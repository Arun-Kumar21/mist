"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Headphones, Sparkles, Heart } from "lucide-react"

import { getApiErrorMessage, loginWithEmail, registerWithEmail } from "@/lib/api/auth"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AuthMode = "login" | "register"

type AuthCardProps = {
  mode: AuthMode
}

type SubmitState = {
  type: "success" | "error"
  message: string
} | null

const authCopy = {
  login: {
    title: "Login to your account",
    description: "Enter your email and password to continue listening.",
    actionLabel: "Sign Up",
    actionHref: "/register",
    submitLabel: "Login",
    footerPrompt: "New to MIST?",
    footerLinkLabel: "Create an account",
    footerLinkHref: "/register",
  },
  register: {
    title: "Create your account",
    description: "Create your account and start listening right away.",
    actionLabel: "Login",
    actionHref: "/login",
    submitLabel: "Create account",
    footerPrompt: "Already have an account?",
    footerLinkLabel: "Login",
    footerLinkHref: "/login",
  },
} as const

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter()
  const formId = React.useId()
  const content = authCopy[mode]
  const [submitState, setSubmitState] = React.useState<SubmitState>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const formData = new FormData(event.currentTarget)
      const email = String(formData.get("email") ?? "").trim().toLowerCase()
      const username = String(formData.get("name") ?? "").trim()
      const password = String(formData.get("password") ?? "")
      const confirmPassword = String(formData.get("confirmPassword") ?? "")

      if (mode === "register" && password !== confirmPassword) {
        setSubmitState({
          type: "error",
          message: "Passwords do not match.",
        })
        return
      }

      if (mode === "register" && username.length < 3) {
        setSubmitState({
          type: "error",
          message: "Display name must be at least 3 characters.",
        })
        return
      }

      setSubmitState(null)
      setIsSubmitting(true)

      try {
        if (mode === "register") {
          await registerWithEmail({
            email,
            username,
            password,
          })
          setSubmitState({ type: "success", message: "Account created successfully." })
        } else {
          await loginWithEmail({ email, password })
          setSubmitState({ type: "success", message: "Logged in successfully." })
        }

        router.push("/")
      } catch (error) {
        setSubmitState({
          type: "error",
          message: getApiErrorMessage(error, "Authentication failed"),
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [mode, router]
  )

  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm md:grid-cols-[0.95fr_1.05fr]">
      <aside className="flex flex-col justify-between gap-10 bg-muted/50 p-6 sm:p-8">
        <div className="space-y-7">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <div>
              <p className="text-lg font-semibold tracking-tight">MIST</p>
              <p className="text-sm text-muted-foreground">Music listening platform</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="max-w-sm text-2xl font-semibold tracking-tight sm:text-3xl">
              Listen seamless music.
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
              Listen to what you like with a focused player built around your taste.
            </p>
          </div>
        </div>

        <div className="grid gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Headphones className="size-4" />
            <span>Seamless music listening.</span>
          </div>
          <div className="flex items-center gap-2">
            <Heart className="size-4" />
            <span>Listen to what you like.</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" />
            <span>Recommendations shaped by embeddings.</span>
          </div>
        </div>
      </aside>

      <Card className="h-full rounded-none border-0 bg-transparent py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-6 pt-6 sm:px-8 sm:pt-8">
          <CardTitle className="text-2xl">{content.title}</CardTitle>
          <CardDescription className="leading-6">{content.description}</CardDescription>
          <CardAction>
            <Button asChild variant="link" className="px-0">
              <Link href={content.actionHref}>{content.actionLabel}</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-6 pt-1 sm:px-8">
          <form id={formId} onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor={`${mode}-email`}>Email</Label>
              <Input
                id={`${mode}-email`}
                name="email"
                type="email"
                placeholder="Kanao@example.com"
                autoComplete="email"
                required
              />
            </div>

            {mode === "register" && (
              <div className="grid gap-2">
                <Label htmlFor={`${mode}-name`}>Display Name</Label>
                <Input
                  id={`${mode}-name`}
                  name="name"
                  type="text"
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor={`${mode}-password`}>Password</Label>
                {mode === "login" && (
                  <Link href="#" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                    Forgot your password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Input
                  id={`${mode}-password`}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div className="grid gap-2">
                <Label htmlFor={`${mode}-confirm-password`}>Confirm Password</Label>
                <div className="relative">
                  <Input
                    id={`${mode}-confirm-password`}
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4 bg-transparent px-6 pb-6 sm:px-8 sm:pb-8">
          {submitState && (
            <p
              className={submitState.type === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
            >
              {submitState.message}
            </p>
          )}
          <Button type="submit" form={formId} className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : content.submitLabel}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {content.footerPrompt}{" "}
            <Link href={content.footerLinkHref} className="font-medium text-foreground underline-offset-4 hover:underline">
              {content.footerLinkLabel}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
