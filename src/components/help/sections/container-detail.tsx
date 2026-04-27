import { HelpImage } from "@/components/help/help-image";
import { HelpCallout } from "@/components/help/help-callout";
import { Kbd } from "@/components/help/kbd";

export function ContainerDetailSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Container Detail</h2>
        <p className="mt-2 text-muted-foreground">
          Click any container name to open its detail page — three tabs covering logs, performance
          insights, and an interactive terminal. The back arrow returns you to wherever you came
          from — the container list, or a Compose project if you navigated here from one.
        </p>
      </div>

      <HelpImage src="/help/container-detail-overview.png" alt="Container detail page with three tabs" caption="Container detail — Logs, Insights, and Terminal tabs" />

      {/* Logs Tab */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Logs Tab</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Logs tab streams live output from the container via WebSocket. New lines appear as
          they're written — no polling, no refresh needed.
        </p>
        <HelpImage src="/help/container-detail-logs.png" alt="Log streaming view with filter bar" caption="Live log stream with stdout (white) and stderr (amber) lines" />

        <h4 className="font-medium mt-5">Pause & Resume</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click <strong>Pause</strong> to stop the display from scrolling while the stream
          continues in the background. Up to 1000 lines are buffered while paused — if the buffer
          fills, a red warning appears. Click <strong>Resume</strong> to flush the buffer and
          catch up.
        </p>

        <h4 className="font-medium mt-5">Filtering</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The filter bar supports wildcards — <Kbd>*</Kbd> matches any sequence of characters and{" "}
          <Kbd>?</Kbd> matches any single character. Filtering is applied client-side in real time
          so the stream doesn't reconnect when you type. Matching text is highlighted in the output.
        </p>
        <p className="text-sm text-muted-foreground">
          Examples: <code className="font-mono text-xs">error*</code> matches any line starting
          with "error", <code className="font-mono text-xs">*timeout*</code> matches any line
          containing "timeout".
        </p>

        <h4 className="font-medium mt-5">Stream Filter</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use the <strong>stdout / stderr / all</strong> selector to show only one stream.
          stdout lines are white, stderr lines are amber.
        </p>

        <h4 className="font-medium mt-5">Status Indicator</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A status dot in the toolbar reflects the current connection state:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li><span className="font-medium text-foreground">Not running</span> — container is stopped; historical logs are shown but no live stream.</li>
          <li><span className="font-medium text-amber-500 dark:text-amber-400">Connecting…</span> — container is running but the WebSocket hasn't connected yet.</li>
          <li><span className="font-medium text-green-600 dark:text-green-400">Streaming</span> — live logs are flowing.</li>
        </ul>

        <HelpCallout type="tip">
          For persistent log storage and cross-container search, enable persistence in the{" "}
          <strong>Insights</strong> tab. Logs are only stored after you opt in.
        </HelpCallout>
      </section>

      {/* Insights Tab */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Insights Tab</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Insights tab shows live CPU and memory usage as area charts, and lets you configure
          persistent log storage for the container.
        </p>
        <HelpImage src="/help/container-detail-insights.png" alt="Insights tab with CPU and memory charts" caption="Live CPU (orange) and memory (purple) area charts" />

        <h4 className="font-medium mt-5">CPU & Memory Charts</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Charts are seeded immediately on open from a snapshot, then stream live updates via
          WebSocket. CPU is shown as a percentage of available cores. Memory shows current usage
          against the container's limit — if no cgroup limit is set, the limit is shown as
          "no limit" rather than dividing by zero.
        </p>
        <p className="text-sm text-muted-foreground">
          The first data frame is discarded — CPU calculation requires two consecutive samples so
          the first reading is always zero and would skew the chart.
        </p>

        <h4 className="font-medium mt-5">Persistent Logging</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The <strong>Persist logs</strong> toggle enables log collection for this container.
          When enabled, a background task streams and stores every log line in the local database,
          making it searchable from the Log Search page.
        </p>

        <h4 className="font-medium mt-5">Retention Policy</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Two retention modes are available — pick one or use both:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-2 px-4 py-2.5">
            <span className="font-medium">By size</span>
            <span className="text-muted-foreground">Prune oldest lines when stored logs exceed N megabytes.</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2 px-4 py-2.5">
            <span className="font-medium">By age</span>
            <span className="text-muted-foreground">Delete lines older than N days automatically.</span>
          </div>
        </div>
        <HelpCallout type="note">
          Retention is enforced after each flush cycle (every 5 seconds or 200 lines). It is not
          applied retroactively when you change the settings.
        </HelpCallout>
      </section>

      {/* Terminal Tab */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Terminal Tab</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Terminal tab opens an interactive shell inside the container using{" "}
          <code className="font-mono text-xs">exec</code>. It's a full xterm.js terminal — resize,
          colour support, and standard keyboard shortcuts all work.
        </p>
        <HelpImage src="/help/container-detail-terminal.png" alt="Interactive terminal inside a container" caption="Full interactive terminal via xterm.js" />
        <HelpCallout type="tip">
          The terminal session is kept alive when you switch to other tabs. The WebSocket stays
          connected so any running processes continue uninterrupted. The terminal is hidden with
          CSS rather than unmounted — switching back reconnects to the same session.
        </HelpCallout>
        <HelpCallout type="note">
          The container must be running to open a terminal. If the container stops while a session
          is active, the connection will close.
        </HelpCallout>
      </section>
    </div>
  );
}
