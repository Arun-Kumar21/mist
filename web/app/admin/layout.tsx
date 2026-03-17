"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Image, LayoutDashboard, ListMusic, LogOut, Menu, PanelLeftClose, Upload } from "lucide-react"

import { useAuthStore } from "@/lib/stores/auth-store"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/admin/dashboard", label: "Songs", icon: LayoutDashboard },
  { href: "/admin/upload", label: "Upload", icon: Upload },
  { href: "/admin/banners", label: "Banners", icon: Image },
  { href: "/admin/collections", label: "Collections", icon: ListMusic },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, clearSession } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)
  const [sidebarOpen, setSidebarOpen] = React.useState(true)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted) return
    if (!isAuthenticated || user?.role !== "admin") {
      router.replace("/")
    }
  }, [mounted, isAuthenticated, user, router])

  if (!mounted || !isAuthenticated || user?.role !== "admin") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh bg-background">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-zinc-50 dark:bg-zinc-900">
          {/* Logo */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-4">
            <Logo size={16} />
            <span className="text-sm font-semibold tracking-[0.18em]">MIST</span>
            <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Admin
            </span>
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
              className="ml-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
          <div className="border-t border-border p-3 space-y-1">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              ← Back to app
            </Link>
            <button
              type="button"
              onClick={() => { clearSession(); router.push("/login") }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Logout
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!sidebarOpen && (
          <div className="flex items-center border-b border-border px-4 py-3">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
