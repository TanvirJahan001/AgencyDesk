/**
 * app/api/attendance/route.ts
 *
 * This V1 action-based endpoint has been replaced by dedicated V2 routes:
 *
 *   POST /api/attendance/start   — Start work
 *   POST /api/attendance/pause   — Pause (start break)
 *   POST /api/attendance/resume  — Resume work
 *   POST /api/attendance/end     — End work
 *   GET  /api/attendance/current — Live session + open segment
 *   GET  /api/attendance/history — Session history with date-range filter
 *
 * Returns 410 Gone so any stale clients get a clear signal to update.
 */

import { NextResponse } from "next/server";

const GONE = {
  success: false,
  error:
    "This endpoint has been replaced. Use /api/attendance/start, /pause, /resume, /end, /current, or /history.",
};

export function GET()  { return NextResponse.json(GONE, { status: 410 }); }
export function POST() { return NextResponse.json(GONE, { status: 410 }); }
