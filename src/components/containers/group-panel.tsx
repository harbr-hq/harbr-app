import { useState, useTransition } from "react";
import { useMinPending } from "@/hooks/use-min-pending";
import { useConfirm } from "@/hooks/use-confirm";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { type Container, type ContainerGroup } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SortableContainerRow } from "@/components/containers/sortable-container-row";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronRight,
  GripVertical,
  Loader2,
  Lock,
  Play,
  Square,
  Trash2,
  Zap,
  ZapOff,
} from "lucide-react";

// ── Colour palette ─────────────────────────────────────────────────────────
// All Tailwind classes must be statically present so they aren't tree-shaken.
export const COLOURS = [
  {
    key: "violet",
    label: "Violet",
    dot: "bg-violet-500",
    ring: "ring-1 ring-violet-500/30",
    bg: "bg-violet-500/[0.03]",
    header: "bg-violet-500/[0.07] border-violet-500/15",
    text: "text-violet-700 dark:text-violet-300",
  },
  {
    key: "pink",
    label: "Pink",
    dot: "bg-pink-500",
    ring: "ring-1 ring-pink-500/30",
    bg: "bg-pink-500/[0.03]",
    header: "bg-pink-500/[0.07] border-pink-500/15",
    text: "text-pink-700 dark:text-pink-300",
  },
  {
    key: "rose",
    label: "Rose",
    dot: "bg-rose-500",
    ring: "ring-1 ring-rose-500/30",
    bg: "bg-rose-500/[0.03]",
    header: "bg-rose-500/[0.07] border-rose-500/15",
    text: "text-rose-700 dark:text-rose-300",
  },
  {
    key: "orange",
    label: "Orange",
    dot: "bg-orange-500",
    ring: "ring-1 ring-orange-500/30",
    bg: "bg-orange-500/[0.03]",
    header: "bg-orange-500/[0.07] border-orange-500/15",
    text: "text-orange-700 dark:text-orange-300",
  },
  {
    key: "amber",
    label: "Amber",
    dot: "bg-amber-500",
    ring: "ring-1 ring-amber-500/30",
    bg: "bg-amber-500/[0.03]",
    header: "bg-amber-500/[0.07] border-amber-500/15",
    text: "text-amber-700 dark:text-amber-300",
  },
  {
    key: "green",
    label: "Green",
    dot: "bg-green-500",
    ring: "ring-1 ring-green-500/30",
    bg: "bg-green-500/[0.03]",
    header: "bg-green-500/[0.07] border-green-500/15",
    text: "text-green-700 dark:text-green-300",
  },
  {
    key: "teal",
    label: "Teal",
    dot: "bg-teal-500",
    ring: "ring-1 ring-teal-500/30",
    bg: "bg-teal-500/[0.03]",
    header: "bg-teal-500/[0.07] border-teal-500/15",
    text: "text-teal-700 dark:text-teal-300",
  },
  {
    key: "sky",
    label: "Sky",
    dot: "bg-sky-500",
    ring: "ring-1 ring-sky-500/30",
    bg: "bg-sky-500/[0.03]",
    header: "bg-sky-500/[0.07] border-sky-500/15",
    text: "text-sky-700 dark:text-sky-300",
  },
  {
    key: "indigo",
    label: "Indigo",
    dot: "bg-indigo-500",
    ring: "ring-1 ring-indigo-500/30",
    bg: "bg-indigo-500/[0.03]",
    header: "bg-indigo-500/[0.07] border-indigo-500/15",
    text: "text-indigo-700 dark:text-indigo-300",
  },
] as const;

export type ColourKey = (typeof COLOURS)[number]["key"];

export function getColour(key: string | null | undefined) {
  return COLOURS.find((c) => c.key === key) ?? COLOURS[0];
}

// Stable empty reference — avoids a "new [] each render" infinite-loop
// that would occur with `data ?? []` as a useEffect dependency.
export const EMPTY_GROUPS: ContainerGroup[] = [];

export function findGroupForContainer(
  groups: ContainerGroup[],
  containerId: string,
): ContainerGroup | undefined {
  return groups.find((g) => g.container_ids.includes(containerId));
}

