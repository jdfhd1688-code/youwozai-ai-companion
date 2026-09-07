# 有我在产品与技术规格

## 目标

把 PRD 转换为可开发、可测试、可追踪的系统行为。需求编号用于提交、测试和版本记录。

## 系统边界

浏览器负责界面、用户操作、AudioContext 解锁和语音播放；Next.js Route Handlers 负责认证、业务规则、Provider 调用和数据访问；SQLite 负责本地持久化。外部 LLM 和 TTS 是可替换依赖，不拥有安全流程的最终决定权。

## 需求清单

| 编号 | 要求 | 当前状态 | 主要证据 |
| --- | --- | --- | --- |
| AUTH-01 | 用户能够注册、登录、退出和注销 | 已实现 | `src/app/api/auth`、`src/lib/auth.ts` |
| DATA-01 | 用户数据按 Session 隔离并写入 SQLite | 已实现 | `src/lib/db.ts`、`src/lib/data-access.ts` |
| CHAT-01 | 对话产生陪伴回复和结构化草稿 | 已实现 | `/api/chat`、`src/lib/companion.ts` |
| CHAT-02 | 外部 LLM 失败时使用确定性降级 | 已实现 | `src/lib/llm.ts` |
| RISK-01 | 风险分为 low、medium、high | 已实现 | `src/lib/risk*.ts` |
| SAFE-01 | high 进入固定安全流程 | 已实现 | `src/lib/safety-content.ts` |
| SAFE-02 | 守护通知受逐项权限和确认控制 | 已实现 | `guardian-permissions.ts`、notifications API |
| VOICE-01 | 自然 TTS 为主，浏览器语音为 fallback | 已实现，依赖有效额度 | `src/lib/tts.ts` |
| VOICE-02 | 首次用户操作解锁后允许 session 内自动播放 | 已实现 | `audio-session.ts`、`voice-player.tsx` |
| VOICE-03 | 全局单音轨，切页停止 | 已实现 | `voice-playback.ts`、根布局生命周期 |
| INSIGHT-01 | 记录参与趋势和每周来信 | 已实现 | records、letter API |
| NOTIFY-01 | 真实外部消息送达 | 未实现 | 当前仅站内模拟 |

## 关键状态

### 语音状态

`idle → loading → playing ↔ paused → idle`

- 新请求开始时取消旧请求和旧音频。
- 页面隐藏或路由切换时回到 `idle`。
- `autoPlayVoice=true` 且 `audioUnlocked=true` 才允许自动播放。
- `play()` 被浏览器拒绝时仅提示一次重新授权。

### 通知状态

`pending → sent` 或 `pending → cancelled`

只有拥有对应守护人授权的字段可以进入通知载荷。取消和发送均保留时间戳。

## API 概览

| 路径 | 方法 | 用途 |
| --- | --- | --- |
| `/api/auth/register` | POST | 注册 |
| `/api/auth/login` | POST | 登录 |
| `/api/auth/logout` | POST | 退出 |
| `/api/chat` | POST | 回复、风险路由与情绪草稿 |
| `/api/records` | GET/POST | 查询和保存记录 |
| `/api/records/[id]` | PATCH/DELETE | 修改和删除记录 |
| `/api/guardians` | GET/POST/PATCH | 守护人及权限管理 |
| `/api/notifications` | GET/POST | 创建和查询通知 |
| `/api/notifications/[id]` | PATCH | 发送或撤销通知 |
| `/api/letter` | GET | 每周来信与聚合数据 |
| `/api/settings/voice` | GET/PATCH | 语音偏好 |
| `/api/tts` | GET/POST | Provider 状态与语音生成 |

## 非功能要求

- 安全：服务端重新校验权限和请求字段；密钥仅存在于服务端环境变量。
- 隐私：不在日志打印用户原文、音频内容或密钥。
- 可用性：外部 AI 服务异常时文字核心路径可用。
- 性能：TTS 请求设置超时和小型内存缓存。
- 可测试性：确定性业务规则与 UI 副作用分离。
- 可观测性：后续增加匿名化错误码、Provider 延迟和降级率，不记录敏感内容。

## 发布定义

一次版本发布至少满足：依赖安装成功、全部自动化测试通过、production build 通过、标准 Demo 路径人工通过、已知问题写入版本记录、没有密钥进入版本控制。
