import { createRootRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  setPendingAction,
  clearAllPendingActions,
  type PendingAction,
} from "@/hooks/use-pending-actions";
import {
  setComposePending,
  clearAllComposePending,
  type ComposeTrayAction,
} from "@/hooks/use-compose-pending";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { StatusBar } from "@/components/layout/status-bar";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Listen for tray "Preferences" and "View Logs →" events, navigate accordingly.
    // Guard with a try/catch — not all environments have Tauri available (e.g. browser dev).
    let cleanupSettings: (() => void) | undefined;
    let cleanupLogs: (() => void) | undefined;
    let cleanupContainersChanged: (() => void) | undefined;
    let cleanupComposeChanged: (() => void) | undefined;
    let cleanupContainerAction: (() => void) | undefined;
    let cleanupComposeAction: (() => void) | undefined;

    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen("open-settings", () => {
          router.navigate({ to: "/settings" });
        }).then((u) => {
          cleanupSettings = u;
        });
        listen("open-logs", () => {
          router.navigate({
            to: "/logs",
            search: { q: "", cids: "", stream: "all", since: "all", order: "desc" },
          });
        }).then((u) => {
          cleanupLogs = u;
        });
        listen("containers-changed", () => {
          // Action(s) completed — clear pending markers so the row drops the
          // optimistic state once the refetch lands.
          clearAllPendingActions();
          void queryClient.invalidateQueries({ queryKey: ["containers"] });
        }).then((u) => {
          cleanupContainersChanged = u;
        });
        listen<{ id: string; action: PendingAction }>(
          "container-action",
          (event) => {
            setPendingAction(event.payload.id, event.payload.action);
          },
        ).then((u) => {
          cleanupContainerAction = u;
        });
        listen("compose-changed", () => {
          clearAllComposePending();
          void queryClient.invalidateQueries({ queryKey: ["compose"] });
        }).then((u) => {
          cleanupComposeChanged = u;
        });
        listen<{ name: string; action: ComposeTrayAction }>(
          "compose-action",
          (event) => {
            setComposePending(event.payload.name, event.payload.action);
          },
        ).then((u) => {
          cleanupComposeAction = u;
        });
      })
      .catch(() => undefined);

    return () => {
      cleanupSettings?.();
      cleanupLogs?.();
      cleanupContainersChanged?.();
      cleanupComposeChanged?.();
      cleanupContainerAction?.();
      cleanupComposeAction?.();
    };
  }, [router, queryClient]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="harbr-ui-theme">
      <TooltipProvider>
        <SidebarProvider defaultOpen={true} className="h-svh overflow-hidden">
          <AppSidebar />
          <SidebarInset className="overflow-hidden">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-4" />
              <div className="flex-1" />
              <ModeToggle />
            </header>
            <main className="flex-1 min-h-0 overflow-auto p-4">
              <Outlet />
            </main>
            <StatusBar />
          </SidebarInset>
        </SidebarProvider>
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
