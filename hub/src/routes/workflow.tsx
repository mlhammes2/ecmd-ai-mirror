import { EcmdPowerShellResultsCard } from "../components/EcmdPowerShellResultsCard";
import { createFileRoute } from "@tanstack/react-router";
import Workflow from "../pages/Workflow";

export const Route = createFileRoute("/workflow")({
  component: Workflow,
});

<>
      <EcmdPowerShellResultsCard />
      <button id="ecmd-header-copy-errors-btn" type="button" onClick={handleHeaderCopyErrors} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(56,189,248,0.16)", color: "#e2e8f0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Copy Errors</button>
    </>
