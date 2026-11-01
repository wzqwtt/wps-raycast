/** 文档目录展示：把接口返回的位置信息收敛为一段可读文本 + 超长截断 */

import { WpsFile } from "../api/types";

/**
 * 列表副标题的宽度预算（ASCII=1，中日韩字符=2）。
 * Raycast 不暴露可用宽度，取经验值：一行里还要放文档名、标签和创建者。
 */
const SUBTITLE_WIDTH_BUDGET = 36;

/** 路径分隔统一展示为「 / 」，比裸斜杠更易读 */
function prettify(raw: string): string {
  return raw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" / ");
}

/**
 * 取文档所在目录的完整文本。
 * 优先 `src.path`，缺失时退回 `src.name`（位置来源名，如空间名）。
 * ⚠️ 待实测：`file_src.path` 的真实格式（docs/roadmap.md）。这里按字符串处理，
 * 同时兼容数组形态，并去掉末尾与文件名重复的一段，避免「目录」里又出现文件名。
 */
export function fileDirectory(file: WpsFile): string | undefined {
  const rawPath: unknown = file.src?.path;
  let text: string | undefined;
  if (typeof rawPath === "string") text = rawPath;
  else if (Array.isArray(rawPath)) text = rawPath.filter((s) => typeof s === "string").join("/");

  const segments = prettify(text ?? "").split(" / ").filter(Boolean);
  if (segments.at(-1) === file.name) segments.pop();
  const dir = segments.join(" / ");
  if (dir) return dir;

  const name = file.src?.name?.trim();
  return name || undefined;
}

function charWidth(ch: string): number {
  // 中日韩统一表意文字、全角标点、假名、韩文等按双宽处理
  return /[\u1100-\u115f\u2e80-\u9fff\uac00-\ud7a3\uf900-\ufaff\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1;
}

/** 按显示宽度截断，超出时末尾加「…」；未超出原样返回 */
export function truncateByWidth(text: string, budget = SUBTITLE_WIDTH_BUDGET): string {
  const total = [...text].reduce((sum, c) => sum + charWidth(c), 0);
  if (total <= budget) return text;

  // 预留 1 个宽度给省略号
  let used = 0;
  let out = "";
  for (const ch of text) {
    const w = charWidth(ch);
    if (used + w > budget - 1) break;
    used += w;
    out += ch;
  }
  return `${out}…`;
}
