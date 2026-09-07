# 有我在版本记录

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
