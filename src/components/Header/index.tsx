/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { useState } from 'react';
import { Button, Divider, Form, Input, Message, Modal, Popover } from '@arco-design/web-react';
import { IconMenu, IconUser } from '@arco-design/web-react/icon';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import NetworkIndicator from '@/components/NetworkIndicator';
import { useIsMobile } from '@/utils/utils';
import { RootState } from '@/store';
import { logout } from '@/store/slices/auth';
import { resetConversationState } from '@/store/slices/conversation';
import { AuthAPI } from '@/app/bizApi';
import { useLeave } from '@/lib/useCommon';
import Logo from '@/assets/img/Logo.svg';
import styles from './index.module.less';

const Disclaimer = 'https://www.volcengine.com/docs/6348/68916';
const ReversoContext = 'https://www.volcengine.com/docs/6348/68918';
const UserAgreement = 'https://www.volcengine.com/docs/6348/128955';

interface HeaderProps {
  children?: React.ReactNode;
  hide?: boolean;
}

function Header(props: HeaderProps) {
  const { children, hide } = props;
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const leaveRoom = useLeave();
  const [pwdVisible, setPwdVisible] = useState(false);
  const [form] = Form.useForm();

  const MenuProps = [
    {
      name: '免责声明',
      url: Disclaimer,
    },
    {
      name: '隐私政策',
      url: ReversoContext,
    },
    {
      name: '用户协议',
      url: UserAgreement,
    },
  ];

  const handleLogout = async () => {
    try {
      await leaveRoom();
    } catch {
      // ignore
    }
    try {
      await AuthAPI.logout();
    } catch {
      // ignore
    }
    dispatch(logout());
    dispatch(resetConversationState());
    navigate('/login', { replace: true });
  };

  const handleChangePassword = async () => {
    const values = await form.validate();
    await AuthAPI.changePassword(values.oldPassword, values.newPassword);
    Message.success('密码已修改，请重新登录');
    setPwdVisible(false);
    await handleLogout();
  };

  return (
    <div
      className={styles.header}
      style={{
        display: hide ? 'none' : 'flex',
      }}
    >
      <div className={styles['header-logo']}>
        {useIsMobile() ? null : (
          <Popover
            content={
              <div className={styles['menu-wrapper']}>
                {MenuProps.map((menuItem) => (
                  <Button
                    type="text"
                    key={menuItem.name}
                    onClick={() => {
                      window.open(menuItem.url, '_blank');
                    }}
                  >
                    {menuItem.name}
                  </Button>
                ))}
              </div>
            }
          >
            <IconMenu className={styles['header-setting-btn']} />
          </Popover>
        )}
        <img src={Logo} alt="Logo" />
        <Divider type="vertical" />
        <span className={styles['header-logo-text']}>实时对话式 AI 体验馆</span>
        <NetworkIndicator />
      </div>
      {children}
      <div className={styles['header-right']}>
        {useIsMobile() ? null : (
          <>
            <div
              className={styles['header-right-text']}
              onClick={() =>
                window.open('https://www.volcengine.com/product/veRTC/ConversationalAI', '_blank')
              }
            >
              官网链接
            </div>
            <div
              className={styles['header-right-text']}
              onClick={() =>
                window.open(
                  'https://www.volcengine.com/contact/product?t=%E5%AF%B9%E8%AF%9D%E5%BC%8Fai&source=%E4%BA%A7%E5%93%81%E5%92%A8%E8%AF%A2',
                  '_blank'
                )
              }
            >
              联系我们
            </div>
          </>
        )}
        {user ? (
          <Popover
            position="br"
            content={
              <div className={styles['menu-wrapper']}>
                <div className={styles.userName}>{user.username}</div>
                <Button type="text" onClick={() => setPwdVisible(true)}>
                  修改密码
                </Button>
                <Button type="text" status="danger" onClick={handleLogout}>
                  退出登录
                </Button>
              </div>
            }
          >
            <Button type="text" icon={<IconUser />} className={styles.userBtn}>
              {user.username}
            </Button>
          </Popover>
        ) : null}
      </div>
      <Modal
        title="修改密码"
        visible={pwdVisible}
        onCancel={() => setPwdVisible(false)}
        onOk={handleChangePassword}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="旧密码"
            field="oldPassword"
            rules={[{ required: true, message: '请输入旧密码' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="新密码"
            field="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { minLength: 6, message: '至少 6 位' },
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Header;
