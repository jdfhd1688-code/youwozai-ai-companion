# 有我在 Voice & Risk 修复报告

## 1. 机械语音原因

机械声音的原因是 A：当前未配置真实 `TTS_API_KEY`，因此前端走的是 Web Speech API / SpeechSynthesis fallback。真实 TTS Provider 接口已实现，但本机没有可用的供应商 Key。

## 2. 正式 TTS Provider

- 统一入口：`generateSpeechDataUrl({ text, scene, speed, voice })`
- 当前支持 OpenAI-compatible TTS
- 业务代码通过 scene / speed / voice 参数解耦供应商
- 环境变量：`TTS_API_KEY`、`TTS_BASE_URL`、`TTS_MODEL`、`TTS_VOICE`
- 无 Key 或 API 失败时返回 `provider: browser`，前端使用 SpeechSynthesis fallback

## 3. 当前 Voice 配置

- 默认 voice：`alloy`
- 默认 model：`gpt-4o-mini-tts`
- 支持 normal、chat、weekly_letter、comforting、safety 五种 scene
- 支持 slow、natural、fast 三档语速

## 4. 自动播放实现

- 用户首次点击“听小在说”或首次发送聊天消息时，`audioUnlocked=true`
- `sessionStorage` 记录当前会话的音频解锁状态
- 仅当 `autoPlayVoice=true` 且 `audioUnlocked=true` 时自动播放新回复
- 每次新语音播放前停止上一条
- `audio.play()` 被浏览器拒绝时不会中断聊天

## 5. 浏览器 autoplay 限制处理

- 不通过 hack 绕过浏览器策略
- 首次用户主动操作作为 audio unlock gesture
- 未解锁时用户可手动点击播放
- 后续同一会话可稳定自动播放

## 6. speaking 动画实现

- 小在增加 speaking 状态
- 播放时头像周围使用低频、克制的柔和 pulse
- Safety 场景保持 comforting 视觉，不切换为活泼 speaking
- 新语音播放时只有当前消息对应的小在进入 speaking

## 7. 风险识别旧问题

旧规则主要依赖少量固定关键词，对“想离开这个世界”“不要醒来”“已经交代好了”“不想继续了”等隐晦表达覆盖不足。

## 8. 新风险识别架构

当前采用三层融合：

- 规则层：扩充死亡愿望、绝望、自伤、方法/计划、准备行为、告别/负担感信号
- 语义风险分类层：独立 LLM classifier，输出严格 JSON
- 上下文趋势层：结合近期记录数量、负面比例和平均强度

最终由 `deterministicRiskFusion()` 计算风险，并决定是否进入 Safety Workflow。

## 9. High Risk 测试结果

新增 10 条高风险表达覆盖测试，包括隐晦死亡愿望、方法/计划、告别和准备行为，测试通过。

## 10. False Positive 测试结果

新增 7 条反例测试，包括“这个 bug 快把我搞死了”“累死了”“笑死我了”“我想杀掉这个进程”“我不想继续做这个项目了”等，均未误判为 High。

## 11. 自动化测试结果

- `pnpm test`：24 项通过，0 项失败
- 覆盖 autoplay 策略、TTS fallback、语音互斥、speaking 状态相关逻辑、High Risk 正反例、权限与通知流程

## 12. Build 结果

- `tsc --noEmit`：通过
- `pnpm build`：成功，24 个页面与 API Route 生成
- `pnpm dev`：正常启动

## 13. 剩余问题

- 本机未配置真实 TTS / LLM Key，默认仍使用离线规则与浏览器语音 fallback
- 语音输入仍未接真实语音转文字
- 未做像素级截图视觉回归
