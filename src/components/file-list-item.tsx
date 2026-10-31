import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { WpsFile } from "../api/types";
import { fileUrl } from "../api/files";
import { fileTypeIcon } from "./icons";

interface FileListItemProps {
  file: WpsFile;
  /** 渲染该文件的动作区（入参为解析出的可打开链接，可能为空） */
  actions: (url: string | undefined) => React.ReactNode;
}

/**
 * 共享的文档列表项（Search / Recent 复用）。
 * 只依赖类型与纯函数，不直接发请求（分层规则）。
 */
export function FileListItem({ file, actions }: FileListItemProps) {
  const url = fileUrl(file);
  return (
    <List.Item
      key={file.file_id}
      title={file.name}
      subtitle={file.modified_by}
      icon={fileTypeIcon(file)}
      accessories={[{ date: file.mtime ? new Date(file.mtime * 1000) : undefined }]}
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
