"use client";

import Link from "next/link";
import { Clock, DollarSign, ArrowRight, Building2, Calendar } from "lucide-react";

export default function AdminSettingsPage() {
  const settings = [
    {
      title: "Company & Branding",
      description: "Configure company information, logo, business hours, and financial settings",
      icon: Building2,
      href: "/admin/settings/company",
      color: "bg-purple-50 text-purple-600",
    },
    {
      title: "Shifts & Schedules",
      description: "Manage shift templates and assign employee work schedules",
      icon: Calendar,
      href: "/admin/settings/shifts",
      color: "bg-orange-50 text-orange-600",
    },
    {
      title: "Overtime Policies",
      description: "Configure overtime thresholds and pay multipliers for different policy types",
      icon: Clock,
      href: "/admin/settings/overtime",
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Tax & Deductions",
      description: "Manage tax brackets and deduction templates for payroll calculations",
      icon: DollarSign,
      href: "/admin/settings/tax",
      color: "bg-green-50 text-green-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-2">Configure system settings for payroll and HR</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {settings.map((setting) => {
          const Icon = setting.icon;
          return (
            <Link
              key={setting.href}
              href={setting.href}
              className="group rounded-lg border border-slate-200 bg-white p-6 hover:shadow-lg transition-all hover:border-slate-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`rounded-lg p-3 ${setting.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
              </div>

              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {setting.title}
              </h3>
              <p className="text-sm text-slate-600">
                {setting.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
