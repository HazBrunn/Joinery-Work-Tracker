import { ReactNode, useEffect, useRef, useState } from 'react';

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
  // Read inside the window listeners, which are bound once per drag and would
  // otherwise close over the state as it was when the drag started.
  const live = useRef({ items, onReorder, dragIndex, overIndex });
  live.current = { items, onReorder, dragIndex, overIndex };

  const begin = (index: number, _e: React.PointerEvent, container: HTMLElement) => {
    mids.current = Array.from(container.querySelectorAll('[data-drag-row]')).map((r) => {
      const b = (r as HTMLElement).getBoundingClientRect();
      return b.top + b.height / 2;
    });
    setDragIndex(index);
    setOverIndex(index);
  };

  // The whole drag is tracked on the window rather than through the handle.
  // Pointer capture on a button is refused often enough — and a finger leaves a
  // 36px target immediately — that relying on either is how a drag ends up
  // doing nothing at all.
  useEffect(() => {
    if (dragIndex == null) return;
    const onMove = (e: PointerEvent) => {
      let gap = mids.current.length;
      for (let i = 0; i < mids.current.length; i++) {
        if (e.clientY < mids.current[i]) {
          gap = i;
          break;
        }
      }
      setOverIndex(gap);
      e.preventDefault();
    };
    const onUp = () => {
      const { items: cur, onReorder: cb, dragIndex: from, overIndex: gap } = live.current;
      if (from != null && gap != null) {
        // Removing the dragged row first shifts everything below it up one, so
        // a gap below the origin is one lower in the array that remains.
        const to = gap > from ? gap - 1 : gap;
        if (to !== from) {
          const next = [...cur];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          cb(next);
        }
      }
      setDragIndex(null);
      setOverIndex(null);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragIndex]);

  return { dragIndex, overIndex, count: items.length, begin };
}

type DL = ReturnType<typeof useDragList>;

export function DragContainer({ children }: { children: ReactNode }) {
  return <div data-drag-container>{children}</div>;
}

export function DragRow({ dl, index, children }: { dl: DL; index: number; children: ReactNode }) {
  const dragging = dl.dragIndex === index;
  const showing = dl.dragIndex != null && dl.overIndex != null
    && dl.overIndex !== dl.dragIndex && dl.overIndex !== dl.dragIndex + 1;
  const lineAbove = showing && dl.overIndex === index;
  const lineBelow = showing && dl.overIndex === dl.count && index === dl.count - 1;
  return (
    <div
      data-drag-row
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
      style={{
        cursor: 'grab',
        touchAction: 'none',
        flex: '0 0 auto',
        background: dl.dragIndex === index ? 'var(--accent)' : undefined,
      }}
    >
      ⠿
    </button>
  );
}
