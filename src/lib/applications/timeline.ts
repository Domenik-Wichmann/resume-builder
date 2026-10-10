import "server-only";
import { usable, type StateClaim } from "../career-brain/state";

const months =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const reportedStart = new RegExp(
  `(?:(${months})\\s+((?:19|20)\\d{2})\\s+start month|start month\\s+(${months})\\s+((?:19|20)\\d{2}))`,
  "i",
);

export function reportedTimeline(claims: StateClaim[]) {
  const starts = new Set<string>();
  for (const claim of claims.filter(usable)) {
    if (
      claim.attribution !== "PERSONAL" ||
      !/reports?|reported/i.test(claim.value)
    )
      continue;
    const match = claim.value.match(reportedStart);
    if (match) {
      const month = (match[1] || match[3]).slice(0, 3);
      starts.add(
        `${month[0].toUpperCase()}${month.slice(1).toLowerCase()} ${match[2] || match[4]}`,
      );
    }
  }
  // A reported month is not an exact date or proof of current employment.
  // Ambiguous starts stay absent; canonical date fields remain unchanged.
  if (starts.size === 1)
    return `Reported start: ${[...starts][0]} · end date unconfirmed`;
  return undefined;
}

export function timelineSortKey(record: {
  dates: { start: string | null; end: string | null };
  timeline_note?: string;
}) {
  if (record.dates.end || record.dates.start)
    return record.dates.end || record.dates.start || "";
  const reported = record.timeline_note?.match(
    /^Reported start: ([A-Za-z]{3}) (\d{4})/,
  );
  if (!reported) return "";
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].indexOf(reported[1]);
  // This month key is used only for ordering, never stored as an exact date.
  return month < 0
    ? ""
    : `${reported[2]}-${String(month + 1).padStart(2, "0")}`;
}
