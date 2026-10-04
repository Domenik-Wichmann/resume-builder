"use client";
import { useEffect } from "react";
export function rememberWorkspace(id: string) {
  sessionStorage.setItem("rb_selected_workspace", id);
}
export async function sendExploreSignal(
  kind: "skill" | "category" | "project",
  id: string,
  workspaceId?: string,
) {
  const selected =
    workspaceId || sessionStorage.getItem("rb_selected_workspace");
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
