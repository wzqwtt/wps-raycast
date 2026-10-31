/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Client ID - WPS 365 开放平台「企业自建应用」的 Client ID（AK） */
  "clientId": string,
  /** Client Secret - 应用密钥（SK），存入 Raycast 加密数据库 */
  "clientSecret": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-documents` command */
  export type SearchDocuments = ExtensionPreferences & {}
  /** Preferences accessible in the `recent-documents` command */
  export type RecentDocuments = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-documents` command */
  export type SearchDocuments = {}
  /** Arguments passed to the `recent-documents` command */
  export type RecentDocuments = {}
}

