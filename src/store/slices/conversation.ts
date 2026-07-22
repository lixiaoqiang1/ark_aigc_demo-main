/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ConversationItem } from '@/app/bizApi';

export type ChatMode = 'text' | 'voice';

export interface ConversationState {
  list: ConversationItem[];
  currentId: string;
  chatMode: ChatMode;
  /** 已落库消息指纹，避免重复写入 */
  persistedKeys: string[];
}

const initialState: ConversationState = {
  list: [],
  currentId: '',
  chatMode: 'text',
  persistedKeys: [],
};

const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    setConversations: (state, action: PayloadAction<ConversationItem[]>) => {
      state.list = action.payload;
    },
    upsertConversation: (state, action: PayloadAction<ConversationItem>) => {
      const idx = state.list.findIndex((c) => c.id === action.payload.id);
      if (idx >= 0) {
        state.list[idx] = action.payload;
      } else {
        state.list.unshift(action.payload);
      }
      state.list.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    },
    removeConversation: (state, action: PayloadAction<string>) => {
      state.list = state.list.filter((c) => c.id !== action.payload);
      if (state.currentId === action.payload) {
        state.currentId = state.list[0]?.id || '';
      }
    },
    setCurrentConversationId: (state, action: PayloadAction<string>) => {
      state.currentId = action.payload;
      state.persistedKeys = [];
    },
    setChatMode: (state, action: PayloadAction<ChatMode>) => {
      state.chatMode = action.payload;
    },
    markPersisted: (state, action: PayloadAction<string>) => {
      if (!state.persistedKeys.includes(action.payload)) {
        state.persistedKeys.push(action.payload);
      }
    },
    resetPersisted: (state) => {
      state.persistedKeys = [];
    },
    resetConversationState: () => initialState,
  },
});

export const {
  setConversations,
  upsertConversation,
  removeConversation,
  setCurrentConversationId,
  setChatMode,
  markPersisted,
  resetPersisted,
  resetConversationState,
} = conversationSlice.actions;

export default conversationSlice.reducer;
