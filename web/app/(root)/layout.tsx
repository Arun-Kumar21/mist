import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppNavbar } from "@/components/nav/app-navbar"
import { PlayerBottomBar } from "@/components/player-bottom-bar"
import { FeedbackBanner } from "@/components/feedback-banner"

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex min-h-svh w-full flex-col">
        <AppNavbar />
        <FeedbackBanner />

        <div className="flex-1 px-3 py-4 pb-32 sm:px-4 sm:py-6 sm:pb-36">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </div>

        <PlayerBottomBar />
      </main>
    </SidebarProvider>
  )
}