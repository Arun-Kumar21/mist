"use client"

import { useState } from "react"
import { X, MessageCircle } from "lucide-react"
import Link from "next/link"

export function FeedbackBanner() {
  const [isOpen, setIsOpen] = useState(true)

  if (!isOpen) return null

  return (
    <div className="border-b border-emerald-500/50 bg-emerald-950/30 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
          <p className="truncate text-xs font-medium text-emerald-100 sm:text-sm">
            We'd love your feedback
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 sm:gap-3">
          <Link
            href="https://docs.google.com/forms/d/e/1FAIpQLSd2SMsQNmyIBCQMwKWvG5zZJSPIQG0LEplpPCl63EDdzLXEbw/viewform?usp=publish-editor"
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap rounded-sm bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-300 transition-all hover:bg-emerald-500/30 hover:text-emerald-200 sm:px-3 sm:py-1.5 sm:text-sm"
          >
            <span className="hidden sm:inline">Share Feedback</span>
            <span className="sm:hidden">Feedback</span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded p-1 transition-all hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200"
            aria-label="Close feedback banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

