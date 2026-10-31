import { execFile } from "node:child_process";
import { closeMainWindow, open, showToast, Toast } from "@raycast/api";

/**
 * Chrome 标签查重聚焦（设计见 docs/plans/2026-11-01-chrome-tab-dedup-design.md）。
 * Raycast API 不暴露浏览器标签，走 osascript + Chrome AppleScript 字典；
 * 非网络请求，不经过 apiFetch；Node 内置模块，不引入新运行时依赖。
 */

/** 智能打开结果：focused=已聚焦已有标签；opened=新开；后两者=查重失败已回退新开 */
export type SmartOpenResult = "focused" | "opened" | "timeout" | "unauthorized";

/** 查重超时上限：查重是回车链路上的额外开销，必须远小于用户耐心 */
const OSA_TIMEOUT_MS = 3_000;

/** 只从 link_url 提取 link_id 参与匹配，且白名单字符集，防 AppleScript 字符串注入 */
function extractLinkId(url: string): string | undefined {
  const m = /kdocs\.cn\/l\/([A-Za-z0-9_-]+)/.exec(url);
  return m?.[1];
}

/**
 * 单条脚本完成「查 + 聚焦」，避免两次进程启动。
 * Chrome 未运行时直接返回（is running 检查不会拉起 Chrome）。
 */
function buildAppleScript(linkId: string): string {
  return `
if application "Google Chrome" is not running then return "not_running"
tell application "Google Chrome"
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      if URL of t contains "/l/${linkId}" then
        set active tab index of w to i
        set index of w to 1
        activate
        return "focused"
      end if
    end repeat
  end repeat
  return "miss"
end tell`;
}

/** 执行 osascript，任何异常都向上抛由调用方收敛 */
function runOsaScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("osascript", ["-e", script], { timeout: OSA_TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err) {
        // -1743 = 未授权「自动化」控制 Chrome 的权限（macOS TCC）
        if (stderr.includes("-1743") || stderr.toLowerCase().includes("not authorized")) {
          reject(new UnauthorizedError());
        } else {
          reject(err);
        }
        return;
      }
      resolve(stdout.trim());
    });
  });
}

class UnauthorizedError extends Error {}

/**
 * 智能打开文档：Chrome 已有该文档标签则聚焦，否则新开。
 * 查重失败（超时/未授权）时回退为直接新开，永不阻塞用户。
 */
export async function openDocumentSmart(url: string): Promise<SmartOpenResult> {
  const linkId = extractLinkId(url);
  if (linkId) {
    try {
      const result = await runOsaScript(buildAppleScript(linkId));
      if (result === "focused") return "focused";
      // miss / not_running 及其他输出：落回新开
    } catch (error) {
      if (error instanceof UnauthorizedError) return "unauthorized";
      return "timeout";
    }
  }
  await open(url);
  return "opened";
}

/** 命令层入口：智能打开 + 统一 toast 提示（Search / Recent 共用） */
export async function smartOpenWithToast(url: string): Promise<void> {
  const result = await openDocumentSmart(url);
  switch (result) {
    case "focused":
      await showToast({ style: Toast.Style.Success, title: "已聚焦 Chrome 中已打开的标签" });
      break;
    case "opened":
      break;
    case "timeout":
      await showToast({ style: Toast.Style.Failure, title: "查重超时，已直接打开" });
      break;
    case "unauthorized":
      await showToast({
        style: Toast.Style.Failure,
        title: "已直接打开",
        message: "未授权控制 Chrome，请在 系统设置 → 隐私与安全性 → 自动化 中允许",
      });
      break;
  }
}
