# 有我在 APP MVP V1.0 交付信息

## ZIP 文件

- 文件名：`youwozai-app-mvp-v1-review.zip`
- 完整路径：`C:\Users\86172\Documents\ChatGPT\有我在APP\youwozai-app-mvp-v1-review.zip`
- 建议上传给 ChatGPT 检查的文件名：`youwozai-app-mvp-v1-review.zip`

## 本地运行

```bash
pnpm install
pnpm db:seed
pnpm dev
```

或：

```bash
npm install
npm run db:seed
npm run dev
```

打开：`http://localhost:3000`

## 测试账号

- 用户：`demo@youwozai.app` / `Capybara123`
- 守护人：`guardian@youwozai.app` / `Guardian123`

## 已实现

- 注册登录、退出登录、账号注销
- 首页小在主视觉与入口
- 和小在聊聊
- 结构化情绪记录确认与保存
- 心情历史查看、编辑、删除
- 每周来信、趋势图、成长相册
- 守护圈、逐人授权
- 高风险 Safety Workflow
- 站内模拟通知、撤销、审计
- 隐私与 AI 记忆管理

## 风险测试场景

### Low

```text
今天同事把方案改了却没告诉我，我做了三天的东西突然白费了，很委屈又很烦。
```

### Medium

```text
这半个月我总觉得自己被掏空了，晚上也睡不好，白天不想见任何人，感觉没有希望。
```

### High

```text
最近我总是想，要是能消失就好了，早上也不想醒来，觉得这样下去真的没有意义。
```

## 当前说明

- 语音输入为界面入口，未接真实语音转文字
- 守护通知为站内模拟，不是真实短信
- 风险分级与结构化抽取当前为离线规则实现，已预留 LLM 配置
- 数据库真实写入 SQLite
