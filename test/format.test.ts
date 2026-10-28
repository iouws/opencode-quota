import assert from "node:assert/strict"
import test from "node:test"
import {
  barParts,
  formatCountdown,
  formatPercentLeft,
  remainingPercent,
  WINDOW_LABEL,
} from "../src/format.ts"

test("remaining percent is clamped", () => {
  assert.equal(remainingPercent(0), 100)
  assert.equal(remainingPercent(5), 95)
  assert.equal(remainingPercent(75), 25)
  assert.equal(remainingPercent(120), 0)
  assert.equal(formatPercentLeft(5), "95%")
})

test("the meter fills as quota remains", () => {
  assert.deepEqual(barParts(100, 10, "bars"), {
    filled: "▮▮▮▮▮▮▮▮▮▮",
    empty: "",
  })
  assert.deepEqual(barParts(0, 10, "bars"), {
    filled: "",
    empty: "▯▯▯▯▯▯▯▯▯▯",
  })
  assert.deepEqual(barParts(50, 10, "ascii"), {
    filled: "|||||",
    empty: ".....",
  })
  assert.deepEqual(barParts(1, 10, "blocks"), {
    filled: "█",
    empty: "░░░░░░░░░",
  })
})

test("countdowns stay compact", () => {
  const now = 1_000_000
  assert.equal(formatCountdown(now + 3 * 3_600_000 + 43 * 60_000, now), "3h 43m")
  assert.equal(formatCountdown(now + 2 * 86_400_000 + 5 * 3_600_000, now), "2d 5h")
  assert.equal(formatCountdown(now + 12 * 86_400_000, now), "12d")
  assert.equal(formatCountdown(now - 1, now), "now")
})

test("window labels are short", () => {
  assert.equal(WINDOW_LABEL.rolling, "5h")
  assert.equal(WINDOW_LABEL.weekly, "7d")
  assert.equal(WINDOW_LABEL.monthly, "30d")
})
