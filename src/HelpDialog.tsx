import { t } from "./i18n";

// KaiBoard 自建帮助弹窗。
// 结构 / 类名 / 样式完全复刻 Excalidraw 0.18.1 的 HelpDialog（MIT 协议），
// 仅做两处必要改动：
//   1. 移除原顶部 Excalidraw 官方外链（文档 / 博客 / GitHub issues / YouTube）——
//      这些对 KaiBoard 产品无意义，换成 KaiBoard 自己的 GitHub 链接。
//   2. 键帽配色等用 Excalidraw 真实主题变量，做到「看起来和原版一模一样」。
// 快捷键条目、布局、文案均照原版中文 locale 原样呈现，不做创意发挥。

// 帮助弹窗顶部展示 KaiBoard GitHub 仓库入口。

// Excalidraw 0.18.1 真实主题变量（取自其编译产物，light / dark 各一套），
// 直接挂到弹窗根节点，确保内部 .HelpDialog__* 样式拿到正确颜色，不依赖 Excalidraw 的变量级联。
const THEME_VARS = {
  light: {
    "--color-primary-light": "#e3e2fe",
    "--dialog-border-color": "#e9ecef",
    "--color-surface-mid": "#f2f2f7",
    "--button-gray-1": "#e9ecef",
    "--popup-text-color": "#000000",
    "--text-primary-color": "#1b1b1f",
    "--border-radius-lg": ".5rem",
    "--border-radius-md": ".375rem",
  },
  dark: {
    "--color-primary-light": "#4f4d6f",
    "--dialog-border-color": "#2a2a30",
    "--color-surface-mid": "hsl(240 6% 10%)",
    "--button-gray-1": "#363636",
    "--popup-text-color": "#ced4da",
    "--text-primary-color": "#e9ecef",
    "--border-radius-lg": ".5rem",
    "--border-radius-md": ".375rem",
  },
} as const;

type ThemeVars = Record<string, string>;

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="1rem" height="1rem" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

function SiteIcon() {
  return (
    <svg viewBox="0 0 16 16" width="1rem" height="1rem" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM6.943 1.65A6.96 6.96 0 0 0 3.32 4.073c.374-.18.78-.273 1.192-.273.934 0 1.81.445 2.36 1.198.34.47.523 1.03.527 1.606H2.025a6.96 6.96 0 0 1 4.918-4.954Zm2.114 0a6.96 6.96 0 0 1 4.918 4.954h-2.59c.016-.392-.1-.784-.333-1.105a2.36 2.36 0 0 0-1.995-.981 2.36 2.36 0 0 0-1.995.981c-.233.321-.349.713-.333 1.105H6.264c.018-1.192.59-2.29 1.512-2.99a4.08 4.08 0 0 1 1.281-.698ZM4.512 5.2c.48 0 .928.23 1.214.62.175.242.27.53.274.83H2.1c.053-.55.354-1.046.804-1.357a1.65 1.65 0 0 1 1.608-.093Zm7.0 0c.48 0 .928.23 1.214.62.175.242.27.53.274.83H9.1c.053-.55.354-1.046.804-1.357a1.65 1.65 0 0 1 1.608-.093ZM2.025 7.2h2.9c.02.565.21 1.11.555 1.573.55.753 1.426 1.198 2.36 1.198.934 0 1.81-.445 2.36-1.198.345-.463.535-1.008.555-1.573h2.9a6.963 6.963 0 0 1-6.965 6.963A6.963 6.963 0 0 1 2.025 7.2Zm4.99 0h1.97c-.018.283-.13.555-.325.773-.36.4-.926.56-1.44.422a1.19 1.19 0 0 1-.793-.793A1.22 1.22 0 0 1 7.015 7.2Z"
      />
    </svg>
  );
}

interface ShortcutDef {
  label: string;
  keys: string[];
  /** 多个按键组合之间是否显示「或」。曲线箭头 / 曲线固定为 false。 */
  or?: boolean;
}

function Shortcut({ def }: { def: ShortcutDef }) {
  const showOr = def.or !== false;
  return (
    <div className="HelpDialog__shortcut">
      <div>{def.label}</div>
      <div className="HelpDialog__key-container">
        {def.keys.map((combo, i) => (
          <span key={i} style={{ display: "contents" }}>
            {showOr && i > 0 && <span className="HelpDialog__or">或</span>}
            {combo.split("+").map((k, j) => (
              <kbd key={j} className="HelpDialog__key">
                {k}
              </kbd>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

function Island({
  cls,
  title,
  items,
}: {
  cls: string;
  title: string;
  items: ShortcutDef[];
}) {
  return (
    <div className={`HelpDialog__island ${cls}`}>
      <h4 className="HelpDialog__island-title">{title}</h4>
      <div className="HelpDialog__island-content">
        {items.map((d, i) => (
          <Shortcut key={i} def={d} />
        ))}
      </div>
    </div>
  );
}

// ---------- 快捷键数据（顺序 / 文案照 Excalidraw 0.18.1 中文 locale） ----------

const TOOLS: ShortcutDef[] = [
  { label: "抓手（平移工具）", keys: ["H"] },
  { label: "选择", keys: ["V", "1"] },
  { label: "矩形", keys: ["R", "2"] },
  { label: "菱形", keys: ["D", "3"] },
  { label: "椭圆", keys: ["O", "4"] },
  { label: "箭头", keys: ["A", "5"] },
  { label: "线条", keys: ["L", "6"] },
  { label: "自由书写", keys: ["P", "7"] },
  { label: "文字", keys: ["T", "8"] },
  { label: "插入图像", keys: ["9"] },
  { label: "橡皮", keys: ["E", "0"] },
  { label: "画框工具", keys: ["F"] },
  { label: "激光笔", keys: ["K"] },
  { label: "从画布上取色", keys: ["I", "Shift+S", "Shift+G"] },
  { label: "编辑线条或箭头的点", keys: ["Ctrl+Enter"] },
  { label: "添加或编辑文本", keys: ["Enter"] },
  { label: "添加新行(文本编辑器)", keys: ["Enter", "Shift+Enter"] },
  { label: "完成编辑 (文本编辑器)", keys: ["Esc", "Ctrl+Enter"] },
  { label: "曲线箭头", keys: ["A", "单击", "单击", "单击"], or: false },
  { label: "曲线", keys: ["L", "单击", "单击", "单击"], or: false },
  { label: "裁剪图像", keys: ["双击", "Enter"] },
  { label: "完成图像裁剪", keys: ["Enter", "Esc"] },
  { label: "绘制后保持所选的工具栏状态", keys: ["Q"] },
  { label: "禁用箭头吸附", keys: ["Ctrl"] },
  { label: "为选中的形状添加/更新链接", keys: ["Ctrl+K"] },
];

const VIEW: ShortcutDef[] = [
  { label: "放大", keys: ["Ctrl++"] },
  { label: "缩小", keys: ["Ctrl+-"] },
  { label: "重置缩放", keys: ["Ctrl+0"] },
  { label: "缩放以适应所有元素", keys: ["Shift+1"] },
  { label: "缩放到选区", keys: ["Shift+2"] },
  { label: "上下移动页面", keys: ["PgUp/PgDn"] },
  { label: "左右移动页面", keys: ["Shift+PgUp/PgDn"] },
  { label: "禅模式", keys: ["Alt+Z"] },
  { label: "吸附至对象", keys: ["Alt+S"] },
  { label: "显示网格", keys: ["Ctrl+'"] },
  { label: "查看模式", keys: ["Alt+R"] },
  { label: "切换主题", keys: ["Alt+Shift+D"] },
  { label: "画布与图形属性", keys: ["Alt+/"] },
  { label: "在画布中查找", keys: ["Ctrl+/"] },
  { label: "命令面板", keys: ["Ctrl+Shift+P", "Ctrl+P"] },
];

const EDITOR: ShortcutDef[] = [
  { label: "从通用元素创建流程图", keys: ["Ctrl+方向键"] },
  { label: "在流程图中导航", keys: ["Alt+方向键"] },
  { label: "移动画布", keys: ["Space+拖动", "Wheel+拖动"] },
  { label: "重置画布", keys: ["Ctrl+Delete"] },
  { label: "删除", keys: ["Delete"] },
  { label: "剪切", keys: ["Ctrl+X"] },
  { label: "拷贝", keys: ["Ctrl+C"] },
  { label: "粘贴", keys: ["Ctrl+V"] },
  { label: "粘贴为纯文本", keys: ["Ctrl+Shift+V"] },
  { label: "全部选中", keys: ["Ctrl+A"] },
  { label: "添加元素到选区", keys: ["Shift+单击"] },
  { label: "深度选择", keys: ["Ctrl+单击"] },
  { label: "在方框内深度选择并避免拖拽", keys: ["Ctrl+拖动"] },
  { label: "复制为 PNG 到剪贴板", keys: ["Shift+Alt+C"] },
  { label: "拷贝样式", keys: ["Ctrl+Alt+C"] },
  { label: "粘贴样式", keys: ["Ctrl+Alt+V"] },
  { label: "置于底层", keys: ["Ctrl+Shift+[", "Ctrl+Alt+["] },
  { label: "置于顶层", keys: ["Ctrl+Shift+]", "Ctrl+Alt+]"] },
  { label: "下移一层", keys: ["Ctrl+["] },
  { label: "上移一层", keys: ["Ctrl+]"] },
  { label: "顶部对齐", keys: ["Ctrl+Shift+↑"] },
  { label: "底端对齐", keys: ["Ctrl+Shift+↓"] },
  { label: "左对齐", keys: ["Ctrl+Shift+←"] },
  { label: "右对齐", keys: ["Ctrl+Shift+→"] },
  { label: "复制", keys: ["Ctrl+D", "Alt+拖动"] },
  { label: "锁定/解锁", keys: ["Ctrl+Shift+L"] },
  { label: "撤销", keys: ["Ctrl+Z"] },
  { label: "重做", keys: ["Ctrl+Y", "Ctrl+Shift+Z"] },
  { label: "编组", keys: ["Ctrl+G"] },
  { label: "解除编组", keys: ["Ctrl+Shift+G"] },
  { label: "水平翻转", keys: ["Shift+H"] },
  { label: "垂直翻转", keys: ["Shift+V"] },
  { label: "显示描边颜色选择器", keys: ["S"] },
  { label: "显示背景颜色选择器", keys: ["G"] },
  { label: "显示字体选择器", keys: ["Shift+F"] },
  { label: "缩小字体大小", keys: ["Ctrl+Shift+<"] },
  { label: "放大字体大小", keys: ["Ctrl+Shift+>"] },
];

interface HelpDialogProps {
  onClose: () => void;
  theme: "light" | "dark";
}

export default function HelpDialog({ onClose, theme }: HelpDialogProps) {
  const vars = (THEME_VARS[theme] as ThemeVars) as any;
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal help-modal" style={vars}>
        <div className="modal-head">
          <span>帮助</span>
          <button className="modal-close" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="HelpDialog">
            <div className="HelpDialog__logo-row">
              <a
                className="HelpDialog__btn HelpDialog__btn--muted"
                href="https://github.com/ChasenKai/KaiBoard"
                target="_blank"
                rel="noopener noreferrer"
                title="前往 GitHub 给 KaiBoard 点个 Star"
              >
                <span className="HelpDialog__link-icon">
                  <GitHubIcon />
                </span>
                给个 GitHub Star 吧
              </a>
              <a
                className="HelpDialog__btn HelpDialog__btn--muted"
                href="https://kailab.pages.dev"
                target="_blank"
                rel="noopener noreferrer"
                title="访问 KaiLab 官网"
              >
                <span className="HelpDialog__link-icon">
                  <SiteIcon />
                </span>
                {t("help_officialSite")}
              </a>
            </div>
            <h3>快捷键</h3>
            <div className="HelpDialog__islands-container">
              <Island cls="HelpDialog__island--tools" title="工具" items={TOOLS} />
              <Island cls="HelpDialog__island--view" title="视图" items={VIEW} />
              <Island
                cls="HelpDialog__island--editor"
                title="编辑器"
                items={EDITOR}
              />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <span className="spacer" />
          <button className="mini" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </>
  );
}
