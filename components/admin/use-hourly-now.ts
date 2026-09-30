"use client";

import { useEffect, useState } from "react";

const HOUR_MS = 60 * 60 * 1000;

const currentHour = () => Math.floor(Date.now() / HOUR_MS) * HOUR_MS;

/**
 * The current time rounded down to the hour, re-rendering when the hour
 * changes. Passed as `now` to staff queries so SLA fields ("overdue", age)
 * keep moving while Convex still caches results within the hour.
 */
export const useHourlyNow = (): number => {
  const [now, setNow] = useState(currentHour);
  useEffect(() => {
    const id = setInterval(() => {
      const hour = currentHour();
      setNow((prev) => (prev === hour ? prev : hour));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return now;
};
