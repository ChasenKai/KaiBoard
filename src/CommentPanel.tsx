import { t, getLang } from "./i18n";

export interface CommentItem {
  /** 所属元素 id */
  elementId: string;
  text: string;
  at: number;
  /** 元素类型，仅作展示 */
  kind?: string;
}

interface Props {
  items: CommentItem[];
  showMarkers?: boolean;
  onToggleMarkers?: () => void;
  onAdd: () => void;
  onLocate: (elementId: string) => void;
  onDelete: (elementId: string) => void;
  onClose: () => void;
}

export default function CommentPanel({ items, showMarkers, onToggleMarkers, onAdd, onLocate, onDelete, onClose }: Props) {
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal">
        <div className="modal-head">
          <span>{t("cmt_title")}</span>
          <button className="modal-close" onClick={onClose} title={t("trash_close")}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {items.length === 0 ? (
            <div className="trash-empty">{t("cmt_empty")}</div>
          ) : (
            items.map((it) => (
              <div className="trash-row" key={it.elementId}>
                <span className="icon">💬</span>
                <span className="trash-name" title={it.text}>
                  {it.text}
                </span>
                <span className="trash-time">{new Date(it.at).toLocaleDateString(getLang())}</span>
                <button className="mini" onClick={() => onLocate(it.elementId)}>
                  {t("cmt_locate")}
                </button>
                <button className="mini danger" onClick={() => onDelete(it.elementId)}>
                  {t("cmt_delete")}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-foot">
          <span className="hint">{items.length > 0 ? t("cmt_countN", { n: items.length }) : ""}</span>
          {onToggleMarkers && (
            <label className="marker-toggle" title={t("cmt_showMarkersTitle")}>
              <input type="checkbox" checked={!!showMarkers} onChange={onToggleMarkers} />
              {t("cmt_showMarkers")}
            </label>
          )}
          <span className="spacer" />
          <button className="mini" onClick={onAdd}>
            {t("cmt_add")}
          </button>
          <button className="mini" onClick={onClose}>
            {t("trash_close")}
          </button>
        </div>
      </div>
    </>
  );
}
