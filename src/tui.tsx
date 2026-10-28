import type { UsageLimitsInfo } from "@opencode/client"
import { Plugin } from "@opencode/plugin/tui"
import { Yoga } from "@opentui/core"
import type { BoxRenderable, Renderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import {
  BAR_STYLE_LABEL,
  WINDOWS,
  WINDOW_LABEL,
  WINDOW_TITLE,
  barParts,
  describeError,
  formatAbsolute,
  formatClock,
  formatCountdown,
  formatPercentLeft,
  isUnsupported,
  nextBarStyle,
  nextWidth,
  remainingPercent,
  type QuotaWindow,
} from "./format"
import { hasGo, isGoProvider, windowMeter, type Meter } from "./quota"
import { DEFAULT_SETTINGS, mergeSettings, nextPlacement, normalizeSettings, type Settings } from "./settings"

interface Controller {
  readonly context: Plugin.Context
  readonly settings: () => Settings
  readonly info: () => UsageLimitsInfo | null | undefined
  readonly error: () => string | undefined
  readonly updatedAt: () => number | undefined
  readonly loading: () => boolean
  readonly providerID: () => string | undefined
  refresh: (force?: boolean) => Promise<void>
  update: (patch: Partial<Settings>) => void
  reset: () => void
  open: () => void
}

function meterColor(controller: Controller, meter: Meter) {
  const theme = controller.context.theme
  const remaining = remainingPercent(meter.percent)
  if (meter.limited || remaining <= 10) return theme.text.feedback.error.base
  if (remaining <= 30) return theme.text.feedback.warning.base
  return theme.text.feedback.success.base
}

function visible(controller: Controller) {
  if (!hasGo(controller.info())) return false
  if (!controller.settings().onlyActiveProvider) return true
  const provider = controller.providerID()
  return provider === undefined || isGoProvider(provider)
}

type ChatRect = {
  readonly left: number
  readonly top: number
  readonly width: number
}

/** Yoga layouts are parent-relative, so add every ancestor offset. */
function absolutePosition(node: Renderable) {
  let left = 0
  let top = 0
  let current: Renderable | null | undefined = node
  while (current) {
    const layout = current.getLayout()
    left += layout.left
    top += layout.top
    current = current.parent
  }
  return { left, top }
}

/**
 * The host has no slot at the top of the chat pane, so measure the main session
 * column from inside the composer slot. That column starts below the session
 * tabs and excludes the right sidebar, which is exactly where the strip belongs.
 */
const reservations = new WeakMap<Renderable, { count: number; original: number | undefined }>()

function ChatProbe(props: {
  readonly id: string
  readonly active: () => boolean
  readonly reserve: () => boolean
  readonly onRect: (id: string, rect: ChatRect | undefined) => void
}) {
  let node: BoxRenderable | undefined
  const dimensions = useTerminalDimensions()
  let last = ""
  let reserved: Renderable | undefined

  const release = () => {
    if (!reserved) return
    const entry = reservations.get(reserved)
    if (entry) {
      entry.count--
      if (entry.count <= 0) {
        reserved.paddingTop = entry.original
        reservations.delete(reserved)
      }
    }
    reserved = undefined
  }

  // Reserve one real chat row for the strip instead of covering the transcript.
  const reserve = (main: Renderable) => {
    if (reserved === main) return
    release()
    const entry = reservations.get(main)
    if (entry) {
      entry.count++
    } else {
      const padding = main.getPadding(Yoga.Edge.Top)
      const original = padding.unit === Yoga.Unit.Point ? padding.value : undefined
      reservations.set(main, { count: 1, original })
      main.paddingTop = (original ?? 0) + 1
    }
    reserved = main
  }

  const clear = () => {
    if (last === "inactive") return
    last = "inactive"
    props.onRect(props.id, undefined)
  }

  const update = () => {
    if (!props.active()) {
      release()
      clear()
      return
    }
    if (!node) return
    const main = node.parent?.parent
    if (!main) return
    if (props.reserve()) reserve(main)
    else release()
    const layout = main.getLayout()
    if (layout.width <= 0 || layout.height <= 0) return
    const position = absolutePosition(main)
    const key = `${position.left}:${position.top}:${layout.width}`
    if (key === last) return
    last = key
    props.onRect(props.id, { left: position.left, top: position.top, width: layout.width })
  }

  createEffect(() => {
    props.active()
    props.reserve()
    dimensions()
    update()
  })

  const timer = setInterval(update, 500)
  onCleanup(() => {
    clearInterval(timer)
    release()
    props.onRect(props.id, undefined)
  })

  return (
    <box
      height={0}
      ref={(value) => {
        node = value
        update()
      }}
    />
  )
}

/** The meter stretches only after the row's real width is known. */
function useMeasuredWidth(node: () => BoxRenderable | undefined) {
  const [width, setWidth] = createSignal(0)
  const timer = setInterval(() => {
    const item = node()
    if (!item) return
    const next = item.getLayout().width
    if (next > 0 && next !== width()) setWidth(next)
  }, 250)
  onCleanup(() => clearInterval(timer))
  return width
}

/** A one-line strip above the prompt or at the top of the chat pane. */
function QuotaStrip(props: { controller: Controller }) {
  const controller = props.controller
  const theme = controller.context.theme
  const dimensions = useTerminalDimensions()
  const [now, setNow] = createSignal(Date.now())
  const timer = setInterval(() => setNow(Date.now()), 30_000)
  onCleanup(() => clearInterval(timer))

  const [strip, setStrip] = createSignal<BoxRenderable>()
  const measured = useMeasuredWidth(strip)

  const meter = createMemo(() => {
    if (!visible(controller)) return
    return windowMeter(controller.info(), controller.settings().window)
  })

  const compact = createMemo(() => (measured() || dimensions().width) < 64)

  const resetText = (value: Meter) => {
    if (!controller.settings().showReset || value.limited) return ""
    const countdown = formatCountdown(value.resetsAt, now())
    return compact() ? `· ${countdown}` : `· resets in ${countdown}`
  }

  const percentText = (value: Meter) =>
    value.limited ? "limit reached" : `${formatPercentLeft(value.percent)} left`

  const barWidth = (value: Meter) => {
    const configured = controller.settings().barWidth
    if (configured > 0) return configured
    const total = measured()
    if (total <= 0) return 12
    const reset = resetText(value).length
    const quota = compact() ? 0 : "/quota".length
    const gaps = 3 + (reset > 0 ? 1 : 0) + (quota > 0 ? 1 : 0)
    const fixed =
      WINDOW_LABEL[controller.settings().window].length +
      percentText(value).length +
      reset +
      quota +
      gaps +
      4
    return Math.max(4, total - fixed)
  }

  return (
    <Show when={meter()}>
      {(value) => {
        const remaining = () => remainingPercent(value().percent)
        const parts = () => barParts(remaining(), barWidth(value()), controller.settings().barStyle)
        const color = () => meterColor(controller, value())
        return (
          <box
            ref={setStrip}
            width="100%"
            height={1}
            flexShrink={0}
            flexDirection="row"
            gap={1}
            paddingLeft={2}
            paddingRight={2}
            onMouseUp={controller.open}
          >
            <text fg={theme.text.muted} wrapMode="none">
              {WINDOW_LABEL[controller.settings().window]}
            </text>
            <text wrapMode="none">
              <span style={{ fg: color() }}>{parts().filled}</span>
              <span style={{ fg: theme.text.muted }}>{parts().empty}</span>
            </text>
            <text fg={color()} wrapMode="none">
              {percentText(value())}
            </text>
            <Show when={resetText(value())}>
              <text fg={theme.text.muted} wrapMode="none">
                {resetText(value())}
              </text>
            </Show>
            <box flexGrow={1} />
            <Show when={!compact()}>
              <text fg={theme.text.muted} wrapMode="none">
                /quota
              </text>
            </Show>
          </box>
        )
      }}
    </Show>
  )
}

/** A block for the session sidebar (the right-hand Context/MCP pane). */
function QuotaSidebar(props: { controller: Controller }) {
  const controller = props.controller
  const theme = controller.context.theme
  const [now, setNow] = createSignal(Date.now())
  const timer = setInterval(() => setNow(Date.now()), 30_000)
  onCleanup(() => clearInterval(timer))

  const [node, setNode] = createSignal<BoxRenderable>()
  const measured = useMeasuredWidth(node)
  const meter = createMemo(() => {
    if (!visible(controller)) return
    return windowMeter(controller.info(), controller.settings().window)
  })

  return (
    <Show when={meter()}>
      {(value) => {
        const remaining = () => remainingPercent(value().percent)
        const color = () => meterColor(controller, value())
        const label = () => WINDOW_LABEL[controller.settings().window]
        const percent = () => (value().limited ? "limit reached" : `${formatPercentLeft(value().percent)} left`)
        const width = () => Math.max(8, (measured() || 32) - label().length - percent().length - 2)
        const parts = () => barParts(remaining(), width(), controller.settings().barStyle)
        return (
          <box ref={setNode} width="100%" flexDirection="column" gap={0} onMouseUp={controller.open}>
            <box flexDirection="row" justifyContent="space-between">
              <text fg={theme.text.base} wrapMode="none">
                <b>Quota</b>
              </text>
              <text fg={theme.text.muted} wrapMode="none">
                OpenCode Go · {label()}
              </text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.text.muted} wrapMode="none">
                {label()}
              </text>
              <text wrapMode="none">
                <span style={{ fg: color() }}>{parts().filled}</span>
                <span style={{ fg: theme.text.muted }}>{parts().empty}</span>
              </text>
              <text fg={color()} wrapMode="none">
                {percent()}
              </text>
            </box>
            <Show when={controller.settings().showReset && !value().limited}>
              <text fg={theme.text.muted} wrapMode="none">
                resets in {formatCountdown(value().resetsAt, now())}
              </text>
            </Show>
            <Show when={value().limited}>
              <text fg={color()} wrapMode="none">
                waiting for reset
              </text>
            </Show>
          </box>
        )
      }}
    </Show>
  )
}

