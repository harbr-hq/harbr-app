import { HelpImage } from "@/components/help/help-image";
import { HelpCallout } from "@/components/help/help-callout";

export function VolumesSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Volumes</h2>
        <p className="mt-2 text-muted-foreground">
          Inspect and manage named volumes — browse files, see which containers are using each
          volume, and prune unused ones.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Volume List</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Volumes page lists all named volumes on your Podman instance. Each row shows the
          volume name, driver, disk usage, and how many containers are currently referencing it.
        </p>
        <HelpImage src="/help/volumes-list.png" alt="Volume list with name, driver, size and ref-count columns" caption="Named volumes list" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Disk usage is fetched from Podman's{" "}
          <code className="font-mono text-xs">/system/df</code> endpoint. Reference counts are
          computed by cross-referencing all container mounts — Podman doesn't populate this
          directly in the volume listing.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">File Browser</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click <strong>Browse files</strong> on any volume to open the file browser. Navigate
          folders and see file names, sizes, and last-modified timestamps.
        </p>
        <HelpImage src="/help/volumes-browser.png" alt="Volume file browser showing directory listing" caption="Browsing files inside a volume" />
        <HelpCallout type="note">
          The file browser reads files directly from the volume's mountpoint on the host filesystem.
          On <strong>Windows and macOS</strong>, volumes live inside the Podman Machine VM — the
          mountpoint is not accessible from the host, so the file browser is unavailable on those
          platforms.
        </HelpCallout>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Container Membership</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The <strong>Containers</strong> tab on a volume shows every container (running or stopped)
          that has this volume mounted. Clicking a container name navigates to its detail page.
        </p>
        <HelpImage src="/help/volumes-containers.png" alt="Volume containers tab showing mounted containers" caption="Containers using this volume" />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Removing Volumes</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click <strong>Remove</strong> in the volume's action menu to delete it. Volumes that are
          in use by at least one container cannot be removed until all containers referencing them
          are deleted.
        </p>
        <HelpCallout type="warning">
          Removing a volume permanently deletes all data stored inside it. This cannot be undone.
        </HelpCallout>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Prune</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong>Prune unused volumes</strong> removes all volumes not currently referenced by any
          container. Harbr reports how many volumes were removed and how much disk space was
          reclaimed.
        </p>
      </section>
    </div>
  );
}
