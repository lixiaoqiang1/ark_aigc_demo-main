# Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
# SPDX-license-identifier: BSD-3-Clause

import time
import uuid

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from token_builder import AccessToken, PRIVILEGES
from util import assert_val, read_files, response_wrapper, Signer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

SCENES = read_files('./scenes', '.json')
VOLC_HOST = 'rtc.volcengineapi.com'
VOLC_VERSION = '2024-12-01'


@app.post('/proxy')
async def proxy(request: Request):
    """代理 AIGC 的 OpenAPI 请求（对应 Node app.js proxy）"""

    async def logic():
        action = request.query_params.get('Action')
        version = request.query_params.get('Version', VOLC_VERSION)

        try:
            body_data = await request.json()
        except Exception:
            body_data = {}

        assert_val(action, 'Action 不能为空')
        assert_val(version, 'Version 不能为空')

        scene_id = body_data.get('SceneID')
        assert_val(scene_id, 'SceneID 不能为空, SceneID 用于指定场景的 JSON')

        json_data = SCENES.get(scene_id)
        assert_val(
            json_data,
            f'{scene_id} 不存在, 请先在 Server_python/scenes 下定义该场景的 JSON.',
        )

        voice_chat = json_data.get('VoiceChat', {})
        account_config = json_data.get('AccountConfig', {})

        assert_val(account_config.get('accessKeyId'), 'AccountConfig.accessKeyId 不能为空')
        assert_val(account_config.get('secretKey'), 'AccountConfig.secretKey 不能为空')

        request_body = {}
        if action == 'StartVoiceChat':
            request_body = voice_chat
        elif action == 'StopVoiceChat':
            app_id = voice_chat.get('AppId')
            room_id = voice_chat.get('RoomId')
            task_id = voice_chat.get('TaskId')

            assert_val(app_id, 'VoiceChat.AppId 不能为空')
            assert_val(room_id, 'VoiceChat.RoomId 不能为空')
            assert_val(task_id, 'VoiceChat.TaskId 不能为空')

            request_body = {
                'AppId': app_id,
                'RoomId': room_id,
                'TaskId': task_id,
            }

        open_api_request_data = {
            'method': 'POST',
            'path': '/',
            'params': {'Action': action, 'Version': version},
            'headers': {
                'Host': VOLC_HOST,
                'Content-Type': 'application/json',
            },
            'body': request_body,
        }

        signer = Signer(open_api_request_data, 'rtc')
        signer.add_authorization(account_config)
        body_str = signer.body_json()

        url = f'https://{VOLC_HOST}?Action={action}&Version={version}'
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                headers=open_api_request_data['headers'],
                content=body_str.encode('utf-8'),
                timeout=30.0,
            )
            return resp.json()

    return await response_wrapper('proxy', logic, contain_metadata=False)


@app.post('/getScenes')
async def get_scenes(_request: Request):
    """获取场景列表并自动生成 Token（对应 Node app.js getScenes）"""

    async def logic():
        result_scenes = []

        for key, data in SCENES.items():
            scene_config = data.get('SceneConfig', {})
            rtc_config = data.get('RTCConfig', {})
            voice_chat = data.get('VoiceChat', {})

            app_id = rtc_config.get('AppId')
            room_id = rtc_config.get('RoomId')
            user_id = rtc_config.get('UserId')
            token = rtc_config.get('Token')
            app_key = rtc_config.get('AppKey')

            assert_val(app_id, f'{key} 场景的 RTCConfig.AppId 不能为空')

            if app_id and (not token or not user_id or not room_id):
                rtc_config['RoomId'] = voice_chat['RoomId'] = room_id or str(uuid.uuid4())
                rtc_config['UserId'] = voice_chat['AgentConfig']['TargetUserId'][0] = (
                    user_id or str(uuid.uuid4())
                )

                assert_val(app_key, f'自动生成 Token 时, {key} 场景的 AppKey 不可为空')

                token_builder = AccessToken(
                    app_id, app_key, rtc_config['RoomId'], rtc_config['UserId']
                )
                token_builder.add_privilege(PRIVILEGES['PrivSubscribeStream'], 0)
                token_builder.add_privilege(PRIVILEGES['PrivPublishStream'], 0)
                token_builder.expire_time(int(time.time()) + 24 * 3600)
                rtc_config['Token'] = token_builder.serialize()

            scene_config['id'] = key
            scene_config['botName'] = (voice_chat.get('AgentConfig') or {}).get('UserId')
            scene_config['isInterruptMode'] = (
                (voice_chat.get('Config') or {}).get('InterruptMode') == 0
            )

            llm_config = (voice_chat.get('Config') or {}).get('LLMConfig') or {}
            vision_config = llm_config.get('VisionConfig') or {}
            scene_config['isVision'] = vision_config.get('Enable')
            scene_config['isScreenMode'] = (
                (vision_config.get('SnapshotConfig') or {}).get('StreamType') == 1
            )

            avatar_config = (voice_chat.get('Config') or {}).get('AvatarConfig') or {}
            scene_config['isAvatarScene'] = avatar_config.get('Enabled')
            scene_config['avatarBgUrl'] = avatar_config.get('BackgroundUrl')

            # 与 Node 一致：从返回给前端的配置中移除 AppKey
            rtc_config.pop('AppKey', None)

            result_scenes.append({
                'scene': scene_config or {},
                'rtc': rtc_config,
            })

        return {'scenes': result_scenes}

    return await response_wrapper('getScenes', logic)


if __name__ == '__main__':
    print('AIGC Server is running at http://localhost:3001')
    uvicorn.run('main:app', host='0.0.0.0', port=3001, reload=True)
