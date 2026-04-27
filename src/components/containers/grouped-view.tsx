import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

// For group reordering, use pointer-within so the swap only triggers when
// the pointer physically enters another group's bounding box. This means
// the switch point is the actual visual boundary between groups, regardless
// of height. Falls back to nearest top-edge for gaps between groups.
// Container drags use closestCenter unchanged (rows are uniform height).
const groupAwareCollision: CollisionDetection = (args) => {
  const { active, droppableContainers, droppableRects, pointerCoordinates } = args;

  if (String(active.id).startsWith("grp:")) {
    const groupOnly = {
      ...args,
      droppableContainers: droppableContainers.filter(
        ({ id }) => String(id).startsWith("grp:"),
      ),
    };

    // Primary: only switch when pointer is physically inside a group's rect.
    const within = pointerWithin(groupOnly);
    if (within.length > 0) return within;

    // Fallback for gaps between groups — nearest top edge.
    if (pointerCoordinates) {
      const byTopEdge = droppableContainers
        .filter(({ id }) => String(id).startsWith("grp:") && droppableRects.has(id))
        .map((container) => {
          const rect = droppableRects.get(container.id)!;
          return { id: container.id, data: { value: Math.abs(rect.top - pointerCoordinates.y) } };
        })
        .sort((a, b) => (a.data?.value ?? 0) - (b.data?.value ?? 0));
      if (byTopEdge.length > 0) return byTopEdge;
    }
  }

  return closestCenter(args);
};
import {
  sortableKeyboardCoordinates,
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Container, type ContainerGroup } from "@/lib/api";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { ContainerRow } from "@/components/containers/container-row";
import { SortableGroupPanel } from "@/components/containers/sortable-group-panel";
import { EMPTY_GROUPS, findGroupForContainer, getColour } from "@/components/containers/group-panel";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroupedViewProps {
  containers: Container[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectMany: (ids: string[], select: boolean) => void;
  onRemoved: (id: string) => void;
  conflictingPorts?: Set<number>;
}

// ─── Drag overlay preview for a group header ─────────────────────────────────

function GroupDragPreview({ group, containerCount }: { group: ContainerGroup; containerCount: number }) {
  const isCompose = group.kind === "compose";
  const isCustom = group.kind === "custom";
  const isUngrouped = group.kind === "ungrouped";
  const colour = getColour(isCustom ? group.colour : null);

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden shadow-lg ring-2 ring-primary/30 cursor-grabbing",
        isCompose && "ring-1 ring-blue-500/30 bg-blue-500/[0.03]",
        isCustom && [colour.ring, colour.bg],
        isUngrouped && "ring-1 ring-dashed ring-border/50 bg-muted/10",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5",
          isCompose && "bg-blue-500/[0.07]",
          isCustom && colour.header,
          isUngrouped && "bg-muted/20",
        )}
      >
        <span
          className={cn(
            "text-sm font-semibold",
            isCompose && "text-blue-700 dark:text-blue-300",
            isCustom && colour.text,
            isUngrouped && "text-muted-foreground",
          )}
        >
          {group.name}
        </span>
        <span className="text-xs text-muted-foreground">{containerCount}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GroupedView({
  containers,
  selectedIds,
  onToggle,
  onSelectMany,
  onRemoved,
  conflictingPorts,
}: GroupedViewProps) {
  const queryClient = useQueryClient();

  // Container drag state
  const [activeContainerId, setActiveContainerId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localGroups, setLocalGroups] = useState<ContainerGroup[]>(EMPTY_GROUPS);

  // Group drag state
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupDragActive, setGroupDragActive] = useState(false);
  const [localGroupOrder, setLocalGroupOrder] = useState<string[]>([]);

  // Persisted set of collapsed group IDs — survives navigation and restarts.
  const [collapsedIds, setCollapsedIds] = useLocalStorage<string[]>("harbr:groups:collapsed", []);

  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);

  const { data: serverGroups = EMPTY_GROUPS } = useQuery({
    queryKey: ["groups"],
    queryFn: api.groups.list,
    refetchInterval: 5_000,
  });

  // When a group drag is in progress, apply local ordering to the server groups.
  const activeGroups = dragActive ? localGroups : serverGroups;
  const displayedGroups = useMemo(() => {
    if (!groupDragActive || localGroupOrder.length === 0) return activeGroups;
    const orderMap = new Map(localGroupOrder.map((id, i) => [id, i]));
    return [...activeGroups].sort(
      (a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity),
    );
  }, [activeGroups, groupDragActive, localGroupOrder]);

  const containerMap = useMemo(
    () => new Map(containers.map((c) => [c.id, c])),
    [containers],
  );

  // Keep all group container_ids from the server — do NOT filter against containerMap here.
  // containerMap excludes stopped containers when runningOnly=true, which would incorrectly
  // drop containers from their groups during a status transition.
  // GroupPanel handles missing containerMap entries by rendering null for each absent ID.
  const mergedGroups = displayedGroups;

  // All custom groups — passed to GroupPanel to build "Move to" submenus.
  const customGroups = useMemo(
    () => serverGroups.filter((g) => g.kind === "custom"),
    [serverGroups],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["groups"] }),
      queryClient.invalidateQueries({ queryKey: ["containers"] }),
    ]);

  const createGroup = useMutation({
    mutationFn: (name: string) => api.groups.create({ name }),
    onSuccess: () => {
      invalidate();
      setNewGroupName("");
      setShowNewGroup(false);
    },
  });

  const setGroupDisplayOrder = useMutation({
    mutationFn: (groupIds: string[]) => api.groups.setDisplayOrder(groupIds),
    onSettled: () => {
      void invalidate().finally(() => setGroupDragActive(false));
    },
  });

  // ── Normalise over.id — strip "grp:" prefix to get bare group ID ──────────
  function normaliseOverId(id: string): string {
    return id.startsWith("grp:") ? id.slice(4) : id;
  }

  function handleDragStart({ active }: DragStartEvent) {
    const id = active.id as string;

    if (id.startsWith("grp:")) {
      // Group drag
      setActiveGroupId(id.slice(4));
      setLocalGroupOrder(mergedGroups.map((g) => g.id));
      setGroupDragActive(true);
    } else {
      // Container drag
      setActiveContainerId(id);
      setLocalGroups(serverGroups);
      setDragActive(true);
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const activeId = active.id as string;

    if (activeId.startsWith("grp:")) {
      // ── Group reorder ────────────────────────────────────────────────────
      setActiveGroupId(null);

      if (!over || active.id === over.id) {
        setGroupDragActive(false);
        return;
      }

      const fromId = activeId.slice(4);
      const toId = normaliseOverId(over.id as string);

      const currentOrder = localGroupOrder.length > 0
        ? localGroupOrder
        : mergedGroups.map((g) => g.id);

      const oldIndex = currentOrder.indexOf(fromId);
      const newIndex = currentOrder.indexOf(toId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        setGroupDragActive(false);
        return;
      }

      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      setLocalGroupOrder(newOrder);
      setGroupDisplayOrder.mutate(newOrder);
      return;
    }

    // ── Container drag ───────────────────────────────────────────────────
    setActiveContainerId(null);

    if (!over || active.id === over.id) {
      setDragActive(false);
      return;
    }

    const normOverId = normaliseOverId(over.id as string);

    // Drop onto a group panel
    const overAsGroup = mergedGroups.find((g) => g.id === normOverId);
    if (overAsGroup) {
      const sourceGroup = findGroupForContainer(mergedGroups, activeId);
      if (!sourceGroup || overAsGroup.id === sourceGroup.id) {
        setDragActive(false);
        return;
      }
      if (sourceGroup.kind === "compose" || overAsGroup.kind === "compose") {
        setDragActive(false);
        return;
      }

      const newSourceIds = sourceGroup.container_ids.filter((id) => id !== activeId);
      const newDestIds = [...overAsGroup.container_ids, activeId];

      setLocalGroups((prev) =>
        prev.map((g) => {
          if (g.id === sourceGroup.id) return { ...g, container_ids: newSourceIds };
          if (g.id === overAsGroup.id) return { ...g, container_ids: newDestIds };
          return g;
        }),
      );

      if (overAsGroup.kind === "custom") {
        void api.groups
          .assignContainer(overAsGroup.id, { container_id: activeId })
          .then(() => api.groups.setOrder(overAsGroup.id, { container_ids: newDestIds }))
          .then(invalidate)
          .finally(() => setDragActive(false));
      } else if (overAsGroup.kind === "ungrouped") {
        void api.groups
          .unassignContainer(sourceGroup.id, activeId)
          .then(invalidate)
          .finally(() => setDragActive(false));
      } else {
        setDragActive(false);
      }
      return;
    }

    // Drop onto a container row (reorder / cross-group)
    const sourceGroup = findGroupForContainer(mergedGroups, activeId);
    const destGroup = findGroupForContainer(mergedGroups, normOverId);

    if (!sourceGroup || !destGroup) {
      setDragActive(false);
      return;
    }

    if (sourceGroup.id === destGroup.id) {
      const oldIndex = sourceGroup.container_ids.indexOf(activeId);
      const newIndex = destGroup.container_ids.indexOf(normOverId);
      if (oldIndex === newIndex) {
        setDragActive(false);
        return;
      }

      const newIds = arrayMove(sourceGroup.container_ids, oldIndex, newIndex);
      setLocalGroups((prev) =>
        prev.map((g) => (g.id === sourceGroup.id ? { ...g, container_ids: newIds } : g)),
      );

      void api.groups
        .setOrder(sourceGroup.id, { container_ids: newIds })
        .then(invalidate)
        .finally(() => setDragActive(false));
    } else {
      if (sourceGroup.kind === "compose" || destGroup.kind === "compose") {
        setDragActive(false);
        return;
      }

      const newSourceIds = sourceGroup.container_ids.filter((id) => id !== activeId);
      const destIdx = destGroup.container_ids.indexOf(normOverId);
      const newDestIds = [...destGroup.container_ids];
      newDestIds.splice(destIdx >= 0 ? destIdx : newDestIds.length, 0, activeId);

      setLocalGroups((prev) =>
        prev.map((g) => {
          if (g.id === sourceGroup.id) return { ...g, container_ids: newSourceIds };
          if (g.id === destGroup.id) return { ...g, container_ids: newDestIds };
          return g;
        }),
      );

      if (destGroup.kind === "custom") {
        void api.groups
          .assignContainer(destGroup.id, { container_id: activeId })
          .then(() => api.groups.setOrder(destGroup.id, { container_ids: newDestIds }))
          .then(invalidate)
          .finally(() => setDragActive(false));
      } else if (destGroup.kind === "ungrouped") {
        void api.groups
          .unassignContainer(sourceGroup.id, activeId)
          .then(invalidate)
          .finally(() => setDragActive(false));
      } else {
        setDragActive(false);
      }
    }
  }

  function handleDragCancel() {
    setActiveContainerId(null);
    setActiveGroupId(null);
    setDragActive(false);
    setGroupDragActive(false);
  }

  function applySortedOrder(group: ContainerGroup, newIds: string[]) {
    setLocalGroups(serverGroups.map((g) =>
      g.id === group.id ? { ...g, container_ids: newIds } : g,
    ));
    setDragActive(true);
    void api.groups
      .setOrder(group.id, { container_ids: newIds })
      .then(invalidate)
      .finally(() => setDragActive(false));
  }

  function handleRunningFirst(group: ContainerGroup) {
    const cs = group.container_ids
      .map((id) => containerMap.get(id))
      .filter((c): c is Container => c !== undefined);
    applySortedOrder(group, [
      ...cs.filter((c) => c.status === "running").map((c) => c.id),
      ...cs.filter((c) => c.status !== "running").map((c) => c.id),
    ]);
  }

  function handleStoppedFirst(group: ContainerGroup) {
    const cs = group.container_ids
      .map((id) => containerMap.get(id))
      .filter((c): c is Container => c !== undefined);
    applySortedOrder(group, [
      ...cs.filter((c) => c.status !== "running").map((c) => c.id),
      ...cs.filter((c) => c.status === "running").map((c) => c.id),
    ]);
  }

  function handleUpdate(id: string, name?: string, colour?: string | null) {
    void api.groups.update(id, { name, colour }).then(invalidate);
  }

  function handleDelete(id: string) {
    void api.groups.remove(id).then(invalidate);
  }

  async function handleStartAll(id: string, containerIds?: string[]): Promise<void> {
    if (containerIds && containerIds.length > 0) {
      await Promise.all(containerIds.map((cid) => api.containers.start(cid)));
    } else {
      await api.groups.startAll(id);
    }
    // Status changes don't affect group membership — only invalidate containers.
    void queryClient.invalidateQueries({ queryKey: ["containers"] });
  }

  async function handleStopAll(id: string, containerIds?: string[]): Promise<void> {
    if (containerIds && containerIds.length > 0) {
      await Promise.all(containerIds.map((cid) => api.containers.stop(cid)));
    } else {
      await api.groups.stopAll(id);
    }
    // Status changes don't affect group membership — only invalidate containers.
    void queryClient.invalidateQueries({ queryKey: ["containers"] });
  }

  function handleMoveTo(containerId: string, targetGroupId: string) {
    if (targetGroupId === "ungrouped") {
      const sourceGroup = findGroupForContainer(mergedGroups, containerId);
      if (!sourceGroup || sourceGroup.kind !== "custom") return;
      void api.groups.unassignContainer(sourceGroup.id, containerId).then(invalidate);
    } else {
      void api.groups.assignContainer(targetGroupId, { container_id: containerId }).then(invalidate);
    }
  }

  const activeContainer = activeContainerId ? containerMap.get(activeContainerId) : null;
  const activeGroup = activeGroupId ? mergedGroups.find((g) => g.id === activeGroupId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={groupAwareCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DragOverlay>
        {activeContainer && (
          <ContainerRow
            container={activeContainer}
            selected={false}
            onToggle={() => {}}
            onRemoved={() => {}}
          />
        )}
        {activeGroup && (
          <GroupDragPreview
            group={activeGroup}
            containerCount={activeGroup.container_ids.length}
          />
        )}
      </DragOverlay>

      {/* New group toolbar */}
      <div className="flex items-center gap-2 px-2 mb-3">
        {showNewGroup ? (
          <>
            <TextInput
              className="h-7 text-sm w-40"
              placeholder="Group name"
              value={newGroupName}
              autoFocus
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newGroupName.trim()) {
                  createGroup.mutate(newGroupName.trim());
                }
                if (e.key === "Escape") {
                  setShowNewGroup(false);
                  setNewGroupName("");
                }
              }}
            />
            <Button
              size="sm"
              variant="default"
              className="h-7"
              disabled={!newGroupName.trim() || createGroup.isPending}
              onClick={() => {
                if (newGroupName.trim()) createGroup.mutate(newGroupName.trim());
              }}
            >
              {createGroup.isPending ? "Creating…" : "Create"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                setShowNewGroup(false);
                setNewGroupName("");
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-muted-foreground"
            onClick={() => setShowNewGroup(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New group
          </Button>
        )}
      </div>

      <div className="pl-4 pr-4 pt-2">
        <SortableContext
          items={mergedGroups.map((g) => `grp:${g.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {mergedGroups.map((group) => (
            <SortableGroupPanel
              key={group.id}
              group={group}
              containerMap={containerMap}
              selectedIds={selectedIds}
              conflictingPorts={conflictingPorts}
              collapsed={collapsedIds.includes(group.id)}
              onCollapsedChange={(v) =>
                setCollapsedIds((prev) =>
                  v ? [...prev, group.id] : prev.filter((id) => id !== group.id),
                )
              }
              onToggle={onToggle}
              onSelectMany={onSelectMany}
              onRemoved={onRemoved}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onStartAll={handleStartAll}
              onStopAll={handleStopAll}
              onRunningFirst={handleRunningFirst}
              onStoppedFirst={handleStoppedFirst}
              customGroups={customGroups}
              onMoveTo={handleMoveTo}
            />
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
}
