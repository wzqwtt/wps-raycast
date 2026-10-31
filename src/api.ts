import { getAccessToken } from "./auth";
import { WpsApiError, WpsDoclib, WpsDoclibSearchResponse, WpsFile, WpsSearchResponse } from "./types";

/**
 * WPS 365 OpenAPI 客户端
 *
 * 端点验证状态（来源 open.wps.cn 官方文档，2026-10 调研，详见 docs/api-design.md）：
 * - GET  /v7/files/search    ✅ 已验证（scope=all 全权限搜索，with_link 返回 link_url）
 * - POST /v7/airsheet/files  ✅ 已验证（创建智能表格，需 drive_id，文件名带 .ksheet 后缀）
 * - GET  /v7/doclib/search   ✅ 已验证（搜索团队文档库 → drive_id）
 * - 其余（重命名/移动/创建智能文档 .ap）待实测后补全，见各函数 TODO。
 */

const API_BASE = "https://openapi.wps.cn/v7"; // 固定白名单地址，仅 HTTPS，无用户可控 URL

/** 统一带鉴权的 API 请求（唯一网络出口） */
async function apiFetch<T>(
  path: string,
  init: { method?: "GET" | "POST"; query?: Record<string, string | undefined>; body?: unknown } = {},
): Promise<T> {
  const accessToken = await getAccessToken();
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }

  const resp = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });

  const json = (await resp.json().catch(() => ({}))) as { code?: number; msg?: string };
  // WPS 约定：HTTP 200 但 body.code != 0 表示业务错误（如 403000001 = 无文件权限）
  if (!resp.ok || (json.code !== undefined && json.code !== 0)) {
    throw new WpsApiError(json.code ?? -1, json.msg ?? `请求失败（HTTP ${resp.status}）`, resp.status);
  }
  return json as T;
}

export interface SearchOptions {
  keyword: string;
  /** 搜索范围：all | latest | personal_drive | group_drive | share_to_me ... */
  scope?: string;
  /** 文件后缀过滤，如 [".ap", ".ksheet"] */
  fileExts?: string[];
  pageToken?: string;
  pageSize?: number;
}

/** 核心接口：关键词搜索用户有权限的文件（GET /v7/files/search，公网 page_size 上限 500） */
export async function searchFiles(options: SearchOptions): Promise<{ files: WpsFile[]; nextPageToken?: string }> {
  const pageSize = Math.min(options.pageSize ?? 50, 500);
  const resp = await apiFetch<WpsSearchResponse>("/files/search", {
    query: {
      keyword: options.keyword,
      scope: options.scope ?? "all",
      type: "all", // file_name + content
      file_exts: options.fileExts?.join(","),
      with_link: "true",
      page_size: String(pageSize),
      page_token: options.pageToken,
    },
  });
  return {
    files: (resp.data?.items ?? []).map((item) => item.file),
    nextPageToken: resp.data?.next_page_token,
  };
}

/** 最近文件（基于 /v7/files/search 的 latest 范围；keyword 传空，若实测不合法再换端点） */
export async function listRecentFiles(pageSize = 50): Promise<WpsFile[]> {
  const { files } = await searchFiles({ keyword: "", scope: "latest", pageSize });
  return files;
}

/** 搜索团队文档库（GET /v7/doclib/search），用于创建文档时选择目标空间 */
export async function searchDoclibs(keyword: string): Promise<WpsDoclib[]> {
  const resp = await apiFetch<WpsDoclibSearchResponse>("/doclib/search", {
    query: { keyword, page_size: "50" },
  });
  return (resp.data?.items ?? []).map((item) => item.drive);
}

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
  return resp.data.file;
}

/**
 * TODO(M3 实测) 重命名：官方知识库内容管理模块包含重命名端点，
 * REST 路径与参数以 open.wps.cn「知识库内容管理」文档为准。
 */
export async function renameFile(_fileId: string, _newName: string): Promise<void> {
  throw new WpsApiError(-1, "重命名接口待实测补全（见 docs/api-design.md）");
}

/**
 * TODO(M3 实测) 移动/归档：官方支持单/批量移动（异步任务），落地时补全。
 */
export async function moveFile(_fileId: string, _targetFolderId: string): Promise<void> {
  throw new WpsApiError(-1, "移动接口待实测补全（见 docs/api-design.md）");
}

/** 打开文件：仅接受金山文档域名的分享链接（防御性校验，链接来自 API 响应） */
export function fileUrl(file: WpsFile): string | undefined {
  if (file.link_url && /^https:\/\/([a-z0-9-]+\.)*kdocs\.cn\//.test(file.link_url)) return file.link_url;
  return undefined;
}
