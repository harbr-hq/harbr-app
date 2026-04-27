import { HelpCallout } from "@/components/help/help-callout";

export function TroubleshootingSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Troubleshooting</h2>
        <p className="mt-2 text-muted-foreground">
          Common issues and how to fix them.
        </p>
      </div>

      {/* Daemon Offline */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Daemon shows as offline</h3>
        <p className="text-sm text-muted-foreground">
          The status bar shows a red indicator and containers won't load.
        </p>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Check that Podman is running:</p>
          <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
            podman ps
          </pre>
          <p className="font-medium mt-3">On Linux — check the user socket is enabled:</p>
          <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
            systemctl --user status podman.socket
          </pre>
          <p className="font-medium mt-3">On macOS / Windows — check the machine is running:</p>
          <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
            podman machine list{"\n"}
            podman machine start
          </pre>
          <p className="font-medium mt-3">Verify the socket path in your config matches what Podman is using:</p>
          <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
            {"# macOS — find the actual socket path\n"}
            podman machine inspect --format {'\'{{.ConnectionInfo.PodmanSocket.Path}}\''}
          </pre>
        </div>
      </section>

      {/* No Compose Binary */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">"No compose binary available"</h3>
        <p className="text-sm text-muted-foreground">
          Harbr can't find a working compose backend. Podman 5.x includes a{" "}
          <code className="font-mono text-xs">podman compose</code> subcommand but still requires
          an external backend.
        </p>
        <p className="text-sm font-medium">Install podman-compose via pip:</p>
        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
          pip install podman-compose
        </pre>
        <p className="text-sm text-muted-foreground mt-2">
          Then restart Harbr — compose binary detection runs at startup.
        </p>
        <HelpCallout type="note">
          On Windows, if pip isn't available install Python first:{" "}
          <code className="font-mono text-xs">winget install Python.Python.3.13</code>
        </HelpCallout>
      </section>

      {/* Compose Up Fails */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Compose Up fails immediately</h3>
        <p className="text-sm text-muted-foreground">
          Check Podman Machine is running (macOS / Windows):
        </p>
        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
          podman machine list
        </pre>
        <p className="text-sm text-muted-foreground mt-2">
          Also check that the image names in your compose file are fully qualified:{" "}
          <code className="font-mono text-xs">docker.io/library/nginx</code> rather than just{" "}
          <code className="font-mono text-xs">nginx</code>.
        </p>
      </section>

      {/* Windows Socket */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Windows — wrong socket path</h3>
        <p className="text-sm text-muted-foreground">
          Podman on Windows uses a named pipe, not a Unix socket. The correct paths are:
        </p>
        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
          {"# Podman Machine (default machine name)\n"}
          npipe:////./pipe/podman-machine-default{"\n\n"}
          {"# Docker engine socket (if using Podman's Docker compatibility)\n"}
          npipe:////./pipe/docker_engine
        </pre>
        <p className="text-sm text-muted-foreground mt-2">
          Check your machine name with <code className="font-mono text-xs">podman machine list</code> if
          the default doesn't work.
        </p>
      </section>

      {/* macOS Socket After Restart */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">macOS — can't connect after reboot</h3>
        <p className="text-sm text-muted-foreground">
          Podman Machine doesn't start automatically on macOS after a reboot. Run:
        </p>
        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
          podman machine start
        </pre>
        <p className="text-sm text-muted-foreground mt-2">
          The socket path can also change between Podman versions. If restarting doesn't help,
          re-run the inspect command to get the current path and update your config:
        </p>
        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
          podman machine inspect --format {'\'{{.ConnectionInfo.PodmanSocket.Path}}\''}
        </pre>
      </section>

      {/* Log Search No Results */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Log Search returns no results</h3>
        <p className="text-sm text-muted-foreground">
          Log Search only searches logs that have been persisted to the local database. Go to the
          container's <strong>Insights</strong> tab and enable <strong>Persist logs</strong>. Logs
          are stored from the moment you enable it — historical logs before that point are not
          retroactively collected.
        </p>
      </section>

      {/* Terminal won't open */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Terminal tab won't connect</h3>
        <p className="text-sm text-muted-foreground">
          The terminal requires the container to be running. If it was stopped while you were on the
          terminal tab, the WebSocket will close. Start the container again and navigate back to the
          terminal tab.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          The terminal also requires the container image to have a shell (
          <code className="font-mono text-xs">/bin/sh</code> or{" "}
          <code className="font-mono text-xs">/bin/bash</code>). Minimal images like distroless
          won't work.
        </p>
      </section>

      {/* Containers stopped after reboot */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Linux — containers stopped after reboot</h3>
        <p className="text-sm text-muted-foreground">
          Two things are required for rootless Podman containers to auto-start on reboot. Also note
          that only <code className="font-mono text-xs">restart: always</code> works for reboot
          persistence — <code className="font-mono text-xs">restart: unless-stopped</code> is not
          handled by Podman's boot service.
        </p>
        <p className="text-sm font-medium">1. Enable systemd linger for your user:</p>
        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
          loginctl enable-linger $USER
        </pre>
        <p className="text-sm text-muted-foreground mt-1">
          Without linger, your user's systemd session never starts at boot, so no containers run.
        </p>
        <p className="text-sm font-medium mt-3">2. Enable the Podman restart service:</p>
        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
          systemctl --user enable podman-restart.service
        </pre>
        <p className="text-sm text-muted-foreground mt-1">
          This service reads the restart policy on each container and starts them at boot. It's
          installed with Podman but disabled by default.
        </p>
        <p className="text-sm font-medium mt-3">Verify both are set correctly:</p>
        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
          {"loginctl show-user $USER | grep Linger\n"}
          systemctl --user is-enabled podman-restart.service
        </pre>
        <HelpCallout type="note">
          Both steps are required. Linger alone keeps your session alive but won't start containers.
          The restart service alone won't run without linger.
        </HelpCallout>
      </section>

      {/* Clear Stored Logs */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Clearing stored log data</h3>
        <p className="text-sm text-muted-foreground">
          Go to <strong>Preferences → Clear Log Data</strong> to wipe all persisted log lines from
          the local database. This doesn't affect running containers or live log streaming — only
          the historical data stored for search.
        </p>
      </section>
    </div>
  );
}
