/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { Message } from '@arco-design/web-react';
import { AIGC_PROXY_HOST } from '@/config';
import { clearAuth, getToken } from '@/utils/authStorage';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const token = getToken();
  const res = await fetch(`${AIGC_PROXY_HOST}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 401) {
    clearAuth();
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
      window.location.href = '/login';
    }
    throw new ApiError(data?.detail || '请先登录', 401);
  }

  if (!res.ok) {
    const detail = data?.detail;
    let msg = `请求失败(${res.status})`;
    if (typeof detail === 'string') {
      msg = detail;
    } else if (Array.isArray(detail) && detail[0]?.msg) {
      msg = detail[0].msg;
    } else if (detail && typeof detail === 'object') {
      try {
        msg = JSON.stringify(detail);
      } catch {
        // keep default
      }
    }
    Message.error(msg);
    throw new ApiError(msg, res.status);
  }

  return data as T;
}
