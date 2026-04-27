import { useRouterState } from "@tanstack/react-router";

const routeToSection: Record<string, string> = {
  "/containers/": "container-detail", // nested detail routes — check before /containers
  "/containers":  "containers",
  "/compose":     "compose",
  "/images":      "images",
  "/volumes":     "volumes",
  "/networks":    "networks",
  "/logs":        "log-search",
  "/settings":    "preferences",
};

/**
 * Returns the help section ID that corresponds to the current route.
 * Falls back to "getting-started" for routes with no specific section.
 */
export function useHelpSection(): string {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  for (const [prefix, section] of Object.entries(routeToSection)) {
    if (pathname === prefix.trimEnd() || pathname.startsWith(prefix)) {
      return section;
    }
  }

  return "getting-started";
}
