/**
 * app/(dashboard)/ceo/clients/CEOClientsClient.tsx
 *
 * Read-only client list for CEO.
 * Same table and filters as admin, but no add/edit/delete actions.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, ClientStatus } from "@/types";
import { CLIENT_STATUSES } from "@/types";

const STATUS_COLORS: Record<ClientStatus, string> = {
  lead:    "bg-gray-100 text-gray-800",
  active:  "bg-green-100 text-green-800",
  paused:  "bg-yellow-100 text-yellow-800",
  churned: "bg-red-100 text-red-800",
};

export default function CEOClientsClient() {
  const [clients, setClients]         = useState<Client[]>([]);
  const [loading, setLoading]         = useState(true);
  const [query, setQuery]             = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">("all");

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/clients");
      const json = await res.json();
      if (json.success) setClients(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filtered = clients.filter((c) => {
    const q = query.toLowerCase();
    const matchesQuery =
      c.companyName.toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(q) ||
      c.contactEmail.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-900">Clients</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ClientStatus | "all")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">All Statuses</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search company, contact, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Stats */}
      <p className="text-xs text-slate-500">
        {filtered.length} of {clients.length} client{clients.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">
          {query ? "No clients match your search." : "No clients found."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Company Name", "Contact", "Email", "Status", "Billing Type", "Monthly Retainer"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                        {client.companyName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900">{client.companyName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{client.contactName}</td>
                  <td className="px-4 py-3 text-slate-500">{client.contactEmail}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[client.status])}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{client.billingType}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {client.monthlyRetainer != null
                      ? `$${client.monthlyRetainer.toLocaleString()}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
