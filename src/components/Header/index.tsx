/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { useState } from 'react';
import { Button, Divider, Form, Input, Message, Modal, Popover } from '@arco-design/web-react';
import { Menu, ExternalLink, User, KeyRound, LogOut, ChevronDown, FileText } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/utils/utils';
import { RootState } from '@/store';
import { logout } from '@/store/slices/auth';
import { resetConversationState } from '@/store/slices/conversation';
import { AuthAPI } from '@/app/bizApi';
import NetworkIndicator from '@/components/NetworkIndicator';
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
  const [userPopVisible, setUserPopVisible] = useState(false);

  const menuItems = [
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

  const userPopContent = (
    <div className={styles.userPopover}>
      <div className={styles.userPopHeader}>
        <div className={styles.userPopAvatar}>
          <User size={20} />
        </div>
        <div className={styles.userPopInfo}>
          <div className={styles.userPopName}>{user?.username || '未登录'}</div>
          <div className={styles.userPopId}>ID: {user?.id || '-'}</div>
        </div>
      </div>
      <div className={styles.userPopBody}>
        {user?.created_at && (
          <div className={styles.userPopMeta}>
            <span className={styles.userPopMetaLabel}>注册时间</span>
            <span className={styles.userPopMetaValue}>
              {new Date(user.created_at).toLocaleDateString('zh-CN')}
            </span>
          </div>
        )}
      </div>
      <div className={styles.userPopDivider} />
      <div className={styles.userPopActions}>
        <div
          className={styles.userPopAction}
          onClick={() => {
            setUserPopVisible(false);
            setPwdVisible(true);
          }}
        >
          <KeyRound size={15} />
          修改密码
        </div>
        <div
          className={styles.userPopAction}
          onClick={() => {
            setUserPopVisible(false);
            window.open('https://www.volcengine.com/docs/6348/68916', '_blank');
          }}
        >
          <FileText size={15} />
          使用文档
        </div>
        <div className={styles.userPopDivider} />
        <div
          className={`${styles.userPopAction} ${styles.userPopDanger}`}
          onClick={() => {
            setUserPopVisible(false);
            handleLogout();
          }}
        >
          <LogOut size={15} />
          退出登录
        </div>
      </div>
    </div>
  );

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
                {menuItems.map((menuItem) => (
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
            <Menu className={styles['header-setting-btn']} size={18} />
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
              <ExternalLink size={13} style={{ marginRight: 3 }} />
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
            trigger="hover"
            popupVisible={userPopVisible}
            onVisibleChange={setUserPopVisible}
            content={userPopContent}
          >
            <div className={styles.userBtn}>
              <div className={styles.userBtnAvatar}>
                <User size={16} />
              </div>
              <span className={styles.userBtnName}>{user.username}</span>
              <ChevronDown
                size={14}
                className={styles.userBtnArrow}
                style={{ transform: userPopVisible ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
              />
            </div>
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
