import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { Activity } from "react";
import { ContainersPage } from "./containers.index";

export const Route = createFileRoute("/containers")({
  component: ContainersLayout,
});

function ContainersLayout() {
  const matchRoute = useMatchRoute();
  // True when a specific container is open — hide the list but keep it alive.
  const onDetail = !!matchRoute({ to: "/containers/$id" });

  return (
    <>
      {/* The overflow-y-auto wrapper must be INSIDE Activity so React owns the
          DOM node and can preserve its scroll position when toggling hidden/visible.
          When hidden (display:none), the wrapper is out of layout and <main>
          scrolls the detail page normally instead. */}
      <Activity mode={onDetail ? "hidden" : "visible"}>
        <div className="h-full overflow-y-auto">
          <ContainersPage />
        </div>
      </Activity>

      <Outlet />
    </>
  );
}
