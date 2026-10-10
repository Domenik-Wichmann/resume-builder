"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type CSSProperties,
} from "react";
import type { CareerRecord } from "@/lib/career/model";
import {
  graphPointer,
  initialGraphView,
  zoomGraph,
  type GraphView,
} from "@/lib/career/evidence-viewport";
import { evidenceEdges } from "@/lib/career/evidence-graph";
import {
  catalogSchema,
  catalogCategories,
  catalogRecords,
} from "@/lib/career/catalog";
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
  expanded = false,
  onExpand,
}: {
  records: CareerRecord[];
  busy: boolean;
  collapsed: boolean;
  onToggle: () => void;
  expanded?: boolean;
  onExpand?: () => void;
}) {
  const [view, setView] = useState<GraphView>(initialGraphView);
  const [mobile, setMobile] = useState(false);
  const preview = mobile && !expanded;
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const camera = useRef(initialGraphView);
  const pan = useRef<{ x: number; y: number; view: GraphView } | null>(null);
  function changeView(next: GraphView) {
    camera.current = next;
    setView(next);
  }
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [size, setSize] = useState<MapSize>({ width: 280, height: 600 });
  const [skillIds, setSkillIds] = useState<ReadonlySet<string>>(new Set());
  const grab = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [connectionRecords, setConnectionRecords] = useState<CareerRecord[]>(
    [],
  );
  const canvas = useRef<HTMLDivElement>(null);
  // Every retrieved record stays on the graph, including while an answer loads.
  const pool = records;
  const visible = preview ? records.slice(0, 6) : records;
  const edges = useMemo(() => {
    const metadata = new Map(
      connectionRecords.map((record) => [record.id, record]),
    );
    const linked = records.map((record) => {
      const current = metadata.get(record.id);
      return {
        ...record,
        skills: [...new Set([...record.skills, ...(current?.skills || [])])],
        related_ids: [
          ...new Set([
            ...(record.related_ids || []),
            ...(current?.related_ids || []),
          ]),
        ],
      };
    });
    return evidenceEdges(linked, skillIds);
  }, [records, connectionRecords, skillIds]);
  const active = dragging || selected || hovered;
  const compact = visible.length > 12;
  const layoutSize = expanded
    ? { width: size.width / 1.5, height: size.height / 1.5 }
    : size;
  const points = visible.map((record, i) => {
    const floating = active !== record.id && dragging !== record.id;
    return {
      record,
      ...mapPoint(
        i,
        visible.length,
        layoutSize,
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
  const detail = pool.find((record) => record.id === selected);
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
    if (collapsed) return;
    const controller = new AbortController();
    // Published metadata only restores connections between existing workspace
    // nodes. Catalog records never become additional displayed evidence.
    fetch("/api/career-catalog", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = catalogSchema.parse(await response.json());
        if (!controller.signal.aborted) {
          setSkillIds(
            new Set(data.career.skill_records.map((record) => record.id)),
          );
          setConnectionRecords(
            catalogCategories.flatMap(([key]) => catalogRecords(data, key)),
          );
        }
      })
      .catch(() => {
        /* Keep the workspace evidence if browsing is unavailable. */
      });
    return () => controller.abort();
  }, [busy, collapsed]);

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
    const element = canvas.current;
    if (!element || collapsed || !expanded) return;
    const zoom = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? bounds.height
            : 1);
      changeView(
        zoomGraph(
          camera.current,
          delta,
          event.clientX - bounds.left,
          event.clientY - bounds.top,
        ),
      );
    };
    element.addEventListener("wheel", zoom, { passive: false });
    return () => element.removeEventListener("wheel", zoom);
  }, [collapsed, expanded]);

  useEffect(() => {
    if (!expanded || !onExpand) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        changeView(initialGraphView);
        onExpand();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded, onExpand]);

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
    if (!pool.some((record) => record.id === id)) return;
    setSelected(id);
    setHovered(null);
  }

  function drag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = canvas.current!.getBoundingClientRect();
    const offset = grab.current;
    if (!offset) return;
    const pointer = graphPointer(
      camera.current,
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );
    if (
      Math.hypot(event.clientX - offset.startX, event.clientY - offset.startY) >
      3
    )
      offset.moved = true;
    setPositions((previous) => ({
      ...previous,
      [id]: containPoint(
        {
          x: (pointer.x / bounds.width) * 100 - offset.x,
          y: (pointer.y / bounds.height) * 100 - offset.y,
        },
        layoutSize,
        compact,
      ),
    }));
  }

  return (
    <aside
      className={`evidence-rail${preview ? " is-preview" : ""}${collapsed ? " is-collapsed" : ""}${expanded ? " is-expanded" : ""}${busy ? " is-working" : ""}`}
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
        {!collapsed && onExpand && (
          <button
            type="button"
            className="rail-toggle graph-expand"
            aria-label={expanded ? "Restore graph size" : "Expand graph"}
            title={expanded ? "Restore graph size" : "Expand graph"}
            aria-pressed={expanded}
            onClick={() => {
              changeView(initialGraphView);
              onExpand();
            }}
          >
            {expanded ? "Close graph" : "Expand graph"}
          </button>
        )}
        {view.scale !== 1 && !collapsed && (
          <button
            type="button"
            className="graph-reset"
            aria-label="Reset graph zoom"
            onClick={() => changeView(initialGraphView)}
          >
            {Math.round(view.scale * 100)}%
          </button>
        )}
        {busy && (
          <span
            className="map-indicator working"
            role="status"
            aria-label="Finding evidence"
          />
        )}
      </div>
      <div id="evidence-panel-content" hidden={collapsed}>
        {preview && (
          <p className="graph-preview-caption">
            {busy
              ? "Searching connected evidence…"
              : `${records.length} source records · showing up to 6`}
            <br />
            Tap a node or expand to explore.
          </p>
        )}
        <div
          ref={canvas}
          className={`evidence-canvas${compact ? " is-compact" : ""}`}
          aria-busy={busy}
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (
              !expanded ||
              event.button !== 0 ||
              (event.target as Element).closest("button")
            )
              return;
            event.preventDefault();
            window.getSelection()?.removeAllRanges();
            pan.current = {
              x: event.clientX,
              y: event.clientY,
              view: camera.current,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (
              !pan.current ||
              !event.currentTarget.hasPointerCapture(event.pointerId)
            )
              return;
            changeView({
              ...pan.current.view,
              x: pan.current.view.x + event.clientX - pan.current.x,
              y: pan.current.view.y + event.clientY - pan.current.y,
            });
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onLostPointerCapture={() => {
            pan.current = null;
          }}
        >
          <div
            className="evidence-viewport"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          >
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
                    data-source={edge.source}
                    data-target={edge.target}
                    key={`${edge.source}-${edge.target}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    className={
                      highlighted
                        ? "is-active"
                        : active
                          ? "is-dimmed"
                          : undefined
                    }
                    vectorEffect="non-scaling-stroke"
                    style={{ animationDelay: `${index * -0.2}s` }}
                  />
                );
              })}
            </svg>
            {busy && !points.length && (
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
                className={`evidence-node${active === record.id ? " is-active" : ""}${connected.has(record.id) ? " is-connected" : ""}`}
                key={record.id}
                style={
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    "--label-space": `${(1 - y / 100) * size.height}px`,
                  } as CSSProperties
                }
                data-record-id={record.id}
                aria-label={record.title}
                aria-pressed={selected === record.id}
                title={`${record.title} · Drag to arrange, select to read`}
                onClick={(event) => {
                  if (event.detail === 0 || !grab.current?.moved) {
                    if (preview && onExpand) onExpand();
                    else selectRecord(record.id);
                  }
                }}
                onPointerEnter={() => setHovered(record.id)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(record.id)}
                onBlur={() => setHovered(null)}
                onPointerDown={(event) => {
                  if (!expanded || event.button !== 0) return;
                  // Native text dragging competes with pointer capture and can
                  // interrupt a node drag when it starts on the full label.
                  event.preventDefault();
                  event.stopPropagation();
                  window.getSelection()?.removeAllRanges();
                  event.currentTarget.focus({ preventScroll: true });
                  const bounds = canvas.current!.getBoundingClientRect();
                  const pointer = graphPointer(
                    camera.current,
                    event.clientX - bounds.left,
                    event.clientY - bounds.top,
                  );
                  grab.current = {
                    x: (pointer.x / bounds.width) * 100 - x,
                    y: (pointer.y / bounds.height) * 100 - y,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                  };
                  setPositions((previous) => ({
                    ...previous,
                    [record.id]: { x, y },
                  }));
                  setDragging(record.id);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => drag(event, record.id)}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onLostPointerCapture={() => {
                  setDragging(null);
                }}
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
        </div>
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
                  ? pool.find((record) => record.id === id)
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
