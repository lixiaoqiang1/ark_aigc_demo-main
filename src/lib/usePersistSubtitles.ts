/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { useConversationManager } from '@/lib/useConversationManager';
import { useScene } from '@/lib/useCommon';

/**
 * 将已完成的字幕消息落库（语音 / 助手回复）
 */
export function usePersistSubtitles() {
  const { msgHistory } = useSelector((s: RootState) => s.room);
  const { currentId, chatMode } = useSelector((s: RootState) => s.conversation);
  const { botName } = useScene();
  const { persistMessage } = useConversationManager();
  const lastLen = useRef(0);

  useEffect(() => {
    if (!currentId && msgHistory.length === 0) return;
    // 仅处理新增的完整消息
    const slice = msgHistory.slice(Math.max(0, lastLen.current - 1));
    lastLen.current = msgHistory.length;

    slice.forEach((msg) => {
      if (msg.fromHistory) return;
      const completed = Boolean(msg.paragraph || msg.definite);
      if (!completed || !msg.value?.trim()) return;

      const fromBot =
        msg.user === botName || (msg.user || '').includes('voiceChat_');
      const role = fromBot ? 'assistant' : 'user';
      const source = msg.source || (chatMode === 'text' && !fromBot ? 'text' : 'voice');
      // 文本模式下用户消息已在发送时落库
      if (role === 'user' && source === 'text') return;

      persistMessage({
        role,
        content: msg.value,
        source: source as 'voice' | 'text',
        key: `${role}:${source}:${msg.value}:${msg.time}`,
      }).catch(() => undefined);
    });
  }, [botName, chatMode, currentId, msgHistory, persistMessage]);
}
