import "../lib/ecmdRuntimeBoot";
import { createFileRoute } from "@tanstack/react-router";
import { PlasmicHostPage } from "../pages/PlasmicHost";

export const ECMD_PLASMIC_HOST_ROOT_ID = "ecmd-plasmic-host-root";

function PlasmicHostPendingContainer() {
  return (
    <div
      id={ECMD_PLASMIC_HOST_ROOT_ID}
      style={{ display: "contents" }}
      suppressHydrationWarning
    />
  );
}

function PlasmicHostClientContainer() {
  return (
    <div
      id={ECMD_PLASMIC_HOST_ROOT_ID}
      style={{ display: "contents" }}
      suppressHydrationWarning
    >
      <PlasmicHostPage />
    </div>
  );
}

export const Route = createFileRoute("/plasmic-host")({
  // PlasmicCanvasHost reads window.location.hash (#canvas=true&origin=...) on mount;
  // disabling SSR for /plasmic-host and emitting a deterministic #ecmd-plasmic-host-root
  // container prevents server/client hydration mismatches completely across all artboards.
  ssr: false,
  pendingComponent: PlasmicHostPendingContainer,
  component: PlasmicHostClientContainer,
});
