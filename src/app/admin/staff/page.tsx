"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, Button, StatusBadge } from "@/components/yield";
import { UserPlus, Shield, X, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";

interface StaffMember {
  id: string;
  staff_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  employment_status: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  roles: string[];
}

export default function AdminStaffPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ staff: StaffMember[] }>({
    queryKey: ["admin-staff", includeInactive],
    queryFn: async () => {
      const res = await fetch(`/api/admin/staff${includeInactive ? "?include_inactive=true" : ""}`);
      if (!res.ok) throw new Error("Failed to load staff");
      return res.json();
    },
  });

  const staff = data?.staff || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Staff & RBAC</h1>
          <p className="text-sm text-ink-soft mt-0.5">Manage staff accounts and role assignments</p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setIncludeInactive(!includeInactive)}>
            {includeInactive ? "Show active only" : "Show all"}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Add Staff
          </Button>
        </div>
      </div>

      {/* Staff list */}
      {isLoading ? (
        <LoadingState message="Loading staff…" />
      ) : error ? (
        <ErrorState message="Couldn't load staff" onRetry={() => refetch()} />
      ) : staff.length === 0 ? (
        <div className="ys-card text-center py-12">
          <Shield className="h-8 w-8 text-ink-soft mx-auto" />
          <p className="mt-3 text-sm text-ink-soft">No staff members found.</p>
        </div>
      ) : (
        <div className="ys-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-track/60">
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Staff #</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Name</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Email</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Department</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Roles</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 transition">
                  <td className="py-3 pr-4 font-mono text-xs text-ink-soft">{member.staff_number}</td>
                  <td className="py-3 pr-4">
                    <p className="text-sm text-ink font-medium">{member.full_name}</p>
                    {member.phone && <p className="text-xs text-ink-soft">{member.phone}</p>}
                  </td>
                  <td className="py-3 pr-4 text-sm text-ink">{member.email}</td>
                  <td className="py-3 pr-4 text-sm text-ink-soft capitalize">{member.department || "—"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {member.roles?.map((role) => (
                        <span key={role} className="text-xs bg-indigo/10 text-indigo rounded-full px-2 py-0.5 capitalize">
                          {role.replace(/_/g, " ")}
                        </span>
                      )) || <span className="text-xs text-ink-soft">—</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={member.is_active ? "active" : "locked"} />
                  </td>
                  <td className="py-3 pr-4 text-xs text-ink-soft">{formatDate(member.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create staff modal */}
      {showCreate && <CreateStaffModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateStaffModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    phone: "",
    department: "",
    role_name: "operations",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = [
    { value: "super_admin", label: "Super Admin" },
    { value: "operations", label: "Operations" },
    { value: "finance_officer", label: "Finance Officer" },
    { value: "loan_officer", label: "Loan Officer" },
    { value: "compliance", label: "Compliance" },
    { value: "customer_support", label: "Customer Support" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create staff member");
      setLoading(false);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-paper rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-ink">Add Staff Member</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="ys-label block mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              className="ys-input"
              placeholder="e.g. Ngozi Eze"
            />
          </div>
          <div>
            <label className="ys-label block mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="ys-input"
              placeholder="staff@yield.ng"
            />
          </div>
          <div>
            <label className="ys-label block mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="ys-input"
              placeholder="08123456789"
            />
          </div>
          <div>
            <label className="ys-label block mb-1.5">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="ys-input"
              placeholder="e.g. Operations"
            />
          </div>
          <div>
            <label className="ys-label block mb-1.5">Role</label>
            <select
              value={form.role_name}
              onChange={(e) => setForm({ ...form, role_name: e.target.value })}
              className="ys-input"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-clay bg-clay/5 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create staff"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
