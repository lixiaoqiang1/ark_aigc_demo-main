import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Tag } from '@arco-design/web-react';
import { MessageSquareText } from 'lucide-react';
import { RootState } from '@/store';
import Loading from '@/components/Loading/HorizonLoading';
import { isMobile } from '@/utils/utils';
import { useScene } from '@/lib/useCommon';
import USER_AVATAR from '@/assets/img/userAvatar.png';
import styles from './index.module.less';

function Conversation(props: React.HTMLAttributes<HTMLDivElement> & { showSubtitle?: boolean }) {
  const { className, showSubtitle = true, ...rest } = props;
  const room = useSelector((state: RootState) => state.room);
  const { msgHistory, isFullScreen, isJoined } = room;
  const { userId } = useSelector((state: RootState) => state.room.localUser);
  const { isAITalking, isUserTalking, scene } = useSelector((state: RootState) => state.room);
  const hasMessages = msgHistory.length > 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const { botName, icon } = useScene();

  const isUserMsg = (msg: (typeof msgHistory)[0]) => {
    if (msg.role === 'user') return true;
    if (msg.role === 'assistant') return false;
    if (userId && msg.user === userId) return true;
    if (msg.user === 'user') return true;
    return false;
  };

  const isRobotMsg = (msg: (typeof msgHistory)[0]) => {
    if (msg.role === 'assistant') return true;
    if (msg.role === 'user') return false;
    return msg.user === botName || (msg.user || '').includes('voiceChat_') || msg.user === 'assistant';
  };

  const isUserTextLoading = (owner: string) => owner === userId && isUserTalking;
  const isAITextLoading = (owner: string) =>
    (owner === botName || (owner || '').includes('voiceChat_')) && isAITalking;

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight - container.clientHeight;
    }
  }, [msgHistory.length]);

  return (
    <div
      ref={containerRef}
      className={`${styles.conversation} ${className} ${isFullScreen ? styles.fullScreen : ''} ${
        isMobile() ? styles.mobileConversation : ''
      }`}
      {...rest}
    >
      {!hasMessages && !isJoined ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '80%',
          gap: 16,
          color: '#86909c',
        }}>
          <MessageSquareText size={48} strokeWidth={1.5} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1d2129' }}>开始新的对话</div>
          <div style={{ fontSize: 13, color: '#86909c', textAlign: 'center', lineHeight: 1.6 }}>
            输入消息或点击语音按钮开始与 AI 对话
          </div>
        </div>
      ) : null}
      {(showSubtitle ? msgHistory : []).map((msg, index) => {
        const { value, user, isInterrupted } = msg;
        const userSide = isUserMsg(msg);
        const robotSide = isRobotMsg(msg);
        if (!userSide && !robotSide) return null;
        return (
          <div
            key={`msg-container-${index}`}
            className={styles.mobileLine}
            style={{ justifyContent: userSide && isMobile() ? 'flex-end' : '' }}
          >
            {!isMobile() && (
              <div className={styles.msgName}>
                <div className={styles.avatar}>
                  <img src={userSide ? USER_AVATAR : icon} alt="Avatar" />
                </div>
                {userSide ? '我' : scene || '助手'}
              </div>
            )}
            <div className={`${styles.sentence} ${userSide ? styles.user : styles.robot}`}>
              <div className={styles.content}>
                {value}
                <div className={styles['loading-wrapper']}>
                  {hasMessages &&
                  (isUserTextLoading(user) || isAITextLoading(user)) &&
                  index === msgHistory.length - 1 ? (
                    <Loading gap={3} className={styles.loading} dotClassName={styles.dot} />
                  ) : null}
                </div>
              </div>
              {!userSide && isInterrupted ? <Tag className={styles.interruptTag}>已打断</Tag> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Conversation;
