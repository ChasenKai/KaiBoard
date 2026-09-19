## 变更说明 / What changed
简要描述本 PR 做了什么、为什么。  
Briefly describe what this PR does and why.

## 关联 / Related
- 关闭 #（issue 编号） / Closes # (issue number)

## 检查清单 / Checklist
- [ ] 自测通过（`npm run typecheck` 与 `npm run build` 均成功）  
  Self-tested (`npm run typecheck` and `npm run build` both pass).
- [ ] 如涉及构建脚本，确认 `scripts/prepare-fonts.mjs` 的三级降级清理链未被破坏  
  If build scripts are involved, confirm the three-level fallback cleanup chain in `scripts/prepare-fonts.mjs` is not broken.
- [ ] 如引入新依赖，已同步更新 `package.json` 与 `package-lock.json`  
  If new dependencies are introduced, `package.json` and `package-lock.json` are updated.
- [ ] 如涉及对外文案 / 文档，口径与 README 的定位说明保持一致  
  If public-facing copy/docs changed, they stay consistent with the README positioning.
- [ ] 文档（如适用）已同步 / Docs updated (if applicable).

## 备注 / Notes
设计决策、兼容性影响、后续计划等。  
Design decisions, compatibility impact, follow-up plans, etc.
