/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */

import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Input,
  List,
  Modal,
  Typography,
  Message,
} from '@arco-design/web-react';
import {
  IconDelete,
  IconEdit,
  IconPlus,
} from '@arco-design/web-react/icon';
import { RootState } from '@/store';
import { useConversationManager } from '@/lib/useConversationManager';
import styles from './index.module.less';

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export default function ConversationSidebar() {
  const { list, currentId } = useSelector((s: RootState) => s.conversation);
  const {
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
  } = useConversationManager();
  const [renameId, setRenameId] = useState('');
  const [title, setTitle] = useState('');

  const openRename = (id: string, currentTitle: string) => {
    setRenameId(id);
    setTitle(currentTitle);
  };

  const submitRename = async () => {
    if (!title.trim()) {
      Message.warning('标题不能为空');
      return;
    }
    await renameConversation(renameId, title.trim());
    setRenameId('');
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <Typography.Text bold>会话</Typography.Text>
        <Button
          type="primary"
          size="mini"
          icon={<IconPlus />}
          onClick={() => createConversation()}
        >
          新建
        </Button>
      </div>
      <List
        className={styles.list}
        bordered={false}
        dataSource={list}
        noDataElement={<div className={styles.empty}>暂无会话，点击新建</div>}
        render={(item) => (
          <List.Item
            key={item.id}
            className={`${styles.item} ${item.id === currentId ? styles.active : ''}`}
            onClick={() => switchConversation(item.id)}
            actions={[
              <Button
                key="edit"
                type="text"
                size="mini"
                icon={<IconEdit />}
                onClick={(e) => {
                  e.stopPropagation();
                  openRename(item.id, item.title);
                }}
              />,
              <Button
                key="del"
                type="text"
                size="mini"
                status="danger"
                icon={<IconDelete />}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(item.id);
                }}
              />,
            ]}
          >
            <div className={styles.title}>{item.title || '新会话'}</div>
            <div className={styles.time}>{formatTime(item.updated_at)}</div>
          </List.Item>
        )}
      />
      <Modal
        title="修改标题"
        visible={Boolean(renameId)}
        onCancel={() => setRenameId('')}
        onOk={submitRename}
      >
        <Input value={title} onChange={setTitle} maxLength={200} />
      </Modal>
    </div>
  );
}
