"use client";

import { useState } from "react";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { toast } from "sonner";
import { LoaderCircle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect, PageHeader, StaffGate } from "@/components/admin/admin-shell";
import { humanize } from "@/components/admin/grievance-ui";
import { ROLES, type Role } from "@/lib/constants";

const ROLE_HINTS: Record<Role, string> = {
  member: "Citizen: chat and own grievances",
  officer: "Staff: dashboard, grievance console, knowledge base",
  admin: "Staff + role management",
  kiosk: "Shared walk-in kiosk account",
};

const RoleManager = () => {
  const setRole = useMutation(api.roles.setRole);
  const staff = useQuery(api.roles.listStaff);
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<Role>("officer");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await setRole({ email: email.trim(), role });
      toast.success(`${email.trim()} is now ${humanize(role)}`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set role");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="rounded-xl border p-4 flex flex-col gap-3">
        <div className="grid sm:grid-cols-[1fr_12rem] gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">User email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@example.gov.in"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <NativeSelect
              id="role"
              value={role}
              onChange={(e) => setRoleValue(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{ROLE_HINTS[role]}</p>
        <p className="text-xs text-muted-foreground">
          The user must have signed up first. To make a kiosk, create an account for the kiosk
          (e.g. kiosk.pacs01@…) and set its role to kiosk.
        </p>
        <div>
          <Button type="submit" disabled={busy || !email.trim()}>
            {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
            Set role
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Staff and kiosk accounts</h2>
        {staff === undefined ? (
          <Skeleton className="h-24 w-full" />
        ) : staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No officers, admins or kiosks yet. Admins listed in ADMIN_EMAILS don&apos;t appear
            here unless they also have a stored role.
          </p>
        ) : (
          <ul className="rounded-xl border divide-y">
            {staff.map((u) => (
              <li key={u.userId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm truncate">{u.name || u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className="text-xs rounded-full bg-muted px-2 py-0.5 shrink-0">
                  {humanize(u.role)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader />
      <div className="mx-auto max-w-3xl w-full px-4 pb-8 pt-2 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" /> Roles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Grant officer, admin or kiosk access by email.
          </p>
        </div>
        <StaffGate adminOnly>{() => <RoleManager />}</StaffGate>
      </div>
    </>
  );
}
