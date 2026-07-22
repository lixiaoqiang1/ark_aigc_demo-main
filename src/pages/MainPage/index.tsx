/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Header from '@/components/Header';
import ResizeWrapper from '@/components/ResizeWrapper';
import Menu from './Menu';
import { useIsMobile } from '@/utils/utils';
import Apis from '@/app/index';
import MainArea from './MainArea';
import ConversationSidebar from '@/components/ConversationSidebar';
import { ABORT_VISIBILITY_CHANGE, useLeave } from '@/lib/useCommon';
import { useConversationManager } from '@/lib/useConversationManager';
import { usePersistSubtitles } from '@/lib/usePersistSubtitles';
import {
  RTCConfig,
  SceneConfig,
  updateRTCConfig,
  updateScene,
  updateSceneConfig,
} from '@/store/slices/room';
import { setCurrentConversationId, upsertConversation } from '@/store/slices/conversation';
import { ConversationAPI } from '@/app/bizApi';
import styles from './index.module.less';

export default function () {
  const leaveRoom = useLeave();
  const dispatch = useDispatch();
  const { refreshList, loadMessages } = useConversationManager();
  usePersistSubtitles();

  const getScenes = async () => {
    const {
      scenes,
    }: {
      scenes: {
        rtc: RTCConfig;
        scene: SceneConfig;
      }[];
    } = await Apis.Basic.getScenes();
    dispatch(updateScene(scenes[0].scene.id));
    dispatch(
      updateSceneConfig(
        scenes.reduce<Record<string, SceneConfig>>((prev, cur) => {
          prev[cur.scene.id] = cur.scene;
          return prev;
        }, {})
      )
    );
    dispatch(
      updateRTCConfig(
        scenes.reduce<Record<string, RTCConfig>>((prev, cur) => {
          prev[cur.scene.id] = cur.rtc;
          return prev;
        }, {})
      )
    );
  };

  useEffect(() => {
    (async () => {
      try {
        await getScenes();
        const list = await refreshList();
        if (list.length) {
          dispatch(setCurrentConversationId(list[0].id));
          await loadMessages(list[0].id);
        } else {
          const created = await ConversationAPI.create();
          dispatch(upsertConversation(created));
          dispatch(setCurrentConversationId(created.id));
        }
      } catch (e) {
        console.error(e);
      }
    })();

    const isOriginalDemo = window.location.host.startsWith('localhost');
    const handler = () => {
      if (
        document.visibilityState === 'hidden' &&
        !sessionStorage.getItem(ABORT_VISIBILITY_CHANGE)
      ) {
        leaveRoom();
      }
    };
    !isOriginalDemo && document.addEventListener('visibilitychange', handler);
    return () => {
      !isOriginalDemo && document.removeEventListener('visibilitychange', handler);
    };
  }, []);

  return (
    <ResizeWrapper className={styles.container}>
      <Header />
      <div
        className={styles.main}
        style={{
          padding: useIsMobile() ? '' : '24px',
        }}
      >
        {useIsMobile() ? null : <ConversationSidebar />}
        <div className={`${styles.mainArea} ${useIsMobile() ? styles.isMobile : ''}`}>
          <MainArea />
        </div>
        {useIsMobile() ? null : (
          <div className={styles.operationArea}>
            <Menu />
          </div>
        )}
      </div>
    </ResizeWrapper>
  );
}
