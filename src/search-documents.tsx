import {
  Action,
  ActionPanel,
  Icon,
  List,
  LocalStorage,
  Toast,
  showToast,
} from "@raycast/api";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { fileUrl, listRecentFiles, searchFiles } from "./api/files";
import { WpsFile } from "./api/types";
import { FileListItem, warnNoLink } from "./components/file-list-item";
import { WPS_ICON } from "./components/icons";
import { smartOpenWithToast } from "./browser/chrome";

/** 钉选存储 key（LocalStorage 只存非密数据，token 红线不受影响） */
const PINNED_KEY = "pinned-files";

/** 加载钉选文档；坏数据直接丢弃而不是中断命令 */
async function loadPinnedFiles(): Promise<WpsFile[]> {
  const raw = await LocalStorage.getItem<string>(PINNED_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WpsFile[]) : [];
  } catch {
    return [];
  }
}

/** 命令薄壳：只做视图组装与状态，不直接发请求（见 AGENTS.md 分层规则） */
export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [files, setFiles] = useState<WpsFile[]>([]);
  const [pinned, setPinned] = useState<WpsFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextPageToken, setPageToken] = useState<string>();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const load = useCallback(async (keyword: string, pageToken?: string) => {
    setIsLoading(true);
    try {
      // 空关键词：默认展示最近文档（命令一打开就有完整内容可点）
      const result = keyword
        ? await searchFiles({ keyword, pageToken, pageSize: 50 })
        : { files: await listRecentFiles(50), nextPageToken: undefined };
      setFiles((prev) =>
        pageToken ? [...prev, ...result.files] : result.files,
      );
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

  // 钉选是本地存储数据，与搜索互不干扰，仅在命令启动时读取一次
  useEffect(() => {
    void loadPinnedFiles().then(setPinned);
  }, []);

  /** 切换钉选状态：新钉选追加到钉选区末尾，再次执行则取消钉选 */
  const togglePin = useCallback(
    async (file: WpsFile) => {
      const wasPinned = pinned.some((f) => f.file_id === file.file_id);
      const next = wasPinned
        ? pinned.filter((f) => f.file_id !== file.file_id)
        : [...pinned, file];
      setPinned(next);
      await LocalStorage.setItem(PINNED_KEY, JSON.stringify(next));
      await showToast({
        style: Toast.Style.Success,
        title: wasPinned ? "已取消钉选" : "已钉选到顶部",
      });
    },
    [pinned],
  );

  function loadMore() {
    if (nextPageToken && !isLoading) void load(searchText, nextPageToken);
  }

  /** 列表项动作区：钉选区与最近/搜索结果共用，仅钉选动作文案随状态切换 */
  function itemActions(file: WpsFile) {
    const isPinned = pinned.some((f) => f.file_id === file.file_id);
    return (url: string | undefined) => (
      <>
        {url ? (
          <>
            <Action
              title="在浏览器打开"
              icon={Icon.ArrowRight}
              onAction={() => void smartOpenWithToast(url)}
            />
            {/* 查重失败的兜底路径：跳过查重直接新开 */}
            <Action.OpenInBrowser
              title="新标签打开（跳过查重）"
              url={url}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          </>
        ) : (
          <Action
            title="无分享链接"
            icon={Icon.Minus}
            onAction={() => void warnNoLink()}
          />
        )}
        {url ? (
          <Action.CopyToClipboard
            title="复制链接"
            content={url}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        ) : null}
        <Action
          title={isPinned ? "取消钉选" : "钉选到顶部"}
          icon={isPinned ? Icon.PinDisabled : Icon.Pin}
          /* 需求原定 ⌘P，但该键被 Raycast 保留、运行时强制移除（实测 07:27 日志），应用户要求改用 ⌘S */
          shortcut={{ modifiers: ["cmd"], key: "s" }}
          onAction={() => void togglePin(file)}
        />
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
              await showToast({
                style: Toast.Style.Success,
                title: "已登出，下次使用将重新授权",
              });
            }}
          />
        </ActionPanel.Submenu>
      </>
    );
  }

  const showPinnedSection = searchText === "" && pinned.length > 0;
  const fileList = (items: WpsFile[]) =>
    items.map((file) => (
      <FileListItem
        key={file.file_id}
        file={file}
        actions={itemActions(file)}
      />
    ));

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
      {/* 空关键词时钉选区置顶；搜索时隐藏，避免干扰关键词匹配 */}
      {showPinnedSection ? (
        <List.Section key="pinned-section" title="📌 钉选">
          {fileList(pinned)}
        </List.Section>
      ) : null}
      {files.length === 0 &&
      !isLoading &&
      (searchText !== "" || pinned.length === 0) ? (
        <List.EmptyView
          key="empty-view"
          icon={WPS_ICON}
          title={searchText ? "没有找到相关文档" : "输入关键词搜索文档"}
          description="支持搜索智能文档、智能表格等所有你有权限的文件"
        />
      ) : null}
      {showPinnedSection ? (
        <List.Section key="recent-section" title="最近文档">
          {fileList(files)}
        </List.Section>
      ) : (
        /* 有搜索关键词或无钉选时保持原样：不带 Section 标题（keyed Fragment 消除 key 警告） */
        <React.Fragment key="files">{fileList(files)}</React.Fragment>
      )}
    </List>
  );
}
