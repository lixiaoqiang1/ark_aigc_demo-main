/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { apiRequest } from './client';
import type { AuthUser } from '@/utils/authStorage';

export interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  source: 'voice' | 'text';
  created_at: string;
  conversation_title?: string;
}

export const AuthAPI = {
  register: (username: string, password: string) =>
    apiRequest<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    }),
  login: (username: string, password: string) =>
    apiRequest<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    }),
  logout: () => apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  changePassword: (oldPassword: string, newPassword: string) =>
    apiRequest<{ ok: boolean; requireRelogin?: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
  me: () => apiRequest<{ user: AuthUser }>('/auth/me'),
};

export const ConversationAPI = {
  list: () => apiRequest<{ conversations: ConversationItem[] }>('/conversations'),
  create: (title?: string) =>
    apiRequest<ConversationItem>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  get: (id: string) => apiRequest<ConversationItem>(`/conversations/${id}`),
  rename: (id: string, title: string) =>
    apiRequest<ConversationItem>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`/conversations/${id}`, { method: 'DELETE' }),
  listMessages: (id: string) =>
    apiRequest<{ messages: MessageItem[] }>(`/conversations/${id}/messages`),
  addMessage: (
    id: string,
    payload: { role: 'user' | 'assistant'; content: string; source: 'voice' | 'text' }
  ) =>
    apiRequest<MessageItem>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const ChatAPI = {
  /** 文本直连方舟，无需 RTC */
  send: (payload: {
    SceneID: string;
    conversation_id?: string;
    message: string;
    history?: { role: 'user' | 'assistant' | 'system'; content: string }[];
  }) =>
    apiRequest<{ reply: string; model: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
