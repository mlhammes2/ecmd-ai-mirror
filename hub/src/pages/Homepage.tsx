import React, { useEffect, useState } from "react";
import { PlasmicRootProvider, PlasmicComponent, ComponentRenderData } from "@plasmicapp/loader-react";
import { PLASMIC } from "../plasmic-init";

export default function Homepage() {
  const [plasmicData, setPlasmicData] = useState<ComponentRenderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    PLASMIC.maybeFetchComponentData("Homepage")
      .then((data) => {
        if (mounted) {
          setPlasmicData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Plasmic Homepage fetch notice:", err);
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (plasmicData) {
    return (
      <PlasmicRootProvider loader={PLASMIC} prefetchedData={plasmicData}>
        <PlasmicComponent component="Homepage" />
      </PlasmicRootProvider>
    );
  }

  return (
    <PlasmicRootProvider loader={PLASMIC}>
      {loading ? (
        <div className="flex min-h-[85vh] flex-col items-center justify-center bg-[#040B14] text-emerald-400">
          <div className="mb-4 h-9 w-9 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="font-mono text-xs uppercase tracking-wider text-emerald-400/80">Connecting to Plasmic Studio Canvas...</p>
        </div>
      ) : (
        <div className="flex min-h-[85vh] flex-col items-center justify-center bg-gradient-to-b from-[#062825] via-[#040B14] to-[#020509] px-4 py-16 text-white">
          <div className="max-w-2xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Plasmic Studio Live Host Connected
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white">
              Emerald Coast Mobile Detailing
            </h1>
            <p className="mx-auto max-w-xl text-base text-slate-300 leading-relaxed">
              ECMD Carbon 4 flagship portal. Designed in Plasmic Studio, powered by Supabase Postgres and TanStack Start.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <a
                href="https://studio.plasmic.app/projects/mrkoQykvpZZfVbEc1yjabw/-/Homepage"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
              >
                Open in Plasmic Studio ↗
              </a>
              <a
                href="/workflow"
                className="rounded-lg border border-emerald-500/30 bg-slate-900/60 px-5 py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-slate-800"
              >
                Workflow &amp; Boot-Up
              </a>
              <a
                href="/console"
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                Command Console
              </a>
            </div>
          </div>
        </div>
      )}
    </PlasmicRootProvider>
  );
}
