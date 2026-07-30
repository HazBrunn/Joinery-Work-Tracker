import { ReactNode, useRef, useState } from 'react';

/*
  Reordering a short list by dragging a handle. Pointer events, so it works with
  a finger in an installed PWA where HTML5 drag-and-drop does not.

  The index it tracks is a *gap*, not a row: 0 is above the first, length is
  below the last. Reading it as a row is the classic version of this bug — the
  drop lands one place below the line that showed where it would go, and the
  position after the last row can never be reached.
*/
export function useDragList<T>(items: T[], onReorder: (next: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const mids = useRef<number[]>([]);

  const begin = (index: number, e: React.PointerEvent, container: HTMLElement) => {
    mids.current = Array.from(container.querySelectorAll('[data-drag-row]')).map((r) => {
      const b = (r as HTMLElement).getBoundingClientRect();
      return b.top + b.height / 2;
    });
    setDragIndex(index);
    setOverIndex(index);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety; the drag still works without it */
    }
  };

  const move = (e: React.PointerEvent) => {
    if (dragIndex == null) return;
    let gap = mids.current.length;
    for (let i = 0; i < mids.current.length; i++) {
      if (e.clientY < mids.current[i]) {
        gap = i;
        break;
      }
    }
    setOverIndex(gap);
  };

  const end = () => {
    if (dragIndex != null && overIndex != null) {
      // Removing the dragged row first shifts everything below it up one, so a
      // gap below the origin is one lower in the array that remains.
      const to = overIndex > dragIndex ? overIndex - 1 : overIndex;
      if (to !== dragIndex) {
        const next = [...items];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(to, 0, moved);
        onReorder(next);
      }
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  return { dragIndex, overIndex, count: items.length, begin, move, end };
}

type DL = ReturnType<typeof useDragList>;

export function DragContainer({ children }: { children: ReactNode }) {
  return <div data-drag-container>{children}</div>;
}

export function DragRow({ dl, index, children }: { dl: DL; index: number; children: ReactNode }) {
  const dragging = dl.dragIndex === index;
  const live = dl.dragIndex != null && dl.overIndex != null
    && dl.overIndex !== dl.dragIndex && dl.overIndex !== dl.dragIndex + 1;
  const lineAbove = live && dl.overIndex === index;
  const lineBelow = live && dl.overIndex === dl.count && index === dl.count - 1;
  return (
    <div
      data-drag-row
      onPointerMove={(e) => dl.dragIndex != null && dl.move(e)}
      onPointerUp={() => dl.dragIndex != null && dl.end()}
      onPointerCancel={() => dl.dragIndex != null && dl.end()}
      style={{
        position: 'relative',
        opacity: dragging ? 0.5 : 1,
        borderRadius: 'var(--radius-sm)',
        boxShadow: lineAbove
          ? 'inset 0 2px 0 var(--accent)'
          : lineBelow
            ? 'inset 0 -2px 0 var(--accent)'
            : undefined,
        touchAction: dl.dragIndex != null ? 'none' : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function DragHandle({ dl, index }: { dl: DL; index: number }) {
  const grab = (e: React.PointerEvent) => {
    e.stopPropagation();
    let n = e.currentTarget as HTMLElement | null;
    while (n && !n.hasAttribute('data-drag-container')) n = n.parentElement;
    if (n) dl.begin(index, e, n);
  };
  return (
    <button
      className="btn-icon"
      aria-label="Drag to reorder"
      title="Drag to reorder"
      onPointerDown={grab}
      onPointerMove={(e) => {
        if (dl.dragIndex != null) {
          e.stopPropagation();
          dl.move(e);
        }
      }}
      onPointerUp={(e) => {
        if (dl.dragIndex != null) {
          e.stopPropagation();
          dl.end();
        }
      }}
      style={{ cursor: 'grab', touchAction: 'none', flex: '0 0 auto' }}
    >
      ⠿
    </button>
  );
}
