# Python Server

## 启动命令

```bash
cd Server
pip install -r requirements.txt
python main.py
```

服务监听 **http://0.0.0.0:3001**，API 与原先 Node 版完全一致：

| 接口 | 说明 |
|------|------|
| `POST /getScenes?Action=getScenes` | 读取场景配置，自动生成 RTC Token |
| `POST /proxy?Action=StartVoiceChat` | 启动 AIGC 智能体 |
| `POST /proxy?Action=StopVoiceChat` | 停止 AIGC 智能体 |

## 使用须知

服务启动时会自动读取 `Server/scenes` 下的所有 `.json` 文件作为可用场景。

1. 在 `Server/scenes` 目录下参考 `Custom.json.example` 创建 `Custom.json`（含真实凭证，该文件已在 `.gitignore` 中）。
2. JSON 格式大小写敏感，字段说明见 `doc/01-配置说明.md`。
3. 修改场景 JSON 后重启服务；`getScenes` 每次会重新生成 TaskId。
4. 若 `RTCConfig.RoomId`、`UserId`、`Token` 未填写，服务端会自动生成。

## 目录结构

```
Server/
├── main.py           # FastAPI 入口（/getScenes、/proxy）
├── util.py           # 配置读取、校验、OpenAPI 签名
├── token_builder.py  # RTC AccessToken 生成
├── requirements.txt
└── scenes/           # 场景配置（Custom.json）
```

## 相关参数获取

- **AccountConfig**：https://console.volcengine.com/iam/keymanage/
- **RTCConfig**：https://console.volcengine.com/rtc/aigc/listRTC
- **VoiceChat**：https://www.volcengine.com/docs/6348/1558163

## 注意

- 原 Node 版文件（`app.js`、`util.js`、`token.js`）保留作参考，默认请使用 Python 版。
- 同一时间 3001 端口只能跑一个服务端（Python 或 Node，不要同时启动）。
