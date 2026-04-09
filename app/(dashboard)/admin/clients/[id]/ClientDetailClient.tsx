/**
 * app/(dashboard)/admin/clients/[id]/ClientDetailClient.tsx
 *
 * Client detail page showing:
 *  - Client info card
 *  - Projects section with list of projects for this client
 *  - Links to project detail pages
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  ArrowLeft,
  Plus,
  Calendar,
  DollarSign,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, Project, ProjectStatus } from "@/types";
import { PROJECT_STATUSES } from "@/types";

const PROJECT_STATUS_MAP: Record<ProjectStatus, string> = {
  lead:      "bg-gray-100 text-gray-800",
  proposal:  "bg-blue-100 text-blue-800",
  active:    "bg-green-100 text-green-800",
  on_hold:   "bg-yellow-100 text-yellow-800",
  completed: "bg-purple-100 text-purple-800",
  archived:  "bg-red-100 text-red-800",
};

export default function ClientDetailClient({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [client, setClient]         = useState<Client | null>(null);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Fetch client details
  useEffect(() => {
    async function fetchClient() {
      setLoadingClient(true);
      try {
        const res  = await fetch(`/api/clients/${clientId}`);
        const json = await res.json();
        if (json.success) {
          setClient(json.data);
        } else {
          setError(json.error ?? "Failed to load client.");
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoadingClient(false);
      }
    }

    fetchClient();
  }, [clientId]);

  // Fetch projects for this client
  useEffect(() => {
    async function fetchProjects() {
      setLoadingProjects(true);
      try {
        const res  = await fetch(`/api/projects?clientId=${clientId}`);
        const json = await res.json();
        if (json.success) {
          setProjects(json.data);
        }
      } catch {
        // silent
      } finally {
        setLoadingProjects(false);
      }
    }

    if (client) {
      fetchProjects();
    }
  }, [client, clientId]);

  if (loadingClient) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!client) {
    return (
      <div className="rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        Client not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Client Info Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
                <Building2 className="h-6 w-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{client.companyName}</h1>
                <p className="text-sm text-slate-500">{client.industry || "No industry specified"}</p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="mt-4">
              <span className={cn(
                "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                client.status === "lead"    ? "bg-gray-100 text-gray-800" :
                client.status === "active"  ? "bg-green-100 text-green-800" :
                client.status === "paused"  ? "bg-yellow-100 text-yellow-800" :
                client.status === "churned" ? "bg-red-100 text-red-800" :
                "bg-slate-100 text-slate-800"
              )}>
                {client.status}
              </span>
            </div>
          </div>

          {/* Billing Info */}
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium text-slate-600 uppercase mb-2">Billing</p>
            <p className="text-sm font-semibold text-slate-900">{client.billingType}</p>
            {client.monthlyRetainer != null && (
              <p className="text-sm text-slate-600 mt-1">
                <DollarSign className="h-3 w-3 inline mr-1" />
                ${client.monthlyRetainer.toLocaleString()}/mo
              </p>
            )}
          </div>
        </div>

        {/* Contact Details */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-600">Contact Email</p>
              <a href={`mailto:${client.contactEmail}`} className="text-sm text-brand-600 hover:text-brand-700">
                {client.contactEmail}
              </a>
            </div>
          </div>

          {client.contactPhone && (
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-600">Phone</p>
                <a href={`tel:${client.contactPhone}`} className="text-sm text-brand-600 hover:text-brand-700">
                  {client.contactPhone}
                </a>
              </div>
            </div>
          )}

          {client.website && (
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-600">Website</p>
                <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:text-brand-700">
                  {client.website}
                </a>
              </div>
            </div>
          )}

          {client.address && (
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-600">Address</p>
                <p className="text-sm text-slate-600">{client.address}</p>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Notes</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}

        {/* Contact Name */}
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-xs font-medium text-slate-600">Primary Contact</p>
          <p className="text-sm text-slate-900 mt-1">{client.contactName}</p>
        </div>
      </div>

      {/* Projects Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
          <Link
            href={`/admin/projects/new?clientId=${client.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add Project
          </Link>
        </div>

        {loadingProjects ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
            No projects yet. <Link href={`/admin/projects/new?clientId=${client.id}`} className="text-brand-600 hover:text-brand-700">Add one</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const statusColor = PROJECT_STATUSES.find(s => s.value === project.status)?.color || "bg-slate-100 text-slate-700";
              return (
                <Link
                  key={project.id}
                  href={`/admin/projects/${project.id}`}
                  className="block rounded-lg border border-slate-200 p-4 hover:border-brand-300 hover:bg-brand-50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{project.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{project.serviceType}</p>
                    </div>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0", statusColor)}>
                      {project.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Budget: ${project.budget.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Due: {new Date(project.deadline).toLocaleDateString()}
                    </div>
                    <div>Team: {project.teamMembers.length} member{project.teamMembers.length !== 1 ? "s" : ""}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
