import type { UsageLimitsInfo } from "@opencode/client"
import type { QuotaWindow } from "./format"
import { WINDOWS } from "./format"

export interface Meter {
  percent: number
  limited: boolean
  resetsAt: number
}

export type GoMeters = Record<QuotaWindow, Meter>

/** The Go meters, or nothing when the workspace has no Go subscription. */
export function goMeters(info: UsageLimitsInfo | null | undefined): GoMeters | undefined {
  if (!info?.go) return undefined
  return {
    rolling: info.go.rolling,
    weekly: info.go.weekly,
    monthly: info.go.monthly,
  }
}

export function windowMeter(info: UsageLimitsInfo | null | undefined, window: QuotaWindow): Meter | undefined {
  return goMeters(info)?.[window]
}

export function hasGo(info: UsageLimitsInfo | null | undefined) {
  return Boolean(info?.go)
}

export function isGoProvider(providerID: string | undefined) {
  return providerID === "opencode-go"
}

export function allWindows() {
  return WINDOWS
}
