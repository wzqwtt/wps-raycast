import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  LocalStorage,
  Toast,
  showToast,
} from "@raycast/api";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { fileUrl, listRecentFiles, normalizeFile, searchFiles } from "./api/files";
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
    if (!Array.isArray(parsed)) return [];
    // 旧版本存下的数据可能缺 file_id：重新收敛后去重，保证每个钉选项有唯一身份
    const seen = new Set<string>();
    return (parsed as WpsFile[])
      .map((f) => normalizeFile(f, f.src))
      .filter((f) => !seen.has(f.file_id) && seen.add(f.file_id));
  } catch {
    return [];
  }
}

/** 请求超过该时长才弹「搜索中」转圈 toast：快请求不打扰，慢请求有明确反馈 */
const SLOW_REQUEST_MS = 800;

/**
 * 搜索在途且结果区还没有条目时的占位项。
 * 空的 List.Section 会被收起，列表没有任何 Item 时 Raycast 会显示内置 “No results”。
 */
const SEARCH_PENDING_ID = "search-pending";

/** 钉选项的本地关键词过滤：空格分词、全部命中、忽略大小写（与接口的文件名搜索语义对齐） */
function matchesKeyword(name: string, keyword: string): boolean {
  const terms = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = name.toLowerCase();
  return terms.every((t) => lower.includes(t));
}

