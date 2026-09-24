// Cloudflare Pages 入口 Worker（Advanced Mode）
//
// 职责：
// 1) 将默认 pages.dev 域名 301 归一到自定义域
//    原因：CF Pages `_redirects` 不支持域名级重定向（source 只能是路径），故读 Host 头在边缘做 301。
// 2) 修复 soft-404：`env.ASSETS.fetch` 对缺失路径会 **SPA 回退成 index.html 并返回 200**，
//    导致所有垃圾 URL 被搜索引擎当成有效页（SEO 软 404）。本 worker 检测该回退，
//    改返 `404.html`（**真实 404 状态码**）。
//
// ⚠️ 与本文件等价的逻辑已在 kaibuddy.com 门户验证通过（同一模式）；但两站是各自独立的
//    CF Pages 项目 —— **改动不自动同步**，改一边记得看另一边（2026-09-24 就是因为不同步而遗漏）。
//
// Advanced Mode 下须用 env.ASSETS.fetch(request) 回退静态资源。
// （2026-09-24 修正：此前本 worker 只有职责 1，缺 not-found 检测 → kaiboard 站 soft-404。）
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1) 默认域名 → 自定义域
    if (url.hostname === "kaiboard.pages.dev") {
      url.hostname = "kaiboard.kaibuddy.com";
      return Response.redirect(url.toString(), 301);
    }

    const reqPath = url.pathname;

    // 2) clean URL 支持：/help → /help.html（若存在），避免无扩展名真实页被下面的 not-found 逻辑误杀。
    if (reqPath !== "/" && !reqPath.includes(".") && !reqPath.endsWith("/")) {
      const tryHtml = await env.ASSETS.fetch(new URL(reqPath + ".html", url));
      if (tryHtml.status === 200 && new URL(tryHtml.url).pathname === reqPath + ".html") {
        return tryHtml;
      }
    }

    const res = await env.ASSETS.fetch(request);

    // 3) not-found 检测：SPA 回退把缺失路径喂成 index.html（200）。
    //    真实首页请求 "/" 的 res.url 也是 /index.html，故放行 reqPath === "/"。
    if (res.status === 200 && reqPath !== "/" && new URL(res.url).pathname === "/index.html") {
      const nf = await env.ASSETS.fetch(new URL("/404.html", url));
      return new Response(nf.body, { status: 404, headers: nf.headers });
    }

    return res;
  },
};
