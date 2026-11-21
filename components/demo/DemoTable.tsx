"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export interface DemoTableRow {
  id: string;
  cells: string[];
}

interface DemoTableProps {
  title: string;
  columns: string[];
  rows: DemoTableRow[];
}

const STATUS_STYLES: Record<string, string> = {
  Active: "badge-green", Approved: "badge-green", Paid: "badge-green", Working: "badge-green",
  Completed: "badge-blue", Done: "badge-blue", Issued: "badge-blue", Submitted: "badge-blue",
  "In Progress": "badge-blue", Pending: "badge-yellow", "On Break": "badge-yellow", Review: "badge-yellow",
  "Missed Checkout": "badge-red", Rejected: "badge-red", Cancelled: "badge-red",
};

export default function DemoTable({ title, columns, rows }: DemoTableProps) {
  const [search, setSearch] = useState("");
  const searchTerm = search.trim().toLowerCase();
  const visibleRows = searchTerm ? rows.filter(({ cells }) => cells.some((cell) => cell.toLowerCase().includes(searchTerm))) : rows;

  return (
    <section className="card p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {rows.length > 5 && (
          <label className="relative w-full sm:w-60">
            <span className="sr-only">Filter {title.toLowerCase()}</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              className="input pl-9"
              type="search"
              placeholder="Filter records"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="border-y border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>{columns.map((column) => <th key={column} scope="col" className="whitespace-nowrap px-4 py-3">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {visibleRows.map(({ id, cells }) => (
              <tr key={id}>
                {cells.map((cell, index) => (
                  <td key={columns[index]} className={`whitespace-nowrap px-4 py-3 ${index === 0 ? "font-medium text-slate-900" : ""}`}>
                    {columns[index] === "Status" ? <span className={STATUS_STYLES[cell] ?? "badge-gray"}>{cell}</span> : cell}
                  </td>
                ))}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center">{searchTerm ? "No matching records." : "No demo records yet."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
