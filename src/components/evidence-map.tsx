"use client";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { CareerRecord } from "@/lib/career/model";
import { evidenceEdges } from "@/lib/career/evidence-graph";
import {
  containPoint,
  mapPoint,
  type MapSize,
} from "@/lib/career/evidence-layout";

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
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [size, setSize] = useState<MapSize>({ width: 280, height: 600 });
  const [page, setPage] = useState(0);
  const canvas = useRef<HTMLDivElement>(null);
  const edges = useMemo(() => evidenceEdges(records), [records]);
  const active = hovered || selected;
  const capacity = Math.max(
    2,
    Math.min(
      12,
      Math.floor((size.height - 100) / 75) * (size.width < 220 ? 1 : 2),
    ),
  );
  const pages = Math.max(1, Math.ceil(records.length / capacity));
  const currentPage = Math.min(page, pages - 1);
  const visible = records.slice(
    currentPage * capacity,
    (currentPage + 1) * capacity,
  );
  const points = visible.map((record, i) => {
    const floating = active !== record.id && dragging !== record.id;
    return {
      record,
      ...mapPoint(
        i,
        visible.length,
        size,
        floating ? time : 0,
        busy && floating,
        positions[record.id],
      ),
    };
  });
  const searching = Array.from({ length: 8 }, (_, i) =>
    mapPoint(i, 8, size, time, true),
  );
  const byId = new Map(points.map((point) => [point.record.id, point]));
  const visibleEdges = edges.filter(
    (edge) => byId.has(edge.source) && byId.has(edge.target),
  );
  const detail = records.find((record) => record.id === selected);
  const connected = new Set(
    edges.flatMap((edge) =>
      edge.source === active
        ? [edge.target]
        : edge.target === active
          ? [edge.source]
          : [],
    ),
  );

  useEffect(() => {
    const element = canvas.current;
    if (!element || collapsed) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [collapsed]);

  useEffect(() => {
    if (collapsed || (!records.length && !busy)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = 0;
    const animate = (now: number) => {
      if (now - last >= 40) {
        setTime(now);
        last = now;
      }
      frame = requestAnimationFrame(animate);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      if (!preference.matches) frame = requestAnimationFrame(animate);
    };
    update();
    preference.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", update);
    };
  }, [collapsed, records.length, busy]);

  function selectRecord(id: string) {
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return;
    setPage(Math.floor(index / capacity));
    setSelected(id);
    setHovered(null);
  }

  function drag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
    setPositions((previous) => ({
      ...previous,
      [id]: containPoint(
        {
          x: ((event.clientX - bounds.left) / bounds.width) * 100,
          y: ((event.clientY - bounds.top) / bounds.height) * 100,
        },
        size,
      ),
    }));
  }

  return (
    <aside
      className={`evidence-rail${collapsed ? " is-collapsed" : ""}${busy ? " is-working" : ""}`}
      aria-label="Connected evidence"
    >
      <div className="rail-heading evidence-heading">
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
        {busy && (
          <span
            className="map-indicator working"
            role="status"
            aria-label="Finding evidence"
          />
        )}
      </div>
      <div id="evidence-panel-content" hidden={collapsed}>
        <div ref={canvas} className="evidence-canvas" aria-busy={busy}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {visibleEdges.map((edge, index) => {
              const source = byId.get(edge.source)!;
              const target = byId.get(edge.target)!;
              const highlighted =
                edge.source === active || edge.target === active;
              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={
                    highlighted ? "is-active" : active ? "is-dimmed" : undefined
                  }
                  vectorEffect="non-scaling-stroke"
                  style={{ animationDelay: `${index * -0.2}s` }}
                />
              );
            })}
          </svg>
          {busy && (
            <div className="processing-cloud" aria-hidden="true">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                {searching.map((point, i) => {
                  const next = searching[(i + 3) % searching.length];
                  return (
                    <line
                      key={i}
                      x1={point.x}
                      y1={point.y}
                      x2={next.x}
                      y2={next.y}
                      vectorEffect="non-scaling-stroke"
                      style={{ animationDelay: `${i * -0.3}s` }}
                    />
                  );
                })}
              </svg>
              {searching.map((point, i) => (
                <span
                  key={i}
                  className="processing-dot"
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    animationDelay: `${i * -0.4}s`,
                  }}
                />
              ))}
            </div>
          )}
          {points.map(({ record, x, y }) => (
            <button
              type="button"
              className={`evidence-node${active && active !== record.id && !connected.has(record.id) ? " is-dimmed" : ""}${connected.has(record.id) ? " is-connected" : ""}`}
              key={record.id}
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-label={record.title}
              aria-pressed={selected === record.id}
              title={`${record.title} · Drag to arrange, select to read`}
              onClick={() => selectRecord(record.id)}
              onPointerEnter={() => setHovered(record.id)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(record.id)}
              onBlur={() => setHovered(null)}
              onPointerDown={(event) => {
                setDragging(record.id);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => drag(event, record.id)}
              onPointerUp={(event) =>
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              onLostPointerCapture={() => setDragging(null)}
            >
              <span className="node-orb" aria-hidden="true" />
              <span className="node-label">{record.title}</span>
            </button>
          ))}
          {!points.length && !busy && (
            <div className="map-empty">
              <span aria-hidden="true">✧</span>
              <p>Your first question starts the map.</p>
            </div>
          )}
        </div>
        {pages > 1 && (
          <nav className="map-pagination" aria-label="Evidence map pages">
            <button
              type="button"
              aria-label="Previous evidence records"
              disabled={currentPage === 0}
              onClick={() => {
                setPage(currentPage - 1);
                setHovered(null);
                setSelected(null);
              }}
            >
              ‹
            </button>
            <span>
              {currentPage * capacity + 1}–
              {Math.min((currentPage + 1) * capacity, records.length)} /{" "}
              {records.length}
            </span>
            <button
              type="button"
              aria-label="Next evidence records"
              disabled={currentPage === pages - 1}
              onClick={() => {
                setPage(currentPage + 1);
                setHovered(null);
                setSelected(null);
              }}
            >
              ›
            </button>
          </nav>
        )}
        {detail && (
          <article className="node-detail" aria-label={detail.title}>
            <button
              className="node-detail-close"
              aria-label="Close source record"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <h4>{detail.title}</h4>
            <p>{detail.subtitle}</p>
            <p>{detail.summary}</p>
            <div className="tags">
              {detail.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
            <div className="node-connections">
              {edges.flatMap((edge) => {
                const id =
                  edge.source === detail.id
                    ? edge.target
                    : edge.target === detail.id
                      ? edge.source
                      : null;
                const other = id
                  ? records.find((record) => record.id === id)
                  : null;
                return other ? (
                  <button
                    key={other.id}
                    title={edge.label}
                    onClick={() => selectRecord(other.id)}
                  >
                    ↗ {other.title}
                  </button>
                ) : (
                  []
                );
              })}
            </div>
          </article>
        )}
      </div>
    </aside>
  );
}
