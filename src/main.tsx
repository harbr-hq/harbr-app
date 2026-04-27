import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { setApiToken } from "./lib/api";
import "@fontsource/syne/800.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 2000 },
  },
});

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function bootstrap() {
  // In Tauri, fetch the auth token from the Rust backend before rendering.
  // In browser dev mode (no Tauri), invoke isn't available — skip silently.
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const token = await invoke<string>("get_token");
    setApiToken(token);
  } catch {
    // Running outside Tauri (e.g. `pnpm dev` without the desktop shell).
    // Auth won't work but the UI still renders for layout development.
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
