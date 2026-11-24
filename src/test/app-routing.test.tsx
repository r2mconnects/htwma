import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

describe("App routing", () => {
  const paths = [
    "/",
    "/about",
    "/committee",
    "/gallery",
    "/contact",
    "/admin/login",
    "/admin",
    "/admin/members",
    "/admin/members/new",
    "/admin/fees",
    "/admin/committee",
    "/admin/gallery",
    "/admin/announcements",
    "/admin/messages",
    "/admin/import-export",
    "/admin/settings",
  ];

  for (const path of paths) {
    it(`matches route ${path}`, () => {
      const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    });
  }
});
