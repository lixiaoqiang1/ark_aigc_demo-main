/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { Form, Input, Button, Message, Card } from '@arco-design/web-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
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
      const res = await AuthAPI.login(values.username.trim(), values.password);
      dispatch(setCredentials(res));
      Message.success('登录成功');
      navigate('/', { replace: true });
    } catch {
      // 业务错误已由 apiRequest / 表单校验提示
    }
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card} title="登录">
        <Form form={form} layout="vertical" onSubmit={onSubmit}>
          <Form.Item
            label="用户名"
            field="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item
            label="密码"
            field="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" />
          </Form.Item>
          <Button long type="primary" htmlType="submit">
            登录
          </Button>
        </Form>
        <div className={styles.footer}>
          还没有账号？<Link to="/register">去注册</Link>
        </div>
      </Card>
    </div>
  );
}
