# pi-custom-anime-header

Custom startup header extension for Pi (`@earendil-works/pi-coding-agent`) featuring an anti-aliased half-block anime chibi portrait, a matching half-block `pi` wordmark, transparent background support, and interactive presets via `/header`.

## Features

- **Transparent cutout half-block rendering**: Removes outer background fill so the portrait blends directly into your terminal background.
- **Anti-aliased downsampling**: Box-resamples the source dot matrix (`68x60`) cleanly to `34x15` or `45x20` cells, plus a `68x30` lossless mode and pure line-art modes (`line`, `line45`).
- **Top-aligned `13x5` `pi` wordmark**: Half-block lowercase `pi` logo aligned with the top of the portrait.
- **Startup help below header**: Preserves `Pi` version, keybind hints, and `ctrl+o` expand/collapse support cleanly underneath the header.
- **Live switching with `/header`**: Switch portraits, toggle the side `pi` wordmark, toggle/reposition description text, or restore the built-in Pi header without restarting.

## Installation

Install directly from GitHub via Pi:

```bash
pi install git:github.com/nescryo/pi-custom-anime-header
```

Or try it for a single session without installing:

```bash
pi -e https://github.com/nescryo/pi-custom-anime-header
```

Alternatively, copy `extensions/custom-header.ts` into `~/.pi/agent/extensions/custom-header.ts`.

## Commands

Use `/header` in interactive mode (with tab-completion):

| Command | Description |
|---|---|
| `/header chibi` | `34x15` anti-aliased chibi cutout (default) |
| `/header chibi45` | `45x20` anti-aliased chibi cutout |
| `/header chibi68` | `68x30` 1:1 lossless chibi cutout |
| `/header line` | `34x15` transparent line-art only (no white fill) |
| `/header line45` | `45x20` transparent line-art only (no white fill) |
| `/header pi` | `13x5` white half-block `pi` wordmark only |
| `/header braille` | `34x15` Braille art with ASCII spaces for `U+2800` |
| `/header subaru` | `42x17` Subaru half-block portrait |
| `/header builtin` | Restore Pi's built-in startup header |
| `/header` | Toggle between custom and built-in header |
| `/header logo [on\|off]` | Toggle or set the `13x5` `pi` wordmark on the right |
| `/header text [on\|off\|below\|side]` | Toggle, hide, or reposition Pi description text |

## Tip: Hide Startup Resource Listings

If you want only this header on startup without the `[Extensions]`, `[Skills]`, or `[Context]` listings below it, set `quietStartup` to `"header"` in `~/.pi/agent/settings.json` (or via `/settings` → **Quiet startup** → `header`):

```json
{
  "quietStartup": "header"
}
```
