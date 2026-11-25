export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n", { headers: { "Content-Type": "text/plain" } });
    }
    const target = "https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-dev-gateway" + url.search;
    const resp = await fetch(target, { method: "GET" });
    const text = await resp.text();
    return new Response("<pre>" + text.replace(/</g, "&lt;") + "</pre>", { status: resp.status, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
};
