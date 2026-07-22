# Python Server

Node `Server` 的 Python 等价实现，并扩展账号 / 会话持久化能力。

## 启动命令

```bash
pip install -r requirements.txt

python main.py
```

默认监听 `http://localhost:3001`。

## 能力概览

| 模块 | 路径 | 说明 |
|------|------|------|
| RTC 代理 | `POST /getScenes`、`POST /proxy` | 需登录；场景配置与启停 VoiceChat |
| 账号 | `/auth/register` `/login` `/logout` `/change-password` `/me` | JWT Bearer |
| 会话 | `/conversations` CRUD | SQLite 落库 |
| 消息 | `/conversations/:id/messages` | 文本/语音来源标记 |

数据文件：`server_python/data/app.db`（本地生成，已 gitignore）。

## 场景配置

与原先一致：将凭证写入 `server_python/scenes/*.json`（可参考 `Custom.example`）。
