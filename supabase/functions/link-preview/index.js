import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { parseHTML } from "npm:linkedom@0.18.9";
import ipaddr from "npm:ipaddr.js@2.2.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

// Explicit trusted hosts avoid turning this endpoint into an arbitrary fetch proxy.
// Include each shop/redirect hostname exactly. Do not add user-controlled domains.
const hosts = (name, defaults) => new Set((Deno.env.get(name) ?? defaults).split(",").map(x => x.trim().toLowerCase()).filter(Boolean));
// Swiss family favourites. Environment values replace these defaults.
const pageHosts = hosts("PREVIEW_ALLOWED_HOSTS",
  "galaxus.ch,www.galaxus.ch,digitec.ch,www.digitec.ch,zalando.ch,www.zalando.ch");
const imageHosts = new Set([...pageHosts, ...hosts("PREVIEW_IMAGE_HOSTS",
  "static.digitecgalaxus.ch,static01.galaxus.com,img01.ztat.net")]);

async function safeURL(raw, allowed, base) {
  const url = new URL(raw, base);
  if (url.href.length > 2000 || url.protocol !== "https:" || url.username || url.password ||
      url.port || !allowed.has(url.hostname) || ipaddr.isValid(url.hostname)) throw new Error("blocked_url");
  // Fail closed if DNS is unavailable or any address is not public unicast.
  const records = await Promise.allSettled([
    Deno.resolveDns(url.hostname, "A"), Deno.resolveDns(url.hostname, "AAAA"),
  ]);
  const addresses = records.flatMap(r => r.status === "fulfilled" ? r.value : []);
  if (!addresses.length || addresses.some(ip => ipaddr.process(ip).range() !== "unicast")) throw new Error("blocked_url");
  url.hash = "";
  return url;
}

async function boundedText(stream, maximum) {
  if (!stream) throw new Error("empty_body");
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "", size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > maximum) throw new Error("body_too_large");
      text += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
}

async function preview(raw, signal) {
  let url = await safeURL(raw, pageHosts);
  for (let redirect = 0; redirect <= 3; redirect++) {
    const response = await fetch(url, {
      redirect: "manual", signal,
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "FamilyWishlistPreview/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) throw new Error("invalid_redirect");
      url = await safeURL(location, pageHosts, url);
      continue;
    }
    if (!response.ok || !/^(text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get("content-type") || "")) {
      await response.body?.cancel();
      throw new Error("not_html");
    }
    const html = await boundedText(response.body, 1_000_000);
    // Parse metadata only; scripts are never executed and HTML is never returned.
    const { document } = parseHTML(html);
    const meta = (name) => [...document.querySelectorAll("meta")].find(el =>
      (el.getAttribute("property") || el.getAttribute("name") || "").toLowerCase() === name
    )?.getAttribute("content")?.trim();
    const title = (meta("og:title") || meta("twitter:title") || document.querySelector("title")?.textContent || "")
      .replace(/\s+/g, " ").trim().slice(0, 120);
    let image = null;
    for (const candidate of [meta("og:image:secure_url"), meta("og:image"), meta("twitter:image")]) {
      if (!candidate) continue;
      try { image = (await safeURL(candidate, imageHosts, url)).href; break; }
      catch { /* A missing or unapproved image does not discard the title. */ }
    }
    return { title, image };
  }
  throw new Error("too_many_redirects");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL"),
      Deno.env.get("PREVIEW_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"), {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const { data: { user }, error } = await db.auth.getUser(authorization.slice(7));
    if (error || !user) return json({ error: "unauthorized" }, 401);
    const membership = await db.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (membership.error || !membership.data) return json({ error: "forbidden" }, 403);
    if (!pageHosts.size) return json({ error: "not_configured" }, 503);
    let body;
    try { body = JSON.parse(await boundedText(request.body, 4096)); }
    catch { return json({ error: "invalid_request" }, 400); }
    if (typeof body?.url !== "string") return json({ error: "invalid_request" }, 400);
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, 8000);
      });
      const result = await Promise.race([preview(body.url, controller.signal), timeout]);
      return json(result);
    } finally { clearTimeout(timer); controller.abort(); }
  } catch {
    // Do not return remote page content, internal addresses, or token details.
    return json({ error: "preview_unavailable" }, 422);
  }
});
