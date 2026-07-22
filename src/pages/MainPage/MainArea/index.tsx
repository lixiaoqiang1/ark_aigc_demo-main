/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { useSelector } from 'react-redux';
import Conversation from './Room/Conversation';
import ToolBar from './Room/ToolBar';
import CameraArea from './Room/CameraArea';
import ChatComposer from '@/components/ChatComposer';
import AiAvatarCard from '@/components/AiAvatarCard';
import { RootState } from '@/store';
import { useScene } from '@/lib/useCommon';
import { isMobile } from '@/utils/utils';
import roomStyle from './Room/index.module.less';
import styles from './mainArea.module.less';

/**
 * 右侧主区域：始终展示会话历史；底部仅按「文本/语音」互斥显示输入框或语音按钮。
 * 文本模式不展示语音 ToolBar / 摄像头等 RTC 控件。
 */
function MainArea() {
  const { isJoined, isShowSubtitle, isFullScreen } = useSelector((s: RootState) => s.room);
  const { chatMode } = useSelector((s: RootState) => s.conversation);
  const { isAvatarScene } = useScene();
  const isVoiceJoined = chatMode === 'voice' && isJoined;

  return (
    <div
      className={`${roomStyle.wrapper} ${styles.panel} ${isMobile() ? roomStyle.mobile : ''}`}
    >
      {isVoiceJoined && !isMobile() && (isFullScreen || isAvatarScene)
        ? null
        : !isMobile() && chatMode === 'voice' && (
            <AiAvatarCard
              showUserTag={!isShowSubtitle}
              showStatus={isJoined}
              className={isShowSubtitle ? roomStyle.subtitleAiAvatar : ''}
            />
          )}
      {isVoiceJoined && !isMobile() ? <CameraArea /> : null}
      {isVoiceJoined && isMobile() ? (
        <div className={roomStyle.mobilePlayer} id="mobile-local-player" />
      ) : null}

      <Conversation className={`${roomStyle.conversation} ${styles.conversation}`} showSubtitle />

      {isVoiceJoined ? <ToolBar className={roomStyle.toolBar} /> : null}

      <div className={styles.composerDock}>
        <ChatComposer />
      </div>

      <div className={roomStyle.declare}>AI生成内容由大模型生成，不能完全保障真实</div>
    </div>
  );
}

export default MainArea;
