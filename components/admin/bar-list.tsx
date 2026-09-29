"use client";

/** Horizontal bar list: one row per key, sorted by count, bar relative to the max. */
export const BarList = ({
  data,
  label = (k) => k,
  empty = "No data yet",
}: {
  data: Record<string, number>;
  label?: (key: string) => string;
  empty?: string;
}) => {
  const rows = Object.entries(data)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = rows[0][1];
  return (
    <ul className="flex flex-col gap-2">
      {rows.map(([key, n]) => (
        <li key={key} className="flex flex-col gap-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{label(key)}</span>
            <span className="tabular-nums text-muted-foreground">{n}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${Math.max(4, (n / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};
