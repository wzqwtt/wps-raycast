import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { fileUrl, listRecentFiles, searchFiles } from "./api";
import { WpsFile } from "./types";

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [files, setFiles] = useState<WpsFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextPageToken, setPageToken] = useState<string>();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async (keyword: string, pageToken?: string) => {
    setIsLoading(true);
    try {
      // 空关键词：展示最近文件作为默认内容（命令一打开就有东西可点）
      const result = keyword
        ? await searchFiles({ keyword, pageToken, pageSize: 50 })
        : { files: await listRecentFiles(10), nextPageToken: undefined };
      setFiles((prev) => (pageToken ? [...prev, ...result.files] : result.files));
      setPageToken(result.nextPageToken);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "搜索失败",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void load(searchText), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [searchText, load]);

  function loadMore() {
    if (nextPageToken && !isLoading) void load(searchText, nextPageToken);
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="搜索我有权限的 WPS 文档…"
      pagination={{
        pageSize: 50,
        hasMore: Boolean(nextPageToken),
        onLoadMore: loadMore,
      }}
      throttle
    >
      {files.length === 0 && !isLoading ? (
        <List.EmptyView
          title={searchText ? "没有找到相关文档" : "输入关键词搜索文档"}
          description="支持搜索智能文档、智能表格等所有你有权限的文件"
        />
      ) : null}
      {files.map((file) => {
        const url = fileUrl(file);
        return (
          <List.Item
            key={file.file_id}
            title={file.name}
            subtitle={file.modified_by}
            accessories={[{ date: file.mtime ? new Date(file.mtime) : undefined }]}
            actions={
              <ActionPanel>
                {url ? (
                  <Action.OpenInBrowser title="在浏览器打开" url={url} icon={Icon.ArrowRight} />
                ) : (
                  <Action
                    title="无分享链接"
                    icon={Icon.Minus}
                    onAction={async () => {
                      await showToast({
                        style: Toast.Style.Failure,
                        title: "该文件没有分享链接",
                        message: "未分享文件的链接兜底将在后续版本支持",
                      });
                    }}
                  />
                )}
                {url ? (
                  <Action.CopyToClipboard title="复制链接" content={url} shortcut={{ modifiers: ["cmd"], key: "c" }} />
                ) : null}
                <Action
                  title="刷新"
                  icon={Icon.ArrowClockwise}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                  onAction={() => void load(searchText)}
                />
                <ActionPanel.Submenu title="账号" icon={Icon.Person}>
                  <Action
                    title="登出 WPS"
                    icon={Icon.Logout}
                    onAction={async () => {
                      const { logout } = await import("./auth");
                      await logout();
                      await showToast({ style: Toast.Style.Success, title: "已登出，下次使用将重新授权" });
                    }}
                  />
                </ActionPanel.Submenu>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
