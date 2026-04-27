import { HelpImage } from "@/components/help/help-image";
import { HelpCallout } from "@/components/help/help-callout";

export function GettingStarted() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Getting Started</h2>
        <p className="mt-2 text-muted-foreground">
          Everything you need to know to get Harbr up and running.
        </p>
      </div>

      {/* What is Harbr */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">What is Harbr?</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Harbr is a native desktop application for managing containers using Podman. It provides a
          polished UI for everything you'd normally do from the command line — starting and stopping
          containers, streaming logs, running Compose projects, browsing images and volumes — without
          requiring a Docker account, a background daemon running as root, or a browser tab.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Under the hood, Harbr runs a small Axum HTTP server that talks to the Podman socket. The
          UI communicates with that server over HTTP and WebSocket — which means the same interface
          can connect to a remote machine running Harbr in the future.
        </p>
        <HelpImage src="/help/getting-started-overview.png" alt="Harbr main interface overview" caption="The Harbr container list on first launch" />
      </section>

      {/* Prerequisites */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Prerequisites</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Harbr requires Podman to be installed and running on your machine. It does not work with
          Docker Desktop or the Docker daemon — Podman only.
        </p>
        <div className="space-y-2 text-sm">
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <span className="font-medium">Linux</span>
              <pre className="mt-1.5 rounded bg-muted px-3 py-2 text-xs font-mono">
                systemctl --user enable --now podman.socket
              </pre>
            </div>
            <div>
              <span className="font-medium">macOS</span>
              <pre className="mt-1.5 rounded bg-muted px-3 py-2 text-xs font-mono">
                brew install podman{"\n"}
                podman machine init{"\n"}
                podman machine start
              </pre>
            </div>
            <div>
              <span className="font-medium">Windows</span>
              <pre className="mt-1.5 rounded bg-muted px-3 py-2 text-xs font-mono">
                winget install RedHat.Podman{"\n"}
                podman machine init{"\n"}
                podman machine start
              </pre>
            </div>
          </div>
        </div>
        <HelpCallout type="note">
          Compose operations also require <code className="font-mono text-xs">podman-compose</code>.
          Install it with <code className="font-mono text-xs">pip install podman-compose</code> on
          all platforms.
        </HelpCallout>
      </section>

      {/* First Run */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">First Run</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          On first launch, Harbr does the following automatically:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            Generates a bearer token and saves it to the config directory. This token is used to
            authenticate API requests between the frontend and the local daemon.
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            Starts the Axum HTTP server on <code className="font-mono text-xs">127.0.0.1:9090</code>.
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            Connects to the Podman socket. If the socket isn't reachable, the status bar will show
            the daemon as offline — start Podman and Harbr will reconnect automatically.
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            Initialises the embedded SurrealDB database for storing persistent logs and settings.
          </li>
        </ul>
        <HelpCallout type="tip">
          The token file location is shown in Preferences → System Info. You won't normally need it
          — the desktop app handles auth transparently.
        </HelpCallout>
      </section>

      {/* Dashboard */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">The Dashboard</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The dashboard gives you a quick health check of your entire Podman environment at a glance.
        </p>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            <span><strong className="text-foreground">Stat cards</strong> — running container count, total images with combined size, volume count, and network count. Each card links to the corresponding page.</span>
          </div>
          <div className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            <span><strong className="text-foreground">Running containers panel</strong> — a compact list of currently running containers.</span>
          </div>
          <div className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            <span><strong className="text-foreground">Resource usage graph</strong> — aggregate CPU and memory across all running containers, updated every 5 seconds. The graph resets automatically when the set of running containers changes.</span>
          </div>
          <div className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            <span><strong className="text-foreground">Activity feed</strong> — a live stream of recent container events from the Podman socket.</span>
          </div>
          <div className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            <span><strong className="text-foreground">Compose projects</strong> — up to 8 active projects shown as cards. Click View all to open the full Compose list.</span>
          </div>
        </div>
        <HelpCallout type="note">
          The resource graph shows the <em>sum</em> of CPU and memory across all running containers — not per-container. Visit the Insights tab on a specific container for individual resource charts.
        </HelpCallout>
      </section>

      {/* Config File */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Config File</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Harbr reads configuration from a TOML file. The location depends on your platform:
        </p>
        <div className="rounded-lg border p-4 space-y-3 text-sm">
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <span className="font-medium text-muted-foreground">Linux</span>
            <code className="font-mono text-xs">~/.config/harbr/config.toml</code>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <span className="font-medium text-muted-foreground">macOS</span>
            <code className="font-mono text-xs">~/Library/Application Support/harbr/config.toml</code>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <span className="font-medium text-muted-foreground">Windows</span>
            <code className="font-mono text-xs">%APPDATA%\harbr\config.toml</code>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The most commonly needed setting is <code className="font-mono text-xs">[podman] socket</code> —
          see <strong>Preferences</strong> for details on finding and setting the correct path.
        </p>
      </section>
    </div>
  );
}
