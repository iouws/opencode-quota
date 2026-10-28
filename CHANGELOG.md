# Changelog

## 0.1.3

- Moved the home strip inside the centered home column, just below the prompt
  and hints, instead of attaching it to the bottom footer.
- The home strip now matches the prompt width; the session strip stays hidden
  on the home screen.

## 0.1.2

- Added a full-width quota strip above the home footer, shown on launch and
  whenever the main screen is open.
- Removed the small `Go 5h …` footer item; the home strip replaces it.

## 0.1.1

- Added the `right` placement: the quota block can live in the session
  sidebar (the Context/MCP pane).
- `p` in `/quota` now cycles `screen` → `composer` → `right`.
- The horizontal strip still reserves its own row and stretches to the chat
  width.

## 0.1.0

- Initial public release.
- OpenCode Go 5-hour, weekly and monthly allowances.
- `screen` and `composer` placements.
- `/quota` dialog, meter styles, reset countdowns and GPL-3.0 licensing.
