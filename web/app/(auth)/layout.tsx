import { AuthHomeLink } from "@/components/auth/home-link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col gap-6">
        <div className="flex w-full justify-start">
          <AuthHomeLink />
        </div>
        <div className="flex flex-1 items-center justify-center">
          {children}
        </div>
      </div>
    </main>
  )
}
