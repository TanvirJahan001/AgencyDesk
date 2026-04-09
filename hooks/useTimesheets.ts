/**
 * hooks/useTimesheets.ts — Client hook for timesheet operations
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Timesheet, TimesheetPeriodType } from "@/types";

export function useTimesheets() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimesheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/timesheets");
      if (!res.ok && res.status !== 200) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setTimesheets(data.data);
      } else {
        setError(data.error || "Failed to fetch timesheets.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  const generate = useCallback(
    async (periodType: TimesheetPeriodType, periodLabel: string) => {
      setError(null);
      try {
        const res = await fetch("/api/timesheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodType, periodLabel }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        await fetchTimesheets();
        return data.data as Timesheet;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to generate.";
        setError(msg);
        return null;
      }
    },
    [fetchTimesheets]
  );

  const generateFromDate = useCallback(
    async (periodType: TimesheetPeriodType, date: string) => {
      setError(null);
      try {
        const res = await fetch("/api/timesheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodType, date }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          // Try to extract JSON error message, fall back to raw text
          try {
            const json = JSON.parse(text);
            throw new Error(json.error || `HTTP ${res.status}`);
          } catch {
            throw new Error(text || `HTTP ${res.status}`);
          }
        }
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        await fetchTimesheets();
        return data.data as Timesheet;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to generate.";
        setError(msg);
        return null;
      }
    },
    [fetchTimesheets]
  );

  const submit = useCallback(
    async (timesheetId: string) => {
      setError(null);
      try {
        const res = await fetch("/api/timesheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit", timesheetId }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        await fetchTimesheets();
        return true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to submit.";
        setError(msg);
        return false;
      }
    },
    [fetchTimesheets]
  );

  return {
    timesheets,
    loading,
    error,
    refresh: fetchTimesheets,
    generate,
    generateFromDate,
    submit,
  };
}
