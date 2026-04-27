import { HelpImage } from "@/components/help/help-image";
import { HelpCallout } from "@/components/help/help-callout";

export function ContainersSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Containers</h2>
        <p className="mt-2 text-muted-foreground">
          The container list is the main view in Harbr — everything starts here.
        </p>
      </div>

      {/* The List */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">The Container List</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The containers page lists all containers on your Podman socket — running and stopped. Each
          row shows the container name, image, status, CPU and memory usage bars, and any exposed
          port mappings. Click a row to expand it and see more detail, or click the container name
          to open the detail page.
        </p>
        <HelpImage src="/help/containers-list.png" alt="Container list overview" caption="The container list with running and stopped containers" />
      </section>

      {/* Status Indicators */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Status Indicators</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The coloured dot on the left of each row indicates the container's current state:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { dot: "bg-emerald-500 animate-pulse", label: "Running", desc: "Container is active and responding." },
            { dot: "bg-amber-400 animate-pulse", label: "Paused", desc: "Container processes are frozen. CPU drops to zero but memory is still held." },
            { dot: "bg-slate-400", label: "Stopped / Exited", desc: "Container has exited or been stopped." },
            { dot: "bg-red-500", label: "Error / Unknown", desc: "Container exited with a non-zero code or its state cannot be determined." },
          ].map(({ dot, label, desc }) => (
            <div key={label} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
              <div>
                <span className="font-medium">{label}</span>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Search & Filter */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Search & Filter</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The search bar at the top of the list filters by container name and image in real time.
          Click the <strong>×</strong> button inside the search bar to clear it instantly.
          The <strong>Running only</strong> toggle hides stopped containers so you can focus on
          what's active.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If two running containers share the same host port, a{" "}
          <strong className="text-amber-600 dark:text-amber-400">port conflict</strong> warning
          appears in the toolbar. Hover it to see the count — stop or reconfigure the conflicting
          container to resolve it.
        </p>
        <HelpImage src="/help/containers-toolbar.png" alt="Container search and filter toolbar" caption="Search bar and running-only toggle" />
      </section>

      {/* View Modes */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Grouped vs Flat View</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The <strong>Layers</strong> toggle in the toolbar switches between two views:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            <span><strong className="text-foreground">Flat</strong> — all containers in a single list, sorted by name.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60 translate-y-1.5" />
            <span><strong className="text-foreground">Grouped</strong> — containers organised into panels by Compose project, custom groups you create, and an Ungrouped catch-all at the bottom.</span>
          </li>
        </ul>
        <HelpImage src="/help/containers-grouped.png" alt="Grouped container view with Compose projects" caption="Grouped view — Compose projects are grouped automatically" />
      </section>

      {/* Custom Groups */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Custom Groups</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click <strong>+ New group</strong> at the top of the grouped view to create a custom group.
          Give it a name — you can rename it later by double-clicking the name in the group header.
          Each custom group has a colour dot you can click to change its accent colour. New groups
          always appear at the top of the list so you can start assigning containers to them
          straight away.
        </p>
      </section>

      {/* Container Drag and Drop */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Dragging Containers</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          In grouped view, containers are fully draggable. Grab the grip handle on the left of any
          container row to reorder it within its group, or drag it across to a different group
          header to move it. The group membership and sort order are both persisted.
        </p>
        <HelpImage
          src="/help/containers-drag-container.png"
          alt="Dragging a container between groups"
          caption="Drag the grip handle to reorder within a group or move to another group"
        />
        <HelpCallout type="note">
          Containers that belong to a Compose project are locked to their Compose group — they
          can't be dragged into a custom group. Everything else is fair game.
        </HelpCallout>
      </section>

      {/* Move to Group */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Move to Group</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Not a fan of dragging? Click the <strong>⋯</strong> menu on any container row and select{" "}
          <strong>Move to</strong> to open a submenu listing all available groups. Selecting one
          reassigns the container instantly — same result as drag and drop, no mouse acrobatics
          required.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If the container is already in a custom group, an <strong>Ungrouped</strong> option
          appears at the bottom of the submenu so you can remove it from the group without
          deleting the group itself.
        </p>
        <HelpImage
          src="/help/containers-move-to.png"
          alt="Move to submenu in container context menu"
          caption="Move to — reassign a container without dragging"
        />
        <HelpCallout type="note">
          Move to only appears in grouped view, and only for containers that aren't part of a
          Compose project. Compose containers are locked to their project group.
        </HelpCallout>
      </section>

      {/* Reordering Groups */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Reordering Groups</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Groups themselves can be dragged into any order. To drag a group, first{" "}
          <strong>collapse it</strong> using the chevron on the left of its header — a grip handle
          will appear. Grab the grip and drag the group to its new position. Release to drop.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The group order and each group's collapsed/expanded state are both saved locally and
          restored the next time you open the app.
        </p>
        <HelpImage
          src="/help/containers-drag-group.png"
          alt="Dragging a collapsed group to reorder it"
          caption="Collapse a group to reveal its drag handle, then drag it into position"
        />
      </section>

      {/* Group Selection */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Group Selection</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Each group header has a checkbox that selects or deselects all containers in that group
          at once. The checkbox shows three states:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { state: "Unchecked", desc: "No containers in the group are selected. Click to select all." },
            { state: "Indeterminate (—)", desc: "Some containers are selected. Click to select all." },
            { state: "Checked", desc: "All containers in the group are selected. Click to deselect all." },
          ].map(({ state, desc }) => (
            <div key={state} className="grid grid-cols-[160px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium">{state}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The group's <strong>Start</strong> and <strong>Stop</strong> buttons in the header are
          selection-aware. When some (but not all) containers in the group are selected, those
          buttons operate on the selection only — the tooltip changes to{" "}
          <em>Start selected</em> / <em>Stop selected</em> to make this clear. If nothing or
          everything is selected, they act on the entire group as usual.
        </p>
        <HelpCallout type="note">
          Start all / Stop all only appears on <strong>Compose</strong> and{" "}
          <strong>custom groups</strong> — not on the Ungrouped catch-all. To bulk-start or
          bulk-stop ungrouped containers, assign them to a custom group first, or use the
          top-of-page bulk action toolbar after selecting them individually.
        </HelpCallout>
        <HelpCallout type="tip">
          Select a few containers across different groups using their individual checkboxes, then
          use the bulk Start / Stop toolbar at the top of the page to act on all of them in one
          go — or use each group's header buttons to act on just that group's selection.
        </HelpCallout>
      </section>

      {/* Container Actions */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Container Actions</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click the <strong>⋯</strong> menu on any container row to see available actions. The
          options shown depend on the container's current state:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { action: "Start", when: "Container is stopped or exited" },
            { action: "Stop", when: "Container is running" },
            { action: "Pause", when: "Container is running — freezes processes without stopping" },
            { action: "Unpause", when: "Container is paused" },
            { action: "Restart", when: "Container is running or stopped" },
            { action: "Open Terminal", when: "Container is running" },
            { action: "Move to", when: "Grouped view — opens a submenu to reassign the container to a different group (not available for Compose containers)" },
            { action: "Full Details", when: "Always — opens the container detail page" },
            { action: "Insights", when: "Always — opens CPU/memory charts and log settings" },
            { action: "Copy ID", when: "Always — copies the short container ID to clipboard" },
            { action: "Remove", when: "Always — permanently removes the container (force stops if running)" },
          ].map(({ action, when }) => (
            <div key={action} className="grid grid-cols-[140px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium">{action}</span>
              <span className="text-muted-foreground">{when}</span>
            </div>
          ))}
        </div>
        <HelpCallout type="warning">
          Remove is immediate and irreversible. The container and any data not stored in a named
          volume will be lost.
        </HelpCallout>
      </section>

      {/* Bulk Actions */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Bulk Actions</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Check the checkbox on any container row to select it. Once one or more containers are
          selected, a bulk action toolbar appears with <strong>Start all</strong> and{" "}
          <strong>Stop all</strong> options that apply to the selected set.
        </p>
        <HelpImage src="/help/containers-bulk.png" alt="Bulk action toolbar with selected containers" caption="Bulk start/stop after selecting multiple containers" />
      </section>

      {/* Run Container */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Running a New Container</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click <strong>Run Container</strong> in the top-right to open the run sheet. Fill in:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { field: "Image", desc: "Fully qualified image name, e.g. docker.io/library/nginx. Tag defaults to latest if omitted." },
            { field: "Name", desc: "Optional. If left blank, Podman generates a random name." },
            { field: "Ports", desc: "Host → container port pairs, e.g. 8080:80. Add multiple rows as needed." },
            { field: "Environment", desc: "KEY=VALUE pairs. Add as many as required." },
            { field: "Command", desc: "Overrides the image's default command. Leave blank to use the image default." },
          ].map(({ field, desc }) => (
            <div key={field} className="grid grid-cols-[110px_1fr] gap-2 px-4 py-2.5">
              <span className="font-medium">{field}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <HelpCallout type="note">
          Podman requires fully qualified image names. If you get a pull error with a short name
          like <code className="font-mono text-xs">nginx</code>, try{" "}
          <code className="font-mono text-xs">docker.io/library/nginx</code> instead.
        </HelpCallout>
        <HelpImage src="/help/containers-run-sheet.png" alt="Run container sheet with image and port fields" caption="The run container panel" />
      </section>

      {/* Copy ID */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Copying a Container ID</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The short container ID shown in each row is clickable. Hovering reveals a copy icon —
          click to copy the ID to your clipboard. A toast confirms the copy. You can also copy the
          ID from the <strong>⋯</strong> context menu.
        </p>
      </section>
    </div>
  );
}
