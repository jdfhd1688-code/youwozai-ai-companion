import { getDb } from "../src/lib/db";
import {
  createUser,
  insertGuardian,
  insertEmotionRecord,
  insertNotificationEvent,
  addAiMemory,
  startChatSession,
  updateNotificationEventStatus,
} from "../src/lib/data-access";
import { generateLetterForUser } from "../src/lib/weekly-letter";
import { pickOpening } from "../src/lib/companion";

const db = getDb();
db.exec(`
  DELETE FROM notification_events;
  DELETE FROM guardian_permissions;
  DELETE FROM guardians;
  DELETE FROM weekly_letters;
  DELETE FROM emotion_records;
  DELETE FROM chat_sessions;
  DELETE FROM ai_memories;
  DELETE FROM sessions;
  DELETE FROM users;
`);

function cleanEmail(email: string) {
  return email.trim().toLowerCase();
}

const demoEmail = cleanEmail(process.env.DEMO_EMAIL || "demo@youwozai.app");
const demoPassword = process.env.DEMO_PASSWORD || "Capybara123";
const guardianEmail = cleanEmail(process.env.GUARDIAN_EMAIL || "guardian@youwozai.app");
const guardianPassword = process.env.GUARDIAN_PASSWORD || "Guardian123";

const demo = createUser({
  email: demoEmail,
  password: demoPassword,
  nickname: "阿乐",
  ageBand: "25-34",
  timezone: "Asia/Shanghai",
});
const guardian = createUser({
  email: guardianEmail,
  password: guardianPassword,
  nickname: "姐姐",
  ageBand: "35-44",
  timezone: "Asia/Shanghai",
});

addAiMemory(demo.id, "重要考试或汇报前我会特别紧张，希望小在不要急着让我放松，先陪我慢慢说。", "preference");
addAiMemory(demo.id, "比起被安慰“没事的”，我更希望被认真听完再说话。", "preference");

const guardianRow = insertGuardian({
  ownerUserId: demo.id,
  guardianUserId: guardian.id,
  displayName: "姐姐",
  relationship: "家人",
  contactHint: "微信常在线",
  permissions: {
    notifyOnHighRisk: true,
    shareNeedSupport: true,
    shareRiskLevel: true,
    shareEmotionLabels: true,
    shareTrend: false,
    shareStressor: false,
    personalMessage: "如果有一天你收到这条通知，不用急着帮我解决问题。陪我说说话就好。",
  },
});

const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number, hour: number, minute = 0) => {
  const d = new Date(Date.now() - offsetDays * day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const seedRecords: Array<{
  labels: string[];
  intensity: number;
  trigger: string;
  thought: string;
  response: string;
  summary: string;
  risk: "low" | "medium" | "high";
  offset: number;
  hour: number;
}> = [
  { labels: ["平静"], intensity: 4, trigger: "周六早上散步，风很舒服", thought: "能这样待一会儿也不错", response: "", summary: "周六早上有一段平静舒服的时光，散步时风很轻。", risk: "low", offset: 6, hour: 9 },
  { labels: ["开心"], intensity: 7, trigger: "朋友突然约我吃晚饭", thought: "原来还有人记得我", response: "说了很多话，笑了好几次", summary: "和朋友吃饭这件事让今天亮了一点，被记得的感觉很暖。", risk: "low", offset: 5, hour: 19 },
  { labels: ["焦虑", "疲惫"], intensity: 8, trigger: "项目周三要交付，但方案还没定", thought: "要是搞砸了怎么办", response: "一直看手机，睡不着", summary: "项目交付临近，焦虑和疲惫一起涌上来，夜里反复担心。", risk: "medium", offset: 4, hour: 22 },
  { labels: ["委屈", "难过"], intensity: 7, trigger: "同事把我说了三遍的方案改了没告诉我", thought: "是不是我做得不够好", response: "在工位发呆，晚上有点想哭", summary: "被改动方案却没被知会，委屈和难过混在一起，怀疑自己。", risk: "low", offset: 3, hour: 18 },
  { labels: ["低落", "孤独"], intensity: 8, trigger: "加班到很晚，回家路上只有路灯", thought: "好像没有人真的在意我", response: "不想回消息，一个人坐着", summary: "深夜下班后的孤独很清晰，低落的感觉比想象中更重。", risk: "medium", offset: 2, hour: 23 },
  { labels: ["开心", "安心"], intensity: 6, trigger: "妈妈打来电话问了句吃没吃饭", thought: "有人惦记我", response: "挂电话后心情变好了", summary: "一通普通的电话带来安心，被家人惦记是很真实的支持。", risk: "low", offset: 1, hour: 12 },
  { labels: ["焦虑", "迷茫"], intensity: 8, trigger: "周末晚上想到下周全是会", thought: "这种日子什么时候能到头", response: "翻来覆去睡不着", summary: "周日晚上被下周的日程压住，焦虑和迷茫一起出现。", risk: "medium", offset: 1, hour: 22 },
  { labels: ["低落", "无助"], intensity: 9, trigger: "连着几天觉得撑不住，想请假又不敢", thought: "我好像什么都做不好", response: "把自己关在房间里", summary: "连续几天的低落叠加成无助，身体和心理都有点撑不住。", risk: "high", offset: 0, hour: 20 },
];

for (const item of seedRecords) {
  insertEmotionRecord({
    userId: demo.id,
    emotionLabels: item.labels,
    intensity: item.intensity,
    trigger: item.trigger,
    thought: item.thought,
    response: item.response,
    summary: item.summary,
    riskLevel: item.risk,
    createdAt: at(item.offset, item.hour),
  });
}

// 模拟审计：高风险记录 -> 待确认、已发送、已撤销各留一条轨迹
const pendingEvent = insertNotificationEvent({
  userId: demo.id,
  guardianId: guardianRow.id,
  triggerType: "high_risk_record",
  sharedFields: {
    needSupport: true,
    riskLevel: "较高（仅供安全支持参考，非诊断）",
    emotionLabels: ["低落", "无助"],
    personalMessage: guardianRow.permissions.personalMessage,
    supportCard: true,
  },
  status: "pending",
  createdAt: at(0, 21, 5),
});
const sentEvent = insertNotificationEvent({
  userId: demo.id,
  guardianId: guardianRow.id,
  triggerType: "high_risk_record",
  sharedFields: {
    needSupport: true,
    riskLevel: "较高（仅供安全支持参考，非诊断）",
    emotionLabels: ["低落", "孤独"],
    personalMessage: guardianRow.permissions.personalMessage,
    supportCard: true,
  },
  status: "sent",
  sentAt: at(1, 9, 30),
  createdAt: at(2, 21),
});
const cancelledEvent = insertNotificationEvent({
  userId: demo.id,
  guardianId: guardianRow.id,
  triggerType: "high_risk_record",
  sharedFields: {
    needSupport: true,
    personalMessage: guardianRow.permissions.personalMessage,
    supportCard: true,
  },
  status: "cancelled",
  cancelledAt: at(3, 21, 20),
  createdAt: at(3, 21),
});

updateNotificationEventStatus(demo.id, pendingEvent.id, "pending");
void sentEvent;
void cancelledEvent;

startChatSession(demo.id, pickOpening());

try {
  const letter = generateLetterForUser(demo.id, demo.nickname);
  console.log(`Seeded weekly letter ${letter.letter.id}`);
} catch (error) {
  console.warn("Weekly letter seed skipped:", (error as Error).message);
}

console.log(`Demo user: ${demoEmail} / ${demoPassword}`);
console.log(`Guardian user: ${guardianEmail} / ${guardianPassword}`);
console.log("Seed complete.");
