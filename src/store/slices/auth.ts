/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthUser, clearAuth, getStoredUser, getToken, setAuth } from '@/utils/authStorage';

export interface AuthState {
  token: string;
  user: AuthUser | null;
}

const initialState: AuthState = {
  token: getToken(),
  user: getStoredUser(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ token: string; user: AuthUser }>
    ) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      setAuth(action.payload.token, action.payload.user);
    },
    logout: (state) => {
      state.token = '';
      state.user = null;
      clearAuth();
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
