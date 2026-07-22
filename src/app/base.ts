/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { Message } from '@arco-design/web-react';
import { AIGC_PROXY_HOST } from '@/config';
import { clearAuth, getToken } from '@/utils/authStorage';
import type { RequestResponse, ApiConfig, ApiNames, Apis } from './type';

type Headers = Record<string, string>;

const authHeaders = (): Headers => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleUnauthorized = async (res: Response) => {
  if (res.status === 401) {
    clearAuth();
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
      window.location.href = '/login';
    }
    throw new Error('请先登录');
  }
  return res;
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

/**
 * @brief Get
 * @param apiName
 * @param headers
 */
export const requestGetMethod = ({
  action,
  headers = {},
}: {
  action: string;
  headers?: Record<string, string>;
}) => {
  return async (params: Record<string, any> = {}) => {
    const url = `${AIGC_PROXY_HOST}?Action=${action}&${Object.keys(params)
      .map((key) => `${key}=${params[key]}`)
      .join('&')}`;
    const res = await fetch(url, {
      headers: {
        ...authHeaders(),
        ...headers,
      },
    });
    return handleUnauthorized(res);
  };
};

/**
 * @brief Post
 */
export const requestPostMethod = ({
  action,
  apiPath,
  isJson = true,
  headers = {},
}: {
  action: string;
  apiPath: string;
  isJson?: boolean;
  headers?: Headers;
}) => {
  return async <T>(params: T) => {
    const res = await fetch(`${AIGC_PROXY_HOST}${apiPath}?Action=${action}`, {
      method: 'post',
      headers: {
        'content-type': 'application/json',
        ...authHeaders(),
        ...headers,
      },
      body: (isJson ? JSON.stringify(params) : params) as BodyInit,
    });
    return handleUnauthorized(res);
  };
};

/**
 * @brief Return handler
 * @param res
 */
export const resultHandler = (res: RequestResponse) => {
  const { Result, ResponseMetadata } = res || {};
  if (!ResponseMetadata) {
    // 兼容异常响应体
    if (Result !== undefined) return Result;
    throw new Error('服务端响应格式异常');
  }
  // Record request id for debug.
  if (ResponseMetadata.Action === 'StartVoiceChat') {
    const requestId = ResponseMetadata.RequestId;
    requestId && sessionStorage.setItem('RequestID', requestId);
  }
  if (ResponseMetadata.Error) {
    const errMsg =
      ResponseMetadata.Error?.Message ||
      ResponseMetadata.Error?.Code ||
      'unknown error';
    Message.error(`[${ResponseMetadata?.Action}]call failed(reason: ${errMsg})`);
    throw new Error(`[${ResponseMetadata?.Action}] ${errMsg}`);
  }
  if (typeof Result === 'string' && Result !== 'ok') {
    Message.error(`[${ResponseMetadata?.Action}] ${Result}`);
    throw new Error(`[${ResponseMetadata?.Action}] ${Result}`);
  }
  return Result;
};

/**
 * @brief Generate APIs by apiConfigs
 * @param apiConfigs
 */
export const generateAPIs = <T extends readonly ApiConfig[]>(apiConfigs: T) =>
  apiConfigs.reduce<Apis<T>>((store, cur) => {
    const { action, apiPath = '', method = 'get' } = cur;

    const actionKey = action as ApiNames<T>;
    store[actionKey] = async (params) => {
      const queryData =
        method === 'get'
          ? await requestGetMethod({ action })(params)
          : await requestPostMethod({ action, apiPath })(params);
      const res = await queryData?.json();
      return resultHandler(res);
    };
    return store;
  }, {} as Apis<T>);
