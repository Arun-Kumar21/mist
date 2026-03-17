import Link from "next/link"
import { FileText } from "lucide-react"

const detailsUrl =
  "https://www.notion.so/mistmusic/Mist-Public-Roadmap-Community-326cab30a318800e9e35c06b07b9c019?source=copy_link"

export function ProjectDetailsBar() {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950/92 backdrop-blur supports-backdrop-filter:bg-zinc-950/82">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-zinc-100">
            <FileText className="h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
              Project Details
            </p>
          </div>
          <p className="text-sm font-medium text-zinc-100 sm:text-[15px]">
            Read about Mist, community feedback, known issues, upcoming features, and licensing.
          </p>
        </div>

        <div className="flex shrink-0 items-center">
          <Link
            href={detailsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-sm bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            Details
          </Link>
        </div>
      </div>
    </section>
  )
}