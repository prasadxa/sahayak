"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import {
  BookOpen,
  ClipboardList,
  FileWarning,
  LayoutDashboard,
  Plus,
  Search,
  SlidersHorizontal,
  TextSearch,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { SidebarHistory } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { useTranslate } from "@/components/admin/grievance-ui";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";

import { Doc } from "@/convex/_generated/dataModel";
import { isStaffRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const AppSidebar = ({ user }: { user: Doc<"users"> | null }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const label = useTranslate();
  const me = useQuery(api.roles.me, user ? {} : "skip");
  const isStaff = !!me && isStaffRole(me.role);
  const isAdmin = me?.role === "admin";

  const navItems = [
    { href: "/grievances", label: label("nav.grievances", "My grievances"), icon: FileWarning },
    { href: "/track", label: label("nav.track", "Track"), icon: Search },
    { href: "/knowledge", label: label("nav.knowledge", "Knowledge"), icon: BookOpen },
    ...(isStaff
      ? [
          { href: "/admin", label: label("nav.dashboard", "Dashboard"), icon: LayoutDashboard },
          { href: "/admin/grievances", label: "Grievance console", icon: ClipboardList },
        ]
      : []),
    ...(isAdmin
      ? [{ href: "/admin/models", label: "Models & voice", icon: SlidersHorizontal }]
      : []),
  ];
  const [openCommandDialog, setOpenCommandDialog] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenCommandDialog((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelectChat = (chatId: string) => {
    router.push(`/chat/${chatId}`);
    setOpenCommandDialog(false);
    setOpenMobile(false);
  };

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center gap-1">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
                Sahayak
                <span className="block text-[10px] font-normal text-muted-foreground -mt-0.5">
                  Cooperative Assistant
                </span>
              </span>
            </Link>
            <div className="flex flex-row items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    type="button"
                    className="p-2 h-fit"
                    onClick={() => setOpenCommandDialog(true)}
                  >
                    <TextSearch className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent align="end">Search chats (⌘K)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    type="button"
                    className="p-2 h-fit"
                    onClick={() => {
                      setOpenMobile(false);
                      router.push("/");
                      router.refresh();
                    }}
                  >
                    <Plus />
                  </Button>
                </TooltipTrigger>
                <TooltipContent align="end">New chat</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </SidebarMenu>
        <nav className="flex flex-col gap-0.5 px-2 pt-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpenMobile(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-muted text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory
          user={user}
          openCommandDialog={openCommandDialog}
          setOpenCommandDialog={setOpenCommandDialog}
          onSelectChat={handleSelectChat}
        />
      </SidebarContent>
      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
};
