import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { NAV_LINKS } from "@/components/layout/nav-links";
import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches a page for / instead of falling back to not found", () => {
    expect(router.matchRoutes("/").at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each(["/workflow", "/errors", "/plasmic-host"])("matches %s", (path) => {
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(path);
  });

  it.each(["/console", "/history", "/cms"])(
    "does not register obsolete dashboard route %s",
    (path) => {
      const matched = router.matchRoutes(path);
      expect(matched.at(-1)?.routeId).not.toBe(path);
    }
  );

  it("keeps dev header nav links lean with only Workflow & Boot-Up and Errors & Issues", () => {
    expect(NAV_LINKS).toEqual([
      { to: "/workflow", label: "Workflow & Boot-Up" },
      { to: "/errors", label: "Errors & Issues" },
    ]);
  });
});
