import { Action, ActionPanel, Icon, List, Toast, showToast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { listRecentFiles } from "./api/files";
import { WpsFile } from "./api/types";
import { FileListItem, warnNoLink } from "./components/file-list-item";
import { WPS_ICON } from "./components/icons";

/** 命令薄壳：只做视图组装与状态，不直接发请求（见 AGENTS.md 分层规则） */
export default function Command() {
  const { pop } = useNavigation();
  const [files, setFiles] = useState<WpsFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const recent = await listRecentFiles(50);
        if (!cancelled) setFiles(recent);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "获取最近文件失败",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pop]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="过滤最近文档…">
      {files.length === 0 && !isLoading ? (
        <List.EmptyView key="empty-view" icon={WPS_ICON} title="暂无最近文档" description="打开过的文档会出现在这里" />
      ) : null}
      {files.map((file) => (
        <FileListItem
          key={file.file_id}
          file={file}
          actions={(url) => (
            <>
              {url ? (
                <Action.OpenInBrowser title="在浏览器打开" url={url} icon={Icon.ArrowRight} />
              ) : (
                <Action title="无分享链接" icon={Icon.Minus} onAction={() => void warnNoLink()} />
              )}
              {url ? <Action.CopyToClipboard title="复制链接" content={url} /> : null}
            </>
          )}
        />
      ))}
    </List>
  );
}
