import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export function AuthHomeLink() {
  return (
    <Button asChild variant="ghost" className="h-auto gap-2 px-2 py-2 text-sm text-muted-foreground hover:text-foreground">
      <Link href="/">
        <ArrowLeft className="size-4" />
        <Logo size={16} />
        <span>Back to home</span>
      </Link>
    </Button>
  )
}
