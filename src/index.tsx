/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { Message } from '@arco-design/web-react';
import App from './App';
import store from './store';
import './index.less';

// RTC SDK 等常以普通对象 reject，统一转成可读错误，避免 CRA 红屏 `[object Object]`
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason && typeof reason === 'object' && !(reason instanceof Error)) {
    event.preventDefault();
    const msg =
      (typeof (reason as any).message === 'string' && (reason as any).message) ||
      (typeof (reason as any).Message === 'string' && (reason as any).Message) ||
      (() => {
        try {
          return JSON.stringify(reason);
        } catch {
          return '未知错误';
        }
      })();
    console.warn('[unhandledrejection]', reason);
    Message.error(msg);
  }
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
