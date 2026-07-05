# Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
# SPDX-license-identifier: BSD-3-Clause

import copy
import time
import uuid

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from token_builder import AccessToken, PRIVILEGES
from util import (
    assert_speech_app_id,
    assert_val,
    read_files,
    response_wrapper,
    Signer,
)

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


def _build_token(app_id, app_key, room_id, user_id):
    token_builder = AccessToken(app_id, app_key, room_id, user_id)
    token_builder.add_privilege(PRIVILEGES['PrivSubscribeStream'], 0)
    token_builder.add_privilege(PRIVILEGES['PrivPublishStream'], 0)
    token_builder.expire_time(int(time.time()) + 24 * 3600)
    return token_builder.serialize()


async def _signed_volc_request(action, version, body, account_config):
    open_api_request_data = {
        'method': 'POST',
        'path': '/',
        'params': {'Action': action, 'Version': version},
        'headers': {
            'Host': VOLC_HOST,
            'Content-Type': 'application/json',
        },
        'body': body,
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


@app.post('/proxy')
async def proxy(request: Request):
    """代理 AIGC 的 OpenAPI 请求"""

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
        assert_val(json_data, f'{scene_id} 不存在, 请先在 Server/scenes 下定义该场景的 JSON.')

        voice_chat = json_data.get('VoiceChat', {})
        account_config = json_data.get('AccountConfig', {})

        assert_val(account_config.get('accessKeyId'), 'AccountConfig.accessKeyId 不能为空')
        assert_val(account_config.get('secretKey'), 'AccountConfig.secretKey 不能为空')

        request_body = {}

        if action == 'StartVoiceChat':
            asr_app_id = voice_chat.get('Config', {}).get('ASRConfig', {}).get('ProviderParams', {}).get('AppId')
            tts_app_id = (
                voice_chat.get('Config', {})
                .get('TTSConfig', {})
                .get('ProviderParams', {})
                .get('app', {})
                .get('appid')
            )
            assert_speech_app_id(asr_app_id, 'ASRConfig.ProviderParams.AppId')
            assert_speech_app_id(tts_app_id, 'TTSConfig.ProviderParams.app.appid')

            request_body = copy.deepcopy(voice_chat)

            if not request_body.get('TaskId'):
                request_body['TaskId'] = str(uuid.uuid4())
                voice_chat['TaskId'] = request_body['TaskId']

            agent_config = request_body.setdefault('AgentConfig', {})
            if not agent_config.get('UserId'):
                agent_config['UserId'] = 'ChatBot01'
                voice_chat.setdefault('AgentConfig', {})['UserId'] = agent_config['UserId']

            stop_body = {
                'AppId': request_body.get('AppId'),
                'RoomId': request_body.get('RoomId'),
                'TaskId': request_body.get('TaskId'),
            }
            if stop_body['AppId'] and stop_body['RoomId'] and stop_body['TaskId']:
                try:
                    await _signed_volc_request('StopVoiceChat', version, stop_body, account_config)
                except Exception:
                    pass

        elif action == 'StopVoiceChat':
            app_id = voice_chat.get('AppId')
            room_id = voice_chat.get('RoomId')
            task_id = voice_chat.get('TaskId')

            assert_val(app_id, 'VoiceChat.AppId 不能为空')
            assert_val(room_id, 'VoiceChat.RoomId 不能为空')
            assert_val(task_id, 'VoiceChat.TaskId 不能为空')

            request_body = {'AppId': app_id, 'RoomId': room_id, 'TaskId': task_id}

        return await _signed_volc_request(action, version, request_body, account_config)

    return await response_wrapper('proxy', logic, contain_metadata=False)


@app.post('/getScenes')
async def get_scenes(_request: Request):
    """获取场景列表并自动生成 Token"""

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
                rtc_config['UserId'] = user_id or str(uuid.uuid4())
                voice_chat.setdefault('AgentConfig', {}).setdefault('TargetUserId', [''])[0] = rtc_config['UserId']

                assert_val(app_key, f'自动生成 Token 时, {key} 场景的 AppKey 不可为空')
                rtc_config['Token'] = _build_token(app_id, app_key, rtc_config['RoomId'], rtc_config['UserId'])

            voice_chat['TaskId'] = str(uuid.uuid4())

            agent_config = voice_chat.setdefault('AgentConfig', {})
            if not agent_config.get('UserId'):
                agent_config['UserId'] = 'ChatBot01'

            agent_user_id = agent_config.get('UserId')
            target_user_ids = agent_config.setdefault('TargetUserId', [''])
            target_user_id = target_user_ids[0] if target_user_ids else ''

            if not target_user_id or target_user_id == agent_user_id or rtc_config.get('UserId') == agent_user_id:
                if not rtc_config.get('UserId') or rtc_config.get('UserId') == agent_user_id:
                    rtc_config['UserId'] = str(uuid.uuid4())

                target_user_ids[0] = rtc_config['UserId']

                if not voice_chat.get('RoomId'):
                    voice_chat['RoomId'] = rtc_config.get('RoomId') or str(uuid.uuid4())
                    rtc_config['RoomId'] = voice_chat['RoomId']

                if not rtc_config.get('Token') and app_key:
                    rtc_config['Token'] = _build_token(
                        app_id, app_key, rtc_config['RoomId'], rtc_config['UserId']
                    )

            scene_config['id'] = key
            scene_config['botName'] = voice_chat.get('AgentConfig', {}).get('UserId')
            scene_config['isInterruptMode'] = voice_chat.get('Config', {}).get('InterruptMode') == 0

            llm_config = voice_chat.get('Config', {}).get('LLMConfig', {})
            vision_config = llm_config.get('VisionConfig', {})
            scene_config['isVision'] = vision_config.get('Enable')
            scene_config['isScreenMode'] = vision_config.get('SnapshotConfig', {}).get('StreamType') == 1

            avatar_config = voice_chat.get('Config', {}).get('AvatarConfig', {})
            scene_config['isAvatarScene'] = avatar_config.get('Enabled')
            scene_config['avatarBgUrl'] = avatar_config.get('BackgroundUrl')

            rtc_config_safe = copy.deepcopy(rtc_config)
            rtc_config_safe.pop('AppKey', None)

            result_scenes.append({'scene': scene_config, 'rtc': rtc_config_safe})

        return {'scenes': result_scenes}

    return await response_wrapper('getScenes', logic)


if __name__ == '__main__':
    print('AIGC Server is running at http://0.0.0.0:3001')
    uvicorn.run('main:app', host='0.0.0.0', port=3001, reload=True)
