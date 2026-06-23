/* Lógica pura del Board/Kanban — agnóstica, testeable sin DnD ni render. */

export interface BoardItem {
  id: string;
}

export interface BoardColumn<T extends BoardItem> {
  id: string;
  title: string;
  items: T[];
}

export type BoardState<T extends BoardItem> = BoardColumn<T>[];

export function findColumnOf<T extends BoardItem>(
  state: BoardState<T>,
  itemId: string,
): string | undefined {
  return state.find((col) => col.items.some((i) => i.id === itemId))?.id;
}

export function moveItem<T extends BoardItem>(
  state: BoardState<T>,
  itemId: string,
  toColumnId: string,
  toIndex?: number,
): BoardState<T> {
  const fromColumnId = findColumnOf(state, itemId);
  if (fromColumnId === undefined) return state;
  const item = state.find((col) => col.id === fromColumnId)?.items.find((i) => i.id === itemId);
  if (item === undefined) return state;

  return state.map((col) => {
    if (col.id === fromColumnId && col.id === toColumnId) {
      const without = col.items.filter((i) => i.id !== itemId);
      const idx = toIndex ?? without.length;
      return { ...col, items: [...without.slice(0, idx), item, ...without.slice(idx)] };
    }
    if (col.id === fromColumnId) {
      return { ...col, items: col.items.filter((i) => i.id !== itemId) };
    }
    if (col.id === toColumnId) {
      const idx = toIndex ?? col.items.length;
      return { ...col, items: [...col.items.slice(0, idx), item, ...col.items.slice(idx)] };
    }
    return col;
  });
}
