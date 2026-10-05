export type WorkspaceSlot = 0 | 1;
export type WorkspaceSlots = [string | null, string | null];

/** Browser labels are presentation hints. Only the verified listing supplies valid IDs. */
export function assignWorkspaceSlots(
  available: string[],
  previous: WorkspaceSlots,
): WorkspaceSlots {
  const slots: WorkspaceSlots = [null, null];
  for (const index of [0, 1] as const) {
    const id = previous[index];
    if (id && available.includes(id) && !slots.includes(id)) slots[index] = id;
  }
  for (const id of available) {
    if (slots.includes(id)) continue;
    const index = slots.indexOf(null);
    if (index < 0) break;
    slots[index as WorkspaceSlot] = id;
  }
  return slots;
}
