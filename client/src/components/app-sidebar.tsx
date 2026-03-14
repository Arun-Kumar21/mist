"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navigation = [
  { href: "/", label: "Overview" },
  { href: "/library", label: "Library" },
  { href: "/search", label: "Search" },
  { href: "/admin/upload", label: "Upload" },
  { href: "/admin/tracks", label: "Manage" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();

  return (
    <aside className="hidden w-[268px] shrink-0 border-r border-border/70 bg-black/15 backdrop-blur-xl lg:flex lg:flex-col">
      <div className="px-6 py-7">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="inline-block h-2 w-2 bg-primary" />
          <span className="font-display text-lg font-semibold tracking-[0.2em] text-foreground">MIST</span>
        </Link>
        <p className="mt-3 text-sm text-muted-foreground">Private streaming workspace.</p>
      </div>

      <div className="px-6">
        <Badge variant="default" className="rounded-md border border-border/80 bg-secondary/65 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          Navigation
        </Badge>
      </div>

      <nav className="mt-4 flex flex-col gap-1 px-4">
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2.5 text-[15px] font-medium text-muted-foreground transition-colors",
                active ? "bg-secondary text-foreground" : "hover:bg-secondary/70 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-6 pb-7 pt-8">
        <Separator className="mb-5" />

        {isAuthenticated ? (
          <div className="space-y-3">
            <p className="truncate text-sm text-muted-foreground">Signed in as {user?.username}</p>
            <Button variant="outline" size="sm" className="w-full" onClick={logout}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button size="sm" className="w-full" asChild>
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
