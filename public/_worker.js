// Cloudflare Pages 入口 Worker：将默认 pages.dev 域名 301 归一到自定义域
// 注意：CF Pages _redirects 不支持域名级重定向（source 只能是路径），
// 因此通过读取 Host 头在边缘做 301。
// Advanced Mode 下须用 env.ASSETS.fetch(request) 回退静态资源。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "kaiboard.pages.dev") {
      url.hostname = "kaiboard.kaibuddy.com";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