/** 命令薄壳：只做视图组装与状态，不直接发请求（见 AGENTS.md 分层规则） */
export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [files, setFiles] = useState<WpsFile[]>([]);
  const [pinned, setPinned] = useState<WpsFile[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [flash, setFlash] = useState<{
    id: string;
    text: string;
    color: Color;
  }>();
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [nextPageToken, setPageToken] = useState<string>();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // 首页请求在途（含防抖等待）：驱动顶部进度条，并让下方结果区先置空
  const [fetching, setFetching] = useState(true);
  // 请求序号：慢请求晚于新请求返回时丢弃，防止旧关键词的结果覆盖新结果
  const requestSeq = useRef(0);
  // 慢请求的转圈 toast（Toast.Style.Animated）
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const slowToast = useRef<Toast | undefined>(undefined);
  // 已结束的请求序号：用于判断 toast 创建完成时请求是否已经结束
  const doneSeq = useRef(0);

  const finishSlowToast = useCallback(() => {
    clearTimeout(slowTimer.current);
    void slowToast.current?.hide();
    slowToast.current = undefined;
  }, []);

  const load = useCallback(async (keyword: string, pageToken?: string) => {
    const seq = ++requestSeq.current;
    const isFirstPage = !pageToken;
    if (isFirstPage) {
      setFetching(true);
      clearTimeout(slowTimer.current);
      slowTimer.current = setTimeout(async () => {
        const toast = await showToast({
          style: Toast.Style.Animated,
          title: keyword ? `正在搜索「${keyword}」…` : "正在加载最近文档…",
        });
        // 创建 toast 期间请求可能已结束或被新请求取代，此时立即收起，避免残留
        if (seq !== requestSeq.current || doneSeq.current === seq) {
          void toast.hide();
          return;
        }
        slowToast.current = toast;
      }, SLOW_REQUEST_MS);
    }
    setIsLoading(true);
    try {
      // 空关键词：默认展示最近文档（命令一打开就有完整内容可点）
      const result = keyword
        ? await searchFiles({ keyword, pageToken, pageSize: 50 })
        : { files: await listRecentFiles(50), nextPageToken: undefined };
      if (seq !== requestSeq.current) return;
      setFiles((prev) =>
        pageToken ? [...prev, ...result.files] : result.files,
      );
      setPageToken(result.nextPageToken);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      if (isFirstPage) setFiles([]);
      // 先收起转圈 toast，再弹失败提示，避免两个 toast 互相覆盖
      finishSlowToast();
      await showToast({
        style: Toast.Style.Failure,
        title: "搜索失败",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (seq === requestSeq.current) {
        doneSeq.current = seq;
        finishSlowToast();
        setIsLoading(false);
        setFetching(false);
      }
    }
  }, [finishSlowToast]);

  useEffect(() => {
    // 关键词一变立刻进入加载态，不等 300ms 防抖结束
    setFetching(true);
    // 作废在途请求：否则它先返回会把 fetching 误置为 false
    requestSeq.current++;
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => void load(searchText), 300);
    return () => clearTimeout(debounceTimer.current);
  }, [searchText, load]);

  // 钉选是本地存储数据，与搜索互不干扰，仅在命令启动时读取一次
  useEffect(() => {
    void loadPinnedFiles().then(setPinned);
  }, []);

  // 用 ref 持有最新钉选列表：连按 ⌘S 时闭包里的 state 可能还是旧值，会互相覆盖
  const pinnedRef = useRef<WpsFile[]>([]);
  pinnedRef.current = pinned;

  /** 切换钉选状态：钉选数量不设上限；新钉选追加到钉选区末尾，再次执行则取消钉选 */
  const togglePin = useCallback(async (file: WpsFile) => {
    const current = pinnedRef.current;
    const wasPinned = current.some((f) => f.file_id === file.file_id);
    const next = wasPinned
      ? current.filter((f) => f.file_id !== file.file_id)
      : [...current, file];
    pinnedRef.current = next;
    // 条目会在「钉选」与「最近文档」之间移动，显式锁定选中项，避免光标跳回列表顶部
    setSelectedId(file.file_id);
    // 平台不支持移动动画：跳区后给该项挂 1.5 秒高亮标签，作为视觉锚点
    setFlash({
      id: file.file_id,
      text: wasPinned ? "已取消钉选" : "已钉选",
      color: wasPinned ? Color.Orange : Color.Green,
    });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(undefined), 1500);
    setPinned(next);
    await LocalStorage.setItem(PINNED_KEY, JSON.stringify(next));
    await showToast({
      style: Toast.Style.Success,
      title: wasPinned ? "已取消钉选" : "已钉选到顶部",
    });
  }, []);

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

  // 空关键词与搜索共用一套逻辑：
  // 1) 钉选区 = 本地即时过滤（空关键词时全部命中），不等接口；
  // 2) 下方区 = 接口结果（空关键词为最近文档），剔除已在钉选区展示的文件。
  const matchedPinned = pinned.filter((f) => matchesKeyword(f.name, searchText));
  const matchedPinnedIds = new Set(matchedPinned.map((f) => f.file_id));
  // 首页请求在途（含防抖期）：下方区先置空，避免旧关键词的结果对不上新输入；
  // 此时由顶部进度条 + 慢请求 toast 表示加载中，EmptyView 也不会误显示（见下方 !fetching）
  const restFiles = fetching
    ? []
    : files.filter((f) => !matchedPinnedIds.has(f.file_id));
  const showPinnedSection = matchedPinned.length > 0;
  // 有关键词就一直挂「搜索结果」分区：输入当下就有标题，结果回来后标题不跳
  const showResultSection = searchText !== "" || showPinnedSection;
  const showPendingRow = searchText !== "" && fetching && restFiles.length === 0;
  const fileList = (items: WpsFile[]) =>
    items.map((file) => (
      <FileListItem
        key={file.file_id}
        file={file}
        actions={itemActions(file)}
        flash={flash?.id === file.file_id ? flash : undefined}
      />
    ));

  return (
    <List
      isLoading={isLoading || fetching}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      selectedItemId={selectedId}
      onSelectionChange={(id) =>
        // 占位项会消失，不能当作锁定目标，否则结果回来后选中项悬空
        setSelectedId(id === SEARCH_PENDING_ID ? undefined : (id ?? undefined))
      }
      searchBarPlaceholder="搜索我有权限的 WPS 文档…"
      pagination={{
        pageSize: 50,
        hasMore: Boolean(nextPageToken),
        onLoadMore: loadMore,
      }}
      throttle
    >
      {/* 钉选区置顶：命中关键词的钉选文件先于接口结果出现 */}
      {showPinnedSection ? (
        <List.Section key="pinned-section" title="📌 钉选">
          {fileList(matchedPinned)}
        </List.Section>
      ) : null}
      {restFiles.length === 0 && !fetching && !showPinnedSection ? (
        <List.EmptyView
          key="empty-view"
          icon={WPS_ICON}
          title={searchText ? "没有找到相关文档" : "输入关键词搜索文档"}
          description="支持搜索智能文档、智能表格等所有你有权限的文件"
        />
      ) : null}
      {showResultSection ? (
        <List.Section
          key="rest-section"
          title={searchText ? "搜索结果" : "最近文档"}
        >
          {showPendingRow ? (
            <List.Item key={SEARCH_PENDING_ID} id={SEARCH_PENDING_ID} title=" " />
          ) : (
            fileList(restFiles)
          )}
        </List.Section>
      ) : (
        /* 无关键词且无钉选时不带 Section 标题（keyed Fragment 消除 key 警告） */
        <React.Fragment key="files">{fileList(restFiles)}</React.Fragment>
      )}
    </List>
  );
}
