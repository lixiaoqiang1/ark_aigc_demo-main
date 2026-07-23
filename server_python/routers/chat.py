# Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
# SPDX-license-identifier: BSD-3-Clause

import json, os
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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
            raise HTTPException(status_code=404, detail='Conversation not found')
        cur.execute(
            'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
            (conversation_id,),
        )
        rows = cur.fetchall()
    return [{'role': r['role'], 'content': r['content']} for r in rows][-HISTORY_LIMIT:]


@router.post('/chat')
async def text_chat(body: ChatBody, user: dict = Depends(get_current_user)):
    """SSE streaming text chat to Ark LLM."""
    scene = SCENES.get(body.SceneID)
    if not scene:
        raise HTTPException(status_code=400, detail=f'Scene {body.SceneID} not found')

    voice_chat = scene.get('VoiceChat') or {}
    llm_config = ((voice_chat.get('Config') or {}).get('LLMConfig')) or {}
    endpoint_id = (llm_config.get('EndPointId') or llm_config.get('EndpointId') or '').strip()
    if not endpoint_id:
        raise HTTPException(status_code=400, detail='LLMConfig.EndPointId not configured')

    api_key = _resolve_ark_api_key(llm_config)
    if not api_key:
        raise HTTPException(status_code=400, detail='ARK_API_KEY not configured')

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

    if hist and hist[-1].get('role') == 'user' and hist[-1].get('content') == body.message.strip():
        messages.extend(hist)
    else:
        messages.extend(hist)
        messages.append({'role': 'user', 'content': body.message.strip()})

    payload = {
        'model': endpoint_id,
        'messages': messages,
        'stream': True,
        'temperature': 0.7,
    }

    async def event_stream():
        full_content = ''
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                async with client.stream(
                    'POST',
                    f'{ARK_BASE}/chat/completions',
                    headers={
                        'Authorization': f'Bearer {api_key}',
                        'Content-Type': 'application/json',
                    },
                    json=payload,
                ) as resp:
                    if resp.status_code >= 400:
                        detail = await resp.aread()
                        yield f'data: {json.dumps({"error": f"Ark error {resp.status_code}", "detail": detail.decode(errors="replace")[:500]})}\n\n'
                        return

                    async for line in resp.aiter_lines():
                        if not line.startswith('data: '):
                            continue
                        data_str = line[6:]
                        if data_str.strip() == '[DONE]':
                            break
                        try:
                            chunk = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
                        delta = (
                            chunk.get('choices', [{}])[0]
                            .get('delta', {})
                            .get('content', '')
                        )
                        if delta:
                            full_content += delta
                            yield f'data: {json.dumps({"token": delta})}\n\n'
        except httpx.HTTPError as exc:
            yield f'data: {json.dumps({"error": f"HTTP error: {exc}"})}\n\n'

        yield f'data: {json.dumps({"done": True, "full": full_content, "model": endpoint_id})}\n\n'

    return StreamingResponse(
        event_stream(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )
