import React from "react";

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * 根错误边界：任意子组件渲染抛错时，避免整页白屏、未保存数据瞬间丢失。
 * 显示可恢复提示 + 重新加载按钮（重新加载会重新挂载，未落盘的内容由自动保存兜底）。
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // 仅记录到控制台，不向用户暴露技术细节
    console.error("[KaiBoard] render error caught by boundary:", error, info);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            color: "#1f2933",
            background: "#f8f9fa",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20 }}>出错了 / Something went wrong</h2>
          <p style={{ margin: 0, maxWidth: 520, color: "#52606d", fontSize: 14, lineHeight: 1.6 }}>
            白板遇到了一个意外错误，已被安全拦截。你的数据通常已由自动保存兜底；
            重新加载即可继续。若反复出现，请尝试「导出全部」备份当前工作区。
            <br />
            KaiBoard hit an unexpected error and recovered safely. Reload to continue.
            {this.state.message ? (
              <span style={{ display: "block", marginTop: 10, fontFamily: "monospace", fontSize: 12, color: "#9aa5b1" }}>
                {this.state.message}
              </span>
            ) : null}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: "#1971c2",
              color: "#fff",
            }}
          >
            重新加载 / Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
