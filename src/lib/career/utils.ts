import type { CareerRecord } from "./model";
export function deduplicate(records: CareerRecord[], limit = 12) {
  return [
    ...new Map(records.map((record) => [record.id, record])).values(),
  ].slice(0, limit);
}
