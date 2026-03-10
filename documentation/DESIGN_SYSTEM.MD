# DESIGN_SYSTEM.md
# Scanned Photo Splitter — UI Design Guide

## Design Direction

This app handles analog memories — old photos, physical prints, the texture of the past. The UI should feel like a **precision darkroom tool**: focused, calm, and purposeful, with warmth borrowed from archival and editorial photography aesthetics. Think analog craft meets modern utility.

**Aesthetic keywords:** Editorial dark mode · Archival warmth · Precision tooling · Quiet confidence

**What to avoid:** Generic SaaS blue-on-white · Purple gradient AI aesthetics · Flashy consumer app energy · Cluttered toolbars

---

## Color Palette

Use CSS custom properties everywhere. No hardcoded hex values in component code.

```css
:root {
  /* Backgrounds — dark, warm-toned, layered */
  --color-bg-base:       #0f0e0d;   /* near-black with warm undertone */
  --color-bg-surface:    #1a1917;   /* primary card/panel background */
  --color-bg-elevated:   #252320;   /* dropdowns, tooltips, overlays */
  --color-bg-subtle:     #2e2c29;   /* hover states, input backgrounds */

  /* Borders */
  --color-border-default: #3a3733;
  --color-border-subtle:  #2a2826;
  --color-border-strong:  #55524d;

  /* Text */
  --color-text-primary:   #f0ece4;   /* warm white — main readable text */
  --color-text-secondary: #a09a91;   /* labels, secondary info */
  --color-text-muted:     #6b6560;   /* placeholders, disabled states */
  --color-text-inverse:   #0f0e0d;   /* text on light accent backgrounds */

  /* Accent — amber/warm gold as the signature color */
  --color-accent:         #d4a853;   /* primary interactive accent */
  --color-accent-hover:   #e0b96a;
  --color-accent-muted:   #2a2215;   /* tinted background for accent elements */
  --color-accent-border:  #4a3a1a;

  /* Semantic */
  --color-success:        #5a9e6f;
  --color-success-muted:  #0f2018;
  --color-error:          #c45c4a;
  --color-error-muted:    #2a100d;
  --color-warning:        #c49a3a;

  /* Selection overlay on canvas */
  --color-selection:      rgba(212, 168, 83, 0.35);
  --color-selection-border: rgba(212, 168, 83, 0.85);
  --color-selection-handle: #d4a853;
}
```

---

## Typography

Two typefaces — one with archival character, one precise and legible for UI.

```css
/* Import in index.html or global CSS */
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Mono:wght@300;400;500&display=swap');

:root {
  /* Display / Headings — Lora has editorial, archival warmth */
  --font-display: 'Lora', Georgia, serif;

  /* UI / Body / Labels — DM Mono for a precise, tool-like feel */
  --font-ui: 'DM Mono', 'Courier New', monospace;

  /* Scale */
  --text-xs:   11px;
  --text-sm:   12px;
  --text-base: 14px;
  --text-md:   16px;
  --text-lg:   20px;
  --text-xl:   26px;
  --text-2xl:  34px;

  /* Weight */
  --font-normal:  400;
  --font-medium:  500;
  --font-semibold: 600;

  /* Line height */
  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.7;

  /* Letter spacing */
  --tracking-tight:  -0.02em;
  --tracking-normal:  0;
  --tracking-wide:    0.06em;
  --tracking-widest:  0.12em;
}
```

**Typography rules:**
- App title and section headers → `--font-display`, italic weight for flair
- All UI labels, inputs, buttons, metadata fields → `--font-ui`
- Uppercase labels always use `--tracking-widest` and `--text-xs`
- Never mix more than these two typefaces

---

## Spacing & Layout

```css
:root {
  /* Base unit: 4px */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Border radius */
  --radius-sm:   3px;
  --radius-md:   6px;
  --radius-lg:   10px;
  --radius-pill: 999px;

  /* Layout */
  --sidebar-width: 300px;
  --toolbar-height: 52px;
  --preview-strip-height: 180px;
  --canvas-min-height: 480px;
}
```

**Layout structure:**
```
┌─────────────────────────────────────────────────────┐
│  TOOLBAR (52px)  — logo · file actions · export btn │
├──────────────────────────────┬──────────────────────┤
│                              │                      │
│   CANVAS AREA                │  SIDEBAR             │
│   (react-konva Stage)        │  (300px fixed)       │
│                              │  — selection list    │
│                              │  — active meta panel │
│                              │                      │
├──────────────────────────────┴──────────────────────┤
│  PREVIEW STRIP (180px) — thumbnails for all crops   │
└─────────────────────────────────────────────────────┘
```

---

## Component Patterns

### Buttons

