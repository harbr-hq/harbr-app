import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ContainerRow, type RowProps } from "@/components/containers/container-row";
import type { Container } from "@/lib/api";

interface SortableContainerRowProps extends Omit<RowProps, "container" | "dragHandleProps"> {
  container: Container;
}

export function SortableContainerRow({ container, ...rowProps }: SortableContainerRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: container.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? "opacity-50" : ""}
    >
      <ContainerRow
        container={container}
        dragHandleProps={{ ...listeners, ...attributes }}
        {...rowProps}
      />
    </div>
  );
}
