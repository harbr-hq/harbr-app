import { HelpImage } from "@/components/help/help-image";
import { HelpCallout } from "@/components/help/help-callout";

export function ComposeSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Compose</h2>
        <p className="mt-2 text-muted-foreground">
          Manage multi-container Compose projects — discover, edit, and operate them from one place.
        </p>
      </div>

      {/* Project Discovery */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Project Discovery</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Harbr finds Compose projects from two sources:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            <span>
              <strong className="text-foreground">Podman labels</strong> — any running container
              that has <code className="font-mono text-xs">com.docker.compose.project</code> labels
              applied (set automatically by Compose when you run{" "}
              <code className="font-mono text-xs">podman compose up</code>).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            <span>
              <strong className="text-foreground">Compose directories</strong> — folders configured
              in Preferences that Harbr scans for{" "}
              <code className="font-mono text-xs">compose.yaml</code> /{" "}
              <code className="font-mono text-xs">docker-compose.yml</code> files.
            </span>
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Both sources are merged into a single project list. A project discovered only from a file
          (no running containers) shows as <strong>Stopped</strong>.
        </p>
        <HelpCallout type="tip">
          Add directories containing your Compose files in <strong>Preferences → Compose
          Directories</strong>. The default is{" "}
          <code className="font-mono text-xs">~/.config/harbr/compose</code>.
        </HelpCallout>
      </section>

      {/* Creating a Project */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Creating a New Project</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click <strong>New project</strong> to open the creation sheet. Three fields are available:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { field: "Project name", desc: "The name Harbr uses to identify and operate the project. This is passed to compose via -p and overrides any name: field declared in the YAML — so they don't need to match." },
            { field: "Working directory", desc: "Optional. Type a path directly or click Browse to pick a folder. Harbr validates that the path exists — the Create button stays disabled until it resolves to a real directory. Leave unset if your compose file has no relative paths." },
            { field: "compose.yml", desc: "The YAML content. A minimal template is pre-filled. Edit directly or paste in your own. The Create button is disabled until the YAML is valid." },
          ].map(({ field, desc }) => (
            <div key={field} className="grid grid-cols-[160px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium self-start pt-0.5">{field}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The <strong>Format on create</strong> checkbox (top-right of the editor) automatically
          normalises YAML indentation and style before the file is written. Uses the same formatter
          as the Format button in the File tab. The setting is remembered across sessions and shared
          with the file editor.
        </p>
        <HelpImage src="/help/compose-new-project.png" alt="New compose project sheet with working directory input and format on create checkbox" caption="New project sheet — type or browse for the working directory" />
        <HelpCallout type="tip">
          The working directory is for config files that live <em>outside</em> the Harbr-managed
          compose folder — for example an <code className="font-mono text-xs">nginx.conf</code> in
          your home directory. Point the working directory at the folder containing those files, then
          reference them with relative paths like{" "}
          <code className="font-mono text-xs">./nginx.conf</code> in the compose YAML.
        </HelpCallout>
      </section>

      {/* Project List */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">The Project List</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Each project card shows the project name, its overall status, and a summary of service states.
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { status: "Running", desc: "All services are running." },
            { status: "Partial", desc: "Some services are running, others are stopped or missing." },
            { status: "Stopped", desc: "No containers are running. May have a compose file, stopped containers, or both." },
          ].map(({ status, desc }) => (
            <div key={status} className="grid grid-cols-[100px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium">{status}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <HelpImage src="/help/compose-list.png" alt="Compose project list with status indicators" caption="The Compose projects list" />
      </section>

      {/* Services Tab */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Services Tab</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click a project to open it. The Services tab shows each service defined in the Compose
          file, its current container status, image, and exposed ports. Services without a running
          container are shown as stopped.
        </p>
        <HelpImage src="/help/compose-services.png" alt="Compose services tab showing per-service status" caption="Services view inside a Compose project" />
      </section>

      {/* File Tab */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">File Tab</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The File tab shows the raw Compose YAML in an embedded CodeMirror editor with syntax
          highlighting, bracket matching, and live YAML validation. Edit and save directly from
          the UI — changes are written back to the file on disk.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A <strong>copy icon</strong> sits in the top-right corner of the editor — click it to
          copy the full file contents to your clipboard without selecting anything.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If a working directory was set when the project was created, a{" "}
          <strong>Working dir</strong> row appears above the editor showing the path. This is a
          read-only reminder — it is the folder compose uses to resolve relative bind mount paths.
        </p>
        <HelpImage src="/help/compose-editor.png" alt="YAML editor with copy button and toolbar" caption="CodeMirror YAML editor — copy icon top-right, toolbar below" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          The toolbar below the editor provides four actions:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { action: "Format", desc: "Normalises YAML indentation and style using js-yaml. Useful after pasting in content with inconsistent spacing." },
            { action: "Validate", desc: "Runs a full YAML parse and reports any syntax errors as a list below the editor." },
            { action: "Format on save", desc: "Checkbox — when ticked, the file is automatically formatted before every save. Setting is remembered across sessions." },
            { action: "Save", desc: "Writes the current editor content back to disk. Only enabled when there are unsaved changes." },
          ].map(({ action, desc }) => (
            <div key={action} className="grid grid-cols-[140px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium">{action}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <HelpCallout type="note">
          Validation runs on YAML syntax only — it won't catch semantic errors like referencing
          a service that doesn't exist. Those will surface when you run the project.
        </HelpCallout>
      </section>

      {/* Operations */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Running Compose Operations</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The action buttons on each project card are context-sensitive — only the relevant
          operations are shown based on the project's current state.
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { op: "Up", desc: "Shown when stopped. Creates and starts all services, pulling images if needed." },
            { op: "Down", desc: "Shown when running or partial. Stops and removes all containers. Volumes and images are preserved." },
            { op: "Restart", desc: "Shown when running or partial. Stops then starts all services." },
          ].map(({ op, desc }) => (
            <div key={op} className="grid grid-cols-[80px_1fr] gap-2 px-4 py-2.5">
              <span className="font-mono text-xs font-medium">{op}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          When an operation starts, the buttons are replaced by a status indicator and a panel
          slides out from the right showing live output. You can close the panel at any time —
          the operation continues in the background. Click the status indicator to reopen it.
        </p>
        <HelpImage src="/help/compose-output.png" alt="Compose operation output sheet" caption="Live output in the operation panel" />
        <HelpCallout type="warning">
          <strong>Down</strong> removes containers but not volumes. Data stored in named volumes
          persists until you remove the volume explicitly.
        </HelpCallout>
      </section>

      {/* Compose in the Containers Tab */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Compose Groups in the Containers Tab</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Containers tab groups containers by their Compose project when the grouped view is
          enabled. A compose group only appears there when at least one container from that project
          currently exists in Podman — running or stopped.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The key distinction is between <strong>down</strong> and <strong>stop</strong>:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            {
              op: "compose down",
              desc: "Removes containers entirely. They no longer exist in Podman, so the compose group disappears from the Containers tab. The project still appears in the Compose tab because that reads from the file on disk.",
            },
            {
              op: "compose stop",
              desc: "Stops containers but leaves them in an exited state. They still exist in Podman, so the group remains visible in the Containers tab with each service shown as exited.",
            },
          ].map(({ op, desc }) => (
            <div key={op} className="grid grid-cols-[160px_1fr] gap-2 px-4 py-2.5">
              <code className="font-mono text-xs font-medium self-start pt-0.5">{op}</code>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          After a machine reboot, containers that were running without a restart policy end up in
          an <strong>exited</strong> state — they still exist in Podman and will show up in the
          Containers tab as stopped. Only an explicit{" "}
          <code className="font-mono text-xs">compose down</code> removes them.
        </p>
        <HelpCallout type="note">
          If your compose group is not visible in the Containers tab after a reboot, it likely
          means <code className="font-mono text-xs">compose down</code> was run at some point and
          the containers were removed. Run <strong>Compose → Up</strong> to recreate them. The
          Compose tab is always the reliable place to check project state regardless of whether
          containers currently exist.
        </HelpCallout>
        <HelpCallout type="tip">
          To remove a service from a compose project, edit the compose file and remove its entry,
          then run <strong>Down</strong> followed by <strong>Up</strong>. Individual containers
          in a compose group cannot be removed directly — the file is the source of truth.
        </HelpCallout>
      </section>

      {/* Tray Actions */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">System Tray Actions</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Compose operations can also be triggered from the system tray menu — useful when Harbr is
          running in the background and you don't want to switch windows. The tray menu lists all
          discovered projects with Up, Down, and Restart actions available based on their current
          state.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tray-initiated operations show a spinner and status label directly on the project row
          in the Compose list. This gives you visual feedback without the streaming output panel —
          which only appears for operations started from within the UI, since that's the context
          where line-by-line output is useful.
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { source: "From the UI", desc: "Buttons replaced by a status pill. Output panel slides in from the right with live streaming output. Click the pill to reopen the panel." },
            { source: "From the tray", desc: "Project row shows an orange pulsing dot and a spinner pill. No output panel — the operation runs in the background. Row updates automatically when the operation completes." },
          ].map(({ source, desc }) => (
            <div key={source} className="grid grid-cols-[140px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium self-start pt-0.5">{source}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Logs Tab */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Logs Tab</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Logs tab streams output from all services in the project simultaneously, interleaved
          into a single view. Each line is prefixed with the service name so you can tell them
          apart. This is equivalent to{" "}
          <code className="font-mono text-xs">podman compose logs -f</code>.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A status indicator in the toolbar shows the current connection state:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li><span className="font-medium text-foreground">Not running</span> — no running services detected; the tab retries automatically.</li>
          <li><span className="font-medium text-amber-500 dark:text-amber-400">Connecting…</span> — connecting to the log stream (shown after 400 ms).</li>
          <li><span className="font-medium text-green-600 dark:text-green-400">Streaming</span> — live logs are flowing. Auto-reconnects if the project is restarted.</li>
        </ul>
        <HelpImage src="/help/compose-logs.png" alt="Fan-in log view across all services" caption="All service logs combined in one stream" />
      </section>

      {/* Restart Policy */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Restart Policy</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          For Compose-managed containers, restart behaviour is set in the compose file using the{" "}
          <code className="font-mono text-xs">restart:</code> field on each service. Harbr won't
          let you change it at runtime for compose containers — the file is the source of truth.
        </p>
        <div className="rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
          <span className="text-muted-foreground"># compose.yaml</span>{"\n"}
          {"services:\n"}
          {"  web:\n"}
          {"    image: nginx\n"}
          {"    "}
          <span className="text-foreground font-semibold">restart: always</span>
        </div>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { value: "no", desc: "Never restart. Default if omitted." },
            { value: "always", desc: "Restart whenever the container stops, including on reboot. Use this for services that should always be running." },
            { value: "unless-stopped", desc: "Restart on crash but not if you manually stopped it. Does not auto-start on reboot — use always instead." },
            { value: "on-failure", desc: "Only restart on non-zero exit codes. Optionally add a retry cap: on-failure:3." },
          ].map(({ value, desc }) => (
            <div key={value} className="grid grid-cols-[160px_1fr] gap-2 px-4 py-2.5">
              <code className="font-mono text-xs font-medium self-center">{value}</code>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          After changing <code className="font-mono text-xs">restart:</code>, you need to recreate
          the service for it to take effect:
        </p>
        <div className="rounded-md border bg-muted/40 p-4 font-mono text-xs">
          podman compose up -d --force-recreate &lt;service&gt;
        </div>
        <HelpCallout type="note">
          <strong>Rootless containers and reboots:</strong> use{" "}
          <code className="font-mono text-xs">restart: always</code> (not{" "}
          <code className="font-mono text-xs">unless-stopped</code>) — Podman's boot service only
          handles <code className="font-mono text-xs">always</code>. You also need two one-time
          setup steps: <code className="font-mono text-xs">loginctl enable-linger $USER</code> and{" "}
          <code className="font-mono text-xs">systemctl --user enable podman-restart.service</code>.
          See Troubleshooting for details.
        </HelpCallout>
      </section>
    </div>
  );
}
