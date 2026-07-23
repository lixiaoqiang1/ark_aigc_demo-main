import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Input, Message, Radio } from '@arco-design/web-react';
import { Send, Pause, Phone, MessageSquareText } from 'lucide-react';
import { RootState } from '@/store';
import { setChatMode } from '@/store/slices/conversation';
import {
  appendLocalMsg,
  removeEmptyAssistantMsg,
  setInterruptMsg,
  setStreamingAssistantMsg,
  startStreamingAssistant,
  updateFullScreen,
  updateShowSubtitle,
} from '@/store/slices/room';
import { useJoin, useLeave, useScene } from '@/lib/useCommon';
import { useConversationManager } from '@/lib/useConversationManager';
import { ApiError } from '@/app/client';
import RtcClient from '@/lib/RtcClient';
import { COMMAND } from '@/utils/handler';
import AudioController from '@/pages/MainPage/MainArea/Room/AudioController';
import InvokeButton from '@/pages/MainPage/MainArea/Antechamber/InvokeButton';
import { isMobile } from '@/utils/utils';
import { AIGC_PROXY_HOST } from '@/config';
import { getToken } from '@/utils/authStorage';
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
  const abortRef = useRef<AbortController | null>(null);

  const switchMode = (mode: 'text' | 'voice') => {
    dispatch(setChatMode(mode));
    if (mode === 'text' && isJoined) {
      leaveRoom().catch(() => undefined);
    }
  };

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

    const userId = localUser.userId || 'user';

    // 立即追加用户消息
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

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const conversationId = await ensureConversation();
      dispatch(updateShowSubtitle({ isShowSubtitle: true }));

      // 持久化用户消息
      await persistMessage({
        role: 'user',
        content,
        source: 'text',
        key: `user:text:${content}:${Date.now()}`,
      });

      const token = getToken();
      const resp = await fetch(`${AIGC_PROXY_HOST}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          SceneID: sceneId,
          conversation_id: conversationId,
          message: content,
        }),
        signal: abortController.signal,
      });

      if (!resp.ok) {
        let detail = '请求失败';
        try {
          const errData = await resp.json();
          detail = errData.detail || detail;
        } catch {}
        throw new ApiError(detail, resp.status);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new ApiError('无响应体', 0);

      const decoder = new TextDecoder();
      let fullReply = '';
      let buffer = '';

      // eslint-disable-next-line no-await-in-loop
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullReply += data.token;
              if (fullReply.length === data.token.length) {
                // first token: create the AI bubble
                dispatch(startStreamingAssistant({ user: botName || 'assistant' }));
              }
              dispatch(setStreamingAssistantMsg({ value: fullReply }));
            }
            if (data.done) {
              dispatch(
                setStreamingAssistantMsg({
                  value: data.full || fullReply,
                  definite: true,
                  paragraph: true,
                })
              );
            }
            if (data.error) {
              Message.error(data.detail || data.error);
              dispatch(removeEmptyAssistantMsg());
            }
          } catch {}
        }
      }

      // 流结束后持久化完整回复
      if (fullReply) {
        await persistMessage({
          role: 'assistant',
          content: fullReply,
          source: 'text',
          key: `assistant:text:${fullReply}:${Date.now()}`,
        });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      if (!(e instanceof ApiError)) {
        Message.error(e?.message || '发送失败');
      }
      // 移除空的 AI 占位消息
      dispatch(removeEmptyAssistantMsg());
      setText(content);
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  return (
    <div className={`${styles.composer} ${className || ''}`}>
      <div className={styles.modeRow}>
        <Radio.Group type="button" size="small" value={chatMode} onChange={(v) => switchMode(v)}>
          <Radio value="text">
            <MessageSquareText size={14} style={{ marginRight: 4 }} />
            文本
          </Radio>
          <Radio value="voice">
            <Phone size={14} style={{ marginRight: 4 }} />
            语音
          </Radio>
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
              type="text"
              size="small"
              icon={<Pause size={14} />}
              disabled={!canPause}
              onClick={handlePause}
            >
              暂停
            </Button>
            <Button type="primary" loading={sending} onClick={sendText} className={styles.sendBtn}>
              <Send size={14} />
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
