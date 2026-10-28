# OpenCode Quota

[![OpenCode 2.2.0+](https://img.shields.io/badge/OpenCode-2.2.0%2B-blue)](https://opencode.ai/v2/docs/)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)

A compact allowance strip for **OpenCode Go**. It lives inside the chat pane,
below the session tabs, and shows how much of the 5-hour, weekly or monthly
window is left:

```text
1 session-one   2 session-two   3 session-three
5h  ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▯▯▯  93% left  · resets in 3h 57m        /quota
```

The meter stretches to the available chat width, stops before the right
sidebar, and reserves its own row so the transcript is not covered.

Open `/quota` from the command palette or as a slash command to see all three
windows, absolute reset times, and the plugin settings.

## Features

- **5-hour, weekly and monthly** Go windows.
- **Live reset countdown** (`3h 57m`, `2d 5h`, `12d`) and absolute reset times.
- **Segmented meter** with `bars`, `blocks`, `dots` and `ascii` styles.
- **Stretches** to the chat pane width; `/quota` stays at the right edge.
- **Respects the layout**: below session tabs, before the right sidebar, never
  over the transcript.
- **Only for subscription models**: hidden when the selected model is not from
  OpenCode Go (configurable).
- **No API key** stored by the plugin: it reads the local OpenCode server's
  usage endpoint.
- Refreshes after turns, on session usage events, and on a timer.

## Requirements

- **OpenCode 2.2.0 or newer.**
- An **OpenCode Go** or **Go Plus** subscription, signed in to OpenCode Console.
- The TUI, not `opencode run` (this is a TUI plugin).

The usage endpoint is experimental and appears in OpenCode 2.2.0. If the strip
does not appear and `/quota` says the usage API is unavailable, restart the
background service once and reopen the TUI:

```sh
opencode service restart
```

## Install

### With your AI agent (recommended)

Paste this prompt into an OpenCode session. It installs the plugin from this
repository and keeps your existing `cli.json` settings.

```text
Install the OpenCode Quota plugin for my TUI.

Repository: https://github.com/iouws/opencode-quota.git
Target: ~/.config/opencode/plugins/opencode-quota
Windows target: %USERPROFILE%\.config\opencode\plugins\opencode-quota

Do this:
1. Clone the repository into the target directory. Create parent directories if needed.
2. Open ~/.config/opencode/cli.json and preserve every existing setting.
3. Add this plugin entry to the "plugins" array:
   { "package": "./plugins/opencode-quota", "options": { "window": "rolling", "placement": "screen", "barStyle": "bars", "barWidth": 0, "onlyActiveProvider": true } }
4. If "tabs" is absent, add this block at the top level:
   "tabs": { "mode": "on", "scope": "cwd", "layout": "horizontal", "indicators": "numbers" }
5. Validate cli.json as JSON and do not create duplicate plugin entries.
6. Do not edit opencode.json or any other config file.
7. Tell me to reopen the TUI. If /quota reports that the usage API is unavailable, run "opencode service restart" once, then reopen the TUI.
```

### Manual

Clone the plugin into the OpenCode plugins directory:

```sh
git clone https://github.com/iouws/opencode-quota.git ~/.config/opencode/plugins/opencode-quota
```

On Windows PowerShell:

```powershell
git clone https://github.com/iouws/opencode-quota.git "$env:USERPROFILE\.config\opencode\plugins\opencode-quota"
```

Add the plugin to `~/.config/opencode/cli.json`
(`%USERPROFILE%\.config\opencode\cli.json` on Windows). Keep your existing
settings and add the `tabs` and `plugins` blocks:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "tabs": {
    "mode": "on",
    "scope": "cwd",
    "layout": "horizontal",
    "indicators": "numbers"
  },
  "plugins": [
    {
      "package": "./plugins/opencode-quota",
      "options": {
        "window": "rolling",
        "placement": "screen",
        "barStyle": "bars",
        "barWidth": 0,
        "onlyActiveProvider": true
      }
    }
  ]
}
```

The relative `./plugins/opencode-quota` path is resolved from the directory
that contains `cli.json`, so it works on Windows, macOS and Linux.

`cli.json` is the right place for this plugin: TUI options are passed through
it. Adding the package to `opencode.json` is not required.

### Local development

```sh
git clone https://github.com/iouws/opencode-quota.git ~/opencode-quota
cd ~/opencode-quota
npm install
npm run typecheck
npm test
```

Then point `cli.json` at your checkout path and reopen the TUI. The source is
loaded directly; there is no build step.

## Configure

Options in `plugins[].options`:

| Option | Values | Default | Meaning |
| --- | --- | --- | --- |
| `window` | `rolling`, `weekly`, `monthly` | `rolling` | Which allowance the strip shows |
| `barStyle` | `bars`, `blocks`, `dots`, `ascii` | `bars` | Meter characters |
| `barWidth` | `0` or `4`–`30` | `0` | Meter width in cells; `0` stretches to the chat width |
| `showReset` | `true`, `false` | `true` | Show the reset countdown |
| `placement` | `composer`, `screen`, `right` | `screen` | Reserved row at the top of the chat pane, a strip above the prompt, or a block in the session sidebar |
| `onlyActiveProvider` | `true`, `false` | `true` | Hide when the selected model is not from OpenCode Go |
| `refreshSeconds` | `15`–`600` | `60` | How often to reload the allowance |

Settings changed from `/quota` are stored by the plugin and survive TUI
restarts. Values in `plugins[].options` are the initial defaults; stored values
win until you reset them with `shift+r`.

### Placement

- `screen` is the default. The strip measures the real session pane, starts
  below the horizontal tabs, stops before the right sidebar, and reserves one
  row at the top of the chat pane. The transcript starts below it.
- `composer` puts the strip directly above the prompt. It never touches the
  transcript, but it is lower on the screen.
- `right` puts a quota block in the session sidebar (the Context/MCP pane). It
  appears under the built-in sidebar sections and is visible when the sidebar
  is open. On narrow terminals open it from the command palette with
  **Show sidebar**, or set `session.sidebar` to `"auto"` in `cli.json`.
- With `tabs.layout: "vertical"` the top strip starts to the right of the tab
  rail.
- On the home screen the footer shows a compact
  `Go 5h 93% · 3h 57m` contribution instead.

Press `p` in `/quota` to cycle **screen → composer → right**.

When `right` is selected, the sidebar block looks like this:

```text
Quota                  OpenCode Go · 5h
5h  ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▯▯  93% left
resets in 3h 57m
at Oct 29, 02:50
```

## Use

| Command | Action |
| --- | --- |
| `/quota` | Open the quota dialog |
| `1` / `2` / `3` | Select the 5-hour, weekly or monthly window |
| `s` | Cycle the meter style |
| `t` | Show or hide the reset countdown |
| `p` | Cycle `screen` / `composer` / `right` |
| `a` | Toggle “only when the selected model is from Go” |
| `w` | Cycle the meter width |
| `r` | Refresh immediately |
| `shift+r` | Reset stored settings to the configured defaults |
| `esc` | Close the dialog |

Click the strip to open `/quota`.

## How it works

The TUI calls the local OpenCode server's experimental usage endpoint:

```text
GET /api/experimental/usage/limits
```

It returns the Go allowance for the Console workspace the location is signed in
to. `percent` is the share of the window **already used**; the strip displays
the remaining share. The plugin stores no API key and sends no telemetry.

The strip reloads after every successful turn, on `session.usage.updated`, and
on a timer (`refreshSeconds`).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| No strip | Reopen the TUI. A `cli.json` change is read by the CLI at startup. |
| `/quota` says the usage API is unavailable | Run `opencode service restart` once, then reopen the TUI. The endpoint requires 2.2.0. |
| “Sign in to OpenCode Console” | Run `/connect` and sign in to the workspace with the Go subscription. |
| No Go subscription found | The workspace is not subscribed to Go/Go Plus, or you are signed in to a different workspace. |
| Strip hides when switching models | That is `onlyActiveProvider: true`. Set it to `false` to always show the Go quota. |
| Tabs are not visible | Set `tabs.mode` to `"on"` in `cli.json` and reopen the TUI. |
| Strip is at the bottom | Open `/quota`, press `p`, or set `placement: "screen"` in `cli.json`. |

## Uninstall

1. Remove the `./plugins/opencode-quota` entry from the `plugins` array in
   `~/.config/opencode/cli.json`.
2. Delete `~/.config/opencode/plugins/opencode-quota`.
3. Reopen the TUI.

The plugin does not modify `opencode.json`, your sessions, or your database.

## Development

```sh
npm install
npm run typecheck
npm test
```

The source is plain TypeScript loaded by OpenCode; there is no bundle step.
Edit `src/` and reopen or reload the TUI. Pull requests are welcome.

## License

This project is free software under the
[GNU General Public License v3.0 or later](LICENSE)
(`GPL-3.0-or-later`).

- You may use, study, modify, and distribute the plugin for free.
- If you distribute it, you must provide the source under the GPL and keep
  derivative distributions under the GPL.
- **GPL allows paid distribution**, but the recipient still gets the same GPL
  freedoms and the source code. You cannot turn a distributed copy into a
  proprietary, closed product.
- If you want to **forbid paid distribution entirely**, that is a different,
  non-OSI license (for example PolyForm Noncommercial). GPL does not do that.

See [LICENSE](LICENSE) for the full terms.
