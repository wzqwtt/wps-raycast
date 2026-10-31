import { apiFetch } from "./client";
import { WpsApiError, WpsFile, WpsSearchResponse } from "./types";

/** 文件域：搜索、最近、重命名、移动、链接 */

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
    files: (resp.data?.items ?? []).map((item) => normalizeFile(item.file)),
    nextPageToken: resp.data?.next_page_token,
  };
}

/** 最近文件（基于 /v7/files/search 的 latest 范围；keyword 传空，若实测不合法再换端点） */
export async function listRecentFiles(pageSize = 50): Promise<WpsFile[]> {
  const { files } = await searchFiles({ keyword: "", scope: "latest", pageSize });
  return files;
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

/**
 * WPS 返回的 created_by/modified_by 可能是字符串，也可能是对象（如 {id, name}）。
 * 实测：直接传对象给 List.Item 的 subtitle 会报
 * "expected string, received object"。这里统一收敛为展示名。
 */
function toDisplayName(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const name = obj.name ?? obj.display_name ?? obj.nickname;
    if (typeof name === "string") return name;
  }
  return undefined;
}

/** 只保留文档确认过的字段，未知结构收敛为安全类型（其他资源域复用） */
export function normalizeFile(raw: WpsFile): WpsFile {
  return {
    ...raw,
    created_by: toDisplayName(raw.created_by),
    modified_by: toDisplayName(raw.modified_by),
  };
}
