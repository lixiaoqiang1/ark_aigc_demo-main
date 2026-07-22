# Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
# SPDX-license-identifier: BSD-3-Clause

import os
import json
import hashlib
import hmac
import datetime
from fastapi.responses import JSONResponse


class Signer:
    """火山 OpenAPI HMAC 签名（对应 Node 的 @volcengine/openapi Signer）"""

    def __init__(self, request_data, service, region='cn-north-1'):
        self.method = request_data.get('method', 'POST').upper()
        self.path = request_data.get('path', '/')
        self.params = request_data.get('params', {})
        self.headers = request_data.get('headers', {})
        self.body = request_data.get('body', {})
        self.service = service
        self.region = region

    def add_authorization(self, account_config):
        ak = account_config.get('accessKeyId')
        sk = account_config.get('secretKey')
        if not ak or not sk:
            return

        now = datetime.datetime.utcnow()
        date = now.strftime('%Y%m%d')
        ts = now.strftime('%Y%m%dT%H%M%SZ')
        self.headers['X-Date'] = ts

        body_str = self.body_json()
        body_hash = hashlib.sha256(body_str.encode('utf-8')).hexdigest()
        self.headers['X-Content-Sha256'] = body_hash

        signed_headers = sorted(
            k.lower()
            for k in self.headers.keys()
            if k.lower() in ['content-type', 'host', 'x-content-sha256', 'x-date']
        )
        canonical_headers = ''.join(
            f"{k}:{self.headers.get(_key_map(k, self.headers)).strip()}\n"
            for k in signed_headers
        )
        signed_headers_str = ';'.join(signed_headers)
        query_str = '&'.join(f'{k}={v}' for k, v in sorted(self.params.items()))

        canonical_request = (
            f'{self.method}\n{self.path}\n{query_str}\n'
            f'{canonical_headers}\n{signed_headers_str}\n{body_hash}'
        )

        credential_scope = f'{date}/{self.region}/{self.service}/request'
        string_to_sign = (
            f'HMAC-SHA256\n{ts}\n{credential_scope}\n'
            f'{hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()}'
        )

        k_date = _hmac_sha256(sk.encode('utf-8'), date)
        k_region = _hmac_sha256(k_date, self.region)
        k_service = _hmac_sha256(k_region, self.service)
        k_signing = _hmac_sha256(k_service, 'request')
        signature = hmac.new(k_signing, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

        self.headers['Authorization'] = (
            f'HMAC-SHA256 Credential={ak}/{credential_scope}, '
            f'SignedHeaders={signed_headers_str}, Signature={signature}'
        )

    def body_json(self):
        if not self.body:
            return ''
        # 与 Node JSON.stringify 保持一致：无空格
        return json.dumps(self.body, separators=(',', ':'), ensure_ascii=False)


def _hmac_sha256(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()


def _key_map(lower_key, headers):
    for k in headers.keys():
        if k.lower() == lower_key:
            return k
    return lower_key


def read_files(directory, suffix='.json'):
    """读取目录下所有指定后缀文件，对应 Node util.readFiles"""
    scenes = {}
    abs_dir = os.path.join(os.path.dirname(__file__), directory)
    if not os.path.exists(abs_dir):
        return scenes

    for filename in os.listdir(abs_dir):
        if not filename.endswith(suffix):
            continue
        filepath = os.path.join(abs_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                key = filename.replace(suffix, '')
                scenes[key] = data
        except Exception as e:
            print(f'Error reading {filename}: {e}')
    return scenes


async def response_wrapper(api_name, logic_func, contain_metadata=True):
    """统一响应封装，对应 Node util.wrapper"""
    response_metadata = {'Action': api_name}
    try:
        res = await logic_func()
        if contain_metadata:
            return {'ResponseMetadata': response_metadata, 'Result': res}
        return res
    except Exception as e:
        print(f'\x1b[31mError in {api_name}: {e}\x1b[0m')
        response_metadata['Error'] = {'Code': -1, 'Message': str(e)}
        return JSONResponse(content={'ResponseMetadata': response_metadata})


def assert_val(expression, msg):
    """对应 Node util.assert：空值或含空格字符串视为校验失败"""
    if not expression or (isinstance(expression, str) and ' ' in expression):
        print(f'\x1b[31m校验失败: {msg}\x1b[0m')
        raise ValueError(msg)
