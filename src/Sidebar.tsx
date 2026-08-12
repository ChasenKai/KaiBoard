import { useMemo, useRef, useState, type ReactNode } from "react";
import type { FileNode } from "./db";
import { t } from "./i18n";

interface Props {
  nodes: FileNode[];
  activeBoardId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onActivate: (id: string) => void;
  onContextMenu: (x: number, y: number, id: string) => void;
  onBlankContextMenu: (x: number, y: number) => void;
  onMove: (draggedId: string, targetId: string | null, position: "inside" | "after") => void;
  renamingId: string | null;
  onRenamingChange: (id: string | null) => void;
  onRenameSubmit: (id: string, name: string) => void;
  trashCount: number;
  onOpenTrash: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (node: FileNode) => void;
  onExportSelected: () => void;
  onExportSelectedPptx: () => void;
  onClearSelection: () => void;
  onSetSelection: (ids: string[]) => void;
  onSelectionMoved: (count: number, folderId: string | null) => void;
  onDropExternal: (dt: DataTransfer, targetFolderId: string | null) => void;
  /** 头部新建入口（与右键菜单并存） */
  onNewFolder: () => void;
  onNewBoard: () => void;
  /** 当前画板批注 */
  commentCount: number;
  onOpenComments: () => void;
  /** 点击文件夹（无修饰键）时回调，用于同步「粘贴目标文件夹」activeFolderId */
  onFolderFocus?: (id: string) => void;
}

