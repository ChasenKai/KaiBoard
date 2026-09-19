// Agent 共绘的集成层。
//
// 这一层从 App.tsx 解耦出来的目的：
//  1. App.tsx 不织死 AI 代码 → AI 能力集中在可独立维护的模块，而非焊进主文件；
//  2. 契合「AI 外接不内嵌」原则 —— KaiBoard 自身不调用任何大模型 API。
//
// 本模块只消费 agentBridge / agentRelayClient 提供的原子能力 + db 设置，
// 对外暴露 useAgentIntegration 钩子（持有全部 state 与副作用）与 AgentCollabSettings 设置面板组件。
// App.tsx 只需：`const agent = useAgentIntegration({ ... })` 并在 handleAPI 里调 `agent.handleApiReady(api)`，
// 再由顶栏 ✨ AI 按钮唤起 `<AIPanel {...agent} onClose={...} />`（独立浮层，不再嵌入设置）。

import { useCallback, useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import { getSetting, setSetting } from "../db";
import { t } from "../i18n";
import type { Snapshot } from "./agentBridge";


export type AgentRelayStatus = "idle" | "connecting" | "connected" | "error";

export interface AgentIntegrationDeps {
  apiRef: MutableRefObject<any>;
  activeIdRef: MutableRefObject<string | null>;
  showToast: (msg: string) => void;
  activeBoardId: string | null;
  /** 桥改动了画板内容（新建 / 远端改图）时，通知 App 刷新左侧文件树。 */
  onTreeChanged?: () => void;
  /**
   * Agent 在某画板上「活跃」时通知 App（**每次写入都发，含当前画板**），用于点亮该节点。
   * 为什么要和 onTreeChanged 分开：树结构不一定变，但「Agent 正在动这块板」必须能体现
   * —— 无论它是不是用户当前打开的画板。
   */
  onAgentActivity?: (boardId?: string) => void;
}

/** 设置面板组件所需的全部 prop（由 useAgentIntegration 的返回值直接展开传入）。 */
export interface AgentCollabProps {
  agentEnabled: boolean;
  agentToken: string | null;
  agentRelayUrl: string;
  agentRelayToken: string;
  agentRelayStatus: AgentRelayStatus;
  relayMismatch: boolean;
  relayTestMsg: string | null;
  everConnected: boolean;
  toggleAgentCollab: (on: boolean) => void;
  copyRelayToken: () => void;
  updateRelayUrl: (url: string) => void;
  updateRelayToken: (tok: string) => void;
  rediscover: () => void;
  regenerateRelayToken: () => void;
  testRelayConnection: () => void;
  copyInstruction: () => void;
  regenerateAndCopyToken: () => void;
  restoreDefaultUrl: () => void;
  // 快照还原
  snapshots: Snapshot[];
  refreshSnapshots: () => void;
  restoreSnapshot: (snap: Snapshot) => void;
}

/** 完整接入指令 = 给 Agent 的自然语言步骤 + 内嵌 MCP 配置（含令牌）。用户整段粘贴给 Agent 即完成授权。 */
function buildAgentInstruction(token: string): string {
  const cfg = JSON.stringify(
    {
      mcpServers: {
        kaiboard: {
          command: "npx",
          args: ["-y", "@kaibuddy/kaiboard-mcp", "--relay"],
          env: { KAIBOARD_TOKEN: token },
        },
      },
    },
    null,
    2,
  );
  return `${t("agent_instruction")}\n${cfg}`;
}

export function useIntegration(deps: AgentIntegrationDeps) {
  const { apiRef, activeIdRef, showToast, activeBoardId, onTreeChanged, onAgentActivity } = deps;

  const [agentEnabled, setAgentEnabled] = useState(false);
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [agentRelayUrl, setAgentRelayUrl] = useState("http://127.0.0.1:8787");
  const [agentRelayToken, setAgentRelayToken] = useState("");
  const [agentRelayStatus, setAgentRelayStatus] = useState<AgentRelayStatus>("idle");
  const [relayMismatch, setRelayMismatch] = useState(false);
  const [relayTestMsg, setRelayTestMsg] = useState<string | null>(null);
  const [everConnected, setEverConnected] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  // 本地生成中继令牌 T（48 位十六进制）。T 由页面持有为权威值，经「复制接入指令」下发到 Agent 的
  // KAIBOARD_TOKEN；中继启动后即使用 T。这样 Agent 无需“先有令牌才能启动中继”，破除启动死循环。
  const genRelayToken = useCallback((): string => {
    const buf = new Uint8Array(24);
    crypto.getRandomValues(buf);
    return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
  }, []);

  // 探测 /info：页面持有权威令牌 T，此处只做“可达性 + 一致性”校验，不再用中继返回值覆盖 T。
  // 若中继返回的令牌与本地 T 不一致 → relayMismatch=true（提示用户重新复制接入指令以完成轮换）。
  const discoverRelayToken = useCallback(
    async (url?: string): Promise<boolean> => {
      const u = (url || agentRelayUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
      try {
        const r = await fetch(`${u}/info`, { method: "GET" });
        if (r.ok) {
          const j = (await r.json()) as any;
          if (j && j.token) {
            setRelayMismatch(!!agentRelayToken && j.token !== agentRelayToken);
            setAgentRelayStatus("connected");
            return true;
          }
        }
        setAgentRelayStatus("error");
      } catch {
        setAgentRelayStatus("error");
      }
      return false;
    },
    [agentRelayUrl, agentRelayToken],
  );

  // 把当前文件夹名推给本地中继（/state），供 mcp server 的 --dir 一致性探测比对。
  // relay 不可达时静默失败。
  const reportFolder = useCallback(
    async (folder: string | null) => {
      const u = (agentRelayUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
      try {
        await fetch(`${u}/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: folder || "" }),
        });
      } catch {
        /* relay not reachable */
      }
    },
    [agentRelayUrl],
  );

  const toggleAgentCollab = useCallback(
    async (on: boolean) => {
      const { initAgentBridge, generateAgentToken } = await import("./agentBridge");
      const { startAgentRelayClient, stopAgentRelayClient } = await import("./agentRelayClient");
      if (on) {
        const tok = generateAgentToken();
        // 页面生成本地中继令牌 T（仅当尚未持有，避免每次开关都轮换）；T 经「复制接入指令」下发。
        if (!agentRelayToken) {
          const rt = genRelayToken();
          setAgentRelayToken(rt);
          await setSetting("agentRelayToken", rt);
        }
        await setSetting("agentCollabEnabled", true);
        await setSetting("agentCollabToken", tok);
        setAgentEnabled(true);
        setAgentToken(tok);
        if (apiRef.current) {
          initAgentBridge(apiRef.current, showToast, activeIdRef.current || undefined);
          // 传入「取当前画板 id」的回调，让中继能把带 boardId 的命令路由到本页面。
          // 用 getter 而非快照值，保证用户切换画板后每次轮询上报的都是最新值。
          setAgentRelayStatus("connecting");
          startAgentRelayClient(apiRef.current, setAgentRelayStatus, () => activeIdRef.current || undefined);
          // 中继由 Agent 侧启动，页面先置「连接中」，待 Agent 连上后轮询自然转为 connected；
          // 此处再探一次 /info（主要为了令牌一致性判定，不覆盖本地权威令牌）。
          await discoverRelayToken();
        }
      } else {
        await setSetting("agentCollabEnabled", false);
        await setSetting("agentCollabToken", "");
        setAgentEnabled(false);
        setAgentToken(null);
        await stopAgentRelayClient();
        setAgentRelayStatus("idle");
        setRelayMismatch(false);
        setRelayTestMsg(null);
        if (apiRef.current) initAgentBridge(apiRef.current, showToast, activeIdRef.current || undefined);
      }
      showToast(on ? t("agent_enabled") : t("agent_disabled"));
    },
    [showToast, discoverRelayToken, agentRelayToken, genRelayToken],
  );

  const copyRelayToken = useCallback(async () => {
    if (!agentRelayToken) {
      showToast(t("agent_relayNotFound"));
      return;
    }
    try {
      await navigator.clipboard.writeText(agentRelayToken);
      showToast(t("agent_copied"));
    } catch {
      showToast(t("agent_copyFail"));
    }
  }, [agentRelayToken, showToast]);

  const updateRelayUrl = useCallback(
    async (url: string) => {
      setAgentRelayUrl(url);
      await setSetting("agentRelayUrl", url);
      setRelayTestMsg(null);
      if (agentEnabled && apiRef.current) {
        await discoverRelayToken(url);
        const { startAgentRelayClient } = await import("./agentRelayClient");
        startAgentRelayClient(apiRef.current, setAgentRelayStatus, () => activeIdRef.current || undefined);
      }
    },
    [agentEnabled, discoverRelayToken],
  );

  const updateRelayToken = useCallback(
    async (tok: string) => {
      setAgentRelayToken(tok);
      await setSetting("agentRelayToken", tok);
      if (agentEnabled && apiRef.current) {
        const { startAgentRelayClient } = await import("./agentRelayClient");
        startAgentRelayClient(apiRef.current, setAgentRelayStatus, () => activeIdRef.current || undefined);
      }
    },
    [agentEnabled],
  );

  // 「重新发现」按钮：重查 /info 并（若开着）重连中继。
  const rediscover = useCallback(async () => {
    await discoverRelayToken(agentRelayUrl);
    if (agentEnabled && apiRef.current) {
      const { startAgentRelayClient } = await import("./agentRelayClient");
      startAgentRelayClient(apiRef.current, setAgentRelayStatus, () => activeIdRef.current || undefined);
    }
  }, [agentEnabled, agentRelayUrl, discoverRelayToken]);

  // 重新生成中继令牌 T（轮换 / 担心泄露后的安全动作）：更新本地权威值，并提示用户重新复制接入指令。
  const regenerateRelayToken = useCallback(async () => {
    const nt = genRelayToken();
    setAgentRelayToken(nt);
    setRelayMismatch(false);
    await setSetting("agentRelayToken", nt);
    await discoverRelayToken(agentRelayUrl);
  }, [discoverRelayToken, agentRelayUrl, genRelayToken]);

  // 测试连接：探测 /info 可达性，给出明确结果（替代此前“空白无提示”的静默失败）。
  const testRelayConnection = useCallback(async () => {
    setRelayTestMsg(t("agent_testing"));
    const u = (agentRelayUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
    try {
      const r = await fetch(`${u}/info`, { method: "GET" });
      if (r.ok) {
        const j = (await r.json().catch(() => null)) as any;
        setRelayTestMsg(t("agent_testOk", { version: j?.version ?? "?", port: j?.port ?? "?" }));
      } else {
        setRelayTestMsg(t("agent_testBad", { code: r.status }));
      }
    } catch {
      setRelayTestMsg(t("agent_testUnreachable"));
    }
  }, [agentRelayUrl]);

  // 复制「完整接入指令」给 Agent：自然语言步骤 + 内嵌含令牌的 mcp.json 配置。
  // Agent 收到即知道全部要做什么（写 mcp.json → 提醒用户重启 → 之后即可用 KaiBoard 工具）。
  const copyInstruction = useCallback(async () => {
    if (!agentRelayToken) return;
    try {
      await navigator.clipboard.writeText(buildAgentInstruction(agentRelayToken));
      showToast(t("agent_instructionCopied"));
    } catch {
      showToast(t("agent_copyFail"));
    }
  }, [agentRelayToken, showToast]);

  // 更新令牌并重新复制：轮换本地令牌 → 用新令牌重新生成完整接入指令 → 复制给 Agent（合并「重新生成」与「复制」一步到位）。
  const regenerateAndCopyToken = useCallback(async () => {
    const nt = genRelayToken();
    setAgentRelayToken(nt);
    setRelayMismatch(false);
    await setSetting("agentRelayToken", nt);
    await discoverRelayToken(agentRelayUrl);
    try {
      await navigator.clipboard.writeText(buildAgentInstruction(nt));
      showToast(t("agent_instructionCopied"));
    } catch {
      showToast(t("agent_copyFail"));
    }
  }, [genRelayToken, discoverRelayToken, agentRelayUrl, showToast]);

  // 恢复默认连接地址。
  const restoreDefaultUrl = useCallback(async () => {
    await updateRelayUrl("http://127.0.0.1:8787");
  }, [updateRelayUrl]);

  const refreshSnapshots = useCallback(async () => {
    const { listSnapshots } = await import("./agentBridge");
    setSnapshots(await listSnapshots(activeBoardId || undefined));
  }, [activeBoardId]);

  const restoreSnapshot = useCallback(
    async (snap: Snapshot) => {
      if (!snap) return;
      const { restoreSnapshotToApi } = await import("./agentBridge");
      if (!apiRef.current) return;
      restoreSnapshotToApi(apiRef.current, snap);
      await refreshSnapshots();
      showToast(t("agent_snapshotRestored", { n: snap.elements.length }));
    },
    [apiRef, showToast, refreshSnapshots],
  );

  // 初始加载：从 setting 恢复 Agent 共绘状态（与 App 其余 UI 状态恢复解耦，各自独立加载）。
  useEffect(() => {
    (async () => {
      const [on, tok, url, rtok] = await Promise.all([
        getSetting<boolean>("agentCollabEnabled", false),
        getSetting<string>("agentCollabToken", ""),
        getSetting<string>("agentRelayUrl", "http://127.0.0.1:8787"),
        getSetting<string>("agentRelayToken", ""),
      ]);
      setAgentEnabled(on);
      setAgentToken(tok || null);
      setAgentRelayUrl(url || "http://127.0.0.1:8787");
      setAgentRelayToken(rtok || "");
    })();
  }, []);

  // 记录「曾成功连通过」：用于区分「等待 Agent 首次连接」与「连接后断开」。
  useEffect(() => {
    if (agentRelayStatus === "connected") setEverConnected(true);
  }, [agentRelayStatus]);

  // 当前画板 / 开关 / 令牌变化时，重挂 postMessage 监听并重连中继。
  useEffect(() => {
    (async () => {
      const { initAgentBridge } = await import("./agentBridge");
      const { startAgentRelayClient, stopAgentRelayClient } = await import("./agentRelayClient");
      if (!apiRef.current) return;
      initAgentBridge(apiRef.current, showToast, activeBoardId || undefined);
      if (agentEnabled) startAgentRelayClient(apiRef.current, setAgentRelayStatus, () => activeIdRef.current || undefined);
      else stopAgentRelayClient();
    })();
  }, [activeBoardId, agentEnabled, agentToken, agentRelayUrl, agentRelayToken, showToast]);

  // 事件名刻意写成字面量而非 import 常量：agentBridge 须保持动态 import，
  // 值导入会把它拽进主包。常量定义见
  // agentBridge.ts 的 TREE_CHANGED_EVENT / AGENT_ACTIVITY_EVENT（两处字符串须一致）。

  // ① 树结构 / 内容变了（新建画板、远端改图）→ 刷新左侧文件树。
  useEffect(() => {
    if (!onTreeChanged) return;
    const h = () => onTreeChanged();
    window.addEventListener("kaiboard-tree-changed", h);
    return () => window.removeEventListener("kaiboard-tree-changed", h);
  }, [onTreeChanged]);

  // ② Agent 在某个画板上活跃（**每次写入都发，含当前画板**）→ 点亮该节点。
  //    与 ① 分开的原因：树结构不一定变，但「Agent 正在动这块板」必须能体现。
  useEffect(() => {
    if (!onAgentActivity) return;
    const h = (e: Event) =>
      onAgentActivity((e as CustomEvent<{ boardId?: string }>).detail?.boardId);
    window.addEventListener("kaiboard-agent-activity", h);
    return () => window.removeEventListener("kaiboard-agent-activity", h);
  }, [onAgentActivity]);

  // 当前画板 / Agent 开关变化时刷新快照列表；Agent 写入快照后实时刷新。
  useEffect(() => {
    refreshSnapshots();
    const h = () => refreshSnapshots();
    window.addEventListener("kaiboard-snapshot-pushed", h);
    return () => window.removeEventListener("kaiboard-snapshot-pushed", h);
  }, [refreshSnapshots, agentEnabled]);

  // Excalidraw API 就绪时挂载桥并（按 db 设置决定是否）启动中继。
  const handleApiReady = useCallback(
    async (api: any) => {
      const { initAgentBridge } = await import("./agentBridge");
      const { startAgentRelayClient } = await import("./agentRelayClient");
      initAgentBridge(api, showToast, activeIdRef.current || undefined);
      startAgentRelayClient(api, setAgentRelayStatus, () => activeIdRef.current || undefined);
    },
    [showToast],
  );

  return {
    agentEnabled,
    agentToken,
    agentRelayUrl,
    agentRelayToken,
    agentRelayStatus,
    relayMismatch,
    relayTestMsg,
    everConnected,
    // 中性别名，供 App.tsx 以统一字段名消费（如顶栏共绘角标）。
    relayStatus: agentRelayStatus,
    toggleAgentCollab,
    copyRelayToken,
    updateRelayUrl,
    updateRelayToken,
    rediscover,
    regenerateRelayToken,
    testRelayConnection,
    copyInstruction,
    regenerateAndCopyToken,
    restoreDefaultUrl,
    reportFolder,
    handleApiReady,
    snapshots,
    refreshSnapshots,
    restoreSnapshot,
  };
}

/** 独立 AI 面板（从设置迁出）。由顶栏 ✨ AI 按钮唤起，作为浮层存在，不嵌入设置。
 *  内部按「功能槽」组织：Agent 共绘 / Mermaid → 画板 / 更多 AI 能力。
 *  后续新增 AI 功能 = 在此加一个 <section className="ai-feature">，不动顶栏、不动设置。
 *
 *  版式原则：主界面只留「去连接引导卡（复制接入指令 + 更新令牌并重新复制）」；
 *  连接状态置于引导之下、且仅在已发起连接后显示；中继地址排障收进「高级设置」折叠区，
 *  令牌已合并进「更新令牌并重新复制」动作（不再单独展示）。 */
export function CollabPanel(props: AgentCollabProps & { onClose: () => void }) {
  const { onClose, ...p } = props;
  const {
    agentEnabled,
    agentRelayUrl,
    agentRelayToken,
    agentRelayStatus,
    everConnected,
    relayMismatch,
    relayTestMsg,
    toggleAgentCollab,
    updateRelayUrl,
    rediscover,
    regenerateAndCopyToken,
    testRelayConnection,
    copyInstruction,
    restoreDefaultUrl,
    snapshots,
    refreshSnapshots,
    restoreSnapshot,
  } = p;
  const [initiated, setInitiated] = useState(false);
  useEffect(() => {
    if (!agentEnabled) setInitiated(false);
  }, [agentEnabled]);
  return (
    <div className="ai-panel" role="dialog" aria-label={t("ai_panel_title")}>
      <div className="modal-head">
        <span>
          ✨ {t("ai_panel_title")} <span className="badge-exp">{t("ai_experimental")}</span>
        </span>
        <button className="modal-close" onClick={onClose} title={t("set_close")}>
          ✕
        </button>
      </div>
      <div className="modal-body">
        <p className="set-hint ai-panel-sub">{t("ai_panel_subtitle")}</p>

        {/* 功能槽 1：Agent 共绘 */}
        <section className="ai-feature">
          <div className="set-label">{t("agent_title")}</div>
          <p className="set-desc">{t("agent_desc")}</p>
          <div className="set-row">
            <label className="set-label">{t("agent_enable")}</label>
            <input
              type="checkbox"
              checked={agentEnabled}
              onChange={(e) => toggleAgentCollab(e.target.checked)}
            />
          </div>
          {agentEnabled && (
            <>
              {/* 去连接引导卡（首要动作）：复制完整接入指令（自然语言步骤 + 内嵌含令牌的 MCP 配置） */}
              <div className="agent-guide-card">
                <div className="set-label">{t("agent_connectTitle")}</div>
                <p className="set-hint">{t("agent_connectGuide")}</p>
                <div className="set-token-row">
                  <button
                    className="mini primary"
                    onClick={() => { setInitiated(true); copyInstruction(); }}
                    disabled={!agentRelayToken}
                  >
                    {t("agent_copyInstruction")}
                  </button>
                  <button
                    className="mini"
                    onClick={() => { setInitiated(true); regenerateAndCopyToken(); }}
                    disabled={!agentRelayToken}
                  >
                    {t("agent_updateToken")}
                  </button>
                </div>
                {relayMismatch && (
                  <p className="set-hint set-hint-warn">{t("agent_relayMismatch")}</p>
                )}
              </div>

              {/* 连接状态：置于引导之下；仅在已发起连接或已连通过时才显示，避免「都还没连就报失败」 */}
              {agentRelayStatus !== "idle" && (initiated || agentRelayStatus === "connected") && (
                <div className="set-row">
                  <span className={`agent-status agent-status-${agentRelayStatus}`}>
                    {t("agent_relayStatus")}
                    {agentRelayStatus === "error" && !everConnected && !relayMismatch
                      ? t("agent_status_waiting")
                      : t(`agent_status_${agentRelayStatus}`)}
                  </span>
                  <button className="mini" onClick={rediscover}>
                    {t("agent_rediscover")}
                  </button>
                </div>
              )}

              {/* 高级设置：仅中继地址（端口占用排障）。令牌已合并到上面「更新令牌并重新复制」。默认折叠。 */}
              <details className="agent-advanced">
                <summary>{t("agent_advanced")}</summary>
                <div className="set-row stack">
                  <label className="set-label">{t("agent_relayUrl")}</label>
                  <div className="set-token-row">
                    <input
                      type="text"
                      className="set-input"
                      value={agentRelayUrl}
                      placeholder={t("agent_relayUrlPlaceholder")}
                      onChange={(e) => updateRelayUrl(e.target.value)}
                    />
                    <button className="mini" onClick={testRelayConnection}>{t("agent_test")}</button>
                    <button className="mini" onClick={restoreDefaultUrl}>{t("agent_restoreDefault")}</button>
                  </div>
                  <p className="set-hint">{t("agent_relayUrlHint")}</p>
                  {relayTestMsg && <p className="set-hint">{relayTestMsg}</p>}
                </div>
              </details>
            </>
          )}
          {!agentEnabled && <p className="set-experimental">{t("agent_disabledNote")}</p>}
          {/* 快照还原（Agent 共绘「整板替换 / Mermaid 落图」前的自动快照可恢复） */}
          <div className="set-row stack">
            <label className="set-label">{t("agent_snapshotTitle")}</label>
            <button className="mini" onClick={refreshSnapshots}>{t("agent_snapshotRefresh")}</button>
          </div>
          <p className="set-hint">{t("agent_snapshotDesc")}</p>
          {snapshots.length === 0 ? (
            <p className="set-hint">{t("agent_snapshotEmpty")}</p>
          ) : (
            <ul className="set-snapshot-list">
              {snapshots.map((s, i) => (
                <li key={`${s.boardId}-${s.ts}-${i}`} className="set-snapshot-item">
                  <span className="set-snapshot-time">{new Date(s.ts).toLocaleString()}</span>
                  <span className="set-snapshot-meta">{t("agent_snapshotMeta", { n: s.elements.length })}</span>
                  <button className="mini" onClick={() => restoreSnapshot(s)}>{t("agent_snapshotRestore")}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 功能槽 2：Mermaid → 画板（Agent 驱动，非 KaiBoard 内调大模型） */}
        <section className="ai-feature">
          <div className="set-label">{t("ai_mermaid_title")}</div>
          <p className="set-hint">{t("ai_mermaid_desc")}</p>
          <div className="set-row">
            <span className="agent-status agent-status-connected">{t("ai_mermaid_status")}</span>
          </div>
        </section>

        {/* 功能槽 3：未来 AI 能力（占位，展示「注册式」扩展点） */}
        <section className="ai-feature">
          <div className="set-label">{t("ai_more_title")}</div>
          <p className="set-hint">{t("ai_more_desc")}</p>
        </section>
      </div>
    </div>
  );
}