```css
/* Base button */
.btn {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
  transition: all 120ms ease;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

/* Primary — accent filled */
.btn-primary {
  background: var(--color-accent);
  color: var(--color-text-inverse);
  border-color: var(--color-accent);
}
.btn-primary:hover {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
}

/* Secondary — ghost with border */
.btn-secondary {
  background: transparent;
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}
.btn-secondary:hover {
  background: var(--color-bg-subtle);
  border-color: var(--color-border-strong);
}

/* Ghost — no border */
.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border-color: transparent;
}
.btn-ghost:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-subtle);
}

/* Danger */
.btn-danger {
  background: transparent;
  color: var(--color-error);
  border-color: var(--color-error);
}
.btn-danger:hover {
  background: var(--color-error-muted);
}

/* Disabled state — applies to all variants */
.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Icon-only square button */
.btn-icon {
  padding: var(--space-2);
  width: 32px;
  height: 32px;
  justify-content: center;
}
```

---

### Inputs & Form Fields

```css
.field-label {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
  color: var(--color-text-secondary);
  display: block;
  margin-bottom: var(--space-2);
}

.field-input {
  font-family: var(--font-ui);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  width: 100%;
  outline: none;
  transition: border-color 100ms ease, box-shadow 100ms ease;
}

.field-input::placeholder {
  color: var(--color-text-muted);
}

.field-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-muted);
}

.field-input.error {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px var(--color-error-muted);
}

.field-hint {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.field-error {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  color: var(--color-error);
  margin-top: var(--space-1);
}
```

---

### Orientation Selector

The four-button orientation picker should feel like a camera control — tactile and precise.

```css
.orientation-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-1);
  width: fit-content;
}

.orientation-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 100ms ease;
  font-size: 16px;
}

.orientation-btn:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}

.orientation-btn.active {
  background: var(--color-accent-muted);
  border-color: var(--color-accent-border);
  color: var(--color-accent);
}
```

**Orientation button layout:**
```
[ ↑ ] [ ↑ rotated 90° → ]
[ ↓ ] [ ← ]
```
Use SVG arrows, not Unicode characters. Rotate a single arrow SVG with CSS `transform: rotate()` for each variant.

---

### Sidebar Panel (Metadata)

```css
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-bg-surface);
  border-left: 1px solid var(--color-border-subtle);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-section {
  padding: var(--space-5) var(--space-5);
  border-bottom: 1px solid var(--color-border-subtle);
}

.sidebar-section-title {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

/* Selection list item in sidebar */
.selection-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 100ms ease;
}

.selection-item:hover {
  background: var(--color-bg-subtle);
}

.selection-item.active {
  background: var(--color-accent-muted);
}

.selection-item-number {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  color: var(--color-accent);
  min-width: 20px;
}

.selection-item-date {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  flex: 1;
}

.selection-item-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border-strong);  /* incomplete */
}

.selection-item-status.complete {
  background: var(--color-success);
}
```

---

### Preview Strip

```css
.preview-strip {
  height: var(--preview-strip-height);
  background: var(--color-bg-base);
  border-top: 1px solid var(--color-border-subtle);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-5);
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;
}

.preview-thumb {
  flex-shrink: 0;
  height: 130px;
  aspect-ratio: auto;   /* varies by photo */
  max-width: 200px;
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border-default);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 120ms ease, transform 120ms ease;
  position: relative;
}

.preview-thumb:hover {
  border-color: var(--color-border-strong);
  transform: translateY(-2px);
}

.preview-thumb.active {
  border-color: var(--color-accent);
}

.preview-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Badge showing selection number */
.preview-thumb-badge {
  position: absolute;
  top: var(--space-1);
  left: var(--space-1);
  background: rgba(15, 14, 13, 0.75);
  color: var(--color-accent);
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  backdrop-filter: blur(4px);
}
```

---

### Toolbar

```css
.toolbar {
  height: var(--toolbar-height);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  align-items: center;
  padding: 0 var(--space-5);
  gap: var(--space-4);
  position: relative;
  z-index: 10;
}

.toolbar-logo {
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-style: italic;
  color: var(--color-text-primary);
  letter-spacing: var(--tracking-tight);
  margin-right: var(--space-4);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border-subtle);
}

.toolbar-spacer {
  flex: 1;
}

/* Mode indicator pill */
.mode-pill {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-accent-muted);
  color: var(--color-accent);
  border: 1px solid var(--color-accent-border);
}
```

---

### Canvas Selection Overlays (React-Konva)

Apply these values to Konva shapes — not CSS.

```js
// Inactive selection rect
{
  stroke: 'rgba(212, 168, 83, 0.5)',
  strokeWidth: 1.5,
  fill: 'rgba(212, 168, 83, 0.08)',
  dash: [6, 4],
}

// Active / selected rect
{
  stroke: 'rgba(212, 168, 83, 0.9)',
  strokeWidth: 2,
  fill: 'rgba(212, 168, 83, 0.15)',
  dash: [],
}

// Corner handle circle
{
  radius: 5,
  fill: '#d4a853',
  stroke: '#0f0e0d',
  strokeWidth: 1.5,
}

// Auto-detected (not yet confirmed by user)
{
  stroke: 'rgba(90, 158, 111, 0.6)',
  strokeWidth: 1.5,
  fill: 'rgba(90, 158, 111, 0.08)',
  dash: [4, 4],
}
```

