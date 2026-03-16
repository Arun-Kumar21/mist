import { HomeBanner } from "@/components/home-banner"
import { HomeTrackSections } from "@/components/home-track-sections"

export default function Home() {
  return (
    <div className="flex flex-col gap-5 p-3 sm:gap-6 sm:p-4 lg:p-6">
      <HomeBanner />
      <HomeTrackSections />
    </div>
  )
}
