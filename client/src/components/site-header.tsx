"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/search", label: "Search" },
  { href: "/admin/upload", label: "Upload" },
  { href: "/admin/tracks", label: "Manage" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/60 backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <Link href="/" className="font-display text-lg font-semibold tracking-[0.18em] lg:hidden">
          MIST
        </Link>

        <nav className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto lg:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname === link.href && "bg-secondary text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline lg:hidden">{user?.username}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Create account</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
