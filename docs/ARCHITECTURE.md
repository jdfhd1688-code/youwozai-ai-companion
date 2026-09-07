# 有我在系统架构

## 架构结论

项目采用单仓库全栈架构，而不是两个独立部署的前后端仓库。前端展示、服务端 API、领域逻辑和数据访问保持分层，适合 MVP 快速验证；如果进入多人协作或真实运营阶段，再拆分独立服务。

## 组件关系

```text
Browser UI
  ├─ Chat and records
  ├─ Guardian permissions
  └─ Audio session and single playback manager
          │ HTTPS / JSON
Next.js Route Handlers
  ├─ Session authentication
  ├─ Companion and risk orchestration
  ├─ Records and weekly aggregation
  ├─ Guardian and notification workflow
  └─ LLM and TTS provider adapters
          │
SQLite                      External providers
  ├─ users                  ├─ OpenAI-compatible LLM
  ├─ sessions               └─ OpenAI TTS
  ├─ emotion_records
  ├─ weekly_letters
  ├─ guardians and permissions
  ├─ notification_events
  ├─ ai_memories
  └─ user_settings
```

## 模块边界

- `src/app/(app)`：登录后的页面和交互组件。
- `src/app/api`：HTTP 输入输出、认证和错误边界。
- `src/lib/data-access.ts`：数据库读写与用户范围约束。
- `src/lib/risk*.ts`：确定性风险信号与融合逻辑。
- `src/lib/companion.ts`、`llm.ts`：陪伴内容和结构化抽取。
- `src/lib/tts.ts`：服务端 TTS Provider。
- `src/lib/audio-session.ts`、`voice-playback.ts`：浏览器解锁和全局单音轨。

## 数据与信任边界

1. 浏览器输入均视为不可信，服务端验证 Session 和字段。
2. LLM 输出视为不可信，结构化结果必须经过 schema 校验。
3. 高风险只允许被确定性规则上调，不能因模型输出而降级。
4. 守护通知在服务端根据权限重新裁剪字段。
5. TTS 返回只接受音频 MIME，密钥不返回浏览器。

## 当前技术债务

- SQLite 适合单机 Demo，不适合多实例水平扩展。
- Cookie Session 尚需在生产部署中确认 Secure、SameSite、轮换和过期策略。
- 缺少数据库迁移版本表和备份恢复流程。
- 缺少端到端浏览器测试和真实 Provider 的 CI 集成测试。
- 缺少匿名化监控、速率限制和滥用防护。
- 当前不是严格意义上的独立前后端部署，需要在面试中如实表述为“前后端逻辑分层的全栈应用”。

## 演进方向

真实试点阶段优先增加可观测性、限流、数据库备份、内容安全审计和外部通知适配器；达到多人协作或扩容需求后，再考虑 PostgreSQL、任务队列和独立 Provider 服务。
