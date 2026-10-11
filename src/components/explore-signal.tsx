"use client";
import { useEffect } from "react";
import { selectedWorkspace } from "@/lib/workspaces/selection";
export { rememberWorkspace } from "@/lib/workspaces/selection";
export async function sendExploreSignal(
  kind: "skill" | "category" | "project",
  id: string,
  workspaceId?: string,
) {
  const selected = workspaceId || selectedWorkspace();
  if (!selected || navigator.doNotTrack === "1") return;
  await fetch("/api/explore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id, workspace_id: selected }),
  }).catch(() => undefined);
}
export function ExploreSignal({ kind, id }: { kind: "project"; id: string }) {
  useEffect(() => {
    void sendExploreSignal(kind, id);
  }, [kind, id]);
  return null;
}
