"use client";
import { useState } from "react";
import type { ExplorerData } from "@/lib/career-brain/record-view";
import { CareerRecordExplorer } from "./career-record-explorer";
export function ProfileIdentityEditor({ initial }: { initial: ExplorerData }) {
  const [data, setData] = useState(initial);
  return (
    <section className="studio-section">
      <h2>Name, headline & introduction</h2>
      <p className="muted">
        Expand your profile to edit these canonical details. Corrections
        preserve its identity and return it to private review until republished.
      </p>
      <CareerRecordExplorer
        data={{
          ...data,
          records: data.records.filter((row) => row.kind === "profile"),
        }}
        onChange={setData}
      />
    </section>
  );
}
