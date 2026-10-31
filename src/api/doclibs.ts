import { apiFetch } from "./client";
import { WpsDoclib, WpsDoclibSearchResponse } from "./types";

/** 文档库域：团队文档库搜索 */

/** 搜索团队文档库（GET /v7/doclib/search），用于创建文档时选择目标空间 */
export async function searchDoclibs(keyword: string): Promise<WpsDoclib[]> {
  const resp = await apiFetch<WpsDoclibSearchResponse>("/doclib/search", {
    query: { keyword, page_size: "50" },
  });
  return (resp.data?.items ?? []).map((item) => item.drive);
}
