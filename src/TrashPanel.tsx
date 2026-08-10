import type { FileNode } from "./db";
import { t, getLang } from "./i18n";

interface Props {
  items: FileNode[];
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onEmpty: () => void;
  onClose: () => void;
}

function timeAgo(ts?: number | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("time_justNow");
  if (min < 60) return t("time_minutesAgo", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("time_hoursAgo", { n: h });
  const d = Math.floor(h / 24);
  if (d < 30) return t("time_daysAgo", { n: d });
  return new Date(ts).toLocaleDateString(getLang());
}

export default function TrashPanel({ items, onRestore, onPurge, onEmpty, onClose }: Props) {
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal">
        <div className="modal-head">
          <span>{t("trash_title")}</span>
          <button className="modal-close" onClick={onClose} title={t("trash_close")}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {items.length === 0 ? (
            <div className="trash-empty">{t("trash_empty")}</div>
          ) : (
            items.map((it) => (
              <div className="trash-row" key={it.id}>
                <span className="icon">{it.type === "folder" ? "📁" : "🎨"}</span>
                <span className="trash-name" title={it.name}>
                  {it.name}
                </span>
                <span className="trash-time">{timeAgo(it.deletedAt)}</span>
                <button className="mini" onClick={() => onRestore(it.id)}>
                  {t("trash_restore")}
                </button>
                <button
                  className="mini danger"
                  onClick={() => {
                    if (window.confirm(t("trash_purgeConfirm", { name: it.name }))) onPurge(it.id);
                  }}
                >
                  {t("trash_purge")}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-foot">
          <span className="hint">
            {items.length > 0 ? t("trash_totalN", { n: items.length }) : ""}
          </span>
          <span className="spacer" />
          {items.length > 0 && (
            <button
              className="mini danger"
              onClick={() => {
                if (window.confirm(t("trash_emptyConfirm"))) onEmpty();
              }}
            >
              {t("trash_emptyBtn")}
            </button>
          )}
          <button className="mini" onClick={onClose}>
            {t("trash_close")}
          </button>
        </div>
      </div>
    </>
  );
}
