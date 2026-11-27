import { EcmdPowerShellResultsCard } from "../components/EcmdPowerShellResultsCard";
import { createFileRoute } from "@tanstack/react-router";
import Errors from "../pages/Errors";

export const Route = createFileRoute("/errors")({ component: Errors });

<EcmdPowerShellResultsCard />
