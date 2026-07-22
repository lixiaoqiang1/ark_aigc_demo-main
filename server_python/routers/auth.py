# Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
# SPDX-license-identifier: BSD-3-Clause

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth_utils import (
    MIN_PASSWORD_LEN,
    create_access_token,
    get_current_user,
    get_user_by_username,
    hash_password,
    public_user,
    utc_now_iso,
    verify_password,
)
from database import db_cursor

router = APIRouter(prefix='/auth', tags=['auth'])


class RegisterBody(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=MIN_PASSWORD_LEN, max_length=128)


class LoginBody(BaseModel):
    username: str
    password: str


class ChangePasswordBody(BaseModel):
    oldPassword: str
    newPassword: str = Field(min_length=MIN_PASSWORD_LEN, max_length=128)


@router.post('/register')
def register(body: RegisterBody):
    username = body.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail='用户名不能为空')
    if ' ' in username:
        raise HTTPException(status_code=400, detail='用户名不能包含空格')
    if get_user_by_username(username):
        raise HTTPException(status_code=400, detail='用户名已存在')

    now = utc_now_iso()
    user_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute(
            '''
            INSERT INTO users (id, username, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (user_id, username, hash_password(body.password), now, now),
        )

    user = get_user_by_username(username)
    token = create_access_token(user['id'], user['username'])
    return {'token': token, 'user': public_user(user)}


@router.post('/login')
def login(body: LoginBody):
    username = body.username.strip()
    user = get_user_by_username(username)
    if not user or not verify_password(body.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='用户名或密码错误')
    token = create_access_token(user['id'], user['username'])
    return {'token': token, 'user': public_user(user)}


@router.post('/logout')
def logout(_user: dict = Depends(get_current_user)):
    return {'ok': True}


@router.post('/change-password')
def change_password(body: ChangePasswordBody, user: dict = Depends(get_current_user)):
    if not verify_password(body.oldPassword, user['password_hash']):
        raise HTTPException(status_code=400, detail='旧密码错误')
    if body.oldPassword == body.newPassword:
        raise HTTPException(status_code=400, detail='新密码不能与旧密码相同')

    now = utc_now_iso()
    with db_cursor() as cur:
        cur.execute(
            'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
            (hash_password(body.newPassword), now, user['id']),
        )
    return {'ok': True, 'requireRelogin': True}


@router.get('/me')
def me(user: dict = Depends(get_current_user)):
    return {'user': public_user(user)}
