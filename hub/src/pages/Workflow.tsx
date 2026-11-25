import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { carbonQuery } from "../integrations/supabase/client";
import { ECMD_SIDEBAR_BOOT_PROMPT } from "../lib/ecmdBootPrompt";

interface TelemetryData {
  status?: string;
  updatedAt?: string;
  tscClean?: boolean;
  cliSummary?: string;
}

export default function Workflow() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [viteHealth, setViteHealth] = useState<"checking" | "online" | "offline">("checking");
  const [supabaseHealth, setSupabaseHealth] = useState<"checking" | "online" | "error">("checking");
  const [supabaseDetails, setSupabaseDetails] = useState<string>("Checking schema...");

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  useEffect(() => {
    // 1. Check Vite port 8080 health
    const checkVite = async () => {
      try {
        const res = await fetch("/ai-telemetry.json?t=" + Date.now(), { method: "HEAD" });
        setViteHealth(res.ok ? "online" : "offline");
      } catch {
        setViteHealth("offline");
      }
    };

    // 2. Poll ai-telemetry.json
    let mounted = true;
    const fetchTelemetry = async () => {
      try {
        const res = await fetch("/ai-telemetry.json?t=" + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (mounted) setTelemetry(data);
        }
      } catch {
        // preserve previous state
      }
    };

    // 3. Check Supabase connection
    const checkSupabase = async () => {
      try {
        const rows = await carbonQuery("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema='public'");
        if (mounted) {
          setSupabaseHealth("online");
          const count = rows?.[0]?.cnt ?? "OK";
          setSupabaseDetails(`Connected (${count} public tables ready)`);
        }
      } catch (err: any) {
        if (mounted) {
          setSupabaseHealth("error");
          setSupabaseDetails(err?.message || "Bridge unreachable");
        }
      }
    };

    checkVite();
    fetchTelemetry();
    checkSupabase();

    const interval = setInterval(() => {
      checkVite();
      fetchTelemetry();
    }, 2500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const sidebarBootPrompt = ECMD_SIDEBAR_BOOT_PROMPT;

  return (
    <div className="min-h-screen bg-[#040B14] text-[#F8FAFC] pb-16 font-sans">
      {/* Hero Header */}
      <div className="border-b border-emerald-500/20 bg-gradient-to-b from-[#062825] to-[#040B14] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                ECMD Carbon 4 Operating Protocol
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Workflow &amp; Boot-Up Guide
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300 leading-relaxed">
                Eyes (Chrome Sidebar Visual Architect) + Pen (ECMD PEN v4 — Antigravity CLI <code className="text-emerald-300">agy</code> Execution Engine). Launch and orchestrate the entire full-stack system in 30 seconds.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                to="/console"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Command Console ↗
              </Link>
              <a
                href="https://studio.plasmic.app/projects/mrkoQykvpZZfVbEc1yjabw/-/Homepage"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-emerald-500/30 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-slate-800"
              >
                Plasmic Studio ↗
              </a>
              <Link
                to="/"
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                Live Site (/)
              </Link>
            </div>
          </div>

          {/* Live System Health Strip */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Vite Server Health */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    viteHealth === "online"
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                      : viteHealth === "checking"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Vite Dev Server</div>
                  <div className="text-sm font-semibold text-white">localhost:8080</div>
                </div>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                  viteHealth === "online"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : viteHealth === "checking"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {viteHealth === "online" ? "ONLINE" : viteHealth === "checking" ? "CHECKING" : "OFFLINE"}
              </span>
            </div>

            {/* Pen Status Health */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    telemetry?.status === "COMPLETE_CLEAN" || telemetry?.tscClean
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                      : telemetry?.status === "RUNNING"
                      ? "bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                      : "bg-amber-400"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">ECMD PEN V4 STATUS</div>
                  <div className="text-sm font-semibold text-white">
                    {telemetry?.status || "Standing By"}
                  </div>
                </div>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                  telemetry?.status === "COMPLETE_CLEAN" || telemetry?.tscClean
                    ? "bg-emerald-500/20 text-emerald-400"
                    : telemetry?.status === "RUNNING"
                    ? "bg-sky-500/20 text-sky-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {telemetry?.tscClean ? "tsc: 0 errors" : telemetry?.status || "READY"}
              </span>
            </div>

            {/* Supabase Health */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    supabaseHealth === "online"
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                      : supabaseHealth === "checking"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-rose-400"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Supabase Postgres</div>
                  <div className="truncate text-sm font-semibold text-white" title={supabaseDetails}>
                    {supabaseHealth === "online" ? "lvynkeuceiqxafgpgdvs" : "Checking..."}
                  </div>
                </div>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                  supabaseHealth === "online"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : supabaseHealth === "checking"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {supabaseHealth === "online" ? "CONNECTED" : supabaseHealth === "checking" ? "PINGING" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Step-by-Step Guide */}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 space-y-8">
        {/* Step 1: 30-Second Terminal Startup */}
        <section className="rounded-2xl border border-emerald-500/25 bg-[#06101E]/90 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-xs font-black text-slate-950">
                1
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">Launch Local Daemons (30 Seconds)</h2>
                <p className="text-xs text-slate-400">Run two PowerShell terminal windows side-by-side in C:\ECMD</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard("all-terminals", "# Terminal 1: Vite Dev Server\nstartplasmic\n\n# Terminal 2: ECMD PEN v4 Runner (Antigravity agy)\nepen")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
            >
              {copiedKey === "all-terminals" ? "✓ Copied Both!" : "Copy Startup Block"}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Terminal 1 */}
            <div className="rounded-xl border border-slate-800 bg-[#030710] p-4">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-mono font-semibold text-slate-400">Terminal 1 (Vite &amp; Plasmic)</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard("t1", "startplasmic")}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                >
                  {copiedKey === "t1" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre className="mt-1 rounded-lg bg-[#070D18] p-3 font-mono text-xs text-emerald-400">startplasmic</pre>
              <p className="mt-2 text-[11px] text-slate-400">
                Hosts your local Vite dev server on <code className="text-emerald-300">http://localhost:8080</code> for Plasmic Studio canvas connection.
              </p>
            </div>

            {/* Terminal 2 */}
            <div className="rounded-xl border border-slate-800 bg-[#030710] p-4">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-mono font-semibold text-slate-400">Terminal 2 (ECMD PEN v4 — agy.exe)</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard("t2", "epen")}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                >
                  {copiedKey === "t2" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre className="mt-1 rounded-lg bg-[#070D18] p-3 font-mono text-xs text-emerald-400">epen</pre>
              <p className="mt-2 text-[11px] text-slate-400">
                Launches ECMD PEN v4 via <code className="text-emerald-300">epen</code> -&gt; Antigravity <code className="text-emerald-300">agy.exe --output-format stream-json</code>, self-healing <code className="text-emerald-300">npx tsc --noEmit</code> &amp; <code className="text-emerald-300">npx vitest run</code> loop, and live telemetry logging.
              </p>
            </div>
          </div>
        </section>

        {/* Step 2: Chrome Sidebar Boot-Up Prompt */}
        <section className="rounded-2xl border border-emerald-500/25 bg-[#06101E]/90 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-xs font-black text-slate-950">
                2
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">Boot Up Chrome Gemini Sidebar (The Eyes)</h2>
                <p className="text-xs text-slate-400">Paste this prompt into any fresh Chrome Sidebar chat to ground the AI visual architect</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard("sidebar-prompt", sidebarBootPrompt)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              {copiedKey === "sidebar-prompt" ? "✓ Prompt Copied!" : "Copy Sidebar Boot Prompt"}
            </button>
          </div>

          <div className="mt-4">
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#030710] p-4 font-mono text-xs text-slate-300 leading-relaxed">
              {sidebarBootPrompt}
            </pre>
          </div>
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-[#04111E] p-3.5 text-xs text-slate-300 leading-relaxed">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Official Site Themes UI Terminology Glossary
            </div>
            <ul className="mt-1.5 space-y-1 text-slate-300">
              <li>
                <strong className="text-white">Theme Groups Inspector</strong> (short name: <strong className="text-emerald-300">Groups Inspector</strong>, also referred to as <em>&ldquo;groups console&rdquo;</em>) = the <code className="text-emerald-300">[Site Themes] -&gt; Groups</code> per-state CSS class/selector styling panel (sticky <strong className="text-emerald-200">Search Bar + Auto A–Z Natural Sort + Pinning + Collapse/Expand All</strong>, in-card <strong className="text-emerald-200"><code>Copy Attributes From ▾</code></strong> dropdown with <code>All States / This State / All Themes</code> + 1-click <code>Undo</code>, <code>Default / Hover / Focus / Selected / Sel+Hover / Disabled</code> with automatic <strong className="text-emerald-200">Live Canvas State Preview</strong> <code>[👁️ Showing &lt;State&gt; on Canvas]</code> via transient <code>#ecmd-theme-live-state-preview</code>, Border <code>Off / 0px</code>, <code>Width (0–16px)</code>, <code>Style</code>, Gradient Color Studio, Shadows, &amp; Fluid Auto-Scale).
              </li>
              <li>
                <strong className="text-white">Image Groups Inspector</strong> = the <code className="text-sky-300">[Site Themes] -&gt; Images</code> per-theme asset swap &amp; sizing panel with sticky Search + Auto A–Z Natural Sort + Pinning + Collapse/Expand All + in-card <code>Copy Attributes From ▾</code> (<code>Sizing &amp; Fit Only</code> vs <code>Sizing + Image Asset</code> + 1-click <code>Undo</code>).
              </li>
              <li>
                <strong className="text-white">Design Tokens Manager</strong> = the <code className="text-violet-300">[Site Themes] -&gt; Tokens</code> reusable attribute &amp; effect tokens registry (<code>boxShadow</code>, <code>textShadow</code>, <code>paint</code>, <code>border</code>, <code>radius</code>) with sticky Search + Auto A–Z Natural Sort + Pinning + Collapse/Expand All, per-theme <code>themeOverrides</code>, and linked token pills inside Groups.
              </li>
            </ul>
          </div>
        </section>

        {/* Step 3: Eyes + Pen Handshake Lifecycle */}
        <section className="rounded-2xl border border-emerald-500/25 bg-[#06101E]/90 p-6 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-xs font-black text-slate-950">
              3
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">The Eyes + Pen Architectural Lifecycle</h2>
              <p className="text-xs text-slate-400">How changes move seamlessly from visual conception to self-healed production code</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800/80 bg-[#050D18] p-4 text-center">
              <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-lg text-emerald-400">
                👁️
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Phase 1: Eyes</div>
              <div className="mt-1 text-sm font-semibold text-white">Visual Grounding</div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Sidebar inspects open tabs and live DOM in 0ms. Formulates a plan and waits for your confirmation.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#050D18] p-4 text-center">
              <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-lg text-emerald-400">
                ✍️
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Phase 2: Pen</div>
              <div className="mt-1 text-sm font-semibold text-white">Antigravity CLI (agy)</div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Antigravity CLI (<code className="text-emerald-300">agy.exe</code> via <code className="text-emerald-300">epen</code> -&gt; ECMD PEN v4) streams tool calls via <code className="text-emerald-300">stream-json</code>, edits files natively, and executes SQL.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#050D18] p-4 text-center">
              <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-lg text-emerald-400">
                🛡️
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Phase 3: Self-Heal</div>
              <div className="mt-1 text-sm font-semibold text-white">TypeScript Loop</div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Runs <code className="text-emerald-300">npx tsc --noEmit</code> repeatedly in-turn until zero errors remain before completing.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#050D18] p-4 text-center">
              <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-lg text-emerald-400">
                ⚡
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Phase 4: Telemetry</div>
              <div className="mt-1 text-sm font-semibold text-white">0ms Audit Trail</div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Results stream to Command Console &amp; Turn Log. Sidebar reads updated state with 0ms lag.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
