import { OAuth, getPreferenceValues } from "@raycast/api";
import { WpsTokenResponse } from "./types";

/**
 * WPS 365 企业版 OAuth（授权码模式 + client_secret 本地交换）。
 *
 * 安全说明（详见 docs/security.md）：
 * - client_id / client_secret 来自扩展 preferences（password 类型，存 Raycast 加密数据库），不在源码中硬编码。
 * - token 通过 client.setTokens() 存储（Raycast 加密存储），不使用 localStorage。
 * - 所有端点为固定 HTTPS 白名单地址，不存在用户可控 URL（SSRF 面为零）。
 * - client_secret 与 token 不写入任何日志或错误消息。
 */

// 固定端点（open.wps.cn 官方文档），仅 HTTPS
const AUTH_ENDPOINT = "https://openapi.wps.cn/oauth2/auth";
const TOKEN_ENDPOINT = "https://openapi.wps.cn/oauth2/token";

// 权限最小化：搜索 + 读取文件信息 + 用户信息回显
const SCOPES = ["kso.file_search.readwrite", "kso.file.readwrite", "kso.user_base.read"];

interface Preferences {
  clientId: string;
  clientSecret: string;
}

const client = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.Web,
  providerName: "WPS",
  description: "连接 WPS 365 账号",
});

function prefs(): Preferences {
  return getPreferenceValues<Preferences>();
}

async function exchangeToken(params: Record<string, string>): Promise<WpsTokenResponse> {
  const { clientId, clientSecret } = prefs();
  if (!clientId || !clientSecret) {
    throw new Error("缺少 Client ID / Client Secret，请在扩展偏好设置中填写");
  }
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params });
  const resp = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    // 错误响应体是 WPS 的错误说明（如 invalid_client / invalid_scope），不含敏感信息，展示给用户便于排障
    const body = await resp.text();
    const detail = body.length > 500 ? `${body.slice(0, 500)}…` : body;
    console.error(`WPS token 接口 ${resp.status}: ${detail}`);
    throw new Error(`WPS 授权服务返回 ${resp.status}: ${detail}`);
  }
  const token = (await resp.json()) as WpsTokenResponse;
  if (!token.access_token) throw new Error("WPS 授权服务未返回 access_token");
  return token;
}

async function storeToken(token: WpsTokenResponse): Promise<void> {
  await client.setTokens({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
  });
}

async function refresh(stored: OAuth.TokenSet): Promise<void> {
  if (!stored.refreshToken) throw new Error("无 refresh_token，需要重新授权");
  const token = await exchangeToken({ grant_type: "refresh_token", refresh_token: stored.refreshToken });
  await storeToken(token);
}

/** 引导用户完成一次浏览器跳转授权（首次使用 / token 失效时） */
export async function authorize(): Promise<void> {
  const { clientId } = prefs();
  if (!clientId) throw new Error("缺少 Client ID，请在扩展偏好设置中填写");

  // PKCEClient 自动生成 code_challenge / state / redirect_uri
  const request = await client.authorizationRequest({
    endpoint: AUTH_ENDPOINT,
    clientId,
    scope: SCOPES.join(" "),
  });

  // 跳转浏览器完成授权，回调由 Raycast 托管
  const response = await client.authorize(request);

  // WPS 的 code 换 token 需要 client_secret，因此这里手动交换（而非 PKCEClient 内置交换）
  const token = await exchangeToken({
    grant_type: "authorization_code",
    code: response.authorizationCode,
    redirect_uri: request.redirectURI,
  });
  await storeToken(token);
}

/** 获取有效 access_token；过期自动刷新，刷新失败则重新走授权 */
export async function getAccessToken(): Promise<string> {
  const tokens = await client.getTokens();

  if (tokens && !tokens.isExpired()) {
    return tokens.accessToken;
  }
  if (tokens?.refreshToken) {
    try {
      await refresh(tokens);
      const fresh = await client.getTokens();
      if (fresh) return fresh.accessToken;
    } catch (error) {
      console.error(`token 刷新失败，重新授权: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await authorize();
  const fresh = await client.getTokens();
  if (!fresh) throw new Error("授权未完成");
  return fresh.accessToken;
}

/** 退出登录（清理本地 token；Raycast 会自动在偏好中出现 logout 项） */
export async function logout(): Promise<void> {
  await client.removeTokens();
}
