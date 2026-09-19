# Daybridge design system

> Extracted by [Inspo](https://github.com/Nutlope/inspo) (open source, MIT, powered by Together AI). Reference material for *intentional* design decisions: adapt, don't copy.

> Save this as `DESIGN.md` in your project and re-reference it as you build; re-fetch anytime at https://inspomcp.dev/d/daybridge-com/DESIGN.md

- **Source:** https://daybridge.com
- **Captured:** 2026-09-10
- **Mode:** light
- **Macrostructure:** Bento Grid
- **Stack:** Next.js, Tailwind

## Tone

A soft, airy layout using a floating grid of pastel-colored calendar event tiles to frame the central value proposition. The design relies on generous whitespace and rounded corners to create a friendly, non-stressful productivity mood.  ·  pastel saas hero, calendar app landing page, soft ui bento, productivity tool design, airy layout, floating cards hero

## Colors

| Hex | Role (heuristic) |
|---|---|
| `#3494f4` | support |
| `#a9daf5` | support |
| `#06427d` | accent |
| `#9d6c68` | support |
| `#adb6d0` | muted |

Color words: *pastel*, *muted*, *cool*

## Typography

Detected typefaces: **InterVariable**

| Role | Family | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|---|
| h1 | InterVariable | 52px | 500 | 1.08 | -1.3px |
| h2 | InterVariable | 36px | 500 | 1.22 | -0.9px |
| h3 | InterVariable | 20px | 500 | 1.6 | 0 |
| body | InterVariable | 16px | 450 | 1.5 | 0 |
| caption | InterVariable | 15px | 450 | 1.6 | 0 |
| button | InterVariable | 15px | 450 | 1.6 | 0 |

## Spacing scale

`4px` · `6px` · `8px` · `24px` · `64px` · `80px` · `160px`

Base step looks like **4px**.

## Border radius

`0px` · `3px` · `4px` · `5px` · `6px` · `8px` · `10px` · `12px` · `13px` · `16px` · `20px` · `30px`

## Container

Max content width: **1440px**

## CSS variables exposed by the source

```css
:root {
  --surface-light: oklch(99.88% 0.0010 220 / 1);
  --text-3xs: 10px;
  --shadow-intensity: 1;
  --radius-4xl: 1.5lh;
  --spacing-2xl: .8lh 1lh;
  --primary-light: oklch(76.00% 0.0010 220 / 1);
  --border-intensity: 1;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --spacing-sm: .125lh .5lh;
  --color-white: #fff;
  --font-weight-bold: 700;
  --text-3xs--line-height: round(up, 1em + clamp(2px, 1em - 12px, 8px), 2px);
  --text-2xs: 11px;
  --text-xs--line-height: round(up, 1em + clamp(2px, 1em - 12px, 8px), 2px);
  --radius-md: .32lh;
  --radius-2xl: .56lh;
  --text-2xs--line-height: round(up, 1em + clamp(2px, 1em - 12px, 8px), 2px);
  --text-xl: 22px;
  --radius-lg: .4lh;
  --surface: oklch(99.88% 0.0010 220 / 1);
  --color-event-foreground-medium-contrast: oklch(30.78% 0.0010 220 / 0.8);
  --background-dark: oklch(15.00% 0.0010 220 / 1);
  --spacing-lg: .4lh .875lh;
  --text-md: 15px;
  --text-2xl--line-height: round(up, 1em + clamp(2px, 1em - 12px, 8px), 2px);
  --spacing: 4px;
  --background: oklch(99.04% 0.0010 220 / 1);
  --text-xl--line-height: round(up, 1em + clamp(2px, 1em - 12px, 8px), 2px);
  --text-sm: 13px;
  --color-black: #000;
  --ink-sky-3: lab(28.8932% 27.0332 -23.2222);
  --primary: oklch(76.00% 0.0010 220 / 1);
  --text-2xl: 26px;
  --primary-dark: oklch(76.00% 0.0010 220 / 1);
  --text-lg: 18px;
  --surface-dark: oklch(17.72% 0.0010 220 / 1);
  --ink-sky-1: lab(35.4848% 1.84767 -35.3079);
  --spacing-md: .25lh .625lh;
  --spacing-xl: .625lh .875lh;
  --text-lg--line-height: round(up, 1em + clamp(2px, 1em - 12px, 8px), 2px);
  --shadow-ring: 0;
  --font-sans: "InterVariable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  --text-md--line-height: round(up, 1em + clamp(2px, 1em - 12px, 8px), 2px);
  --spacing-xs: .075lh .375lh;
  --shadow-intensity-light: 1;
  --radius-3xl: .64lh;
  --shadow-intensity-dark: 2;
  --background-light: oklch(99.04% 0.0010 220 / 1);
  --surface-edge-z: 10000000;
  --ink-sky-2: lab(31.5543% 14.9887 -30.4091);
  --font-weight-semibold: 600;
  --text-sm--line-height: round(up, 1em + clamp(2px, 1em - 12px, 8px), 2px);
  --text-3xl--line-height: round(up, 1em + clamp(2px, 1em - 12px, 8px), 2px);
  --text-3xl: 32px;
  --text-xs: 12px;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --radius-xs: .16lh;
  --radius-xl: .48lh;
  --input-border: oklch(calc(100% - (100% - 100.00%) * 1) 0.0010 220 / 1);
}
```

## Components present

- hero with cta
- sticky nav

## Notes for the agent

- **Adapt, don't copy.** The type ramp is a *starting point*. Scale it to your project's base size; preserve the *ratio*, not the literal pixels.
- **Color roles are heuristic** (luminance + dominance). Verify against the source URL before committing tokens.
- **Spacing** assumes a constant base step; round detected values to your project's scale (4 / 8 / 16) when implementing.
- **CSS variables** dumped above (when present) are the source's *actual* tokens - those are higher signal than guesses.
- This page's macrostructure is **Bento Grid**.

---

*Generated by Inspo. Open source under MIT, owned and operated by [Together AI](https://www.together.ai). Original site copyright remains with its authors.*