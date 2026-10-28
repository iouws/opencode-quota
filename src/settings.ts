import { BAR_STYLES, type BarStyle, type QuotaWindow } from "./format"

export type Placement = "composer" | "screen"

export interface Settings {
  window: QuotaWindow
  barStyle: BarStyle
  /** Width of the meter in cells. `0` picks a width from the terminal size. */
  barWidth: number
  showReset: boolean
  placement: Placement
  /** Hide the bar when the selected model is not from the Go subscription. */
  onlyActiveProvider: boolean
  /** How often to reload the allowance, in seconds. */
  refreshSeconds: number
}

export const DEFAULT_SETTINGS: Settings = {
  window: "rolling",
  barStyle: "bars",
  barWidth: 0,
  showReset: true,
  placement: "screen",
  onlyActiveProvider: true,
  refreshSeconds: 60,
}

const PLACEMENTS: readonly Placement[] = ["composer", "screen"]
const WINDOW_VALUES: readonly QuotaWindow[] = ["rolling", "weekly", "monthly"]

/** Only the known plugin options, with invalid values ignored. */
export function normalizeSettings(input: Readonly<Record<string, unknown>> | undefined): Partial<Settings> {
  if (!input) return {}
  const result: Partial<Settings> = {}
  if (typeof input.window === "string" && (WINDOW_VALUES as readonly string[]).includes(input.window)) {
    result.window = input.window as QuotaWindow
  }
  if (typeof input.barStyle === "string" && (BAR_STYLES as readonly string[]).includes(input.barStyle)) {
    result.barStyle = input.barStyle as BarStyle
  }
  if (typeof input.barWidth === "number" && Number.isFinite(input.barWidth)) {
    result.barWidth = clampWidth(input.barWidth)
  }
  if (typeof input.showReset === "boolean") result.showReset = input.showReset
  if (typeof input.placement === "string" && (PLACEMENTS as readonly string[]).includes(input.placement)) {
    result.placement = input.placement as Placement
  }
  if (typeof input.onlyActiveProvider === "boolean") result.onlyActiveProvider = input.onlyActiveProvider
  if (typeof input.refreshSeconds === "number" && Number.isFinite(input.refreshSeconds)) {
    result.refreshSeconds = Math.min(600, Math.max(15, Math.round(input.refreshSeconds)))
  }
  return result
}

export function clampWidth(width: number) {
  const rounded = Math.round(width)
  return rounded === 0 ? 0 : Math.min(30, Math.max(4, rounded))
}

/** Effective settings: built-in defaults, then config, then the user's stored overrides. */
export function mergeSettings(
  defaults: Settings,
  config: Partial<Settings>,
  overrides: Partial<Settings>,
): Settings {
  const defined = (value: Partial<Settings>) =>
    Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<Settings>
  return { ...defaults, ...defined(config), ...defined(overrides) }
}
