"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, Check, Loader2, Eye, EyeOff } from "lucide-react";
import type { CompanySettings } from "@/types";

const CURRENCIES = [
  { value: "USD", label: "US Dollar ($)", symbol: "$" },
  { value: "EUR", label: "Euro (€)", symbol: "€" },
  { value: "GBP", label: "British Pound (£)", symbol: "£" },
  { value: "BDT", label: "Bangladeshi Taka (৳)", symbol: "৳" },
  { value: "INR", label: "Indian Rupee (₹)", symbol: "₹" },
  { value: "JPY", label: "Japanese Yen (¥)", symbol: "¥" },
  { value: "AUD", label: "Australian Dollar (A$)", symbol: "A$" },
  { value: "CAD", label: "Canadian Dollar (C$)", symbol: "C$" },
  { value: "CHF", label: "Swiss Franc (CHF)", symbol: "CHF" },
  { value: "SGD", label: "Singapore Dollar (S$)", symbol: "S$" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Dhaka",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface CompanySettingsClientProps {
  initialSettings: CompanySettings;
}

export default function CompanySettingsClient({
  initialSettings,
}: CompanySettingsClientProps) {
  const [settings, setSettings] = useState<CompanySettings>(initialSettings);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogoPreview, setShowLogoPreview] = useState(!!initialSettings.logoUrl);

  useEffect(() => {
    // Auto-hide success message after 3 seconds
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleInputChange = (field: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddressChange = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value,
      },
    }));
  };

  const handleBusinessHoursChange = (field: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      businessHours: {
        start: prev.businessHours?.start ?? "09:00",
        end: prev.businessHours?.end ?? "17:00",
        workDays: prev.businessHours?.workDays ?? [1, 2, 3, 4, 5],
        [field]: value,
      },
    }));
  };

  const handleWorkDaysChange = (day: number) => {
    setSettings((prev) => {
      const currentDays = prev.businessHours?.workDays || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day].sort();
      return {
        ...prev,
        businessHours: {
          start: prev.businessHours?.start ?? "09:00",
          end: prev.businessHours?.end ?? "17:00",
          workDays: newDays,
        },
      };
    });
  };

  const handleCurrencyChange = (currencyValue: string) => {
    const currency = CURRENCIES.find((c) => c.value === currencyValue);
    if (currency) {
      handleInputChange("currency", currency.value);
      handleInputChange("currencySymbol", currency.symbol);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/settings/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setSettings(data.data);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 border border-green-200">
          <Check className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">
            Settings saved successfully
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Company Information Section */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Company Information
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Basic details about your company
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => handleInputChange("companyName", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={settings.companyEmail || ""}
              onChange={(e) =>
                handleInputChange("companyEmail", e.target.value)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={settings.companyPhone || ""}
              onChange={(e) =>
                handleInputChange("companyPhone", e.target.value)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Website
            </label>
            <input
              type="url"
              value={settings.companyWebsite || ""}
              onChange={(e) =>
                handleInputChange("companyWebsite", e.target.value)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Address</h2>
          <p className="text-sm text-slate-600 mt-1">
            Official company address
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Street Address
            </label>
            <input
              type="text"
              value={settings.address?.street || ""}
              onChange={(e) => handleAddressChange("street", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              City
            </label>
            <input
              type="text"
              value={settings.address?.city || ""}
              onChange={(e) => handleAddressChange("city", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              State / Province
            </label>
            <input
              type="text"
              value={settings.address?.state || ""}
              onChange={(e) => handleAddressChange("state", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Zip Code
            </label>
            <input
              type="text"
              value={settings.address?.zipCode || ""}
              onChange={(e) => handleAddressChange("zipCode", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Country
            </label>
            <input
              type="text"
              value={settings.address?.country || ""}
              onChange={(e) => handleAddressChange("country", e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Branding Section */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Branding</h2>
          <p className="text-sm text-slate-600 mt-1">
            Logo and brand display settings
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Logo URL
          </label>
          <input
            type="url"
            value={settings.logoUrl || ""}
            onChange={(e) => handleInputChange("logoUrl", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com/logo.png"
          />
          <p className="text-xs text-slate-500 mt-2">
            Enter the full URL to your company logo image
          </p>
        </div>

        {settings.logoUrl && (
          <div>
            <button
              type="button"
              onClick={() => setShowLogoPreview(!showLogoPreview)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {showLogoPreview ? (
                <>
                  <EyeOff className="h-4 w-4" /> Hide Preview
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" /> Show Preview
                </>
              )}
            </button>

            {showLogoPreview && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-600 mb-3">
                  Logo Preview
                </p>
                <img
                  src={settings.logoUrl}
                  alt="Company Logo"
                  className="max-h-32 max-w-xs object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='80'%3E%3Crect fill='%23e2e8f0' width='200' height='80'/%3E%3Ctext x='50%' y='50%' font-family='Arial' font-size='14' fill='%2394a3b8' text-anchor='middle' dy='.3em'%3ELogo Preview Error%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Business Hours Section */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Business Hours</h2>
          <p className="text-sm text-slate-600 mt-1">
            Operating hours and work days
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Start Time
            </label>
            <input
              type="time"
              value={settings.businessHours?.start || "09:00"}
              onChange={(e) =>
                handleBusinessHoursChange("start", e.target.value)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              End Time
            </label>
            <input
              type="time"
              value={settings.businessHours?.end || "17:00"}
              onChange={(e) =>
                handleBusinessHoursChange("end", e.target.value)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Work Days
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DAYS_OF_WEEK.map((day) => (
              <label
                key={day.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={
                    settings.businessHours?.workDays?.includes(day.value) ||
                    false
                  }
                  onChange={() => handleWorkDaysChange(day.value)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">{day.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Section */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Financial</h2>
          <p className="text-sm text-slate-600 mt-1">
            Currency and fiscal year settings
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Currency *
            </label>
            <select
              value={settings.currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Currency Symbol *
            </label>
            <input
              type="text"
              value={settings.currencySymbol}
              onChange={(e) =>
                handleInputChange("currencySymbol", e.target.value)
              }
              maxLength={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fiscal Year Start
            </label>
            <select
              value={settings.fiscalYearStart || "01"}
              onChange={(e) =>
                handleInputChange("fiscalYearStart", e.target.value)
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Timezone Section */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Timezone</h2>
          <p className="text-sm text-slate-600 mt-1">
            Company timezone for time-based operations
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Timezone *
          </label>
          <select
            value={settings.timezone}
            onChange={(e) => handleInputChange("timezone", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Save Button */}
      <div className="sticky bottom-0 pt-6 border-t border-slate-200 bg-white">
        <button
          type="submit"
          disabled={loading}
          className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}
