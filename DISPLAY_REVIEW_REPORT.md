# 有我在 APP 展示版升级报告

## 1. 本轮目标

在不新增第四个核心模块、不改变产品定位、不重写现有数据库与守护圈流程的前提下，将 MVP 从“可运行功能版”提升到“可面向 AI Solution 岗位展示的产品 Demo”，重点增强角色感、语音陪伴、AI 结构化质量、Safety Workflow 和展示完成度。

## 2. UI/UX 改动

- 聊天页从普通聊天工具改为“和小在互动”体验
- 移除正式界面中的 Low / Medium / High 测试入口，改为轻量表达入口
- High Risk 页面改为三层结构：短句安抚、三个主操作、折叠详情
- 每周来信增加“听小在读给我听”
- 隐私中心新增“小在的声音”设置：自动播放、慢一点/自然/快一点
- 保持奶油米白、暖灰、雾蓝、浅橙设计系统，不引入 Dashboard 或医疗感

## 3. 小在 IP 改动

- 小在状态扩展为 normal、listening、happy、comforting、speaking
- 聊天输入时使用 listening
- 保存成功使用 happy
- High Risk 使用 comforting
- TTS 播放时使用 speaking

## 4. TTS 语音系统

- 新增统一 `generateSpeech` 风格 Provider
- 支持 normal、chat、weekly_letter、comforting、safety 五种场景
- 支持语速 slow / natural / fast
- 支持 OpenAI-compatible TTS 环境变量
- 无 Key 时降级到 Web Speech API / SpeechSynthesis
- TTS 失败只保留文字，不阻塞聊天
- 同一时间只播放一条小在语音，新语音会停止上一条

## 5. LLM 接入

- 新增统一 LLM Provider
- 环境变量：`LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`
- 陪伴回复可调用 LLM
- 情绪结构化抽取采用 LLM + JSON Schema + 服务端校验
- JSON 解析失败自动重试 1 次，仍失败则 fallback 到规则引擎
- 无 Key 时项目完全可运行

## 6. 情绪结构化抽取

- Schema：emotionLabels、intensity、trigger、thought、response、summary、riskLevel
- 允许 trigger 为空
- 不编造用户未说出的经历
- riskLevel 仅作为安全路由信号
- High Risk 表达式仍能生成 `riskLevel=high` draft

## 7. High Risk Workflow

- 高风险表达进入固定 Safety Workflow
- 生成 high draft
- 保存后触发守护圈通知检查
- 有授权守护人生成 pending notification
- 未授权不通知，并明确提示用户
- Safety 页面不输出长篇危机文本，不输出医学诊断

## 8. 守护圈 Workflow

- 保留“加入守护圈 ≠ 自动收到通知”
- 每位守护人独立授权
- PATCH 只更新请求体实际存在的字段
- 未授权字段不得分享
- 通知事件保留 pending / sent / cancelled 审计

## 9. 每周来信

- 保持“信”的阅读体验
- 数据只来自已保存记录
- 增加全文朗读能力
- 图表只保留趋势、主要情绪、常见触发因素

## 10. 测试结果

- `pnpm test`：20 项通过，0 项失败
- 覆盖 LLM fallback、JSON 非法重试、TTS scene、语音互斥、High Risk 三个主按钮、trigger 为空、守护圈权限、通知状态、记录 CRUD、周信生成

## 11. Build 结果

- `tsc --noEmit`：通过
- `pnpm dev`：正常启动，核心页面返回 200
- `pnpm build`：通过，24 个静态/动态页面与 API Route 成功生成

## 12. 已知问题

- 当前默认无真实 LLM / TTS Key，展示时使用本地规则引擎与浏览器语音合成 fallback
- 语音输入仍是入口，未接入真实语音转文字
- 未做像素级截图回归

## 13. 当前是否适合求职展示

A. 可以进入最终展示包装
