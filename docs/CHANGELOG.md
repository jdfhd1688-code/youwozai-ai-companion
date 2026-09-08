# 有我在版本记录

## 1.3.0 Phase 2A：Conversation Foundation

### 新增与调整

- 新增版本化、幂等 `messages` migration；真实本地数据库回填 69 条，0 跳过、0 warning，重复运行新增 0 条。
- 聊天改为先独立持久化 user Message，再执行 Safety/assistant 流程；刷新恢复稳定 Message ID 与 sequence。
- EmotionRecord 增加经所有权验证的 Conversation/Message provenance。
- 保留并统一双写旧 `chat_sessions.messages`，新表读取失败时集中 fallback。
- 自动化测试扩展为 48 项，并增加 390×844 Phase 2A runtime verifier。

## 1.2.0 Phase 1：2.0 骨架审查

### 新增与调整

- 完成当前仓库审查、2.0 二十二维差距分析、数据模型/Memory/Evaluation 设计和 Phase 2 Conversation Engine 建议。
- 一级导航对齐为“聊聊、这一段路、来信、守护圈”，记录页统一为“我的这一段路”。
- 登录页明确 Demo 账号只包含虚构演示数据。
- 修正 lint 命令并补充 typecheck、现有工作流集成测试命令和命名回归测试。
- 新增移动端六路由、桌面回顾页、空状态、四项导航、核心 API、console error 和失败请求验证。

### 验证结果

- `pnpm lint`、`pnpm typecheck`、36 项完整测试、11 项工作流集成测试和 `pnpm build` 均通过。
- 430×932 与 1280×800 实际运行检查覆盖 6 个页面和回顾页状态；7 张截图已更新。

### 已知问题

- AI 记忆和会话历史尚未进入陪伴回复上下文，当前不能描述为完整长期记忆。
- 保存草稿时的风险等级和 pending 通知发送前授权仍需服务端二次约束。
- 缺版本化数据库迁移、E2E/安全测试、生产可观测性和本仓库同构部署配置。
- 真实短信、微信、Push 和电话通知仍未实现；`sent` 仅为站内模拟状态。

## 1.1.0 语音体验完善

### 新增与修复

- OpenAI `gpt-4o-mini-tts` 作为自然中文语音主链路。
- 日常 `coral` 和 High Risk `sage` 两套声音策略。
- AudioContext 首次用户操作解锁和 session 状态。
- 自动播放、手动播放、暂停、恢复和一次重新授权提示。
- 全局单音轨、旧请求取消、切页停止和 speaking 动画同步。
- TTS 超时、空音频、Provider 失败和浏览器语音 fallback。
- 新增 10 项语音播放测试。

### 验证结果

- `pnpm test`：35 项通过。
- `pnpm build`：通过。
- 浏览器：手动播放、fallback 提示和 speaking 状态已验证。

### 已知限制

- 当前提供的 TTS Key 返回额度不足，自然语音需要有效额度后才能实际使用。
- 浏览器系统语音的音色随操作系统和浏览器变化。

## 1.0.0 MVP

- 完成认证、陪伴聊天、情绪记录、每周来信、守护圈、权限矩阵和 High Risk Safety Workflow。
- 使用 SQLite 持久化用户、记录、守护权限、通知、记忆与设置。
- 外部 LLM 不可用时使用本地确定性引擎。
- 真实短信、微信、Push 和电话通知未实现。
