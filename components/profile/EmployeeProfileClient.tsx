/**
 * components/profile/EmployeeProfileClient.tsx
 *
 * Comprehensive employee profile editor for self-service profile management.
 * Shows personal info, address, emergency contacts, employment info, and avatar.
 *
 * Used by:
 * - app/(dashboard)/employee/profile/page.tsx
 * - app/(dashboard)/admin/profile/page.tsx
 * - app/(dashboard)/ceo/profile/page.tsx
 */

"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  UserCircle,
  Phone,
  MapPin,
  Heart,
  Briefcase,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import type { AppUser, EmergencyContact } from "@/types";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  admin:    { label: "Admin",    color: "bg-blue-100 text-blue-800"   },
  employee: { label: "Employee", color: "bg-green-100 text-green-800" },
  ceo:      { label: "CEO",      color: "bg-purple-100 text-purple-800" },
};

interface EmployeeProfileClientProps {
  initialUser: AppUser;
  isAdmin?: boolean;
}

export default function EmployeeProfileClient({
  initialUser,
  isAdmin = false,
}: EmployeeProfileClientProps) {
  const [user, setUser] = useState<AppUser>(initialUser);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Personal Info
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth ?? "");
  const [bio, setBio] = useState(user.bio ?? "");

  // Address
  const [street, setStreet] = useState(user.address?.street ?? "");
  const [city, setCity] = useState(user.address?.city ?? "");
  const [state, setState] = useState(user.address?.state ?? "");
  const [zipCode, setZipCode] = useState(user.address?.zipCode ?? "");
  const [country, setCountry] = useState(user.address?.country ?? "");

  // Emergency Contacts
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(
    user.emergencyContacts ?? []
  );

  const roleInfo = ROLE_LABELS[user.role] ?? { label: user.role, color: "bg-slate-100 text-slate-700" };

  // Track changes
  useEffect(() => {
    const hasChanges =
      displayName !== (user.displayName ?? "") ||
      phone !== (user.phone ?? "") ||
      dateOfBirth !== (user.dateOfBirth ?? "") ||
      bio !== (user.bio ?? "") ||
      street !== (user.address?.street ?? "") ||
      city !== (user.address?.city ?? "") ||
      state !== (user.address?.state ?? "") ||
      zipCode !== (user.address?.zipCode ?? "") ||
      country !== (user.address?.country ?? "") ||
      JSON.stringify(emergencyContacts) !== JSON.stringify(user.emergencyContacts ?? []);

    setUnsavedChanges(hasChanges);
  }, [displayName, phone, dateOfBirth, bio, street, city, state, zipCode, country, emergencyContacts, user]);

  async function handleSave() {
    setMessage(null);
    setLoading(true);

    try {
      const updates: Partial<AppUser> = {
        displayName,
        phone: phone || undefined,
        dateOfBirth: dateOfBirth || undefined,
        bio: bio || undefined,
        address: (street || city || state || zipCode || country) ? {
          street: street || undefined,
          city: city || undefined,
          state: state || undefined,
          zipCode: zipCode || undefined,
          country: country || undefined,
        } : undefined,
        emergencyContacts: emergencyContacts.length > 0 ? emergencyContacts : undefined,
      };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const json = await res.json();

      if (json.success) {
        setUser(json.data);
        setUnsavedChanges(false);
        setMessage({ type: "success", text: "Profile updated successfully." });
      } else {
        setMessage({ type: "error", text: json.error ?? "Failed to update profile." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function addEmergencyContact() {
    setEmergencyContacts([
      ...emergencyContacts,
      { name: "", relationship: "", phone: "", email: "" },
    ]);
  }

  function removeEmergencyContact(index: number) {
    setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index));
  }

  function updateEmergencyContact(index: number, field: keyof EmergencyContact, value: string) {
    const updated = [...emergencyContacts];
    updated[index] = { ...updated[index], [field]: value };
    setEmergencyContacts(updated);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header with avatar and role */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{displayName || "Profile"}</h1>
            <span className={cn("mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", roleInfo.color)}>
              {roleInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={cn(
          "flex items-start gap-2 rounded-lg p-4 text-sm",
          message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
        )}>
          {message.type === "success"
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Personal Info Section */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <UserCircle className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">Personal Information</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
              placeholder="Your full name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email (Read-Only)
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="input disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input min-h-24 resize-none"
            placeholder="Tell us about yourself..."
          />
        </div>
      </div>

      {/* Address Section */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <MapPin className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">Address</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Street Address
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="input"
              placeholder="123 Main St"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input"
              placeholder="New York"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              State / Province
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="input"
              placeholder="NY"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              ZIP / Postal Code
            </label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="input"
              placeholder="10001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Country
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="input"
              placeholder="United States"
            />
          </div>
        </div>
      </div>

      {/* Emergency Contacts Section */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Emergency Contacts</h2>
          </div>
          <button
            type="button"
            onClick={addEmergencyContact}
            className="flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </button>
        </div>

        {emergencyContacts.length === 0 ? (
          <p className="text-sm text-slate-500">No emergency contacts added yet.</p>
        ) : (
          <div className="space-y-4">
            {emergencyContacts.map((contact, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => updateEmergencyContact(idx, "name", e.target.value)}
                    className="input"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={contact.relationship}
                    onChange={(e) => updateEmergencyContact(idx, "relationship", e.target.value)}
                    className="input"
                    placeholder="Relationship (e.g. Spouse, Parent)"
                  />
                  <input
                    type="tel"
                    value={contact.phone}
                    onChange={(e) => updateEmergencyContact(idx, "phone", e.target.value)}
                    className="input"
                    placeholder="Phone Number"
                  />
                  <input
                    type="email"
                    value={contact.email ?? ""}
                    onChange={(e) => updateEmergencyContact(idx, "email", e.target.value)}
                    className="input"
                    placeholder="Email (Optional)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeEmergencyContact(idx)}
                  className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employment Info Section (Read-Only) */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Briefcase className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">Employment Information</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <p className="text-slate-500 mb-1">Role</p>
            <p className="font-medium text-slate-900">{roleInfo.label}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Department</p>
            <p className="font-medium text-slate-900">{user.department ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Position</p>
            <p className="font-medium text-slate-900">{user.position ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Join Date</p>
            <p className="font-medium text-slate-900">
              {user.joinDate ? new Date(user.joinDate).toLocaleDateString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Account Created</p>
            <p className="font-medium text-slate-900">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-1">Pay Type</p>
            <p className="font-medium text-slate-900">{user.payType ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!unsavedChanges || loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
