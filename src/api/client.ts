import { getAccessToken } from "../auth";
import { WpsApiError } from "./types";

/** 固定白名单地址，仅 HTTPS，无用户可控 URL（安全红线 3） */
const API_BASE = "https://openapi.wps.cn/v7";

/** 统一带鉴权的 API 请求（全扩展唯一网络出口） */
export async function apiFetch<T>(
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
    const detail =
      json.msg ?? (Object.keys(json).length === 0 ? `无响应体（HTTP ${resp.status}）` : JSON.stringify(json).slice(0, 500));
    if (Object.keys(json).length === 0) console.error(`WPS API ${path} ${resp.status}: 无响应体`);
    throw new WpsApiError(json.code ?? -1, detail, resp.status);
  }
  return json as T;
}
