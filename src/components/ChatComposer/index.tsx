/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Input, Message, Radio } from '@arco-design/web-react';
import { IconPause } from '@arco-design/web-react/icon';
import store, { RootState } from '@/store';
import { setChatMode } from '@/store/slices/conversation';
import {
  appendLocalMsg,
  setInterruptMsg,
  updateAIGCState,
  updateFullScreen,
  updateShowSubtitle,
} from '@/store/slices/room';
import { useJoin, useScene } from '@/lib/useCommon';
import { useConversationManager } from '@/lib/useConversationManager';
import RtcClient from '@/lib/RtcClient';
import { COMMAND, INTERRUPT_PRIORITY } from '@/utils/handler';
import AudioController from '@/pages/MainPage/MainArea/Room/AudioController';
import InvokeButton from '@/pages/MainPage/MainArea/Antechamber/InvokeButton';
import { isMobile } from '@/utils/utils';
import styles from './index.module.less';

interface Props {
  className?: string;
}

function formatErr(e: any): string {
  if (!e) return '发送失败';
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e?.message === 'string') return e.message;
  if (typeof e?.Message === 'string') return e.Message;
  try {
    return JSON.stringify(e);
  } catch {
    return '发送失败';
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

/** StartVoiceChat 成功后，仍需等待 Agent 真正加入 RTC 房间 */
function waitForAgentReceiver(botName: string, timeoutMs = 20000): Promise<boolean> {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const remotes = store.getState().room.remoteUsers;
      const found = remotes.some(
        (u) =>
          u.userId === botName ||
          u.username === botName ||
          (u.userId || '').includes('voiceChat_')
      );
      if (found) {
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 300);
    };
    tick();
  });
}

export default function ChatComposer({ className }: Props) {
  const dispatch = useDispatch();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [joining, startJoin] = useJoin();
  const { botName, id: sceneId, isScreenMode, isAvatarScene } = useScene();
  const { chatMode, currentId } = useSelector((s: RootState) => s.conversation);
  const { isJoined, localUser, isAITalking, isAIThinking } = useSelector(
    (s: RootState) => s.room
  );
  const { ensureConversation, persistMessage } = useConversationManager();
  const canPause = Boolean(
    isJoined && botName && (isAITalking || isAIThinking || sending || RtcClient.audioBotEnabled)
  );

  // 切换 / 新建会话时清空输入框
  useEffect(() => {
    setText('');
  }, [currentId]);

  const startVoice = async () => {
    if (joining || isJoined) return;
    dispatch(updateFullScreen({ isFullScreen: !isMobile() && !isScreenMode && !isAvatarScene }));
    dispatch(updateShowSubtitle({ isShowSubtitle: true }));
    try {
      await ensureConversation();
      await startJoin();
    } catch {
      // useJoin 内已提示
    }
  };

  const handlePause = () => {
    if (!botName || !RtcClient.audioBotEnabled) {
      Message.warning('当前没有进行中的对话');
      return;
    }
    Promise.resolve(
      RtcClient.commandAgent({
        agentName: botName,
        command: COMMAND.INTERRUPT,
      })
    ).catch(() => undefined);
    dispatch(setInterruptMsg());
    Message.success('已暂停输出');
  };

  const ensureRoomAndAgent = async () => {
    if (!sceneId) {
      throw new Error('场景未加载完成，请刷新后重试');
    }
    if (!isJoined) {
      await startJoin();
    } else if (!RtcClient.audioBotEnabled) {
      await RtcClient.startAgent(sceneId);
      dispatch(updateAIGCState({ isAIGCEnable: true }));
    }

    if (!RtcClient.audioBotEnabled) {
      await new Promise<void>((resolve) => {
        let tries = 0;
        const timer = setInterval(() => {
          tries += 1;
          if (RtcClient.audioBotEnabled || tries >= 20) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    }
    if (!RtcClient.audioBotEnabled) {
      throw new Error('AI 尚未就绪，请稍后再试');
    }
    if (!botName) {
      throw new Error('场景缺少 botName，无法发送文本');
    }

    const ready = await waitForAgentReceiver(botName);
    if (!ready) {
      throw new Error('智能体尚未进入房间，请稍后重试');
    }
  };

  const sendText = async () => {
    const content = text.trim();
    if (!content) return;
    if (sending || joining) return;
    setSending(true);
    // 提交即清空，避免失败后重复堆积；失败时再回填
    setText('');
    try {
      await ensureConversation();
      dispatch(updateShowSubtitle({ isShowSubtitle: true }));
      await ensureRoomAndAgent();

      const userId = localUser.userId || RtcClient.basicInfo?.user_id || 'user';
      dispatch(
        appendLocalMsg({
          value: content,
          time: new Date().toISOString(),
          user: userId,
          paragraph: true,
          definite: true,
          source: 'text',
          role: 'user',
        })
      );
      await persistMessage({
        role: 'user',
        content,
        source: 'text',
        key: `user:text:${content}:${Date.now()}`,
      });

      try {
        await RtcClient.commandAgent({
          agentName: botName,
          command: COMMAND.EXTERNAL_TEXT_TO_LLM,
          interruptMode: INTERRUPT_PRIORITY.HIGH,
          message: content,
        });
      } catch (cmdErr: any) {
        const raw = formatErr(cmdErr);
        // Agent 刚进房偶发无接收方：再等一会重试一次
        if (raw.includes('USER_MESSAGE_NO_RECEIVER') || raw.includes('NO_RECEIVER')) {
          const ok = await waitForAgentReceiver(botName, 10000);
          if (!ok) throw cmdErr;
          await sleep(500);
          await RtcClient.commandAgent({
            agentName: botName,
            command: COMMAND.EXTERNAL_TEXT_TO_LLM,
            interruptMode: INTERRUPT_PRIORITY.HIGH,
            message: content,
          });
        } else {
          throw cmdErr;
        }
      }
    } catch (e: any) {
      setText(content);
      Message.error(formatErr(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`${styles.composer} ${className || ''}`}>
      <div className={styles.modeRow}>
        <Radio.Group
          type="button"
          size="small"
          value={chatMode}
          onChange={(v) => dispatch(setChatMode(v))}
        >
          <Radio value="text">文本</Radio>
          <Radio value="voice">语音</Radio>
        </Radio.Group>
      </div>

      {chatMode === 'text' ? (
        <div className={styles.textPanel}>
          <Input.TextArea
            className={styles.textarea}
            value={text}
            onChange={setText}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            autoSize={{ minRows: 3, maxRows: 8 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
          />
          <div className={styles.actionRow}>
            <Button
              className={styles.pauseBtn}
              icon={<IconPause />}
              disabled={!canPause}
              onClick={handlePause}
            >
              暂停
            </Button>
            <Button type="primary" loading={sending || joining} onClick={sendText}>
              发送
            </Button>
          </div>
        </div>
      ) : isJoined ? (
        <div className={styles.voiceRow}>
          <AudioController />
        </div>
      ) : (
        <div className={styles.voiceStart}>
          <InvokeButton onClick={startVoice} loading={joining} />
        </div>
      )}
    </div>
  );
}
