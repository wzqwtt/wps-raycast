/**
 * WPS 365 开放平台类型定义（数据层共享）
 * 仅包含扩展实际用到的字段；字段名与 open.wps.cn 文档保持一致。
 * 未知响应字段不透传到 UI，新增字段前先对照 docs/api-design.md 的验证状态。
 */

export interface WpsFile {
  file_id: string;
  drive_id: string;
  name: string;
  size?: number;
  /** 秒级时间戳（官方 schema：integer，单位秒） */
  ctime?: number;
  mtime?: number;
  /** 文件类型（官方 schema 有此字段；folder/file/shortcut 等） */
  type?: string;
  file_ext?: string;
  /** 文件打开时间（秒级时间戳，latest 排序依据；可能不返回） */
  otime?: number;
  /** 文件位置来源（搜索结果默认返回） */
  src?: {
    type?: string;
    name?: string;
    path?: string;
  };
  /** 分享链接（with_link=true 时返回），格式 https://www.kdocs.cn/l/{link_id} */
  link_url?: string;
  link_id?: string;
  shared?: boolean;
  /** 实测：可能是字符串，也可能是 {id, name} 形态的对象，经 normalizeFile 收敛为展示名 */
  created_by?: string;
  modified_by?: string;
}

export interface WpsSearchResponse {
  code: number;
  msg?: string;
  data?: {
    items?: {
      file: WpsFile;
      file_src?: { type?: string; name?: string; path?: string };
      highlights?: unknown;
    }[];
    next_page_token?: string;
    total?: number;
  };
}

export interface WpsTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface WpsDoclib {
  drive_id: string;
  name: string;
}

export interface WpsDoclibSearchResponse {
  code: number;
  msg?: string;
  data?: {
    items?: { drive: WpsDoclib }[];
    next_page_token?: string;
  };
}

/** 统一的 WPS API 错误 */
export class WpsApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "WpsApiError";
  }
}
