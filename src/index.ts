import { Plugin } from "@opencode/plugin"

/**
 * The server half only exists so one plugin entry can load both halves from
 * `opencode.json`. The quota bar itself runs entirely in the TUI.
 */
export default Plugin.define({
  id: "quota",
  setup() {},
})
