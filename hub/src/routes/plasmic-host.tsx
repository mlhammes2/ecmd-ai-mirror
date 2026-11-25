import "../lib/ecmdRuntimeBoot";
import { createFileRoute } from "@tanstack/react-router";
import { PlasmicHostPage } from "../pages/PlasmicHost";

export const Route = createFileRoute("/plasmic-host")({
  // PlasmicCanvasHost reads window.location.hash (#canvas=true&origin=...) on mount;
  // disabling SSR for /plasmic-host prevents server/client hydration mismatches completely.
  ssr: false,
  component: PlasmicHostPage,
});
