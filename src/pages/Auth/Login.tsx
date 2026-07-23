/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { Form, Input, Button, Message, Card } from '@arco-design/web-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { LogIn, Phone, Lock } from 'lucide-react';
import { AuthAPI } from '@/app/bizApi';
import { setCredentials } from '@/store/slices/auth';
import styles from './auth.module.less';

export default function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  const onSubmit = async () => {
    try {
      const values = await form.validate();
      const res = await AuthAPI.login(values.phone.trim().replace(/\s/g, ''), values.password);
      dispatch(setCredentials(res));
      Message.success('登录成功');
      navigate('/', { replace: true });
    } catch {
      // 业务错误已由 apiRequest / 表单校验提示
    }
  };

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    form.setFieldValue('phone', cleaned);
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.cardInner}>
          <div className={styles.logoArea}>
            <div className={styles.logoIcon}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="url(#loginGrad)" />
                <path d="M12 20l5 5 11-10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="loginGrad" x1="0" y1="0" x2="40" y2="40">
                    <stop stopColor="#6366f1" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2 className={styles.title}>欢迎回来</h2>
            <p className={styles.subtitle}>登录您的账号以继续</p>
          </div>
          <Form form={form} layout="vertical" onSubmit={onSubmit} className={styles.form}>
            <Form.Item
              label="手机号"
              field="phone"
              rules={[
                { required: true, message: '请输入手机号' },
                { match: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input
                placeholder="请输入手机号"
                prefix={<Phone size={16} />}
                className={styles.input}
                maxLength={11}
                onChange={handlePhoneChange}
              />
            </Form.Item>
            <Form.Item
              label="密码"
              field="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                placeholder="请输入密码"
                prefix={<Lock size={16} />}
                className={styles.input}
              />
            </Form.Item>
            <Button long type="primary" htmlType="submit" className={styles.submitBtn}>
              <LogIn size={16} style={{ marginRight: 6 }} />
              登录
            </Button>
          </Form>
          <div className={styles.footer}>
            还没有账号？<Link to="/register">去注册</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
