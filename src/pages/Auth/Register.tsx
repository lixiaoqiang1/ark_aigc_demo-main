/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { Form, Input, Button, Message, Card } from '@arco-design/web-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { User, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { AuthAPI } from '@/app/bizApi';
import { setCredentials } from '@/store/slices/auth';
import styles from './auth.module.less';

export default function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    form.setFieldValue('phone', cleaned);
  };

  const onSubmit = async () => {
    try {
      const values = await form.validate();
      if (values.password !== values.confirmPassword) {
        Message.error('两次输入的密码不一致');
        return;
      }
      const phone = values.phone.trim().replace(/\s/g, '');
      const res = await AuthAPI.register(phone, values.password);
      dispatch(setCredentials(res));
      Message.success('注册成功');
      navigate('/', { replace: true });
    } catch {
      // 业务错误已由 apiRequest / 表单校验提示
    }
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.cardInner}>
          <div className={styles.logoArea}>
            <div className={styles.logoIcon}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="url(#regGrad)" />
                <path d="M12 20l5 5 11-10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="40" y2="40">
                    <stop stopColor="#f59e0b" />
                    <stop offset="1" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2 className={styles.title}>创建账号</h2>
            <p className={styles.subtitle}>注册一个新的账号开始使用</p>
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
                prefix={<User size={16} />}
                className={styles.input}
                maxLength={11}
                onChange={handlePhoneChange}
              />
            </Form.Item>
            <Form.Item
              label="密码"
              field="password"
              rules={[
                { required: true, message: '请输入密码' },
                { minLength: 6, message: '至少 6 位' },
              ]}
            >
              <Input.Password
                placeholder="至少 6 位"
                prefix={<Lock size={16} />}
                className={styles.input}
              />
            </Form.Item>
            <Form.Item
              label="确认密码"
              field="confirmPassword"
              rules={[{ required: true, message: '请再次输入密码' }]}
            >
              <Input.Password
                placeholder="再次输入密码"
                prefix={<ShieldCheck size={16} />}
                className={styles.input}
              />
            </Form.Item>
            <Button long type="primary" htmlType="submit" className={styles.submitBtn} style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>
              <UserPlus size={16} style={{ marginRight: 6 }} />
              注册
            </Button>
          </Form>
          <div className={styles.footer}>
            已有账号？<Link to="/login">去登录</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
