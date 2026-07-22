# Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
# SPDX-license-identifier: BSD-3-Clause

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import db_cursor

JWT_SECRET = os.environ.get('JWT_SECRET', 'ark-aigc-demo-dev-secret-change-me')
JWT_ALG = 'HS256'
JWT_EXPIRE_HOURS = 72
MIN_PASSWORD_LEN = 6

bearer_scheme = HTTPBearer(auto_error=False)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 120000)
    return f'{salt}${digest.hex()}'


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, stored = password_hash.split('$', 1)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 120000)
    return hmac.compare_digest(digest.hex(), stored)


def create_access_token(user_id: str, username: str) -> str:
    payload = {
        'sub': user_id,
        'username': username,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail='无效或过期的登录凭证') from exc


def get_user_by_id(user_id: str) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute(
            'SELECT id, username, password_hash, created_at, updated_at FROM users WHERE id = ?',
            (user_id,),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def get_user_by_username(username: str) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute(
            'SELECT id, username, password_hash, created_at, updated_at FROM users WHERE username = ?',
            (username,),
        )
        row = cur.fetchone()
    return dict(row) if row else None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token = None
    if credentials and credentials.scheme.lower() == 'bearer':
        token = credentials.credentials
    if not token:
        auth = request.headers.get('Authorization') or ''
        if auth.lower().startswith('bearer '):
            token = auth.split(' ', 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail='请先登录')

    payload = decode_token(token)
    user = get_user_by_id(payload.get('sub', ''))
    if not user:
        raise HTTPException(status_code=401, detail='用户不存在或已被删除')
    return user


def public_user(user: dict) -> dict:
    return {
        'id': user['id'],
        'username': user['username'],
        'created_at': user['created_at'],
        'updated_at': user['updated_at'],
    }