export interface GroupPanelProps {
  group: ContainerGroup;
  containerMap: Map<string, Container>;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectMany: (ids: string[], select: boolean) => void;
  onRemoved: (id: string) => void;
  onUpdate: (id: string, name?: string, colour?: string | null) => void;
  onDelete: (id: string) => void;
  onStartAll: (id: string, containerIds?: string[]) => Promise<void>;
  onStopAll: (id: string, containerIds?: string[]) => Promise<void>;
  onRunningFirst: (group: ContainerGroup) => void;
  onStoppedFirst: (group: ContainerGroup) => void;
  conflictingPorts?: Set<number>;
  /** Controlled collapsed state — managed by SortableGroupPanel. */
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  /** Drag handle props from useSortable — only passed when collapsed. */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  /** Visual cue while the group is being dragged. */
  isDragging?: boolean;
  /** Ref to attach to the outer wrapper for droppable registration. */
  dropRef?: (node: HTMLElement | null) => void;
  isOver?: boolean;
  /** All custom groups — used to build "Move to" submenu in container rows. */
  customGroups?: ContainerGroup[];
  /** Called when a container's "Move to" menu item is selected. */
  onMoveTo?: (containerId: string, targetGroupId: string) => void;
}

export function GroupPanel({
  group,
  containerMap,
  selectedIds,
  onToggle,
  onSelectMany,
  onRemoved,
  onUpdate,
  onDelete,
  onStartAll,
  onStopAll,
  onRunningFirst,
  onStoppedFirst,
  conflictingPorts,
  collapsed,
  onCollapsedChange,
  dragHandleProps,
  isDragging,
  dropRef,
  isOver,
  customGroups,
  onMoveTo,
}: GroupPanelProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [colourOpen, setColourOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  const [stopTransPending, startStopTrans] = useTransition();
  const [startTransPending, startStartTrans] = useTransition();
  const stopPending = useMinPending(stopTransPending);
  const startPending = useMinPending(startTransPending);

  const containers = group.container_ids
    .map((id) => containerMap.get(id))
    .filter((c): c is Container => c !== undefined);

  const runningCount = containers.filter((c) => c.status === "running").length;
  const isCompose = group.kind === "compose";
  const isCustom = group.kind === "custom";
  const isUngrouped = group.kind === "ungrouped";

  const selectedInGroup = containers.filter((c) => selectedIds.has(c.id));
  const allInGroupSelected = containers.length > 0 && selectedInGroup.length === containers.length;
  const someInGroupSelected = selectedInGroup.length > 0 && !allInGroupSelected;
  // When some (but not all) containers are selected, start/stop acts on the selection only.
  const selectionIds = someInGroupSelected ? selectedInGroup.map((c) => c.id) : undefined;

  const colour = getColour(isCustom ? group.colour : null);

  // Build the list of groups a container in this panel can be moved to.
  // Compose containers are locked — no "Move to" menu for them.
  const moveToGroups: Array<{ id: string; name: string }> | undefined =
    !isCompose && customGroups
      ? [
          ...customGroups.filter((g) => g.id !== group.id).map((g) => ({ id: g.id, name: g.name })),
          ...(isCustom ? [{ id: "ungrouped", name: "Ungrouped" }] : []),
        ]
      : undefined;

  function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== group.name) {
      onUpdate(group.id, trimmed);
    }
    setEditing(false);
  }

  return (
    <>
    <div
      ref={dropRef}
      className={cn(
        "mb-3 rounded-xl overflow-hidden transition-all duration-150",
        isCompose && "ring-1 ring-blue-500/30 bg-blue-500/[0.03]",
        isCustom && [colour.ring, colour.bg],
        isUngrouped && "ring-1 ring-dashed ring-border/50 bg-muted/10",
        isOver && !group.locked && "ring-2 ring-primary/50 shadow-[0_0_0_4px] shadow-primary/10",
        isDragging && "opacity-50",
      )}
    >
      {/* ── Group header ────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 border-b group",
          isCompose && "bg-blue-500/[0.07] border-blue-500/15",
          isCustom && colour.header,
          isUngrouped && "bg-muted/20 border-border/30",
        )}
      >
        {/* Drag handle — only shown when collapsed */}
        {collapsed && dragHandleProps ? (
          <button
            {...dragHandleProps}
            className="text-muted-foreground/50 hover:text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing touch-none"
            aria-label="Drag to reorder group"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="w-3.5 shrink-0" />
        )}

        {/* Collapse toggle */}
        <button
          className="text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expand group" : "Collapse group"}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-150",
              !collapsed && "rotate-90",
            )}
          />
        </button>

        {/* Group select-all checkbox */}
        {containers.length > 0 && (
          <Checkbox
            checked={someInGroupSelected ? "indeterminate" : allInGroupSelected}
            onCheckedChange={() =>
              onSelectMany(containers.map((c) => c.id), !allInGroupSelected)
            }
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select all containers in ${group.name}`}
            className="shrink-0"
          />
        )}

        {/* Colour picker dot — custom groups only */}
        {isCustom && (
          <Popover open={colourOpen} onOpenChange={setColourOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10 transition-transform hover:scale-125",
                  colour.dot,
                )}
                title="Change colour"
                onClick={(e) => e.stopPropagation()}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" side="bottom" align="start">
              <div className="flex gap-1.5 flex-wrap w-[130px]">
                {COLOURS.map((c) => (
                  <button
                    key={c.key}
                    className={cn(
                      "h-5 w-5 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110",
                      c.dot,
                      group.colour === c.key && "ring-2 ring-offset-1 ring-foreground/40",
                    )}
                    title={c.label}
                    onClick={() => {
                      onUpdate(group.id, undefined, c.key as ColourKey);
                      setColourOpen(false);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Name — double-click to edit on custom groups */}
        {editing ? (
          <TextInput
            className="h-6 py-0 px-1.5 text-sm font-semibold w-44"
            value={editName}
            autoFocus
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setEditName(group.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span
            className={cn(
              "text-sm font-semibold leading-tight",
              isCustom && "cursor-text",
              isCompose && "text-blue-700 dark:text-blue-300",
              isCustom && colour.text,
              isUngrouped && "text-muted-foreground",
            )}
            onDoubleClick={() => {
              if (isCustom) {
                setEditName(group.name);
                setEditing(true);
              }
            }}
            title={isCustom ? "Double-click to rename" : undefined}
          >
            {group.name}
          </span>
        )}

        {/* Compose lock badge */}
        {isCompose && (
          <Badge
            variant="outline"
            className="h-4 px-1.5 text-[10px] gap-0.5 shrink-0 border-blue-500/30 text-blue-600 dark:text-blue-400"
          >
            <Lock className="h-2.5 w-2.5" />
            compose
          </Badge>
        )}

        {/* Container count */}
        <span className="text-xs text-muted-foreground shrink-0">
          {containers.length}
          {runningCount > 0 && (
            <span className="text-green-500 dark:text-green-400"> · {runningCount} running</span>
          )}
        </span>

        {/* Actions — reveal on group-header hover */}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {containers.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Move running containers to top"
                onClick={() => onRunningFirst(group)}
              >
                <Zap className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Move stopped containers to top"
                onClick={() => onStoppedFirst(group)}
              >
                <ZapOff className="h-3 w-3" />
              </Button>
            </>
          )}
          {!isUngrouped && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                title={someInGroupSelected ? "Start selected" : "Start all"}
                disabled={startPending || stopPending}
                onClick={() =>
                  startStartTrans(async () => {
                    await onStartAll(group.id, selectionIds);
                  })
                }
              >
                {startPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                title={someInGroupSelected ? "Stop selected" : "Stop all"}
                disabled={stopPending || startPending}
                onClick={() =>
                  startStopTrans(async () => {
                    await onStopAll(group.id, selectionIds);
                  })
                }
              >
                {stopPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
              </Button>
            </>
          )}
          {isCustom && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Delete group"
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete group?",
                  description: `"${group.name}" will be deleted. Containers in this group will become ungrouped.`,
                  confirmLabel: "Delete",
                });
                if (ok) onDelete(group.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Container rows ───────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="flex flex-col gap-1.5 px-2 pt-2 pb-1">
          {group.container_ids.length === 0 ? (
            <div
              className={cn(
                "h-10 rounded-lg border border-dashed flex items-center justify-center",
                "text-xs text-muted-foreground/60 transition-colors",
                isOver && !group.locked && "border-primary/40 text-primary/60 bg-primary/5",
                !isOver && "border-border/30",
              )}
            >
              Drop containers here
            </div>
          ) : (
            // SortableContext items must match rendered nodes — exclude IDs absent from
            // containerMap (transiently missing containers) to keep dnd-kit stable.
            <SortableContext items={group.container_ids.filter((id) => containerMap.has(id))} strategy={verticalListSortingStrategy}>
              {group.container_ids.map((id) => {
                const container = containerMap.get(id);
                if (!container) return null;
                return (
                  <SortableContainerRow
                    key={id}
                    container={container}
                    selected={selectedIds.has(id)}
                    conflictingPorts={conflictingPorts}
                    onToggle={() => onToggle(id)}
                    onRemoved={() => onRemoved(id)}
                    moveToGroups={moveToGroups}
                    onMoveTo={onMoveTo ? (targetGroupId) => onMoveTo(container.id, targetGroupId) : undefined}
                  />
                );
              })}
            </SortableContext>
          )}
        </div>
      )}
    </div>
    {dialog}
    </>
  );
}
