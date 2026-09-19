# Gumloop design system

> Extracted by [Inspo](https://github.com/Nutlope/inspo) (open source, MIT, powered by Together AI). Reference material for *intentional* design decisions: adapt, don't copy.

> Save this as `DESIGN.md` in your project and re-reference it as you build; re-fetch anytime at https://inspomcp.dev/d/gumloop-com/DESIGN.md

- **Source:** https://www.gumloop.com
- **Captured:** 2026-09-10
- **Mode:** light
- **Macrostructure:** Marquee Hero
- **Stack:** Next.js, Tailwind

## Tone

Clean, high-contrast layout featuring a bold sans-serif headline and a large, detailed product UI mockup as the primary visual anchor. The use of ample white space and a restrained color palette emphasizes the technical nature of the tool.  ·  ai agent builder, saas hero mockup, minimalist technical landing page, clean software ui showcase, developer tool landing page

## Colors

| Hex | Role (heuristic) |
|---|---|
| `#a325fc` | support |
| `#86cefc` | support |
| `#1aaf50` | accent |
| `#7c7c7d` | support |
| `#bab0b8` | muted |

Color words: *monochrome*, *muted*

## Typography

Detected typefaces: **Gellix**, **ui-sans-serif**, **GeistSans**

| Role | Family | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|---|
| h1 | Gellix | 48px | 500 | 1 | -1.2px |
| h2 | Gellix | 36px | 500 | 1.25 | -0.9px |
| h3 | Gellix | 20px | 500 | 1.25 | 0 |
| body | ui-sans-serif | 16px | 400 | 1.5 | 0 |
| caption | GeistSans | 14px | 500 | 1.43 | 0 |
| button | GeistSans | 14px | 500 | 1.43 | 0 |

## Spacing scale

`16px` · `20px` · `24px` · `32px` · `40px` · `64px` · `76px` · `128px`

Base step looks like **4px**.

## Border radius

`0px` · `2px` · `3px` · `4px` · `6px` · `8px` · `10px` · `12px` · `14px` · `16px`

## Container

Max content width: **1440px**

## CSS variables exposed by the source

```css
:root {
  --border: lab(90.0141% .811607 -2.9353);
  --brand-yellow-dark: lab(16.8146% 15.7422 23.1133);
  --color-sky-500: lab(63.3038% -18.433 -51.0407);
  --color-slate-200: lab(91.7353% -.998765 -4.76968);
  --brand-purple-light: lab(84.6969% 7.22593 -22.5047);
  --brand-subtle: lab(95.9053% .399023 -1.45465);
  --primary-foreground: lab(100% 0 0);
  --brand-green-dark: lab(69.0434% -55.8896 36.097);
  --color-slate-500: lab(48.0876% -2.03595 -16.5814);
  --text-base--line-height: calc(1.5 / 1);
  --radius-4xl: 2rem;
  --brand-pink-light: lab(87.4504% 19.6 -6.46662);
  --color-gray-300: lab(85.1236% -.612259 -3.7138);
  --shadow-floating-xs: 0 0px 0px 1px lab(90.0141% .811607 -2.9353), 0 1px 1px -.5px #00000004, 0 3px 3px -1.5px #00000004, 0 6px 6px -3px #00000003, 0 12px 12px -6px #00000003, 0 24px 24px -12px #00000003;
  --brand-sugarplum: lab(85.8096% 16.1673 -21.1297);
  --color-slate-300: lab(84.7652% -1.94535 -7.93337);
  --brand-pink: lab(56.6128% 61.8515 -17.2101);
  --color-gray-500: lab(47.7841% -.393182 -10.0268);
  --brand-wash-inset: lab(95.2089% .398099 -1.45063);
  --text-9xl--line-height: 1;
  --color-white: #fff;
  --color-sky-600: lab(51.7754% -11.4712 -49.8349);
  --color-gray-400: lab(65.9269% -.832707 -8.17473);
  --color-slate-400: lab(65.5349% -2.25151 -14.5072);
  --color-elevated: lab(100% 0 0);
  --font-weight-bold: 700;
  --brand-nav-height: 3.25rem;
  --color-gray-100: lab(96.1596% -.0823438 -1.13575);
  --font-weight-extralight: 200;
  --text-xs--line-height: calc(1 / .75);
  --background-2: lab(97.9236% -.0000298023 .0000119209);
  --color-neutral-700: lab(27.036% 0 0);
  --color-violet-500: lab(49.9355% 55.1776 -81.8963);
  --color-sky-50: lab(97.3623% -2.33802 -4.13098);
  --brand-lemon-drop: lab(86.7251% 4.35641 86.0659);
  --brand-tangerine: lab(70.4162% 39.3003 76.2008);
  --radius-2xl: 1rem;
  --text-xl: 1.25rem;
  --color-neutral-900: lab(7.78201% -.0000149012 0);
  --text-xxs: .625rem;
  --shadow-floating-2xs: 0 0px 0px 1px lab(90.0141% .811607 -2.9353), 0 1px 1px -.5px #00000003, 0 3px 3px -1.5px #00000002, 0 6px 6px -3px #00000002;
  --text-9xl: 8rem;
  --accent: lab(97.7989% -4.33886 -3.1122);
  --brand-black: lab(16.9485% -.359461 -2.29235);
  --color-slate-800: lab(16.132% -.318035 -14.6672);
  --color-sky-400: lab(70.687% -23.6078 -45.9483);
  --text-2xl--line-height: calc(2 / 1.5);
  --color-slate-600: lab(35.5623% -1.74978 -15.4316);
  --secondary-foreground: lab(1.90607% .255175 -5.34102);
  --spacing: .25rem;
  --background: lab(98.84% .0000298023 -.0000119209);
  --brand-section-bg: lab(97.9679% .263125 -.96122);
  --brand-blue-dark: lab(51.1849% -.736505 -58.5723);
  --brand-body-muted: lab(40.5553% 1.4677 -5.14094);
  --text-xl--line-height: calc(1.75 / 1.25);
  --text-sm: .875rem;
  --color-emerald-500: lab(66.9756% -58.27 19.5419);
  --brand-bubblegum: lab(63.3509% 69.0464 -10.506);
  --color-yellow-50: lab(98.6846% -1.79055 9.7766);
  --color-rose-700: lab(41.1651% 71.6251 30.3087);
}
```

## Components present

- sticky nav
- hero with cta

## Notes for the agent

- **Adapt, don't copy.** The type ramp is a *starting point*. Scale it to your project's base size; preserve the *ratio*, not the literal pixels.
- **Color roles are heuristic** (luminance + dominance). Verify against the source URL before committing tokens.
- **Spacing** assumes a constant base step; round detected values to your project's scale (4 / 8 / 16) when implementing.
- **CSS variables** dumped above (when present) are the source's *actual* tokens - those are higher signal than guesses.
- This page's macrostructure is **Marquee Hero**.

---

*Generated by Inspo. Open source under MIT, owned and operated by [Together AI](https://www.together.ai). Original site copyright remains with its authors.*