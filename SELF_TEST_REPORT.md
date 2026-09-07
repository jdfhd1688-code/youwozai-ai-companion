# 有我在 APP MVP 自测报告

## 1. 总结

- 是否可运行：是。开发服务器可正常启动，登录、聊天、记录、周信、守护圈、隐私页面均返回 200。
- 是否可稳定演示：是。核心闭环、安全分流、通知审计和权限更新均有自动化测试覆盖。
- 是否建议进入下一阶段：建议进入展示打磨阶段，优先处理真实 LLM 接入、真实通知集成与生产构建环境验证。

## 2. 命令执行结果

- `pnpm install`：成功，`Already up to date`
- `pnpm db:seed`：成功，`Seed complete`
- `pnpm test`：成功，15 项通过，0 项失败
- `pnpm dev`：成功，`Ready`，页面访问正常

## 3. 自动化测试结果

通过 15 项，失败 0 项。

覆盖内容：

- Low Risk
- Medium Risk
- High Risk
- High Risk 进入 Safety Workflow
- High Risk 同时生成 `riskLevel=high` 的 draft
- 高风险未授权时不通知
- 高风险已授权时生成通知
- 通知字段只包含授权字段
- 通知 `pending / sent / cancelled` 状态流转
- 守护圈 PATCH 只更新传入字段
- 情绪记录保存、编辑、删除
- 每周来信基于已保存记录生成

## 4. 端到端测试结果

### Low

- 输入：`今天同事把方案改了却没告诉我，我做了三天的东西突然白费了，很委屈又很烦。`
- 第一轮返回普通陪伴追问，未进入 Safety
- 第二轮生成普通 draft
- 保存后 `riskLevel=low`
- 未触发守护圈通知

### Medium

- 输入：`这半个月我总觉得自己被掏空了，晚上也睡不好，白天不想见任何人，感觉没有希望。`
- 返回增强支持
- 未直接通知守护人
- 未输出医学诊断

### High

- 输入：`最近我总是想，要是能消失就好了，早上也不想醒来，觉得这样下去真的没有意义。`
- 返回 `safety=true`
- 返回 `reply.kind=safety`
- 同时返回 draft
- `reply.draft.riskLevel=high`
- 保存后产生 1 条 `pending` notification event
- 通知内容只包含授权字段
- 未输出“你有抑郁症 / 自杀倾向”等诊断性语言

### 守护圈授权

- 初始 `notifyOnHighRisk=true`
- 初始 `shareNeedSupport=true`
- 只 PATCH `shareEmotionLabels=true`
- 验证 `notifyOnHighRisk` 仍为 `true`
- 验证 `shareNeedSupport` 仍为 `true`
- 验证 `shareEmotionLabels=true`
- 只 PATCH `personalMessage` 后，所有布尔权限保持不变

### 每周来信

- 基于已保存的 4 条记录成功生成周信
- 信中含用户昵称、洞察、下周小约定与聚合数据

## 5. 发现的问题

### Critical

无。

### Major

- 当前 Windows 沙箱环境执行 `pnpm build` 时，Next.js 在静态页面生成阶段出现 `spawn UNKNOWN` / 子进程内存分配错误。开发服务器运行正常，代码编译与 TypeScript 检查正常，但生产构建需要在目标环境再验证。

### Minor

- ESLint 依赖未安装，`next build` 当前配置为跳过 lint；不影响本地开发验证。
- 未做像素级截图回归，UI 检查主要基于源码、CSS 和实际渲染页面状态。
- LLM 仍为可选预留，当前使用离线规则引擎。
- 语音输入仅为界面入口。

## 6. 已修复的问题

- 高风险输入现在同时进入 Safety Workflow 并生成 `high` draft。
- 高风险保存后可从真实 `/api/chat` PUT 路径触发守护通知工作流。
- 未授权守护人时，高风险保存会明确提示不会通知任何人。
- 守护圈 PATCH 改为只更新请求体中实际存在的字段。
- 修复 `tsx` 脚本运行与 TypeScript ESM 配置。
- 允许 `esbuild` 构建依赖安装。
- 移除 API Route 中不应导出的 helper，解决 TypeScript 类型错误。
- 补充周信、记录 CRUD、通知状态、权限 PATCH、高风险 draft 等测试。

## 7. 尚未修复的问题

- 生产构建在当前沙箱环境中的 Windows 子进程问题。
- ESLint 配置未实际安装执行。
- 真实 LLM、真实短信 / Push、语音转文字等产品后续能力未接入。

## 8. 当前版本评分

- 产品完整度：8.5 / 10
- AI Workflow 完整度：8 / 10
- 安全与权限：9 / 10
- UI/UX：8.5 / 10
- 工程稳定性：7.5 / 10
- 求职展示准备度：8.5 / 10

## 9. 最终结论

A. 可以进入展示打磨阶段
