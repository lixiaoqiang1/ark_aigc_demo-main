/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

const TOKEN_KEY = 'aigc_auth_token';
const USER_KEY = 'aigc_auth_user';

export interface AuthUser {
  id: string;
  username: string;
  created_at?: string;
  updated_at?: string;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

export const setAuth = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export const isLoggedIn = () => Boolean(getToken());
