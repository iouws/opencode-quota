export const WINDOWS = ["rolling", "weekly", "monthly"] as const

export type QuotaWindow = (typeof WINDOWS)[number]

export const WINDOW_LABEL: Record<QuotaWindow, string> = {
  rolling: "5h",
  weekly: "7d",
  monthly: "30d",
}

export const WINDOW_TITLE: Record<QuotaWindow, string> = {
  rolling: "5-hour",
  weekly: "Weekly",
  monthly: "Monthly",
}

export type BarStyle = "bars" | "blocks" | "dots" | "ascii"

export const BAR_STYLES: readonly BarStyle[] = ["bars", "blocks", "dots", "ascii"]

export const BAR_STYLE_LABEL: Record<BarStyle, string> = {
  bars: "bars",
  blocks: "blocks",
  dots: "dots",
  ascii: "ascii",
}

const BAR_CHARS: Record<BarStyle, { filled: string; empty: string }> = {
  bars: { filled: "▮", empty: "▯" },
  blocks: { filled: "█", empty: "░" },
  dots: { filled: "●", empty: "○" },
  ascii: { filled: "|", empty: "." },
}

/** The filled and empty halves of a meter. The meter fills as quota remains. */
export function barParts(remainingPercent: number, width: number, style: BarStyle) {
  const chars = BAR_CHARS[style]
  const cells = Math.max(1, Math.floor(width))
  const remaining = Math.min(100, Math.max(0, remainingPercent))
  let filled = Math.round((remaining / 100) * cells)
  if (remaining > 0) filled = Math.max(1, filled)
  if (remaining < 100) filled = Math.min(cells - 1, filled)
  return {
    filled: chars.filled.repeat(filled),
    empty: chars.empty.repeat(cells - filled),
  }
}

export function remainingPercent(usedPercent: number) {
  return Math.max(0, Math.min(100, 100 - usedPercent))
}

export function formatPercentLeft(usedPercent: number) {
  return `${Math.round(remainingPercent(usedPercent))}%`
}

/** A short countdown: `3h 43m`, `2d 5h`, `12d`, or `now`. */
export function formatCountdown(at: number, now = Date.now()) {
  const diff = at - now
  if (diff <= 0) return "now"
  const minutes = Math.ceil(diff / 60_000)
  if (minutes < 1) return "<1m"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  if (days < 14) return restHours > 0 ? `${days}d ${restHours}h` : `${days}d`
  return `${days}d`
}

/** An absolute local time for the details dialog, stable in narrow terminals. */
export function formatAbsolute(at: number) {
  const date = new Date(at)
  const text = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  return text.replace(/[\u202f\u00a0]/g, " ")
}

export function formatClock(at: number) {
  return new Date(at)
    .toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    .replace(/[\u202f\u00a0]/g, " ")
}

export function nextBarStyle(style: BarStyle): BarStyle {
  const index = BAR_STYLES.indexOf(style)
  return BAR_STYLES[(index + 1) % BAR_STYLES.length] ?? "bars"
}

export function nextWidth(width: number): number {
  const steps = [0, 8, 10, 12, 16, 20]
  const index = steps.indexOf(width)
  return steps[(index + 1) % steps.length] ?? 12
}

export function describeError(error: unknown) {
  if (error && typeof error === "object") {
    const value = error as {
      message?: unknown
      status?: unknown
      response?: { status?: unknown }
    }
    if (value.status === 404 || value.response?.status === 404) {
      return "Usage API not available; restart the OpenCode service"
    }
    if (typeof value.message === "string" && value.message.length > 0) return value.message
  }
  return String(error)
}

export function isUnsupported(error: unknown) {
  if (!error || typeof error !== "object") return false
  const value = error as { status?: unknown; response?: { status?: unknown } }
  return value.status === 404 || value.response?.status === 404
}
