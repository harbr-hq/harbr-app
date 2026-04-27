import { HelpImage } from "@/components/help/help-image";
import { HelpCallout } from "@/components/help/help-callout";

export function ImagesSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Images</h2>
        <p className="mt-2 text-muted-foreground">
          Browse, inspect, and remove images stored on your Podman instance.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Image List</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Images page lists all images currently stored locally. Each row shows the repository
          and tag, image ID, creation date, and disk size on the host.
        </p>
        <HelpImage src="/help/images-list.png" alt="Image list with name, ID, size and date columns" caption="Local image list" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Images labelled <strong>&lt;none&gt;</strong> are dangling images — intermediate layers
          from a build that are no longer referenced by any tag. They can generally be safely
          removed.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Removing Images</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click the <strong>⋯</strong> menu on any image row and select <strong>Remove</strong> to
          delete it. Images that are currently in use by a container cannot be removed until the
          container is deleted.
        </p>
        <HelpCallout type="warning">
          Removing an image is permanent. If you need it again, it will need to be pulled from the
          registry — which requires an internet connection and may take time depending on size.
        </HelpCallout>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Prune</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The <strong>Prune</strong> button removes all unused images in one operation — images not
          referenced by any container (running or stopped). This is the equivalent of{" "}
          <code className="font-mono text-xs">podman image prune</code>.
        </p>
        <HelpCallout type="warning">
          Prune removes all unreferenced images, not just dangling ones. Any image you pulled but
          don't currently have a container for will be deleted.
        </HelpCallout>
      </section>
    </div>
  );
}
