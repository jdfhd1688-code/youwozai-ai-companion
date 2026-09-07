const os = require("node:os");

const original = os.userInfo;
Object.defineProperty(os, "userInfo", {
  configurable: true,
  value: (...args) => {
    try {
      return original.apply(os, args);
    } catch {
      return { username: "codex" };
    }
  },
});
