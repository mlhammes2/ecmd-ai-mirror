import { createFileRoute } from "@tanstack/react-router";
import Cms from "../pages/Cms";

export const Route = createFileRoute("/cms")({
  component: Cms,
});
