import "../lib/ecmdRuntimeBoot";
import { PlasmicCanvasHost } from "@plasmicapp/loader-react";
import "../plasmic-init";

/**
 * Clean Plasmic Studio canvas host page.
 * Renders ONLY <PlasmicCanvasHost /> with zero overlays, portals, or outer wrappers
 * so Plasmic Studio's iframe handshake and artboard mounting always succeed cleanly.
 */
export function PlasmicHostPage() {
  return <PlasmicCanvasHost />;
}

export default PlasmicHostPage;