function MeterRow(props: { controller: Controller; window: QuotaWindow; now: number }) {
  const controller = props.controller
  const theme = controller.context.theme
  const meter = createMemo(() => windowMeter(controller.info(), props.window))

  return (
    <Show when={meter()}>
      {(value) => {
        const remaining = () => remainingPercent(value().percent)
        const parts = () => barParts(remaining(), 14, controller.settings().barStyle)
        const color = () => meterColor(controller, value())
        return (
          <box flexDirection="column">
            <box flexDirection="row" gap={1} alignItems="center">
              <box width={10}>
                <text fg={theme.text.muted} wrapMode="none">
                  {WINDOW_TITLE[props.window]}
                </text>
              </box>
              <text wrapMode="none">
                <span style={{ fg: color() }}>{parts().filled}</span>
                <span style={{ fg: theme.text.muted }}>{parts().empty}</span>
              </text>
              <box width={12}>
                <text fg={color()} wrapMode="none">
                  {value().limited ? "reached" : `${formatPercentLeft(value().percent)} left`}
                </text>
              </box>
              <text fg={theme.text.muted} wrapMode="none">
                {value().limited ? "waiting for reset" : `resets in ${formatCountdown(value().resetsAt, props.now)}`}
              </text>
            </box>
            <box paddingLeft={11}>
              <text fg={theme.text.muted} wrapMode="none">
                at {formatAbsolute(value().resetsAt)}
              </text>
            </box>
          </box>
        )
      }}
    </Show>
  )
}

