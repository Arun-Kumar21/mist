"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LayoutDashboard, LogOut, UserCog } from "lucide-react"

import { useAuthStore } from "@/lib/stores/auth-store"
import { Logo } from "@/components/logo"
import { ModeToggle } from "@/components/mode-toggle"
import { SearchCommand } from "@/components/nav/search-command"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"

const avatarFallbackColors = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-lime-100 text-lime-700",
  "bg-emerald-100 text-emerald-700",
  "bg-cyan-100 text-cyan-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
]

function getAvatarColor(username: string) {
  const hash = Array.from(username).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return avatarFallbackColors[hash % avatarFallbackColors.length]
}

export function AppNavbar() {
  const { isAuthenticated, user, clearSession } = useAuthStore()
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const showAuthedUi = mounted && isAuthenticated && user
  const initial = user?.username?.trim()?.charAt(0)?.toUpperCase() || "U"
  const avatarColor = user ? getAvatarColor(user.username || user.email) : avatarFallbackColors[0]

  const handleLogout = React.useCallback(() => {
    clearSession()
    router.push("/login")
  }, [clearSession, router])

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-4">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 py-3 sm:gap-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:text-foreground/80">
            <Logo size={18} />
            <span className="text-sm font-semibold tracking-[0.18em] text-foreground">MIST</span>
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {mounted && isAuthenticated && user?.role === "admin" && (
            <Link
              href="/admin/dashboard"
              className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
          <SearchCommand />
          <ModeToggle />
          {showAuthedUi ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md p-1 outline-hidden ring-offset-background transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Open account menu"
                >
                  <Avatar size="sm">
                    <AvatarFallback className={avatarColor}>{initial}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-28 truncate text-sm text-foreground/80 sm:inline">
                    {user.username}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 max-w-[calc(100vw-1rem)] rounded-md p-1">
                <DropdownMenuLabel className="space-y-0.5 px-1.5 py-1">
                  <p className="truncate text-sm font-medium text-foreground">{user.username}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-sm px-1.5 py-1.5">
                  <Link href="/account" className="cursor-pointer">
                    <UserCog />
                    Manage account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" className="rounded-sm px-1.5 py-1.5" onSelect={handleLogout}>
                  <LogOut />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="px-3 sm:px-4">
                <Link href="/login">Login</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="border border-black bg-black px-3 text-white hover:bg-black/90 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90 sm:px-4"
              >
                <Link href="/register">Signup</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
