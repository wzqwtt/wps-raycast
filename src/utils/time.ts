/** 相对时间格式化（中文），用于 subtitle 等非 accessories 场景 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** 完整时间：YYYY-MM-DD HH:mm:ss */
export function formatFullTime(timestampMs: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date(timestampMs);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function formatRelativeTime(timestampMs: number): string {  const date = new Date(timestampMs);
  const now = new Date();

  // 今天内：精确到分
  if (isSameDay(date, now)) {
    return date.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
  }
  // 昨天
  const yesterday = new Date(now.getTime() - DAY);
  if (isSameDay(date, yesterday)) {
    return `昨天 ${date.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })}`;
  }

  const diff = now.getTime() - timestampMs;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return date.toLocaleDateString("zh-CN");
}
