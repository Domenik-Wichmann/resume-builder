"use client";
import { useState, type PointerEvent } from "react";
import type { CareerRecord } from "@/lib/career/model";

export function EvidenceMap({
  records,
  busy,
  collapsed,
  onToggle,
}: {
  records: CareerRecord[];
  busy: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [selected, setSelected] = useState<string | null>(null);
  const visible = records.slice(0, 8);
  const points = visible.map((record, i) => ({
    record,
    ...(positions[record.id] || {
      x: 50 + 31 * Math.cos(i * 2.4),
      y: 48 + 31 * Math.sin(i * 2.4),
    }),
  }));
  const detail = records.find((record) => record.id === selected);
  function drag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
    setPositions((previous) => ({
      ...previous,
      [id]: {
        x: Math.max(
          15,
          Math.min(85, ((event.clientX - bounds.left) / bounds.width) * 100),
        ),
        y: Math.max(
          12,
          Math.min(88, ((event.clientY - bounds.top) / bounds.height) * 100),
        ),
      },
    }));
  }
  return (
    <aside
      className={`evidence-rail${collapsed ? " is-collapsed" : ""}`}
      aria-label="Retrieved evidence map"
    >
      <div className="rail-heading evidence-heading">
        <span className="eyebrow">Connected evidence</span>
        <span className={busy ? "map-indicator working" : "map-indicator"} />
        <button
          type="button"
          className="rail-toggle"
          aria-controls="evidence-panel-content"
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? "Expand connected evidence"
              : "Collapse connected evidence"
          }
          title={
            collapsed
              ? "Expand connected evidence"
              : "Collapse connected evidence"
          }
          onClick={onToggle}
        >
          {collapsed ? "‹" : "›"}
        </button>
      </div>
      <div id="evidence-panel-content" hidden={collapsed}>
        <h3>The connections behind the answer.</h3>
        <p className="rail-caption">
          Published records used in this workspace. Lines connect records with
          shared skills.
        </p>
        <div className="evidence-canvas" aria-busy={busy}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {points.flatMap((point, i) =>
              points
                .slice(i + 1)
                .filter((other) =>
                  point.record.skills.some((skill) =>
                    other.record.skills.includes(skill),
                  ),
                )
                .map((other) => (
                  <line
                    key={`${point.record.id}-${other.record.id}`}
                    x1={point.x}
                    y1={point.y}
                    x2={other.x}
                    y2={other.y}
                  />
                )),
            )}
          </svg>
          {points.map(({ record, x, y }, i) => (
            <button
              type="button"
              className="evidence-node"
              key={record.id}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                animationDelay: `${i * 70}ms`,
              }}
              aria-pressed={selected === record.id}
              onClick={() => setSelected(record.id)}
              onPointerDown={(event) =>
                event.currentTarget.setPointerCapture(event.pointerId)
              }
              onPointerMove={(event) => drag(event, record.id)}
              onPointerUp={(event) =>
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
            >
              <span className="node-orb" />
              <span>{record.title}</span>
            </button>
          ))}
          {!points.length && (
            <div className="map-empty">
              <span aria-hidden="true">✧</span>
              <p>
                {busy
                  ? "Finding relevant evidence…"
                  : "Your first question starts the map."}
              </p>
            </div>
          )}
        </div>
        <p className="rail-caption">
          Drag to arrange · Select to read
          {records.length > 8
            ? ` · Showing 8 of ${records.length} records`
            : ""}
        </p>
        {detail && (
          <article className="node-detail">
            <div className="rail-heading">
              <span className="eyebrow">Source record</span>
              <button
                aria-label="Close source record"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>
            <h4>{detail.title}</h4>
            <p>{detail.subtitle}</p>
            <p>{detail.summary}</p>
            <div className="tags">
              {detail.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </article>
        )}
        {visible.length > 0 && (
          <details className="map-record-list">
            <summary>Browse all source records</summary>
            {records.map((record) => (
              <button key={record.id} onClick={() => setSelected(record.id)}>
                {record.title}
              </button>
            ))}
          </details>
        )}
        <p className="rail-caption map-disclosure">
          This is a source map, not a view into the model’s private reasoning.
        </p>
      </div>
    </aside>
  );
}
