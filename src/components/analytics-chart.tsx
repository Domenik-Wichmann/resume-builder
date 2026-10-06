export function AnalyticsChart({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const maximum = Math.max(1, ...rows.map((r) => r.count));
  return (
    <figure className="analytics-chart">
      <figcaption>{title}</figcaption>
      {rows.length ? (
        <ol>
          {rows.map((row) => (
            <li key={row.label}>
              <span className="analytics-label">{row.label}</span>
              <span className="analytics-bar-track" aria-hidden="true">
                <span style={{ width: (row.count / maximum) * 100 + "%" }} />
              </span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No activity recorded in this period.</p>
      )}
    </figure>
  );
}

export function AnalyticsTrend({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  const points = rows.map((row, index) => ({
    x: 40 + (rows.length > 1 ? index / (rows.length - 1) : 0.5) * 520,
    y: 180 - (row.count / maximum) * 150,
  }));
  const line = points.map((point) => point.x + "," + point.y).join(" ");
  return (
    <figure className="analytics-chart">
      <figcaption>{title}</figcaption>
      {!rows.some((row) => row.count > 0) ? (
        <p className="muted">No activity recorded in this period.</p>
      ) : (
        <>
          <svg
            className="analytics-trend"
            viewBox="0 0 600 220"
            role="img"
            aria-label={
              title + "; daily values are available in the table below."
            }
          >
            <line
              x1="40"
              y1="30"
              x2="560"
              y2="30"
              stroke="var(--line)"
              strokeDasharray="4 4"
            />
            <line x1="40" y1="180" x2="560" y2="180" stroke="var(--line)" />
            <text x="30" y="35" textAnchor="end">
              {maximum}
            </text>
            <text x="30" y="185" textAnchor="end">
              0
            </text>
            <polygon
              points={"40,180 " + line + " 560,180"}
              fill="var(--accent)"
              opacity="0.15"
            />
            <polyline
              points={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
            />
            <text x="40" y="208">
              {rows[0]?.label}
            </text>
            <text x="560" y="208" textAnchor="end">
              {rows[rows.length - 1]?.label}
            </text>
          </svg>
          <details>
            <summary>Daily values</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </figure>
  );
}
