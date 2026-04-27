import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GroupPanel, type GroupPanelProps } from "@/components/containers/group-panel";

// All GroupPanelProps flow through — only the internal dnd props are injected here.
type SortableGroupPanelProps = Omit<
  GroupPanelProps,
  "dragHandleProps" | "isDragging" | "dropRef" | "isOver"
>;

export function SortableGroupPanel({ collapsed, onCollapsedChange, ...props }: SortableGroupPanelProps) {

  // Sortable for group-level reordering — prefixed ID distinguishes from container IDs.
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `grp:${props.group.id}` });

  // Droppable for cross-group container drops — bare group ID.
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: props.group.id });

  return (
    <div
      ref={setSortableRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <GroupPanel
        {...props}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        dragHandleProps={collapsed ? { ...listeners, ...attributes } : undefined}
        isDragging={isDragging}
        dropRef={setDropRef}
        isOver={isOver}
      />
    </div>
  );
}
