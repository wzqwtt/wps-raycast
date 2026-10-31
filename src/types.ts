/**
 * WPS 365 开放平台类型定义
 * 仅包含扩展实际用到的字段；字段名与 open.wps.cn 文档保持一致。
 */

export interface WpsFile {
  file_id: string;
  drive_id: string;
  name: string;
  size?: number;
  ctime?: string;
  mtime?: string;
  file_ext?: string;
  /** 分享链接（with_link=true 时返回），格式 https://www.kdocs.cn/l/{link_id} */
  link_url?: string;
  link_id?: string;
  shared?: boolean;
  created_by?: string;
  modified_by?: string;
}

export interface WpsSearchResponse {
  code: number;
  msg?: string;
  data?: {
    items?: { file: WpsFile; file_src?: string; highlights?: unknown }[];
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
