import { HelpImage } from "@/components/help/help-image";

export function NetworksSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Networks</h2>
        <p className="mt-2 text-muted-foreground">
          View and manage Podman networks and the containers connected to them.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Network List</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Networks page lists all networks on your Podman instance. Each row shows the network
          name, driver, scope, and subnet. The default networks created by Podman (
          <code className="font-mono text-xs">podman</code>,{" "}
          <code className="font-mono text-xs">bridge</code>) are included.
        </p>
        <HelpImage src="/help/networks-list.png" alt="Network list with name, driver, and subnet columns" caption="Podman networks list" />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Container Membership</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Click any network to expand it and see which containers are connected. Running containers
          are highlighted. Clicking a container name navigates to its detail page.
        </p>
        <HelpImage src="/help/networks-expanded.png" alt="Network expanded showing connected containers" caption="Containers connected to a network" />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Removing Networks</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Networks with no connected containers can be removed via the <strong>⋯</strong> menu.
          Podman's default networks cannot be removed.
        </p>
      </section>
    </div>
  );
}
