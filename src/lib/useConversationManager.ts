/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Message, Modal } from '@arco-design/web-react';
import { ConversationAPI, MessageItem } from '@/app/bizApi';
import { RootState } from '@/store';
import {
  markPersisted,
  removeConversation,
  setConversations,
  setCurrentConversationId,
  upsertConversation,
} from '@/store/slices/conversation';
import { loadHistoryMsg, Msg } from '@/store/slices/room';
import { useLeave, useScene } from '@/lib/useCommon';

const toMsg = (m: MessageItem, botName: string, userId: string): Msg => ({
  value: m.content,
  time: m.created_at,
  user: m.role === 'assistant' ? botName || 'assistant' : userId || 'user',
  paragraph: true,
  definite: true,
  source: m.source,
  fromHistory: true,
  role: m.role,
});

export function useConversationManager() {
  const dispatch = useDispatch();
  const leaveRoom = useLeave();
  const { botName } = useScene();
  const { currentId, persistedKeys, list } = useSelector((s: RootState) => s.conversation);
  const { isJoined, localUser, sceneConfigMap, scene, msgHistory } = useSelector(
    (s: RootState) => s.room
  );
  const rtcUserId = localUser.userId || '';
  const sceneBot = sceneConfigMap[scene]?.botName || botName || 'assistant';

  const refreshList = useCallback(async () => {
    const { conversations } = await ConversationAPI.list();
    dispatch(setConversations(conversations));
    return conversations;
  }, [dispatch]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      const { messages } = await ConversationAPI.listMessages(conversationId);
      dispatch(
        loadHistoryMsg(
          messages.map((m) => toMsg(m, sceneBot, rtcUserId || 'user'))
        )
      );
      messages.forEach((m) => {
        dispatch(markPersisted(`${m.role}:${m.source}:${m.content}:${m.created_at}`));
      });
    },
    [dispatch, rtcUserId, sceneBot]
  );

  const ensureConversation = useCallback(async () => {
    if (currentId) return currentId;
    const created = await ConversationAPI.create();
    dispatch(upsertConversation(created));
    dispatch(setCurrentConversationId(created.id));
    return created.id;
  }, [currentId, dispatch]);

  const createConversation = useCallback(async () => {
    // 当前已是空会话（无消息）时，不再重复创建
    if (currentId) {
      const current = list.find((c) => c.id === currentId);
      const localEmpty = msgHistory.length === 0;
      if (localEmpty && current) {
        // 再确认服务端也无消息，避免误判
        try {
          const { messages } = await ConversationAPI.listMessages(currentId);
          if (messages.length === 0) {
            dispatch(setCurrentConversationId(currentId));
            dispatch(loadHistoryMsg([]));
            Message.info('当前已是空白会话');
            return current;
          }
        } catch {
          if (localEmpty) {
            Message.info('当前已是空白会话');
            return current;
          }
        }
      }
    }

    if (isJoined) {
      await leaveRoom();
    }
    const created = await ConversationAPI.create();
    dispatch(upsertConversation(created));
    dispatch(setCurrentConversationId(created.id));
    dispatch(loadHistoryMsg([]));
    Message.success('已新建会话');
    return created;
  }, [currentId, dispatch, isJoined, leaveRoom, list, msgHistory.length]);

  const switchConversation = useCallback(
    async (id: string) => {
      if (isJoined && id !== currentId) {
        await leaveRoom();
      }
      dispatch(setCurrentConversationId(id));
      await loadMessages(id);
    },
    [currentId, dispatch, isJoined, leaveRoom, loadMessages]
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const updated = await ConversationAPI.rename(id, title);
      dispatch(upsertConversation(updated));
      Message.success('标题已更新');
    },
    [dispatch]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      Modal.confirm({
        title: '删除会话',
        content: '删除后消息不可恢复，确认删除？',
        onOk: async () => {
          if (isJoined && currentId === id) {
            await leaveRoom();
          }
          await ConversationAPI.remove(id);
          dispatch(removeConversation(id));
          const nextId = list.find((c) => c.id !== id)?.id;
          if (currentId === id) {
            if (nextId) {
              dispatch(setCurrentConversationId(nextId));
              await loadMessages(nextId);
            } else {
              dispatch(setCurrentConversationId(''));
              dispatch(loadHistoryMsg([]));
            }
          }
          Message.success('已删除');
        },
      });
    },
    [currentId, dispatch, isJoined, leaveRoom, list, loadMessages]
  );

  const persistMessage = useCallback(
    async (payload: {
      role: 'user' | 'assistant';
      content: string;
      source: 'voice' | 'text';
      key?: string;
    }) => {
      const content = payload.content.trim();
      if (!content) return null;
      const key =
        payload.key ||
        `${payload.role}:${payload.source}:${content}`;
      if (persistedKeys.includes(key)) return null;
      const conversationId = await ensureConversation();
      const saved = await ConversationAPI.addMessage(conversationId, {
        role: payload.role,
        content,
        source: payload.source,
      });
      dispatch(markPersisted(key));
      if (saved.conversation_title) {
        dispatch(
          upsertConversation({
            id: conversationId,
            title: saved.conversation_title,
            created_at: saved.created_at,
            updated_at: saved.created_at,
          })
        );
      } else {
        const exist = list.find((c) => c.id === conversationId);
        if (exist) {
          dispatch(
            upsertConversation({
              ...exist,
              updated_at: saved.created_at,
            })
          );
        }
      }
      return saved;
    },
    [dispatch, ensureConversation, list, persistedKeys]
  );

  return {
    refreshList,
    loadMessages,
    ensureConversation,
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
    persistMessage,
  };
}
