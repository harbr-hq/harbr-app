import { HelpImage } from "@/components/help/help-image";
import { HelpCallout } from "@/components/help/help-callout";

export function PreferencesSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Preferences</h2>
        <p className="mt-2 text-muted-foreground">
          Configure Harbr's connection to Podman, compose file directories, and app behaviour.
          Access Preferences from the sidebar footer or the system tray menu.
        </p>
      </div>

      <HelpImage src="/help/preferences-overview.png" alt="Preferences page overview" caption="The Preferences page" />

      {/* Podman Socket */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Podman Socket</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Podman socket path tells Harbr where to connect. The default varies by platform:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          <div className="grid grid-cols-[90px_1fr] gap-2 px-4 py-3">
            <span className="font-medium text-muted-foreground">Linux</span>
            <div>
              <code className="font-mono text-xs">$XDG_RUNTIME_DIR/podman/podman.sock</code>
              <p className="mt-1 text-muted-foreground text-xs">Typically <code className="font-mono">/run/user/1000/podman/podman.sock</code></p>
            </div>
          </div>
          <div className="grid grid-cols-[90px_1fr] gap-2 px-4 py-3">
            <span className="font-medium text-muted-foreground">macOS</span>
            <div>
              <p className="text-muted-foreground text-xs">Find it with:</p>
              <code className="font-mono text-xs">podman machine inspect --format {'\'{{.ConnectionInfo.PodmanSocket.Path}}\''}</code>
              <p className="mt-1 text-muted-foreground text-xs">Prefix the path with <code className="font-mono">unix://</code> in the config.</p>
            </div>
          </div>
          <div className="grid grid-cols-[90px_1fr] gap-2 px-4 py-3">
            <span className="font-medium text-muted-foreground">Windows</span>
            <div>
              <code className="font-mono text-xs">npipe:////./pipe/podman-machine-default</code>
              <p className="mt-1 text-muted-foreground text-xs">Or <code className="font-mono">npipe:////./pipe/docker_engine</code> if using the Docker engine socket.</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          If the socket path is wrong, the status bar shows the daemon as offline. Update the path
          in <code className="font-mono text-xs">config.toml</code> and restart Harbr.
        </p>
        <HelpCallout type="note">
          The socket path can be changed in the config file directly — Preferences shows the current
          value from the config for reference, but the editable field in the UI updates the config
          file and takes effect on the next restart.
        </HelpCallout>
      </section>

      {/* Compose Directories */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Compose Directories</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Harbr scans these directories for Compose files when building the project list. Add any
          folder that contains your <code className="font-mono text-xs">compose.yaml</code> or{" "}
          <code className="font-mono text-xs">docker-compose.yml</code> files.
        </p>
        <p className="text-sm text-muted-foreground">
          Changes to this list take effect immediately — the project list refreshes on the next
          navigation to the Compose page without requiring a restart.
        </p>
        <HelpImage src="/help/preferences-compose-dirs.png" alt="Compose directories editor with add and remove controls" caption="Adding a compose directory in Preferences" />
      </section>

      {/* System Tray */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">System Tray</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Harbr tray icon lives in your system notification area. Left-click it to show or focus
          the main window. Right-click to open the tray menu.
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { label: "Containers", desc: "Submenu listing all containers — running containers get Stop and Restart actions, stopped containers get Start. Stop all running shuts down every running container at once." },
            { label: "Compose", desc: "Submenu per project — Up for stopped projects, Down and Restart for running or partial ones." },
            { label: "Port copy", desc: "Running containers with exposed ports show clickable port mappings below the submenus. Clicking one copies the host port to the clipboard." },
            { label: "Preferences", desc: "Opens the Preferences page directly." },
            { label: "View Logs →", desc: "Opens the Log Search page." },
            { label: "Exit", desc: "Gracefully shuts down the daemon and quits." },
          ].map(({ label, desc }) => (
            <div key={label} className="grid grid-cols-[140px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <HelpCallout type="note">
          The tray menu refreshes every 10 seconds. If you just started or stopped a container it
          may take a moment for the menu item to reflect the new state.
        </HelpCallout>
      </section>

      {/* Tray Notifications */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Tray Notifications</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Harbr fires OS notifications to confirm the outcome of tray actions — so you know whether
          the operation succeeded or failed without having to reopen the window.
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { label: "Container started", desc: "Fired when a Start action completes successfully." },
            { label: "Container stopped", desc: "Fired when a Stop action completes, or when a running container exits unexpectedly." },
            { label: "Container restarted", desc: "Fired after a successful stop + start cycle." },
            { label: "Compose up/down/restart", desc: "\"Starting demo…\" fires immediately when the operation is accepted. A second notification fires when the compose process exits — success or failure." },
            { label: "Failure notifications", desc: "Any action that errors (non-200 response, non-zero exit, or daemon unreachable) fires a notification with the reason so you know what went wrong." },
          ].map(({ label, desc }) => (
            <div key={label} className="grid grid-cols-[200px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <HelpCallout type="note">
          Notifications are sent via <code className="font-mono text-xs">notify-send</code> on Linux.
          If you are not seeing them, check that your notification daemon is running and that{" "}
          <code className="font-mono text-xs">notify-send</code> is installed{" "}
          (<code className="font-mono text-xs">libnotify-bin</code> on Ubuntu/Debian).
        </HelpCallout>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You can turn notifications off entirely using the{" "}
          <strong>System notifications</strong> toggle in Preferences → Interface. This affects
          both tray-triggered actions and the automatic crash-detection notification.
        </p>
      </section>

      {/* Close to Tray */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Close to Tray</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          When <strong>Close to tray</strong> is enabled (the default), clicking the window's close
          button hides Harbr to the system tray instead of quitting. The daemon continues running
          in the background and the tray icon remains active.
        </p>
        <p className="text-sm text-muted-foreground">
          To fully quit Harbr, right-click the tray icon and select <strong>Exit</strong>.
        </p>
      </section>

      {/* Theme */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Theme</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use the theme toggle in the top-right corner of any page to switch between Light, Dark,
          and System (follows your OS setting). The preference is saved locally and persists across
          restarts.
        </p>
      </section>

      {/* System Info */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">System Info</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The System Info panel shows read-only information about your setup:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { label: "App version", desc: "The running version of Harbr." },
            { label: "Podman version", desc: "The Podman version reported by the socket." },
            { label: "Socket path", desc: "The Podman socket Harbr is currently connected to." },
            { label: "Compose binary", desc: "Whether podman compose or podman-compose was detected." },
            { label: "Config file", desc: "The path to the active config.toml." },
            { label: "Data directory", desc: "Where Harbr stores its database and logs." },
          ].map(({ label, desc }) => (
            <div key={label} className="grid grid-cols-[140px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
