"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Globe,
  Library,
  Music2,
  Plus,
  Rss,
  ArrowDownAZ,
  ArrowUpAZ,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const mainNav = [
  { title: "Music", href: "/", icon: Music2 },
  { title: "Explore", href: "/explore", icon: Globe },
  { title: "Feed", href: "/feed", icon: Rss },
  { title: "Library", href: "/collections", icon: Library },
]

const userPlaylists: Array<{ name: string; href: string }> = []

export function AppSidebar() {
  const pathname = usePathname()
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc")

  const sortedPlaylists = React.useMemo(() => {
    const list = [...userPlaylists].sort((a, b) => a.name.localeCompare(b.name))
    return sortOrder === "asc" ? list : list.reverse()
  }, [sortOrder])

  const isMainItemActive = React.useCallback(
    (href: string) => {
      if (href === "/music") {
        return pathname === "/" || pathname === "/music"
      }

      return pathname === href || pathname.startsWith(`${href}/`)
    },
    [pathname]
  )

  return (
    <Sidebar className="[&_[data-sidebar=menu-button]]:font-normal [&_[data-sidebar=menu-button]]:text-sidebar-foreground/85 dark:[&_[data-sidebar=menu-button]]:text-sidebar-foreground/70 [&_[data-sidebar=menu-button][data-active=true]]:bg-sidebar-accent [&_[data-sidebar=menu-button][data-active=true]]:text-sidebar-foreground dark:[&_[data-sidebar=menu-button][data-active=true]]:bg-sidebar-accent/80 dark:[&_[data-sidebar=menu-button][data-active=true]]:text-white [&_[data-sidebar=group-label]]:text-sidebar-foreground/65 dark:[&_[data-sidebar=group-label]]:text-sidebar-foreground/55">
      <SidebarContent className="pt-3">
        <SidebarGroup>
          <SidebarGroupLabel>Browse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isMainItemActive(item.href)}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <div className="flex h-8 items-center justify-between px-2">
              <span>Playlists</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Sort playlists ${sortOrder === "asc" ? "descending" : "ascending"}`}
                  onClick={() => setSortOrder((current) => (current === "asc" ? "desc" : "asc"))}
                >
                  {sortOrder === "asc" ? <ArrowUpAZ /> : <ArrowDownAZ />}
                </Button>
                <Button asChild variant="ghost" size="icon-sm" aria-label="Create playlist">
                  <Link href="/playlists/create" aria-label="Create playlist">
                    <Plus />
                  </Link>
                </Button>
              </div>
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {userPlaylists.length === 0 ? (
              <p className="px-2 py-1 text-xs text-sidebar-foreground/55">
                No playlists yet.
              </p>
            ) : (
              <SidebarMenu className="gap-1">
                {sortedPlaylists.map((playlist) => (
                  <SidebarMenuItem key={playlist.href}>
                    <SidebarMenuButton asChild isActive={pathname === playlist.href || pathname.startsWith(`${playlist.href}/`)}>
                      <Link href={playlist.href}>
                        <Music2 />
                        <span>{playlist.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/35 p-3">
          <div className="flex items-center gap-3">
            <Logo size={20} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground">MIST</p>
              <p className="text-xs text-sidebar-foreground/60 dark:text-sidebar-foreground/50">
                Music listening platform.
              </p>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}