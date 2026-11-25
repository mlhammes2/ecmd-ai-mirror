import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const KEY = "[REDACTED_SECRET]";
const dec = (s: string | null) => { if (!s) return ""; const b64 = s.replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(b64); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };
Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /\n", { headers: { "Content-Type": "text/plain" } });
  if (url.searchParams.get("k") !== KEY) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const op = url.searchParams.get("op") || "status";
  if (op === "list") {
    const { data, error } = await sb.from("ecmd_files_mirror").select("path, updated_at").order("path");
    return Response.json({ ok: !error, files: data, error });
  }
  if (op === "read") {
    const p = url.searchParams.get("path") || dec(url.searchParams.get("p64"));
    const { data, error } = await sb.from("ecmd_files_mirror").select("*").eq("path", p).maybeSingle();
    return Response.json({ ok: !error, file: data, error });
  }
  if (op === "sql") {
    const q = dec(url.searchParams.get("q64")) || url.searchParams.get("q") || "";
    const { data, error } = await sb.rpc("ecmd_exec_sql", { q });
    return Response.json({ ok: !error, result: data, error });
  }
  if (op === "job") {
    const action = url.searchParams.get("act") || "tsc";
    const file_path = url.searchParams.get("path") || dec(url.searchParams.get("p64"));
    const find_str = dec(url.searchParams.get("f64"));
    const replace_str = dec(url.searchParams.get("r64"));
    const full_content = dec(url.searchParams.get("c64"));
    const shell_cmd = dec(url.searchParams.get("s64"));
    const { data: ins, error: insErr } = await sb.from("ecmd_dev_jobs").insert({ status: "pending", action, file_path, find_str, replace_str, full_content, shell_cmd }).select("id").single();
    if (insErr || !ins) return Response.json({ ok: false, error: insErr });
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const { data: row } = await sb.from("ecmd_dev_jobs").select("*").eq("id", ins.id).single();
      if (row && row.status !== "pending" && row.status !== "running") return Response.json({ ok: true, job: row });
    }
    return Response.json({ ok: true, timed_out_waiting_for_worker: true, job_id: ins.id });
  }
  const { data: jobs } = await sb.from("ecmd_dev_jobs").select("id, status, action, file_path, tsc_clean, output, created_at").order("created_at", { ascending: false }).limit(5);
  return Response.json({ ok: true, latest_jobs: jobs });
});
