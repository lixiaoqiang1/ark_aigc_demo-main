# Python Server

Node `Server` 的 Python 等价实现，接口与逻辑保持一致。

## 启动命令

```bash
pip install -r requirements.txt

python main.py
```

或：

```bash
uvicorn main:app --host 0.0.0.0 --port 3001 --reload
```

## 使用须知

Python 服务启动时会自动读取 `Server_python/scenes` 下的所有文件作为可用的场景，并通过接口 API 返回相关信息。

因此，您需要：

1. 在 `Server_python/scenes` 目录下参考其它 JSON 的格式，自定义创建一个 `xxxx.json` 文件，用于描述您的场景，其中 xxxx 为场景名称。
2. 确保您的 `.json` 文件符合模版定义（可参考 Custom.json），大小写敏感。
3. 新增场景 JSON 后须重启 Python 服务，保证场景信息被正常读取。
4. JSON 文件中，若 `RTCConfig.RoomId`、`RTCConfig.UserId`、`RTCConfig.Token` 其中之一未填写，服务将自动生成对应的值以保证对话可以正常启动。

## 接口说明

与 Node Server 相同：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/getScenes` | 获取场景列表，并按需自动生成 RTC Token |
| POST | `/proxy?Action=xxx&Version=2024-12-01` | 代理调用火山 RTC OpenAPI（如 StartVoiceChat / StopVoiceChat） |

默认监听端口：`3001`（与 Node Server 相同，请勿同时启动两端）。

## 相关参数获取

- AccountConfig
  - 可在 https://console.volcengine.com/iam/keymanage/ 获取 AK/SK。
- RTCConfig
  - AppId、AppKey 可从 https://console.volcengine.com/rtc/aigc/listRTC 中获取。
  - RoomId、UserId 可自定义也可不填，交由服务端生成。
- VoiceChat
  - 可参考 https://www.volcengine.com/docs/6348/1558163 中参数描述
  - 可通过 [快速跑通 Demo](https://console.volcengine.com/rtc/aigc/run?s=g) 快速获取参数，跑通后点击右上角 `接入 API` 按钮复制相关代码贴到 JSON 配置文件中即可。

## 注意

- 相关错误会通过服务端接口返回。
- 服务会根据您配置的 `VoiceChat` 中是否存在视觉模型相关的配置返回相关信息给前端页面，从而控制相关 UI 是否展示。
- 使用时请留意相关服务已开通。
