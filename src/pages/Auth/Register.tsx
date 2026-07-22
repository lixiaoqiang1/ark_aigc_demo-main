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

export default function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  const onSubmit = async () => {
    try {
      const values = await form.validate();
      if (values.password !== values.confirmPassword) {
        Message.error('两次输入的密码不一致');
        return;
      }
      const username = values.username.trim();
      const res = await AuthAPI.register(username, values.password);
      dispatch(setCredentials(res));
      Message.success('注册成功');
      navigate('/', { replace: true });
    } catch {
      // 业务错误已由 apiRequest / 表单校验提示
    }
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card} title="注册">
        <Form form={form} layout="vertical" onSubmit={onSubmit}>
          <Form.Item
            label="用户名"
            field="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { minLength: 2, message: '至少 2 个字符' },
              {
                validator: (value, cb) => {
                  if (value && /\s/.test(value)) {
                    cb('用户名不能包含空格');
                  } else {
                    cb();
                  }
                },
              },
            ]}
          >
            <Input placeholder="不含空格，如 demo01" />
          </Form.Item>
          <Form.Item
            label="密码"
            field="password"
            rules={[
              { required: true, message: '请输入密码' },
              { minLength: 6, message: '至少 6 位' },
            ]}
          >
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          <Form.Item
            label="确认密码"
            field="confirmPassword"
            rules={[{ required: true, message: '请再次输入密码' }]}
          >
            <Input.Password placeholder="再次输入密码" />
          </Form.Item>
          <Button long type="primary" htmlType="submit">
            注册
          </Button>
        </Form>
        <div className={styles.footer}>
          已有账号？<Link to="/login">去登录</Link>
        </div>
      </Card>
    </div>
  );
}
