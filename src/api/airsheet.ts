import { apiFetch } from "./client";
import { WpsApiError, WpsFile } from "./types";
import { normalizeFile } from "./files";

/** 智能表格域：创建 */

export interface CreateAirSheetOptions {
  /** 目标空间 drive_id */
  driveId: string;
  /** 文件名（自动补 .ksheet 后缀） */
  name: string;
}

/** 创建智能表格（POST /v7/airsheet/files，已验证端点；响应字段路径待实测固化） */
export async function createAirSheet(options: CreateAirSheetOptions): Promise<WpsFile> {
  const name = options.name.endsWith(".ksheet") ? options.name : `${options.name}.ksheet`;
  const resp = await apiFetch<{ code: number; data?: { file?: WpsFile } }>("/airsheet/files", {
    method: "POST",
    body: { drive_id: options.driveId, name },
  });
  if (!resp.data?.file) throw new WpsApiError(-1, "创建成功但响应中缺少文件信息");
  return normalizeFile(resp.data.file);
}
