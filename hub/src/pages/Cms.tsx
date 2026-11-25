import React, { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { carbonQuery } from "../integrations/supabase/client";
import { DEFAULT_WIX_SITE_MENU_BUTTONS, SiteMenuButtonItem } from "../components/EcmdSideMenuController";

interface WixVaultMeta {
  file_path: string;
  category: string;
  wix_page_or_module: string;
  line_count: number;
  source_origin: string;
  description: string;
}

interface ActiveVaultCode {
  file_path: string;
  category: string;
  content: string;
  line_count: number;
  synced_at?: string;
  source_origin?: string;
}

export default function Cms() {
  const [activeTab, setActiveTab] = useState<"pages" | "components" | "site_menu" | "database" | "wix_vault" | "plasmic_layout">("pages");

  // Site Menu Buttons state
  const [menuButtons, setMenuButtons] = useState<SiteMenuButtonItem[]>(DEFAULT_WIX_SITE_MENU_BUTTONS);
  const [menuLoading, setMenuLoading] = useState<boolean>(false);

  // Wix Vault state
  const [vaultItems, setVaultItems] = useState<WixVaultMeta[]>([]);
  const [vaultLoading, setVaultLoading] = useState<boolean>(false);
  const [vaultSearch, setVaultSearch] = useState<string>("");
  const [vaultCategory, setVaultCategory] = useState<string>("ALL");
  const [viewingCode, setViewingCode] = useState<ActiveVaultCode | null>(null);
  const [codeLoading, setCodeLoading] = useState<boolean>(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Plasmic Layout Hydration state
  const [plasmicHydration, setPlasmicHydration] = useState<any>(null);
  const [plasmicLoading, setPlasmicLoading] = useState<boolean>(false);
  const [layoutSearch, setLayoutSearch] = useState<string>("");
  const [copiedHydrationJson, setCopiedHydrationJson] = useState<boolean>(false);

  useEffect(() => {
    loadVaultManifest();
    loadSiteMenuButtons();
    loadPlasmicHydration();
  }, []);

  useEffect(() => {
    if (activeTab === "wix_vault" && vaultItems.length === 0) {
      loadVaultManifest();
    }
    if (activeTab === "site_menu") {
      loadSiteMenuButtons();
    }
    if (activeTab === "plasmic_layout" && !plasmicHydration) {
      loadPlasmicHydration();
    }
  }, [activeTab]);

  const loadPlasmicHydration = async () => {
    setPlasmicLoading(true);
    try {
      const res = await fetch("/plasmic-layout-hydration.json?t=" + Date.now());
      if (res.ok) {
        const data = await res.json();
        setPlasmicHydration(data);
      }
    } catch {
      // fallback
    } finally {
      setPlasmicLoading(false);
    }
  };

  const loadSiteMenuButtons = async () => {
    setMenuLoading(true);
    try {
      const rows = await carbonQuery<SiteMenuButtonItem>(
        "SELECT id, button_id, slug, label, category, category_order, sort_order, icon_name, css_classes, action_key, target_url, enabled, notes FROM public.ecmd_site_menu_buttons ORDER BY category_order, sort_order"
      );
      if (rows && rows.length > 0) {
        setMenuButtons(rows);
      }
    } catch (e) {
      // fallback to DEFAULT_WIX_SITE_MENU_BUTTONS
    } finally {
      setMenuLoading(false);
    }
  };

  const loadVaultManifest = async () => {
    setVaultLoading(true);
    try {
      const res = await fetch("/wix-vault-index.json?t=" + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setVaultItems(data);
        }
      }
    } catch {
      // fallback
    } finally {
      setVaultLoading(false);
    }
  };

  const openCodeViewer = async (item: WixVaultMeta) => {
    setCodeLoading(true);
    setCodeError(null);
    setCopiedCode(false);
    try {
      const escapedPath = item.file_path.replace(/'/g, "''");
      const rows = await carbonQuery<ActiveVaultCode>(
        `SELECT file_path, category, content, line_count, synced_at, source_origin FROM public.ecmd_wix_legacy_vault WHERE file_path = '${escapedPath}' LIMIT 1`
      );
      if (rows && rows.length > 0 && rows[0]) {
        setViewingCode(rows[0]);
      } else {
        setCodeError("File content not found in Supabase public.ecmd_wix_legacy_vault.");
      }
    } catch (err: any) {
      setCodeError(err.message || "Failed to load code from Supabase.");
    } finally {
      setCodeLoading(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (!viewingCode?.content) return;
    navigator.clipboard.writeText(viewingCode.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Filtered vault items
  const filteredVaultItems = useMemo(() => {
    return vaultItems.filter((item) => {
      if (vaultCategory !== "ALL" && item.category !== vaultCategory) return false;
      if (!vaultSearch.trim()) return true;
      const q = vaultSearch.toLowerCase();
      return (
        item.file_path.toLowerCase().includes(q) ||
        item.wix_page_or_module.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [vaultItems, vaultSearch, vaultCategory]);

  const vaultCategories = useMemo(() => {
    const set = new Set<string>();
    vaultItems.forEach((i) => set.add(i.category));
    return Array.from(set);
  }, [vaultItems]);

  return (
    <div className="min-h-screen bg-[#040B14] text-[#F8FAFC] pb-16 font-sans">
      {/* Header Banner */}
      <div className="border-b border-emerald-500/20 bg-gradient-to-b from-[#062825] to-[#040B14] px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                CMS &amp; Plasmic Directory
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Pages &amp; CMS Structure
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-slate-300">
                Clean Wix CMS-style directory mapping live routes, Plasmic Studio visual components, Supabase Postgres CRM collections, and permanently archived legacy Wix code.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://studio.plasmic.app/projects/mrkoQykvpZZfVbEc1yjabw/-/Homepage"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
              >
                Open Plasmic Studio ↗
              </a>
              <Link
                to="/console"
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                Command Console ↗
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Routes</div>
              <div className="mt-1 text-2xl font-black text-white">6</div>
              <div className="text-[10px] text-emerald-400">Vite + TanStack Start</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Plasmic Components</div>
              <div className="mt-1 text-2xl font-black text-white">5+</div>
              <div className="text-[10px] text-sky-400">Code components registered</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Site Menu Buttons</div>
              <div className="mt-1 text-2xl font-black text-emerald-300">{menuButtons.length || 17}</div>
              <div className="text-[10px] text-emerald-400">#siteMenu Wix Matched</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Supabase Tables</div>
              <div className="mt-1 text-2xl font-black text-white">8+</div>
              <div className="text-[10px] text-emerald-400">lvynkeuceiqxafgpgdvs</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Wix Vault Archived</div>
              <div className="mt-1 text-2xl font-black text-emerald-300">{vaultItems.length || 106}</div>
              <div className="text-[10px] text-emerald-400">ecmd_wix_legacy_vault</div>
            </div>
          </div>

          {/* Section Navigation Pills */}
          <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-800 pb-1">
            <button
              type="button"
              onClick={() => setActiveTab("pages")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "pages"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📄 Routes &amp; Page Directory
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("components")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "components"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🧩 Plasmic Wrapper Components
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("site_menu")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "site_menu"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ☰ Site Menu Buttons (#siteMenu)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("database")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "database"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🗄️ Supabase CRM Collections
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("wix_vault")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "wix_vault"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🏛️ Wix Legacy Vault (40+ Files)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("plasmic_layout")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === "plasmic_layout"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🎨 Plasmic Layout &amp; Elements
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 space-y-8">
        {/* TAB 1: Routes & Page Directory */}
        {activeTab === "pages" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Wix CMS-Style Route Directory</h2>
              <span className="text-xs text-slate-400">Maps frontend URLs to Plasmic Studio &amp; React sources</span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#06101E]/90 shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-[#030712] font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Route Path</th>
                    <th className="p-3.5">Page Title</th>
                    <th className="p-3.5">Render Engine</th>
                    <th className="p-3.5">Source Component</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  <tr className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-bold text-emerald-400">/</td>
                    <td className="p-3.5 font-sans font-medium text-white">Homepage (Live Customer Site)</td>
                    <td className="p-3.5"><span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">Plasmic Studio</span></td>
                    <td className="p-3.5 text-slate-400 text-[11px]">src/pages/Homepage.tsx</td>
                    <td className="p-3.5 text-right"><Link to="/" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">View Live ↗</Link></td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-bold text-emerald-400">/workflow</td>
                    <td className="p-3.5 font-sans font-medium text-white">Workflow &amp; Boot-Up</td>
                    <td className="p-3.5"><span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">React + Vite</span></td>
                    <td className="p-3.5 text-slate-400 text-[11px]">src/pages/Workflow.tsx</td>
                    <td className="p-3.5 text-right"><Link to="/workflow" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">Open ↗</Link></td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-bold text-emerald-400">/console</td>
                    <td className="p-3.5 font-sans font-medium text-white">Command Console (Pen Telemetry)</td>
                    <td className="p-3.5"><span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">React + Vite</span></td>
                    <td className="p-3.5 text-slate-400 text-[11px]">src/pages/Console.tsx</td>
                    <td className="p-3.5 text-right"><Link to="/console" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">Open ↗</Link></td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-bold text-emerald-400">/history</td>
                    <td className="p-3.5 font-sans font-medium text-white">Action &amp; Turn Log</td>
                    <td className="p-3.5"><span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">React + Vite</span></td>
                    <td className="p-3.5 text-slate-400 text-[11px]">src/pages/History.tsx</td>
                    <td className="p-3.5 text-right"><Link to="/history" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">Open ↗</Link></td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-bold text-emerald-400">/cms</td>
                    <td className="p-3.5 font-sans font-medium text-white">Pages &amp; CMS Structure</td>
                    <td className="p-3.5"><span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">React + Vite</span></td>
                    <td className="p-3.5 text-slate-400 text-[11px]">src/pages/Cms.tsx</td>
                    <td className="p-3.5 text-right"><span className="text-xs text-slate-500">Current</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-bold text-emerald-400">/plasmic-host</td>
                    <td className="p-3.5 font-sans font-medium text-white">Plasmic Studio Canvas Host</td>
                    <td className="p-3.5"><span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400">Plasmic Canvas</span></td>
                    <td className="p-3.5 text-slate-400 text-[11px]">src/routes/plasmic-host.tsx</td>
                    <td className="p-3.5 text-right"><a href="/plasmic-host" target="_blank" rel="noreferrer" className="text-xs font-semibold text-purple-400 hover:text-purple-300">Host ↗</a></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Plasmic Wrapper Components */}
        {activeTab === "components" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Plasmic Code Components &amp; Layout Wrappers</h2>
              <span className="text-xs text-slate-400">Visual atoms configured for studio editing</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">EcmdThemeLogo</span>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Header Atom</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Dynamic SVG brand dolphin logo with auto-fallback to text, configurable dimension props (width/height), and click-to-home navigation.
                </p>
                <div className="mt-3 text-[10px] font-mono text-slate-500">src/components/EcmdThemeLogo.tsx</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">EcmdHoverTooltip</span>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">UI Molecule</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Sub-millisecond hover popover with custom arrow placement, delay prop, and dark emerald backdrop blur styling.
                </p>
                <div className="mt-3 text-[10px] font-mono text-slate-500">src/components/EcmdHoverTooltip.tsx</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">EcmdAuthModalController</span>
                  <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">State Controller</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Controls customer login, signup modal presentation, session persistence, and logout flow across Plasmic templates.
                </p>
                <div className="mt-3 text-[10px] font-mono text-slate-500">src/components/EcmdAuthModalController.tsx</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">EcmdDeviceGlobalContext</span>
                  <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">Global Context</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Global viewport size, mobile vs desktop layout state provider with live resize observers.
                </p>
                <div className="mt-3 text-[10px] font-mono text-slate-500">src/components/EcmdDeviceGlobalContext.tsx</div>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">EcmdSideMenuController</span>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Menu Atom (☰)</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Wix #siteMenu repeater modal controller with Google-style category dividers, 17 Wix-matched buttons, fixed breakout, and full Site Themes (Group 3 Modals &amp; Group 4 Text Buttons) reactive styling.
                </p>
                <div className="mt-3 text-[10px] font-mono text-slate-500">src/components/EcmdSideMenuController.tsx</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">EcmdVehicleSelector</span>
                  <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300">Vehicle Selector</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  4-slot vehicle size selector (Coupe, Truck, Sm. SUV, Lg. SUV). Manages the selected vehicle state, persists it to localStorage, and dispatches an 'ecmd-vehicle-change' event.
                </p>
                <div className="mt-3 text-[10px] font-mono text-slate-500">src/components/EcmdVehicleSelector.tsx</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">EcmdPackagesRepeater</span>
                  <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-300">Packages Repeater</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Connects to Supabase to fetch public.ecmd_packages, listens for the 'ecmd-vehicle-change' event, and uses a Plasmic slot exposing context to its children. Includes data-ecmd-pkg hooks.
                </p>
                <div className="mt-3 text-[10px] font-mono text-slate-500">src/components/EcmdPackagesRepeater.tsx</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Site Menu Buttons (#siteMenu) */}
        {activeTab === "site_menu" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Wix Site Menu Buttons (#siteMenu)</h2>
                <span className="text-xs text-slate-400">
                  Exact button names, labels, icons, DOM IDs, and category groupings from legacy Wix repeater
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-300">
                  {menuLoading ? "Syncing..." : `${menuButtons.length} Wix Buttons Live`}
                </span>
                <span className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-mono text-slate-400">
                  Table: public.ecmd_site_menu_buttons
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#06101E]/90 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-[#030712] font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Category (Order)</th>
                      <th className="p-3.5">Sort</th>
                      <th className="p-3.5">Label</th>
                      <th className="p-3.5">DOM ID</th>
                      <th className="p-3.5">Button ID / Action Key</th>
                      <th className="p-3.5">CSS Theme Classes</th>
                      <th className="p-3.5">Target Route / URL</th>
                      <th className="p-3.5 text-right">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {menuButtons.map((btn) => (
                      <tr key={btn.button_id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3.5 font-sans">
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            {btn.category} ({btn.category_order})
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400 text-center font-bold">
                          {btn.sort_order}
                        </td>
                        <td className="p-3.5 font-sans font-medium text-white flex items-center gap-2">
                          <span className="text-emerald-400 font-mono text-xs">[{btn.icon_name || "•"}]</span>
                          <span>{btn.label}</span>
                        </td>
                        <td className="p-3.5 font-mono text-emerald-400 font-semibold">
                          #ecmd-menu-btn-{btn.slug}
                        </td>
                        <td className="p-3.5 text-slate-300 text-[11px]">
                          <div>{btn.button_id}</div>
                          <div className="text-[10px] text-sky-400">{btn.action_key || "none"}</div>
                        </td>
                        <td className="p-3.5 text-slate-400 text-[10px]">
                          {btn.css_classes || "ecmd-group-4 text-buttons gm-menu-item side-menu-btn"}
                        </td>
                        <td className="p-3.5 font-sans text-sky-300 text-[11px]">
                          {btn.target_url || "/"}
                        </td>
                        <td className="p-3.5 text-right text-slate-400 text-[10px] font-sans">
                          {btn.notes || "Wix #siteMenu"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Supabase CRM Collections */}
        {activeTab === "database" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Supabase CRM Collections (WeWeb Native)</h2>
              <span className="text-xs text-emerald-400">Connected: lvynkeuceiqxafgpgdvs</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">ecmd_crm_jobs</span>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Core CRM</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  All customer bookings, job status (Scheduled, En Route, In Progress, Completed), assigned detailer, pricing breakdown, and scheduled times.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">ecmd_crm_customers</span>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Core CRM</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Customer contact profiles, email addresses, phone numbers, total spend, garage vehicle associations, and lifetime service history.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">ecmd_crm_contractors</span>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Dispatch</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Independent mobile detailers, contact emails (whitespace-sanitized for Google Calendar dispatch), commission percentages, and availability.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">ecmd_crm_vehicles</span>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Garage</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Customer vehicles, VINs, makes, models, years, size categories (Sedan, SUV, Truck, Van), and detailing histories.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">ecmd_crm_locations</span>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Routing</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Customer service addresses, street coordinates, access instructions (gate codes), and geographic zones.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">ecmd_advanced_suggestions</span>
                  <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">AI Vault</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Persistent Super Advanced Suggestions vault storing architectural upgrades, required accounts, and roadmap statuses.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-[#071324] p-4">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">🛡️ Migration-First Guardrail Active</div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Notice: We never create new Wix CMS collections. All backend data lives in Supabase Postgres (<code className="text-emerald-300">lvynkeuceiqxafgpgdvs</code>). This ensures your entire CRM, booking database, and AI telemetry remain 100% portable when moving the frontend to WeWeb or Plasmic!
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Wix Legacy Vault (Reference) */}
        {activeTab === "wix_vault" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Wix Legacy Vault</span>
                  <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 text-xs font-mono">
                    {filteredVaultItems.length} items
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  Archived permanently in Supabase <code className="text-emerald-300">public.ecmd_wix_legacy_vault</code>. Click any file to view full code or schema.
                </p>
              </div>

              <button
                type="button"
                onClick={loadVaultManifest}
                disabled={vaultLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
              >
                <span className={vaultLoading ? "animate-spin" : ""}>↻</span>
                <span>Refresh Index</span>
              </button>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3">
              <div className="flex flex-1 items-center gap-2 min-w-[240px]">
                <span className="text-slate-400 text-sm">🔍</span>
                <input
                  type="text"
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  placeholder="Search file path, module name, or description (e.g. data.js, Booking HQ)..."
                  className="w-full rounded-lg border border-slate-800 bg-[#030712] px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                {vaultSearch && (
                  <button
                    type="button"
                    onClick={() => setVaultSearch("")}
                    className="text-xs text-slate-400 hover:text-white px-1.5"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setVaultCategory("ALL")}
                  className={`rounded-md px-2.5 py-1 font-semibold transition ${
                    vaultCategory === "ALL"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  All Categories
                </button>
                {vaultCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setVaultCategory(cat)}
                    className={`rounded-md px-2.5 py-1 font-semibold transition ${
                      vaultCategory === cat
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {cat.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Vault items grid */}
            {vaultLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading Wix Legacy Vault manifest...</div>
            ) : filteredVaultItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-[#06101E]/40 p-12 text-center">
                <div className="text-3xl mb-2">🏛️</div>
                <div className="text-sm font-bold text-white">No Wix Legacy Files Match Filter</div>
                <p className="mt-1 text-xs text-slate-400">Try broadening your search query or reset category filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVaultItems.map((item) => (
                  <div
                    key={item.file_path}
                    className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#06101E] p-4 transition hover:border-emerald-500/40 hover:bg-[#071324]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-400 break-all">
                          {item.wix_page_or_module}
                        </span>
                        <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 whitespace-nowrap">
                          {item.line_count} lines
                        </span>
                      </div>

                      <div className="mt-1">
                        <span className="inline-block rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          {item.category}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>

                      <div className="mt-2 font-mono text-[10px] text-slate-500 truncate" title={item.file_path}>
                        {item.file_path}
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                        {item.source_origin.split("\\").pop() || "Archived"}
                      </span>
                      <button
                        type="button"
                        onClick={() => openCodeViewer(item)}
                        className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
                      >
                        View Code ↗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Plasmic Page Layout & Element Data Inspector */}
        {activeTab === "plasmic_layout" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🎨 Plasmic Page Layout &amp; Element Map</span>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400 border border-emerald-500/20">
                    Hydrated Live
                  </span>
                </h2>
                <span className="text-xs text-slate-400">
                  Full DOM element IDs, hierarchy, slots, and interactive hooks synchronized for Chrome Sidebar AI &amp; WeWeb.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter IDs, components, selectors..."
                  value={layoutSearch}
                  onChange={(e) => setLayoutSearch(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-[#02050B] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none w-64"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(plasmicHydration, null, 2));
                    setCopiedHydrationJson(true);
                    setTimeout(() => setCopiedHydrationJson(false), 2000);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                >
                  {copiedHydrationJson ? "✓ Copied JSON" : "Copy Hydration JSON"}
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-3.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Plasmic Project ID</div>
                <div className="mt-1 font-mono text-xs font-semibold text-sky-400 truncate">
                  {plasmicHydration?.projectId || "mrkoQykvpZZfVbEc1yjabw"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-3.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Registered Components</div>
                <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
                  {plasmicHydration?.componentsCount || 10}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-3.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Theme Groups</div>
                <div className="mt-1 font-mono text-lg font-bold text-purple-400">
                  {plasmicHydration?.themeGroups?.length || 8}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#06101E] p-3.5">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Last Hydrated</div>
                <div className="mt-1 font-mono text-xs text-slate-300">
                  {plasmicHydration?.generatedAt ? new Date(plasmicHydration.generatedAt).toLocaleTimeString() : "Live"}
                </div>
              </div>
            </div>

            {/* 1. Page & Arena Component Hierarchy */}
            <div className="rounded-2xl border border-slate-800 bg-[#06101E] p-5 shadow-xl">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">
                1. Page &amp; Arena Component Hierarchy (Homepage)
              </h3>
              <div className="space-y-3">
                {plasmicHydration?.pageHierarchy?.arenaHierarchy?.map((arena: any, aIdx: number) => (
                  <div key={aIdx} className="rounded-xl border border-slate-800/80 bg-[#02050B] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="font-semibold text-white text-xs">{arena.name}</span>
                        {arena.cssSelector && (
                          <code className="text-[10px] text-sky-400 font-mono px-1.5 py-0.5 rounded bg-sky-950/40 border border-sky-800/40">
                            {arena.cssSelector}
                          </code>
                        )}
                      </div>
                      {arena.themeGroup && (
                        <span className="font-mono text-[10px] text-purple-300 rounded bg-purple-950/40 border border-purple-800/40 px-2 py-0.5">
                          {arena.themeGroup}
                        </span>
                      )}
                    </div>

                    {arena.children && arena.children.length > 0 && (
                      <div className="mt-3 ml-4 border-l border-slate-800 pl-4 space-y-2">
                        {arena.children.map((child: any, cIdx: number) => (
                          <div key={cIdx} className="rounded-lg border border-slate-800/50 bg-[#06101E]/60 p-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-200">{child.name || child.displayName || child.component}</span>
                              {child.themeGroup && (
                                <span className="font-mono text-[10px] text-purple-300">
                                  {child.themeGroup}
                                </span>
                              )}
                            </div>
                            {child.elements && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {child.elements.map((el: any, elIdx: number) => (
                                  <span key={elIdx} className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                                    {el.displayName || el.component || el.id}
                                    {el.triggerId ? ` (#${el.triggerId})` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Interactive Element IDs & State Hooks */}
            <div className="rounded-2xl border border-slate-800 bg-[#06101E] p-5 shadow-xl">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3">
                2. Key Interactive Element IDs &amp; Modal State Hooks
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Theme Group Controller */}
                <div className="rounded-xl border border-slate-800 bg-[#02050B] p-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-xs text-white">EcmdThemeGroupController</span>
                    <span className="text-[10px] font-mono text-emerald-400">Themes Modal</span>
                  </div>
                  <ul className="mt-3 space-y-2 text-xs">
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Trigger:</span>
                      <code className="text-sky-300">#ecmd-theme-trigger</code>
                    </li>
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Dropdown Card:</span>
                      <code className="text-sky-300">#ecmd-theme-dropdown-card</code>
                    </li>
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">List Container:</span>
                      <code className="text-sky-300">#ecmd-theme-dropdown-list</code>
                    </li>
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Event Detail:</span>
                      <code className="text-purple-300">source: "theme-group"</code>
                    </li>
                    <li className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block mb-1">Theme Option IDs:</span>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] text-slate-300">• #ecmd-theme-opt-coastal-light</span>
                        <span className="font-mono text-[10px] text-slate-300">• #ecmd-theme-opt-midnight-slate</span>
                        <span className="font-mono text-[10px] text-slate-300">• #ecmd-theme-opt-emerald-dark</span>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Side Menu Controller */}
                <div className="rounded-xl border border-slate-800 bg-[#02050B] p-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-xs text-white">EcmdSideMenuController</span>
                    <span className="text-[10px] font-mono text-emerald-400">Side Menu (☰)</span>
                  </div>
                  <ul className="mt-3 space-y-2 text-xs">
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Trigger:</span>
                      <code className="text-sky-300">#ecmd-side-menu-trigger</code>
                    </li>
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Modal Card:</span>
                      <code className="text-sky-300">#ecmd-side-menu-card</code>
                    </li>
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Repeater List:</span>
                      <code className="text-sky-300">#ecmd-side-menu-list</code>
                    </li>
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Event Detail:</span>
                      <code className="text-purple-300">source: "side-menu"</code>
                    </li>
                    <li className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block mb-1">Buttons:</span>
                      <span className="font-mono text-[10px] text-emerald-300">17 Buttons across 7 categories</span>
                      <span className="font-mono text-[10px] text-slate-400 block mt-0.5">#ecmd-menu-btn-[slug]</span>
                    </li>
                  </ul>
                </div>

                {/* Auth Modal Controller */}
                <div className="rounded-xl border border-slate-800 bg-[#02050B] p-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-xs text-white">EcmdAuthModalController</span>
                    <span className="text-[10px] font-mono text-emerald-400">Auth Engine</span>
                  </div>
                  <ul className="mt-3 space-y-2 text-xs">
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Trigger 1 (Login):</span>
                      <code className="text-sky-300">#ecmd-auth-trigger-btn</code>
                    </li>
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Trigger 2 (Sign Up):</span>
                      <code className="text-sky-300">#ecmd-auth-signup-trigger-btn</code>
                    </li>
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Modal Card:</span>
                      <code className="text-sky-300">#ecmd-auth-modal</code>
                    </li>
                    <li className="flex justify-between font-mono text-[11px]">
                      <span className="text-slate-400">Event Detail:</span>
                      <code className="text-purple-300">source: "auth-modal"</code>
                    </li>
                    <li className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block mb-1">Form Inputs:</span>
                      <div className="flex flex-col gap-0.5 font-mono text-[10px] text-slate-300">
                        <span>• #ecmd-auth-email-input</span>
                        <span>• #ecmd-auth-password-input</span>
                        <span>• #ecmd-auth-confirm-input</span>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 3. Theme Groups Matrix */}
            <div className="rounded-2xl border border-slate-800 bg-[#06101E] p-5 shadow-xl">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">
                3. Dynamic Theme Groups (1-8) &amp; CSS Class Selectors
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-[#02050B] text-[10px] uppercase font-semibold text-slate-400">
                    <tr>
                      <th className="p-3">Group</th>
                      <th className="p-3">Group Name</th>
                      <th className="p-3">Primary Selector</th>
                      <th className="p-3">Coastal Light Default</th>
                      <th className="p-3">Midnight Slate Default</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {plasmicHydration?.themeGroups?.map((tg: any) => (
                      <tr key={tg.id} className="hover:bg-slate-900/40">
                        <td className="p-3 text-purple-300 font-bold">{tg.group}</td>
                        <td className="p-3 font-sans font-medium text-white">{tg.name}</td>
                        <td className="p-3 text-sky-400">{tg.selector}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-full border border-slate-700 inline-block" style={{ backgroundColor: tg.defaultClBg }} />
                            <span className="text-slate-300">{tg.defaultClBg}</span>
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-full border border-slate-700 inline-block" style={{ backgroundColor: tg.defaultMsBg }} />
                            <span className="text-slate-300">{tg.defaultMsBg}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Code Viewer Modal */}
      {(viewingCode || codeLoading || codeError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-fade-in">
          <div className="flex flex-col h-[85vh] w-full max-w-5xl rounded-2xl border border-emerald-500/30 bg-[#040B14] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#06101E] px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    {viewingCode?.file_path || "Loading..."}
                  </span>
                  {viewingCode && (
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      {viewingCode.category}
                    </span>
                  )}
                  {viewingCode && (
                    <span className="text-[10px] font-mono text-slate-400">
                      ({viewingCode.line_count} lines)
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Live from Supabase table: <code className="text-emerald-300">public.ecmd_wix_legacy_vault</code>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {viewingCode?.content && (
                  <button
                    type="button"
                    onClick={copyCodeToClipboard}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
                  >
                    {copiedCode ? "✓ Copied to Clipboard" : "Copy Code 📋"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setViewingCode(null); setCodeError(null); }}
                  className="rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 bg-[#02050B]">
              {codeLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-emerald-400 font-mono animate-pulse">
                  Fetching code from Supabase public.ecmd_wix_legacy_vault...
                </div>
              ) : codeError ? (
                <div className="rounded-lg border border-rose-500/30 bg-[#160608] p-4 text-xs text-rose-300 font-mono">
                  {codeError}
                </div>
              ) : (
                <pre className="font-mono text-xs leading-relaxed text-slate-200 whitespace-pre">
                  {viewingCode?.content}
                </pre>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-[#06101E] px-5 py-2.5 text-[11px] text-slate-400 font-mono">
              <span>Origin: {viewingCode?.source_origin || "C:\\ECMD"}</span>
              <span>Synced: {viewingCode?.synced_at ? new Date(viewingCode.synced_at).toLocaleString() : "Live"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
