import { WpsFile } from "../api/types";

/**
 * 按文件类型映射 assets/ 下的 SVG 图标。
 * Raycast 会将 SVG 渲染为列表合适的尺寸（约 16-20px），无需手动指定大小。
 */

const EXT_ICON_MAP: Record<string, string> = {
  // 智能表格 / 表格
  ksheet: "ksheet.svg",
  xlsx: "excel.svg",
  et: "excel.svg",
  csv: "excel.svg",
  // 多维表
  dbt: "dbs.svg",
  // 文字文档
  ap: "wps.svg",
  doc: "wps.svg",
  docx: "wps.svg",
  wps: "wps.svg",
  otl: "otl.svg",
  // 演示
  ppt: "ppt.svg",
  pptx: "ppt.svg",
  dps: "ppt.svg",
  // 其他
  pdf: "pdf.svg",
  mind: "mind_mapping.svg",
  flowchart: "flow_chart.svg",
  form: "form.svg",
  poster: "poster.svg",
};

/** 扩展名图标；未知类型回退到 WPS 主图标 */
export function fileTypeIcon(file: WpsFile): string {
  if (file.type === "folder") return "wps-icon.svg";
  const name = file.name ?? "";
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : file.file_ext?.replace(/^\./, "").toLowerCase() ?? "";
  return EXT_ICON_MAP[ext] ?? "wps-icon.svg";
}

/** WPS 主图标（空态、默认场景） */
export const WPS_ICON = "wps-icon.svg";
