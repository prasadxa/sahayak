"use client";

import type { ComponentProps, ReactNode } from "react";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ShieldAlert } from "lucide-react";

import { SidebarToggle } from "@/components/sidebar-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { isStaffRole, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Sticky top bar with the sidebar toggle, for pages inside the (chat) layout. */
export const PageHeader = () => (
  <header className="flex sticky top-0 z-10 bg-background py-1.5 items-center px-2 gap-2">
    <SidebarToggle />
  </header>
);

/** Native select styled like the shadcn Input (there is no Select primitive in components/ui). */
export const NativeSelect = ({ className, ...props }: ComponentProps<"select">) => (
  <select
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
);

const NoAccess = () => (
  <div className="rounded-xl border border-dashed p-8 text-center flex flex-col items-center gap-2">
    <ShieldAlert className="w-6 h-6 text-muted-foreground" />
    <p className="font-medium">You don&apos;t have access</p>
    <p className="text-sm text-muted-foreground">
      This page is for cooperative officers. Ask an administrator to grant your account a staff role.
    </p>
  </div>
);

/**
 * Renders children only for staff (or only for admins with `adminOnly`).
 * The Convex functions enforce the same rule; this just avoids a Forbidden error in the UI.
 */
export const StaffGate = ({
  adminOnly = false,
  children,
}: {
  adminOnly?: boolean;
  children: (me: { role: Role; name: string; email: string }) => ReactNode;
}) => {
  const me = useQuery(api.roles.me);
  if (me === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  const allowed = me && (adminOnly ? me.role === "admin" : isStaffRole(me.role));
  if (!me || !allowed) return <NoAccess />;
  return <>{children(me)}</>;
};
