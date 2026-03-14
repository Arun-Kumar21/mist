import * as React from "react"

type LogoProps = {
  className?: string
  size?: number
}

const maskStyle: React.CSSProperties = {
  WebkitMaskImage: "url('/logo.svg')",
  maskImage: "url('/logo.svg')",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  maskSize: "contain",
}

export function Logo({ className, size = 44 }: LogoProps) {
  return (
    <span
      aria-label="Mist logo"
      className={className}
      role="img"
      style={{ width: size, height: size, position: "relative", display: "inline-block" }}
    >
      <span
        aria-hidden="true"
        className="bg-slate-400 transition-colors dark:bg-slate-100"
        style={{
          ...maskStyle,
          position: "absolute",
          inset: 0,
          transform: "scale(1.06)",
        }}
      />
      <span
        aria-hidden="true"
        className="bg-slate-900 transition-colors dark:bg-slate-50"
        style={{
          ...maskStyle,
          position: "absolute",
          inset: 0,
        }}
      />
    </span>
  )
}