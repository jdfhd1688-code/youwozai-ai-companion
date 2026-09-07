export const SAFETY_ACTIONS = [
  {
    id: "contact-guardian",
    label: "联系我的守护人",
    description: "先检查你是否已经开启守护圈通知授权",
  },
  {
    id: "help-now",
    label: "查看即时求助方式",
    description: "按当前地区展示可用的支持资源",
  },
  {
    id: "continue-with-me",
    label: "我现在是安全的，继续陪我聊",
    description: "仍会留在安全陪伴流程中",
  },
] as const;

export const SAFETY_DETAILS = {
  title: "即时求助与安全提醒",
  note: "小在不是急救系统，也无法替代紧急服务。如果你此刻有紧迫危险，请立即联系当地紧急服务。",
  resources: [
    "联系身边你信任的人，尽量不要一个人待着",
    "中国大陆可拨打心理援助热线 400-161-9995",
    "如存在紧迫危险，请拨打 120 或 110",
  ],
};
