/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Tag, Spin } from '@arco-design/web-react';
import { RootState } from '@/store';
import Loading from '@/components/Loading/HorizonLoading';
import { isMobile } from '@/utils/utils';
import { useScene } from '@/lib/useCommon';
import USER_AVATAR from '@/assets/img/userAvatar.png';
import styles from './index.module.less';
import AIAvatarReadying from '@/components/AIAvatarLoading';

function Conversation(props: React.HTMLAttributes<HTMLDivElement> & { showSubtitle?: boolean }) {
  const { className, showSubtitle = true, ...rest } = props;
  const room = useSelector((state: RootState) => state.room);
  const { msgHistory, isFullScreen, isJoined } = room;
  const { userId } = useSelector((state: RootState) => state.room.localUser);
  const { isAITalking, isUserTalking, scene } = useSelector((state: RootState) => state.room);
  const hasMessages = msgHistory.length > 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const { botName, icon, isAvatarScene } = useScene();

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
      style={isAvatarScene && isJoined && !hasMessages ? { justifyContent: 'center' } : {}}
      {...rest}
    >
      {!hasMessages ? (
        <div className={styles.aiReadying}>
          {isJoined ? (
            isAvatarScene ? (
              <AIAvatarReadying />
            ) : (
              <>
                <Spin size={16} className={styles['aiReading-spin']} />
                AI 准备中, 请稍侯
              </>
            )
          ) : (
            <span>选择左侧会话查看历史，或开始文本 / 语音对话</span>
          )}
        </div>
      ) : null}
      {(showSubtitle ? msgHistory : []).map((msg, index) => {
        const { value, user, isInterrupted } = msg;
        const userSide = isUserMsg(msg);
        const robotSide = isRobotMsg(msg);
        if (!userSide && !robotSide) {
          return null;
        }
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
