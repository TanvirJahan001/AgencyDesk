"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/app/api/calendar/route";

interface CalendarViewProps {
  role: string;
}

export default function CalendarView({ role }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPopover, setShowPopover] = useState(false);

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Get the first and last day of the current month for API call.
   * For display purposes, we pad the calendar grid with prev/next month days.
   */
  function getMonthRange(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const from = firstDay.toISOString().slice(0, 10);
    const to = lastDay.toISOString().slice(0, 10);

    return { from, to, firstDay, lastDay };
  }

  /**
   * Get an array of Date objects for the calendar grid.
   * Includes padding from previous month and next month.
   */
  function getCalendarDays(date: Date): Date[] {
    const { firstDay, lastDay } = getMonthRange(date);

    // Get the day of week for the first day (0 = Sunday)
    const startDayOfWeek = firstDay.getDay();

    // Pad with days from previous month
    const days: Date[] = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i - 1);
      days.push(d);
    }

    // Add all days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(date.getFullYear(), date.getMonth(), i));
    }

    // Pad with days from next month
    const remaining = 42 - days.length; // 6 rows × 7 days
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(lastDay);
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    return days;
  }

  /**
   * Format a Date to YYYY-MM-DD string.
   */
  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Get events for a specific date.
   */
  function getEventsForDate(dateStr: string): CalendarEvent[] {
    return events.filter((e) => {
      // Single-day events
      if (!e.endDate) return e.date === dateStr;
      // Multi-day events (leaves)
      return dateStr >= e.date && dateStr <= e.endDate;
    });
  }

  /**
   * Get color class for event type.
   */
  function getEventColorClass(color: string): string {
    const colorMap: Record<string, string> = {
      "#dc2626": "bg-red-500",       // holiday
      "#ea580c": "bg-orange-500",    // leave
      "#16a34a": "bg-green-500",     // attendance
      "#f97316": "bg-orange-400",    // missed checkout
      "#3b82f6": "bg-blue-500",      // deadline
    };
    return colorMap[color] || "bg-gray-500";
  }

  // ─── Effects ────────────────────────────────────────────────

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      setError(null);

      try {
        const { from, to } = getMonthRange(currentDate);
        const params = new URLSearchParams({ from, to });
        const response = await fetch(`/api/calendar?${params}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch calendar events");
        }

        const data = await response.json();
        setEvents(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [currentDate]);

  // ─── Handlers ───────────────────────────────────────────────

  function handlePrevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  }

  function handleNextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  }

  function handleDayClick(dateStr: string) {
    setSelectedDate(dateStr);
    setShowPopover(true);
  }

  function handleClosePopover() {
    setShowPopover(false);
  }

  // ─── Render ─────────────────────────────────────────────────

  const monthName = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = getCalendarDays(currentDate);
  const today = formatDate(new Date());
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysInCalendar = calendarDays;

  const selectedDateEvents =
    selectedDate && showPopover ? getEventsForDate(selectedDate) : [];

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
        <button
          onClick={handlePrevMonth}
          className="rounded-lg p-2 hover:bg-gray-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold">{monthName}</h2>

        <button
          onClick={handleNextMonth}
          className="rounded-lg p-2 hover:bg-gray-100"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="rounded-lg bg-white shadow-sm">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-px border-b border-gray-200">
          {dayNames.map((dayName) => (
            <div
              key={dayName}
              className="bg-gray-50 px-4 py-3 text-center text-xs font-semibold text-gray-700"
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {daysInCalendar.map((day, idx) => {
            const dateStr = formatDate(day);
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = dateStr === today;
            const dayEvents = getEventsForDate(dateStr);

            return (
              <div
                key={idx}
                className={`relative min-h-24 border border-gray-200 p-2 ${
                  !isCurrentMonth ? "bg-gray-50" : "bg-white"
                }`}
              >
                {/* Day Number */}
                <div
                  className={`text-sm font-semibold ${
                    isToday
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white"
                      : isCurrentMonth
                        ? "text-gray-900"
                        : "text-gray-400"
                  }`}
                >
                  {day.getDate()}
                </div>

                {/* Event Dots */}
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      onClick={() => handleDayClick(dateStr)}
                      className={`truncate rounded px-2 py-1 text-xs font-medium text-white cursor-pointer hover:opacity-80 transition-opacity ${getEventColorClass(
                        event.color
                      )}`}
                      title={event.title}
                    >
                      {event.title.length > 20
                        ? event.title.substring(0, 17) + "…"
                        : event.title}
                    </div>
                  ))}

                  {dayEvents.length > 2 && (
                    <div
                      onClick={() => handleDayClick(dateStr)}
                      className="text-xs text-gray-500 cursor-pointer hover:text-gray-700"
                    >
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>

                {/* Click to view */}
                {dayEvents.length > 0 && (
                  <button
                    onClick={() => handleDayClick(dateStr)}
                    className="absolute inset-0 opacity-0 hover:opacity-5 bg-blue-500 cursor-pointer"
                    aria-label={`View events for ${dateStr}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Popover for selected day */}
      {showPopover && selectedDate && selectedDateEvents.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-96 rounded-lg bg-white shadow-lg">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {new Date(selectedDate).toLocaleDateString("default", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                <button
                  onClick={handleClosePopover}
                  className="rounded-lg p-1 hover:bg-gray-100"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Events List */}
            <div className="max-h-96 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`rounded-lg border-l-4 p-3 ${
                      event.color === "#dc2626"
                        ? "border-red-500 bg-red-50"
                        : event.color === "#ea580c"
                          ? "border-orange-500 bg-orange-50"
                          : event.color === "#16a34a"
                            ? "border-green-500 bg-green-50"
                            : "border-gray-300 bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-gray-900">
                      {event.title}
                    </div>
                    {event.endDate && event.endDate !== event.date && (
                      <div className="mt-1 text-sm text-gray-600">
                        {event.date} to {event.endDate}
                      </div>
                    )}
                    {event.type && (
                      <div className="mt-1 inline-block rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                        {event.type === "holiday"
                          ? "Holiday"
                          : event.type === "leave"
                            ? "Leave"
                            : event.type === "attendance"
                              ? "Attendance"
                              : "Event"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-3 text-right">
              <button
                onClick={handleClosePopover}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-brand-600" />
        </div>
      )}

      {/* Legend */}
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Event Legend</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm text-gray-700">Holiday</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span className="text-sm text-gray-700">Leave Request</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-sm text-gray-700">Attendance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-400" />
            <span className="text-sm text-gray-700">Missed Checkout</span>
          </div>
        </div>
      </div>
    </div>
  );
}