export default function Sidebar({
  nodes,
  activeBoardId,
  expanded,
  onToggle,
  onActivate,
  onContextMenu,
  onBlankContextMenu,
  onMove,
  renamingId,
  onRenamingChange,
  onRenameSubmit,
  trashCount,
  onOpenTrash,
  selectedIds,
  onToggleSelect,
  onExportSelected,
  onExportSelectedPptx,
  onClearSelection,
  onSetSelection,
  onSelectionMoved,
  onDropExternal,
  onNewFolder,
  onNewBoard,
  commentCount,
  onOpenComments,
  onFolderFocus,
}: Props) {
  const draggedId = useRef<string | null>(null);
  const draggedGroup = useRef<string[] | null>(null);
  const lastClickedId = useRef<string | null>(null);
  const cancelRename = useRef(false);
  const [drop, setDrop] = useState<{ id: string; pos: "inside" | "after" } | null>(null);
  const [rootDrop, setRootDrop] = useState(false);
  const [extDrop, setExtDrop] = useState<{ id: string; isFolder: boolean } | null>(null);
  const [query, setQuery] = useState("");

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, FileNode[]>();
    for (const n of nodes) {
      const arr = map.get(n.parentId) ?? [];
      arr.push(n);
      map.set(n.parentId, arr);
    }
    for (const arr of map.values()) {
      // 手动排序：order 升序优先，其次按名称
      arr.sort(
        (a, b) =>
          (a.order ?? 0) - (b.order ?? 0) ||
          a.name.localeCompare(b.name, "zh-Hans-CN")
      );
    }
    return map;
  }, [nodes]);

  // 搜索：命中节点 + 其祖先链可见，祖先强制展开
  const { visibleIds, forceExpand, hitIds } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { visibleIds: null as Set<string> | null, forceExpand: null as Set<string> | null, hitIds: null as Set<string> | null };
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const vis = new Set<string>();
    const exp = new Set<string>();
    const hit = new Set<string>();
    for (const n of nodes) {
      if (!n.name.toLowerCase().includes(q)) continue;
      hit.add(n.id);
      vis.add(n.id);
      let p = n.parentId;
      while (p) {
        vis.add(p);
        exp.add(p);
        p = byId.get(p)?.parentId ?? null;
      }
    }
    return { visibleIds: vis, forceExpand: exp, hitIds: hit };
  }, [nodes, query]);

  // 某节点下的全部「后代」id（递归，含文件夹与画板），用于文件夹勾选态/半选态计算
  const descendantAllIds = (rootId: string): string[] => {
    const res: string[] = [];
    const stack = [rootId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const c of childrenMap.get(cur) ?? []) {
        res.push(c.id);
        if (c.type === "folder") stack.push(c.id);
      }
    }
    return res;
  };

  // 扁平可见节点序列（含文件夹与画板，用于 Shift 范围多选锚点，可跨文件夹）
  const flatOrder = useMemo(() => {
    const out: string[] = [];
    const walk = (parentId: string | null) => {
      for (const c of childrenMap.get(parentId) ?? []) {
        if (visibleIds && !visibleIds.has(c.id)) continue;
        out.push(c.id);
        if (c.type === "folder") {
          const open = forceExpand ? forceExpand.has(c.id) || expanded.has(c.id) : expanded.has(c.id);
          if (open) walk(c.id);
        }
      }
    };
    walk(null);
    return out;
  }, [childrenMap, expanded, forceExpand, visibleIds]);

  const selectRange = (a: string, b: string): string[] => {
    const i = flatOrder.indexOf(a);
    const j = flatOrder.indexOf(b);
    if (i === -1 || j === -1) return [b];
    const [s, e] = i < j ? [i, j] : [j, i];
    return flatOrder.slice(s, e + 1);
  };

  const renderNode = (node: FileNode, depth: number): ReactNode => {
    if (visibleIds && !visibleIds.has(node.id)) return null;

    const isFolder = node.type === "folder";
    const kids = childrenMap.get(node.id) ?? [];
    const isOpen = forceExpand ? forceExpand.has(node.id) || expanded.has(node.id) : expanded.has(node.id);
    const isDropTarget = drop?.id === node.id;
    const isExtDrop = extDrop?.id === node.id;
    // 「文件夹 = 整单元」模型：勾选框直接反映该节点是否在选中集；
    // 半选态 = 文件夹自身未选中、但部分后代被选中。
    const checked = selectedIds.has(node.id);
    const totalDesc = isFolder ? descendantAllIds(node.id).length : 0;
    const selCount = isFolder ? descendantAllIds(node.id).filter((id) => selectedIds.has(id)).length : 0;
    const indeterminate = isFolder && !checked && selCount > 0;
    const isRenaming = renamingId === node.id;
    const cls = [
      "tree-item",
      !isFolder && node.id === activeBoardId ? "active" : "",
      selectedIds.has(node.id) ? "selected" : "",
      isFolder && checked ? "selected-folder" : "",
      hitIds?.has(node.id) ? "search-hit" : "",
      isDropTarget && drop?.pos === "inside" ? "drop-inside" : "",
      isDropTarget && drop?.pos === "after" ? "drop-after" : "",
      isExtDrop ? "ext-drop" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div key={node.id}>
        <div
          className={cls}
          style={{ paddingLeft: 6 + depth * 14 }}
          draggable={!isRenaming}
          title={node.name}
          onClick={(e) => {
            e.stopPropagation();
            if (isRenaming) return;
            // 文件管理器式多选：Ctrl/Shift+点击 = 选而不打开
            if (e.ctrlKey || e.metaKey) {
              onToggleSelect(node);
              lastClickedId.current = node.id;
              return;
            }
            if (e.shiftKey && lastClickedId.current) {
              onSetSelection(selectRange(lastClickedId.current, node.id));
              return;
            }
            lastClickedId.current = node.id;
            if (isFolder) {
              onToggle(node.id);
              onFolderFocus?.(node.id);
            } else onActivate(node.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onRenamingChange(node.id);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(e.clientX, e.clientY, node.id);
          }}
          onDragStart={(e) => {
            // 拖「已选中多项之一」→ 整组拖动；否则只拖该项
            draggedGroup.current =
              selectedIds.has(node.id) && selectedIds.size > 1
                ? Array.from(selectedIds)
                : [node.id];
            draggedId.current = node.id;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", node.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.types.includes("Files")) {
              // 画板不接收外部拖入（避免画板套画板），外部文件均落其所在文件夹
              setExtDrop(isFolder ? { id: node.id, isFolder } : null);
              return;
            }
            setExtDrop(null);
            setRootDrop(false);
            if (!draggedId.current || draggedId.current === node.id) return;
            setDrop({ id: node.id, pos: isFolder ? "inside" : "after" });
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.types.includes("Files")) {
              const target = isFolder ? node.id : node.parentId;
              onDropExternal(e.dataTransfer, target);
              setExtDrop(null);
              return;
            }
            const group = draggedGroup.current ?? (draggedId.current ? [draggedId.current] : []);
            draggedGroup.current = null;
            draggedId.current = null;
            setDrop(null);
            setRootDrop(false);
            if (group.length === 0) return;
            if (group.length > 1) {
              // 整组：全部移入落点文件夹（落点为画板则移入其所在文件夹）
              const folderId = isFolder ? node.id : node.parentId;
              group.forEach((gid) => {
                if (gid !== folderId) onMove(gid, folderId, "inside");
              });
              onSelectionMoved(group.length, folderId);
            } else if (group[0] !== node.id) {
              onMove(group[0], node.id, isFolder ? "inside" : "after");
            }
          }}
          onDragEnd={() => {
            draggedId.current = null;
            setDrop(null);
            setRootDrop(false);
          }}
        >
          <span
            className={"selbox" + (checked ? " on" : "") + (indeterminate ? " ind" : "")}
            title={t("sel_exportSelected")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(node);
            }}
          >
            {checked ? "☑" : indeterminate ? "▣" : "☐"}
          </span>
          <span className="twisty">{isFolder ? (isOpen ? "▾" : "▸") : ""}</span>
          <span className="icon">{isFolder ? "📁" : "🎨"}</span>
          {isRenaming ? (
            <input
              className="rename-input"
              defaultValue={node.name}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                if (cancelRename.current) {
                  cancelRename.current = false;
                  onRenamingChange(null);
                  return;
                }
                onRenameSubmit(node.id, e.currentTarget.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRename.current = true;
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <span className="label">{node.name}</span>
          )}
        </div>
        {isFolder && isOpen && kids.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  const roots = childrenMap.get(null) ?? [];
  const visibleRoots = roots.filter((n) => !visibleIds || visibleIds.has(n.id));
  const hitCount = hitIds?.size ?? 0;

  return (
    <div className="sidebar">
      <div className="sidebar-actions">
        <button className="sidebar-action-btn" onClick={onNewFolder} title={t("ctx_newFolder")}>
          {t("ui_newFolder")}
        </button>
        <button className="sidebar-action-btn" onClick={onNewBoard} title={t("ctx_newBoard")}>
          {t("ui_newBoard")}
        </button>
      </div>

      <div className="sidebar-search">
        <input
          className="search-input"
          type="search"
          placeholder={t("sidebar_searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
        />
      </div>

      {query.trim() && (
        <div className="search-meta">
          {hitCount > 0 ? t("sidebar_foundN", { n: hitCount }) : t("sidebar_noMatch")}
          <span className="search-clear" onClick={() => setQuery("")}>
            {t("sidebar_clear")}
          </span>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="sel-bar">
          <span className="sel-count">{t("sel_selectedN", { n: selectedIds.size })}</span>
          <button onClick={onExportSelected}>{t("sel_exportSelected")}</button>
          <button onClick={onExportSelectedPptx}>{t("sel_exportPptx")}</button>
          <button onClick={onClearSelection}>{t("sel_clear")}</button>
        </div>
      )}

      <div
        className={"tree" + (rootDrop || extDrop?.id === "__root__" ? " root-drop" : "")}
        onContextMenu={(e) => {
          // 子项已 stopPropagation，走到这里说明点的是空白区域
          e.preventDefault();
          onBlankContextMenu(e.clientX, e.clientY);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes("Files")) {
            setExtDrop({ id: "__root__", isFolder: true });
            return;
          }
          setExtDrop(null);
          if (draggedId.current) {
            setDrop(null);
            setRootDrop(true);
          }
        }}
        onDragLeave={() => {
          setRootDrop(false);
          setExtDrop(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes("Files")) {
            onDropExternal(e.dataTransfer, null);
            setExtDrop(null);
            return;
          }
          const group = draggedGroup.current ?? (draggedId.current ? [draggedId.current] : []);
          draggedGroup.current = null;
          draggedId.current = null;
          setDrop(null);
          setRootDrop(false);
          if (group.length > 1) {
            group.forEach((gid) => onMove(gid, null, "inside"));
            onSelectionMoved(group.length, null);
          } else if (group.length === 1 && group[0]) {
            onMove(group[0], null, "inside");
          }
        }}
      >
        {visibleRoots.length === 0 ? (
          <div className="empty">
            {query.trim() ? t("sidebar_noMatch") : t("sidebar_empty")}
          </div>
        ) : (
          visibleRoots.map((n) => renderNode(n, 0))
        )}
      </div>

      <div className="sidebar-foot">
        <button className="trash-btn" onClick={onOpenComments} title={t("cmt_title")}>
          <span className="ic">💬</span>
          {t("cmt_title")}
          {commentCount > 0 ? ` (${commentCount})` : ""}
        </button>
        <button className="trash-btn" onClick={onOpenTrash} title={t("sidebar_trashTitle")}>
          <span className="ic">🗑</span>
          {t("sidebar_trash")}
          {trashCount > 0 ? ` (${trashCount})` : ""}
        </button>
      </div>
    </div>
  );
}
