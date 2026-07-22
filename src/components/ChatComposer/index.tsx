/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Input, Message, Radio } from '@arco-design/web-react';
import { IconPause } from '@arco-design/web-react/icon';
import { RootState } from '@/store';
import { setChatMode } from '@/store/slices/conversation';
import {
  appendLocalMsg,
  setInterruptMsg,
  updateFullScreen,
  updateShowSubtitle,
} from '@/store/slices/room';
import { useJoin, useLeave, useScene } from '@/lib/useCommon';
import { useConversationManager } from '@/lib/useConversationManager';
import { ChatAPI } from '@/app/bizApi';
import { ApiError } from '@/app/client';
import RtcClient from '@/lib/RtcClient';
import { COMMAND } from '@/utils/handler';
import AudioController from '@/pages/MainPage/MainArea/Room/AudioController';
import InvokeButton from '@/pages/MainPage/MainArea/Antechamber/InvokeButton';
import { isMobile } from '@/utils/utils';
import styles from './index.module.less';

interface Props {
  className?: string;
}

export default function ChatComposer({ className }: Props) {
  const dispatch = useDispatch();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [joining, startJoin] = useJoin();
  const leaveRoom = useLeave();
  const { botName, id: sceneId, isScreenMode, isAvatarScene } = useScene();
  const { chatMode, currentId } = useSelector((s: RootState) => s.conversation);
  const { isJoined, localUser, isAITalking, isAIThinking } = useSelector(
    (s: RootState) => s.room
  );
  const { ensureConversation, persistMessage } = useConversationManager();

  const switchMode = (mode: 'text' | 'voice') => {
    dispatch(setChatMode(mode));
    // 切回文本时退出 RTC，不再需要麦/摄像头/挂断工具栏
    if (mode === 'text' && isJoined) {
      leaveRoom().catch(() => undefined);
    }
  };

  // 文本模式走 HTTP，暂停仅对语音 RTC 有效
  const canPause = Boolean(
    chatMode === 'voice' &&
      isJoined &&
      botName &&
      (isAITalking || isAIThinking || RtcClient.audioBotEnabled)
  );

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
    if (chatMode !== 'voice') {
      Message.info('文本模式暂不支持中途暂停');
      return;
    }
    if (!botName || !RtcClient.audioBotEnabled) {
      Message.warning('当前没有进行中的语音对话');
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

  /** 文本：HTTP 直连方舟，无需进 RTC / 等 Agent */
  const sendText = async () => {
    const content = text.trim();
    if (!content) return;
    if (sending) return;
    if (!sceneId) {
      Message.error('场景未加载完成，请刷新后重试');
      return;
    }

    setSending(true);
    setText('');
    try {
      const conversationId = await ensureConversation();
      dispatch(updateShowSubtitle({ isShowSubtitle: true }));

      const userId = localUser.userId || 'user';
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

      const { reply } = await ChatAPI.send({
        SceneID: sceneId,
        conversation_id: conversationId,
        message: content,
      });

      dispatch(
        appendLocalMsg({
          value: reply,
          time: new Date().toISOString(),
          user: botName || 'assistant',
          paragraph: true,
          definite: true,
          source: 'text',
          role: 'assistant',
        })
      );
      await persistMessage({
        role: 'assistant',
        content: reply,
        source: 'text',
        key: `assistant:text:${reply}:${Date.now()}`,
      });
    } catch (e: any) {
      setText(content);
      if (!(e instanceof ApiError)) {
        Message.error(e?.message || '发送失败');
      }
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
          onChange={(v) => switchMode(v)}
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
            <Button type="primary" loading={sending} onClick={sendText}>
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
