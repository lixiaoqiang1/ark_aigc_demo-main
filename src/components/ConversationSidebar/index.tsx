import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Input,
  Modal,
  Typography,
  Message,
} from '@arco-design/web-react';
import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react';
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
          icon={<MessageSquarePlus size={14} />}
          onClick={() => createConversation()}
        >
          新建
        </Button>
      </div>
      <div className={styles.list}>
        {list.length === 0 ? (
          <div className={styles.empty}>暂无会话，点击新建</div>
        ) : (
          list.map((item) => (
            <div
              key={item.id}
              className={`${styles.item} ${item.id === currentId ? styles.active : ''}`}
              onClick={() => switchConversation(item.id)}
            >
              <div className={styles.itemRow}>
                <div className={styles.titleWrap}>
                  <div className={styles.title}>{item.title || '新会话'}</div>
                  <div className={styles.time}>{formatTime(item.updated_at)}</div>
                </div>
                <div className={styles.actions}>
                  <span
                    className={styles.actionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      openRename(item.id, item.title);
                    }}
                  >
                    <Pencil size={13} />
                  </span>
                  <span
                    className={styles.actionBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(item.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
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