---

### Loading & Empty States

```css
/* Full-area loading overlay */
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-surface);
  gap: var(--space-4);
  z-index: 20;
}

.loading-label {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--color-text-muted);
}

/* Dropzone empty state */
.dropzone {
  border: 1.5px dashed var(--color-border-default);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  min-height: 320px;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;
}

.dropzone:hover,
.dropzone.drag-over {
  border-color: var(--color-accent-border);
  background: var(--color-accent-muted);
}

.dropzone-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-style: italic;
  color: var(--color-text-primary);
  letter-spacing: var(--tracking-tight);
}

.dropzone-subtitle {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-align: center;
}

.dropzone-formats {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--color-text-muted);
}
```

---

### Toast Notifications

```css
.toast-container {
  position: fixed;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 100;
  pointer-events: none;
}

.toast {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-pill);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-primary);
  backdrop-filter: blur(8px);
  animation: toast-in 200ms ease forwards;
  white-space: nowrap;
}

.toast.success { border-color: var(--color-success); color: var(--color-success); }
.toast.error   { border-color: var(--color-error);   color: var(--color-error);   }

@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## Motion & Animation

Keep animation purposeful. Every transition should communicate state, not decorate it.

```css
:root {
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-enter:    cubic-bezier(0, 0, 0.2, 1);
  --ease-exit:     cubic-bezier(0.4, 0, 1, 1);

  --duration-fast:   80ms;
  --duration-normal: 150ms;
  --duration-slow:   250ms;
}

/* Sidebar panel fade-in when a selection becomes active */
.meta-panel-enter {
  animation: panel-enter 200ms var(--ease-enter) forwards;
}
@keyframes panel-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Preview thumbnail appear */
@keyframes thumb-appear {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
.preview-thumb {
  animation: thumb-appear 180ms var(--ease-enter) forwards;
}

/* Spinner for OpenCV loading */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border-strong);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}
```

**Animation rules:**
- UI transitions: `--duration-fast` (80ms) — hover states, button presses
- Panel/element appearing: `--duration-normal` (150ms)
- Complex reveals: `--duration-slow` (250ms)
- Never animate layout-affecting properties (width, height) — use `transform` and `opacity` only
- Respect `prefers-reduced-motion` — wrap all decorative animations in a media query

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Icons

Use **Lucide React** (`lucide-react`) throughout. Never use emoji as icons in UI.

```js
// Recommended icon set for this app
import {
  Upload,         // load scan
  ScanLine,       // auto-detect action
  Crop,           // manual crop mode
  RotateCw,       // orientation
  RotateCcw,
  Trash2,         // delete selection
  Download,       // export
  Check,          // complete state
  AlertCircle,    // error
  Loader2,        // loading spinner (animate-spin)
  ChevronRight,   // navigation
  Image,          // photo / empty state
} from 'lucide-react'
```

Icon sizing:
- Toolbar: 16px
- Sidebar labels: 14px
- Empty states: 40px (use `color: var(--color-text-muted)`)
- In buttons: 14px, same color as button label

---

## Scrollbars

```css
* {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;
}
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover { background: var(--color-text-muted); }
```

---

## Global Base Styles

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  overflow: hidden;  /* app is a fixed-layout tool, no page scroll */
}

body {
  font-family: var(--font-ui);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-text-primary);
  background: var(--color-bg-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

::selection {
  background: var(--color-accent-muted);
  color: var(--color-accent);
}

a {
  color: var(--color-accent);
  text-decoration: none;
}

a:hover {
  color: var(--color-accent-hover);
}
```

---

## Do / Don't Quick Reference

| ✅ Do | ❌ Don't |
|---|---|
| Use `--font-display` italic for headings | Use system fonts or Inter/Roboto |
| Use amber/gold as the sole accent color | Introduce blue, purple, or teal |
| Dark warm backgrounds throughout | Use white or light-mode surfaces |
| Uppercase, spaced-out labels in DM Mono | Use sentence-case for UI labels |
| Subtle dashed overlays on canvas | Thick opaque selection boxes |
| Animate `opacity` and `transform` only | Animate `width`, `height`, or `color` directly |
| Keep the canvas area clean and uncluttered | Add floating toolbars over the canvas |
| Show status with small colored dots | Use large badges or bold status text |
| Lucide icons at consistent 14–16px | Emoji, or mixing icon families |
| Validate on blur + on export attempt | Validate aggressively on every keystroke |