// Agent 共绘 · 内建本地中继轮询客户端（B2.1）
//
// 职责：当用户在 KaiBoard 设置里打开「Agent 共绘」后，页面自己长轮询本地中继
// （默认 127.0.0.1:8787），把外部 Agent 发来的指令写入当前画板，并把响应回传。
// 这样普通用户不再需要油猴脚本或 F12 粘贴代码。
//
// 安全模型：
//  - 仅当「Agent 共绘」开关打开时才轮询；关闭即立即停止，端口请求不再发生。
//  - 轮询地址与桥接令牌由用户设置，默认只连 127.0.0.1（不进公网）。
//  - 拿到指令后，仍然走 agentBridge.executeCommand 的令牌校验（KaiBoard 令牌）。
//  - 跨域页面/其它网站无法访问 127.0.0.1（浏览器同源策略保护）。

import { getSetting } from "./db";
import { executeCommand, type BridgeAPI, type BridgeCmd, type CmdMsg, type KbSource } from "./agentBridge";

/** 中继下发的指令体。字段与 CmdMsg 对齐（去掉 type/token，由本客户端补齐）。 */
interface RelayCmd {
  cmd: BridgeCmd;
  id?: string;
  elements?: any[] | any;
  /** N3 寻址：目标画板；缺省 = 当前打开的画板 */
  boardId?: string;
  patches?: any[] | any;
  ids?: string[] | string;
  name?: string;
  parentId?: string | null;
  mermaid?: string;
  source?: KbSource | string;
  opts?: CmdMsg["opts"];
}

let running = false;
let abortCtl: AbortController | null = null;
let apiRef: BridgeAPI | null = null;
let onStatusRef: ((s: "idle" | "connecting" | "connected" | "error") => void) | null = null;
let lastStatus: "idle" | "connecting" | "connected" | "error" | null = null;
let errorBackoff = 1500;

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

function reportStatus(s: "idle" | "connecting" | "connected" | "error") {
  if (s === lastStatus) return;
  lastStatus = s;
  onStatusRef?.(s);
}

async function pollLoop() {
  const url = await getSetting<string>("agentRelayUrl", "http://127.0.0.1:8787").then((u) => u.replace(/\/$/, ""));
  const bridgeToken = await getSetting<string>("agentRelayToken", "");
  const kaiToken = await getSetting<string>("agentCollabToken", "");

  if (!running || !apiRef || !bridgeToken || !kaiToken) {
    reportStatus("idle");
    return;
  }

  reportStatus("connecting");
  abortCtl = new AbortController();

  while (running) {
    if (!apiRef) break;
    try {
      const res = await fetch(`${url}/cmd?token=${encodeURIComponent(bridgeToken)}`, {
        method: "GET",
        signal: abortCtl.signal,
      });
      if (!running) break;
      if (res.status === 200) {
        errorBackoff = 1500; // 连接成功，重置退避
        reportStatus("connected");
        const relayCmd = (await res.json()) as RelayCmd;
        if (relayCmd && relayCmd.cmd) {
          const cmdMsg: CmdMsg = {
            type: "kaiboard-agent-cmd",
            id: relayCmd.id,
            token: kaiToken,
            cmd: relayCmd.cmd,
            elements: relayCmd.elements,
            boardId: relayCmd.boardId,
            patches: relayCmd.patches,
            ids: relayCmd.ids,
            name: relayCmd.name,
            parentId: relayCmd.parentId,
            mermaid: relayCmd.mermaid,
            source: relayCmd.source,
            opts: relayCmd.opts,
          };
          const activeBoardId = await getSetting<string | null>("lastBoardId", null);
          const resp = await executeCommand(apiRef, kaiToken, () => {}, cmdMsg, activeBoardId || undefined);
          await fetch(`${url}/resp?token=${encodeURIComponent(bridgeToken)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: relayCmd.id, ...resp }),
          }).catch(() => {});
          continue; // 拿到指令后立即再轮询，不等待固定间隔
        }
      } else if (res.status === 204) {
        errorBackoff = 1500;
        reportStatus("connected");
      } else if (res.status === 403) {
        reportStatus("error");
        await sleep(3000); // 令牌错，别太频繁
        continue;
      } else {
        reportStatus("error");
      }
      await sleep(500);
    } catch (e: any) {
      if (e?.name === "AbortError") break;
      reportStatus("error");
      await sleep(errorBackoff);
      errorBackoff = Math.min(errorBackoff * 2, 8000); // 指数退避，最高 8s
    }
  }
  reportStatus("idle");
}

/** 启动内建轮询客户端。幂等：会先停止旧实例。 */
export async function startAgentRelayClient(
  api: BridgeAPI,
  onStatus?: (s: "idle" | "connecting" | "connected" | "error") => void
): Promise<void> {
  await stopAgentRelayClient();
  const enabled = await getSetting<boolean>("agentCollabEnabled", false);
  const bridgeToken = await getSetting<string>("agentRelayToken", "");
  if (!enabled || !bridgeToken) return;
  apiRef = api;
  onStatusRef = onStatus || null;
  lastStatus = null;   // 新实例：确保首条状态一定上报
  errorBackoff = 1500; // 重置退避
  running = true;
  pollLoop();
}

/** 停止轮询客户端。 */
export async function stopAgentRelayClient(): Promise<void> {
  running = false;
  if (abortCtl) {
    abortCtl.abort();
    abortCtl = null;
  }
  apiRef = null;
  onStatusRef = null;
}
