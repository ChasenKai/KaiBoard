import type { FileNode } from "./db";
import { t } from "./i18n";

interface Props {
  x: number;
  y: number;
  /** undefined 表示在文件树空白处右键（根目录操作） */
  node?: FileNode;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewBoard: () => void;
  onNewFolder: () => void;
  onExportBoard: () => void;
  onImportToFolder: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onExportPptx: () => void;
  /** 剪贴板非空时，文件夹 / 空白处右键显示「粘贴」 */
  canPaste: boolean;
}

export default function ContextMenu({
  x,
  y,
  node,
  onClose,
  onRename,
  onDelete,
  onNewBoard,
  onNewFolder,
  onExportBoard,
  onImportToFolder,
  onDuplicate,
  onCopyLink,
  onCut,
  onCopy,
  onPaste,
  onExportPptx,
  canPaste,
}: Props) {
  const isBlank = !node;
  const isFolder = node?.type === "folder";
  const isBoard = node?.type === "board";

  // 按实际项数估算菜单高度，避免贴边溢出屏幕
  const itemCount = isBlank ? (canPaste ? 4 : 3) : isFolder ? (canPaste ? 12 : 11) : 10;
  const estHeight = itemCount * 34 + 16;
  const left = Math.min(x, window.innerWidth - 190);
  const top = Math.max(8, Math.min(y, window.innerHeight - estHeight - 8));

  return (
    <>
      <div
        className="ctx-backdrop"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className="ctx-menu" style={{ left, top }} onContextMenu={(e) => e.preventDefault()}>
        {isBlank && <div className="ctx-head">{t("ctx_root")}</div>}

        {(isBlank || isFolder) && (
          <>
            <div className="ctx-item" onClick={onNewBoard}>
              {t("ctx_newBoard")}
            </div>
            <div className="ctx-item" onClick={onNewFolder}>
              {t("ctx_newFolder")}
            </div>
            <div className="ctx-item" onClick={onImportToFolder}>
              {t("ctx_importBoard")}
            </div>
            {canPaste && (
              <div className="ctx-item ctx-paste" onClick={onPaste}>
                {t("ctx_paste")}
              </div>
            )}
          </>
        )}

        {isFolder && (
          <>
            <div className="ctx-item" onClick={onExportPptx}>
              {t("ctx_exportPptx")}
            </div>
            <div className="ctx-item" onClick={onDuplicate}>
              {t("ctx_duplicate")}
            </div>
            <div className="ctx-sep" />
            <div className="ctx-item" onClick={onCut}>
              {t("ctx_cut")}
            </div>
            <div className="ctx-item" onClick={onCopy}>
              {t("ctx_copy")}
            </div>
          </>
        )}

        {isBoard && (
          <>
            <div className="ctx-item" onClick={onExportBoard}>
              {t("ctx_exportBoard")}
            </div>
            <div className="ctx-item" onClick={onExportPptx}>
              {t("ctx_exportPptx")}
            </div>
            <div className="ctx-item" onClick={onDuplicate}>
              {t("ctx_duplicate")}
            </div>
            <div className="ctx-item" onClick={onCopyLink} title={t("ctx_copyLinkTitle")}>
              {t("ctx_copyLink")}
            </div>
            <div className="ctx-sep" />
            <div className="ctx-item" onClick={onCut}>
              {t("ctx_cut")}
            </div>
            <div className="ctx-item" onClick={onCopy}>
              {t("ctx_copy")}
            </div>
            <div className="ctx-sep" />
          </>
        )}

        {!isBlank && (
          <>
            <div className="ctx-sep" />
            <div className="ctx-item" onClick={onRename}>
              {t("ctx_rename")}
            </div>
            <div className="ctx-item danger" onClick={onDelete}>
              {t("ctx_delete")}
            </div>
          </>
        )}
      </div>
    </>
  );
}
