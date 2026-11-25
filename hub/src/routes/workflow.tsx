import { createFileRoute } from "@tanstack/react-router";
import Workflow from "../pages/Workflow";

export const Route = createFileRoute("/workflow")({
  component: Workflow,
});