function Choice(props: { controller: Controller; active: boolean; children: string }) {
  const theme = props.controller.context.theme
  return (
    <text fg={props.active ? theme.text.base : theme.text.muted} wrapMode="none">
      {props.active ? "● " : "○ "}
      {props.children}
    </text>
  )
}

function QuotaDialog(props: { controller: Controller }) {
  const controller = props.controller
  const theme = controller.context.theme
  const [now, setNow] = createSignal(Date.now())
  const timer = setInterval(() => setNow(Date.now()), 10_000)
  onCleanup(() => clearInterval(timer))

  controller.context.keymap.layer(() => ({
    mode: "modal",
    priority: 20,
    commands: [
      { bind: "escape", title: "Close", group: "Quota", run: () => controller.context.ui.dialog.clear() },
      { bind: "1", title: "5-hour window", group: "Quota", run: () => controller.update({ window: "rolling" }) },
      { bind: "2", title: "Weekly window", group: "Quota", run: () => controller.update({ window: "weekly" }) },
      { bind: "3", title: "Monthly window", group: "Quota", run: () => controller.update({ window: "monthly" }) },
      {
        bind: "s",
        title: "Switch bar style",
        group: "Quota",
        run: () => controller.update({ barStyle: nextBarStyle(controller.settings().barStyle) }),
      },
      {
        bind: "t",
        title: "Toggle reset time",
        group: "Quota",
        run: () => controller.update({ showReset: !controller.settings().showReset }),
      },
      {
        bind: "p",
        title: "Cycle placement",
        group: "Quota",
        run: () => controller.update({ placement: nextPlacement(controller.settings().placement) }),
      },
      {
        bind: "a",
        title: "Toggle active provider only",
        group: "Quota",
        run: () => controller.update({ onlyActiveProvider: !controller.settings().onlyActiveProvider }),
      },
      {
        bind: "w",
        title: "Cycle meter width",
        group: "Quota",
        run: () => controller.update({ barWidth: nextWidth(controller.settings().barWidth) }),
      },
      { bind: "r", title: "Refresh", group: "Quota", run: () => void controller.refresh(true) },
      { bind: "shift+r", title: "Reset settings", group: "Quota", run: () => controller.reset() },
    ],
  }))

  const current = () => controller.settings()

  return (
    <box flexDirection="column" padding={1} gap={1}>
      <box flexDirection="row" gap={2} alignItems="center">
        <text fg={theme.text.base}>
          <b>Quota</b>
        </text>
        <text fg={theme.text.muted}>OpenCode Go</text>
        <box flexGrow={1} />
        <Show when={controller.loading()}>
          <text fg={theme.text.muted}>refreshing…</text>
        </Show>
      </box>

      <Show when={controller.info()?.workspace}>
        {(workspace) => (
          <text fg={theme.text.muted} wrapMode="none">
            Workspace: {workspace().name ?? workspace().id}
          </text>
        )}
      </Show>

      <Show
        when={controller.info()?.go}
        fallback={
          <text fg={theme.text.muted} wrapMode="word">
            {controller.error() ??
              (controller.info() === undefined
                ? "Loading…"
                : controller.info() === null
                  ? "Sign in to OpenCode Console with /connect to see your Go allowance."
                  : "No OpenCode Go subscription found for this workspace.")}
          </text>
        }
      >
        <For each={WINDOWS}>{(window) => <MeterRow controller={controller} window={window} now={now()} />}</For>
      </Show>

      <text fg={theme.text.muted} wrapMode="none">
        Updated {controller.updatedAt() ? formatClock(controller.updatedAt()!) : "never"}
        {controller.error() ? ` · ${controller.error()}` : ""}
      </text>

      <text fg={theme.text.base}>
        <b>Settings</b>
      </text>
      <box flexDirection="row" gap={2}>
        <Choice controller={controller} active={current().window === "rolling"}>
          1 5-hour
        </Choice>
        <Choice controller={controller} active={current().window === "weekly"}>
          2 weekly
        </Choice>
        <Choice controller={controller} active={current().window === "monthly"}>
          3 monthly
        </Choice>
      </box>
      <text fg={theme.text.muted} wrapMode="word">
        style {BAR_STYLE_LABEL[current().barStyle]} · reset {current().showReset ? "on" : "off"} · place{" "}
        {current().placement} · provider only {current().onlyActiveProvider ? "on" : "off"} · width{" "}
        {current().barWidth === 0 ? "auto" : current().barWidth}
      </text>
      <text fg={theme.text.muted} wrapMode="word">
        1/2/3 window · s style · t reset · p place · a provider · w width · r refresh · shift+r reset settings · esc
        close
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "quota.tui",
  setup(context) {
    const [overrides, setOverrides] = context.storage.store<Partial<Settings>>("quota.settings", { initial: {} })
    const config = normalizeSettings(context.options)
    const settings = createMemo(() => mergeSettings(DEFAULT_SETTINGS, config, overrides))

    const [info, setInfo] = createSignal<UsageLimitsInfo | null | undefined>(undefined)
    const [error, setError] = createSignal<string>()
    const [updatedAt, setUpdatedAt] = createSignal<number>()
    const [loading, setLoading] = createSignal(false)

    let disposed = false
    let inFlight: Promise<void> | undefined
    let lastAttempt = 0
    let warnedUnsupported = false

    async function refresh(force = false) {
      if (disposed) return
      if (inFlight) return inFlight
      if (!force && Date.now() - lastAttempt < 5_000) return
      lastAttempt = Date.now()
      setLoading(true)
      const pending = (async () => {
        try {
          const location = context.location ?? context.data.location.default()
          const result = await context.client.usage.limits({ location })
          if (disposed) return
          setInfo(result.data)
          setError(undefined)
          setUpdatedAt(Date.now())
        } catch (cause) {
          if (disposed) return
          setError(describeError(cause))
          if (!warnedUnsupported && isUnsupported(cause)) {
            warnedUnsupported = true
            context.ui.toast.show({
              title: "Quota",
              message: "Usage API is unavailable. Restart the OpenCode service to load this version.",
              variant: "warning",
              duration: 8000,
            })
          }
        } finally {
          if (!disposed) setLoading(false)
          inFlight = undefined
        }
      })()
      inFlight = pending
      return pending
    }

    function update(patch: Partial<Settings>) {
      void setOverrides((draft) => {
        Object.assign(draft, patch)
      }).catch((cause) => {
        context.ui.toast.show({ title: "Quota", message: describeError(cause), variant: "error" })
      })
    }

    function reset() {
      void setOverrides((draft) => {
        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
          ;(draft as Record<string, unknown>)[key as string] = undefined
        }
      }).catch((cause) => {
        context.ui.toast.show({ title: "Quota", message: describeError(cause), variant: "error" })
      })
    }

    function open() {
      context.ui.dialog.set({ size: "xlarge" })
      context.ui.dialog.show(() => <QuotaDialog controller={controller} />)
      void controller.refresh(true)
    }

    const controller: Controller = {
      context,
      settings,
      info,
      error,
      updatedAt,
      loading,
      providerID: () => context.ui.model.current()?.providerID,
      refresh,
      update,
      reset,
      open,
    }

    const onSession = () => context.ui.router.current().type === "session"
    const probes = new Map<string, ChatRect>()
    const [chatRect, setChatRect] = createSignal<ChatRect>()
    const updateProbe = (id: string, rect: ChatRect | undefined) => {
      if (rect) probes.set(id, rect)
      else probes.delete(id)
      setChatRect(probes.values().next().value)
    }

    const disposers = [
      context.ui.slot({
        append: "session.composer.top",
        render: (input) => {
          const active = () => {
            const route = context.ui.router.current()
            if (route.type !== "session" || route.sessionID !== input.sessionID) return false
            if (!context.ui.tabs.enabled()) return true
            const current = context.ui.tabs.list().find((tab) => tab.active)?.sessionID
            return current === undefined || current === input.sessionID
          }
          return (
            <>
              <ChatProbe
                id={input.sessionID}
                active={active}
                reserve={() => settings().placement === "screen" && visible(controller)}
                onRect={updateProbe}
              />
              <Show when={settings().placement === "composer"}>
                <QuotaStrip controller={controller} />
              </Show>
            </>
          )
        },
      }),
      context.ui.slot({
        before: "home.footer",
        render: () => <QuotaStrip controller={controller} />,
      }),
      context.ui.slot({
        append: "sidebar.content",
        render: () => (
          <Show when={settings().placement === "right"}>
            <QuotaSidebar controller={controller} />
          </Show>
        ),
      }),
      context.ui.slot({
        prepend: "app",
        render: () => (
          <Show when={onSession() && settings().placement === "screen" && visible(controller) && chatRect()}>
            {(rect) => (
              <box
                position="absolute"
                left={rect().left}
                top={rect().top}
                width={rect().width}
                height={1}
                zIndex={1000}
                backgroundColor={context.theme.background.base}
              >
                <QuotaStrip controller={controller} />
              </box>
            )}
          </Show>
        ),
      }),
    ]

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "quota.show",
          title: "Quota",
          group: "Usage",
          palette: true,
          slash: { name: "quota", aliases: ["limits"] },
          run: () => open(),
        },
      ],
    }))

    const offExecution = context.data.on("session.execution.succeeded", () => void refresh())
    const offUsage = context.data.on("session.usage.updated", () => void refresh())

    const timer = setInterval(() => {
      const seconds = settings().refreshSeconds
      if (Date.now() - lastAttempt >= seconds * 1000) void refresh(true)
    }, 15_000)

    void refresh(true)

    return () => {
      disposed = true
      clearInterval(timer)
      offExecution()
      offUsage()
      for (const dispose of disposers) dispose()
    }
  },
})
