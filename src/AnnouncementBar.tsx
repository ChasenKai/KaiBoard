// 顶部公告条（基础功能，两版本均包含）。
//
// 内容来源：public/announcements.json（打包进 dist，改内容需重部署 + 记变更日志）。
// 若 JSON 里配了 remoteUrl，则远程 JSON 覆盖打包内容（未来用户想自管公告时切此开关）。
//
// 过滤规则：
//  - 按当前日期落在 start~end 区间；
//  - scope 匹配（all 两版本都显示；basic 仅基础版；ai 仅带 AI 版）；
//  - 已被用户关闭（localStorage）的不显示；
//  - 数组靠前的优先（新公告放前面）。
//
// 不改此组件即可发公告：编辑 announcements.json 后重部署即可。

import { useEffect, useState } from "react";

type NoticeLevel = "info" | "warn" | "update" | "promo";

interface Notice {
  id: string;
  level: NoticeLevel;
  text: string;
  link?: string | null;
  linkText?: string | null;
  start?: string;
  end?: string;
  dismissible?: boolean;
  scope?: "all" | "basic" | "ai";
}

interface AnnouncementData {
  remoteUrl?: string | null;
  notices?: Notice[];
}

// 与 App.tsx / agentIntegration.tsx 同义的构建开关：决定 scope 匹配。
const AI_ENABLED = import.meta.env.VITE_AI_ENABLED !== "false";
const DISMISS_KEY = "kb_announcement_dismissed";

async function loadAnnouncements(url: string): Promise<AnnouncementData | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as AnnouncementData;
  } catch {
    return null;
  }
}

export default function AnnouncementBar() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    const dismissed: string[] = JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
    const now = Date.now();
    const scope = AI_ENABLED ? "ai" : "basic";

    (async () => {
      let data = await loadAnnouncements("./announcements.json");
      // 打包 JSON 若配了 remoteUrl，远程覆盖（用户未来可自管）。
      if (data?.remoteUrl) {
        const remote = await loadAnnouncements(data.remoteUrl);
        if (remote) data = remote;
      }
      if (!data?.notices) return;
      const active = data.notices.find(
        (n) =>
          !dismissed.includes(n.id) &&
          (n.scope === "all" || n.scope === scope) &&
          (!n.start || new Date(n.start).getTime() <= now) &&
          (!n.end || new Date(n.end).getTime() >= now)
      );
      if (!cancelled && active) setNotice(active);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!notice) return null;

  const dismiss = () => {
    const dismissed = JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
    if (!dismissed.includes(notice.id)) dismissed.push(notice.id);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed));
    setNotice(null);
  };

  const icon = notice.level === "warn" ? "⚠" : notice.level === "update" ? "↑" : notice.level === "promo" ? "✦" : "ℹ";

  return (
    <div className={`announcement-bar announcement-${notice.level}`} role="status">
      <span className="announcement-icon" aria-hidden>
        {icon}
      </span>
      <span className="announcement-text">{notice.text}</span>
      {notice.link && (
        <a className="announcement-link" href={notice.link} target="_blank" rel="noreferrer">
          {notice.linkText || "了解更多"}
        </a>
      )}
      {notice.dismissible && (
        <button className="announcement-close" onClick={dismiss} aria-label="关闭公告">
          ×
        </button>
      )}
    </div>
  );
}
