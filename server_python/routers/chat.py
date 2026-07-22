# Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
# SPDX-license-identifier: BSD-3-Clause

import os
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth_utils import get_current_user
from database import db_cursor
from util import read_files

router = APIRouter(tags=['chat'])

SCENES = read_files('./scenes', '.json')
ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3'
HISTORY_LIMIT = 40


class ChatMessage(BaseModel):
    role: Literal['user', 'assistant', 'system']
    content: str


class ChatBody(BaseModel):
    SceneID: str = Field(min_length=1)
    conversation_id: Optional[str] = None
    message: str = Field(min_length=1)
    history: Optional[List[ChatMessage]] = None


def _resolve_ark_api_key(llm_config: dict) -> str:
    return (
        (llm_config.get('ApiKey') or '').strip()
        or os.environ.get('ARK_API_KEY', '').strip()
    )


def _load_history_from_db(conversation_id: str, user_id: str) -> List[dict]:
    with db_cursor() as cur:
        cur.execute(
            'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
            (conversation_id, user_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail='会话不存在')
        cur.execute(
            '''
            SELECT role, content FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            ''',
            (conversation_id,),
        )
        rows = cur.fetchall()
    return [{'role': r['role'], 'content': r['content']} for r in rows][-HISTORY_LIMIT:]


@router.post('/chat')
async def text_chat(body: ChatBody, user: dict = Depends(get_current_user)):
    """文本直连方舟 LLM，无需进入 RTC 房间。"""
    scene = SCENES.get(body.SceneID)
    if not scene:
        raise HTTPException(status_code=400, detail=f'场景 {body.SceneID} 不存在')

    voice_chat = scene.get('VoiceChat') or {}
    llm_config = ((voice_chat.get('Config') or {}).get('LLMConfig')) or {}
    endpoint_id = (llm_config.get('EndPointId') or llm_config.get('EndpointId') or '').strip()
    if not endpoint_id:
        raise HTTPException(status_code=400, detail='场景未配置 LLMConfig.EndPointId')

    api_key = _resolve_ark_api_key(llm_config)
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail='未配置方舟 ApiKey：请在环境变量 ARK_API_KEY 或 LLMConfig.ApiKey 中填写',
        )

    system_messages = llm_config.get('SystemMessages') or []
    messages: List[dict] = []
    for sys_msg in system_messages:
        if isinstance(sys_msg, str) and sys_msg.strip():
            messages.append({'role': 'system', 'content': sys_msg.strip()})

    if body.history is not None:
        hist = [{'role': m.role, 'content': m.content} for m in body.history if m.content.strip()]
    elif body.conversation_id:
        hist = _load_history_from_db(body.conversation_id, user['id'])
    else:
        hist = []

    # history 里可能已含本轮用户消息，避免重复追加
    if hist and hist[-1].get('role') == 'user' and hist[-1].get('content') == body.message.strip():
        messages.extend(hist)
    else:
        messages.extend(hist)
        messages.append({'role': 'user', 'content': body.message.strip()})

    payload = {
        'model': endpoint_id,
        'messages': messages,
        'stream': False,
        'temperature': 0.7,
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f'{ARK_BASE}/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                },
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f'调用方舟失败: {exc}') from exc

    if resp.status_code >= 400:
        detail = resp.text
        try:
            detail = resp.json()
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)

    data = resp.json()
    try:
        content = data['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail='方舟返回格式异常') from exc

    if not content:
        raise HTTPException(status_code=502, detail='模型返回空内容')

    return {
        'reply': content,
        'model': endpoint_id,
    }
