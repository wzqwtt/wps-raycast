import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { WpsFile } from "../api/types";
import { fileUrl } from "../api/files";
import { fileTypeIcon } from "./icons";
import { formatRelativeTime } from "../utils/time";

interface FileListItemProps {
  file: WpsFile;
  /** 渲染该文件的动作区（入参为解析出的可打开链接，可能为空） */
  actions: (url: string | undefined) => React.ReactNode;
}

/** 来源目录名：优先 file_src.name（如「个人空间」「XX团队」），否则取 path 末段 */
function directoryName(file: WpsFile): string | undefined {
  if (file.src?.name) return file.src.name;
  const segments = file.src?.path?.split("/").filter(Boolean);
  return segments && segments.length > 0 ? segments[segments.length - 1] : undefined;
}

/**
 * 共享的文档列表项（Search / Recent 复用）。
 * Raycast 的 List.Item 不支持真正的两行文本（平台约束），
 * 视觉等价：title=文档名（主字号），subtitle=「你在 X 打开过 · 目录」（灰色小字），
 * 创建者放 accessories 最右侧；完整两行信息在悬停 tooltip 中。
 */
export function FileListItem({ file, actions }: FileListItemProps) {
  const url = fileUrl(file);
  const dir = directoryName(file);
  const openTimeMs = (file.otime ?? file.mtime ?? 0) * 1000;
  const openDesc = openTimeMs
    ? `你在 ${formatRelativeTime(openTimeMs)} 打开过${dir ? ` · ${dir}` : ""}`
    : dir
      ? `来自 ${dir}`
      : undefined;

  return (
    <List.Item
      key={file.file_id}
      icon={fileTypeIcon(file)}
      title={{ value: file.name, tooltip: openDesc ?? file.name }}
      subtitle={openDesc}
      accessories={[
        openTimeMs ? { date: new Date(openTimeMs) } : undefined,
        file.created_by ? { icon: Icon.Person, text: file.created_by } : undefined,
      ].filter(Boolean) as List.Item.Accessory[]}
      actions={<ActionPanel>{actions(url)}</ActionPanel>}
    />
  );
}

/** 无链接文件的兜底提示（Search 与 Recent 共用） */
export async function warnNoLink(): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title: "该文件没有分享链接",
    message: "未分享文件的链接兜底将在后续版本支持",
  });
}
