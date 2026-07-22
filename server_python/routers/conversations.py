# Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
# SPDX-license-identifier: BSD-3-Clause

import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth_utils import get_current_user, utc_now_iso
from database import db_cursor

router = APIRouter(tags=['conversations'])


class CreateConversationBody(BaseModel):
    title: Optional[str] = None


class PatchConversationBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class CreateMessageBody(BaseModel):
    role: Literal['user', 'assistant']
    content: str = Field(min_length=1)
    source: Literal['voice', 'text'] = 'text'


def _get_owned_conversation(conversation_id: str, user_id: str) -> dict:
    with db_cursor() as cur:
        cur.execute(
            '''
            SELECT id, user_id, title, created_at, updated_at
            FROM conversations WHERE id = ? AND user_id = ?
            ''',
            (conversation_id, user_id),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='会话不存在')
    return dict(row)


def _serialize_conversation(row: dict) -> dict:
    return {
        'id': row['id'],
        'title': row['title'],
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }


def _serialize_message(row: dict) -> dict:
    return {
        'id': row['id'],
        'conversation_id': row['conversation_id'],
        'role': row['role'],
        'content': row['content'],
        'source': row['source'],
        'created_at': row['created_at'],
    }


@router.get('/conversations')
def list_conversations(user: dict = Depends(get_current_user)):
    with db_cursor() as cur:
        cur.execute(
            '''
            SELECT id, user_id, title, created_at, updated_at
            FROM conversations
            WHERE user_id = ?
            ORDER BY updated_at DESC
            ''',
            (user['id'],),
        )
        rows = cur.fetchall()
    return {'conversations': [_serialize_conversation(dict(r)) for r in rows]}


@router.post('/conversations')
def create_conversation(body: CreateConversationBody, user: dict = Depends(get_current_user)):
    now = utc_now_iso()
    conv_id = str(uuid.uuid4())
    title = (body.title or '新会话').strip() or '新会话'
    with db_cursor() as cur:
        cur.execute(
            '''
            INSERT INTO conversations (id, user_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (conv_id, user['id'], title, now, now),
        )
    return _serialize_conversation(
        {'id': conv_id, 'title': title, 'created_at': now, 'updated_at': now}
    )


@router.get('/conversations/{conversation_id}')
def get_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    return _serialize_conversation(_get_owned_conversation(conversation_id, user['id']))


@router.patch('/conversations/{conversation_id}')
def patch_conversation(
    conversation_id: str,
    body: PatchConversationBody,
    user: dict = Depends(get_current_user),
):
    _get_owned_conversation(conversation_id, user['id'])
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail='标题不能为空')
    now = utc_now_iso()
    with db_cursor() as cur:
        cur.execute(
            'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
            (title, now, conversation_id),
        )
    return _serialize_conversation(_get_owned_conversation(conversation_id, user['id']))


@router.delete('/conversations/{conversation_id}')
def delete_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    _get_owned_conversation(conversation_id, user['id'])
    with db_cursor() as cur:
        cur.execute('DELETE FROM messages WHERE conversation_id = ?', (conversation_id,))
        cur.execute('DELETE FROM conversations WHERE id = ?', (conversation_id,))
    return {'ok': True}


@router.get('/conversations/{conversation_id}/messages')
def list_messages(conversation_id: str, user: dict = Depends(get_current_user)):
    _get_owned_conversation(conversation_id, user['id'])
    with db_cursor() as cur:
        cur.execute(
            '''
            SELECT id, conversation_id, role, content, source, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            ''',
            (conversation_id,),
        )
        rows = cur.fetchall()
    return {'messages': [_serialize_message(dict(r)) for r in rows]}


@router.post('/conversations/{conversation_id}/messages')
def create_message(
    conversation_id: str,
    body: CreateMessageBody,
    user: dict = Depends(get_current_user),
):
    conv = _get_owned_conversation(conversation_id, user['id'])
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail='消息内容不能为空')

    now = utc_now_iso()
    msg_id = str(uuid.uuid4())
    new_title = None
    with db_cursor() as cur:
        cur.execute(
            'SELECT COUNT(1) AS cnt FROM messages WHERE conversation_id = ?',
            (conversation_id,),
        )
        count = cur.fetchone()['cnt']
        cur.execute(
            '''
            INSERT INTO messages (id, conversation_id, role, content, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (msg_id, conversation_id, body.role, content, body.source, now),
        )
        # 首条用户消息自动生成标题
        if count == 0 and body.role == 'user' and conv['title'] in ('新会话', ''):
            new_title = content[:20]
            cur.execute(
                'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
                (new_title, now, conversation_id),
            )
        else:
            cur.execute(
                'UPDATE conversations SET updated_at = ? WHERE id = ?',
                (now, conversation_id),
            )

    result = {
        'id': msg_id,
        'conversation_id': conversation_id,
        'role': body.role,
        'content': content,
        'source': body.source,
        'created_at': now,
    }
    if new_title:
        result['conversation_title'] = new_title
    return result
