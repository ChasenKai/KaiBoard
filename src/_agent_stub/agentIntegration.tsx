// KaiBoard 基础版「Agent 共绘」门面桩。
//
// 构建期由 vite resolve.alias 的 @agent 指向本文件（基础版），真实实现位于
// 仓库外（gitignored 的 src/_agent_private，仅本地 AI 构建使用），不进入公开仓库。
//
// 本桩不携带任何真实 AI 协议 / 桥接 / 中继代码：所有方法为 no-op，<AIPanel> 渲染为空。
// 其对外 API 形状与真实实现保持一致，使 App.tsx 在基础版下仍能编译、运行且不报错。

export type AgentRelayStatus = "idle" | "connecting" | "connected" | "error";

export interface AgentIntegrationDeps {
  apiRef: { current: any };
  activeIdRef: { current: string | null };
  showToast: (msg: string) => void;
  activeBoardId: string | null;
  /** 桥写入了「非当前画板」时，通知 App 刷新左侧文件树。 */
  onTreeChanged?: () => void;
}

/** 快照还原所需的快照元信息（桩版本仅用于保持类型兼容）。 */
export interface Snapshot {
  boardId: string;
  ts: number;
  elements: unknown[];
}

/** 设置面板组件所需的全部 prop（由 useAgentIntegration 的返回值直接展开传入）。 */
export interface AgentCollabProps {
  agentEnabled: boolean;
  agentToken: string | null;
  agentRelayUrl: string;
  agentRelayToken: string;
  agentRelayStatus: AgentRelayStatus;
  toggleAgentCollab: (on: boolean) => void;
  copyRelayToken: () => void;
  updateRelayUrl: (url: string) => void;
  updateRelayToken: (tok: string) => void;
  rediscover: () => void;
  snapshots: Snapshot[];
  refreshSnapshots: () => void;
  restoreSnapshot: (snap: Snapshot) => void;
}

export function useAgentIntegration(_deps: AgentIntegrationDeps) {
  return {
    agentEnabled: false,
    agentToken: null,
    agentRelayUrl: "http://127.0.0.1:8787",
    agentRelayToken: "",
    agentRelayStatus: "idle" as AgentRelayStatus,
    toggleAgentCollab: async (_on: boolean) => {},
    copyRelayToken: async () => {},
    updateRelayUrl: async (_url: string) => {},
    updateRelayToken: async (_tok: string) => {},
    rediscover: async () => {},
    reportFolder: async (_folder: string | null) => {},
    handleApiReady: async (_api: any) => {},
    snapshots: [] as Snapshot[],
    refreshSnapshots: async () => {},
    restoreSnapshot: async (_snap: Snapshot) => {},
  };
}

/** 独立 AI 面板（基础版下渲染为空）。 */
export function AIPanel(_props: AgentCollabProps & { onClose: () => void }) {
  return null;
}
