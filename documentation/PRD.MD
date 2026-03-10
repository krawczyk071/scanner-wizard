# PRD: Scanned Photo Splitter

## Overview

A browser-based tool for splitting flatbed scanner output — a single image containing multiple physical photos — into individual, properly oriented, and metadata-tagged image files. The app combines automatic photo detection with manual correction tools, and embeds user-supplied metadata into exported files via EXIF.

---

## Problem Statement

Flatbed scanners often capture several physical photos in one pass. Manually cropping, rotating, and renaming each photo is time-consuming and error-prone. There's no good lightweight browser tool that handles the full workflow: detect → adjust → annotate → export.

---

## Goals

- Automatically detect individual photos within a scanned image
- Allow users to manually correct, add, or remove detected regions
- Capture per-photo metadata (date, city, orientation) at selection time
- Embed metadata into exported files as EXIF data
- Export files with a consistent, date-based naming convention
- Run entirely in the browser — no installation, no server

---

## Out of Scope

- Multi-scan batch processing (one scan file per session)
- Cloud storage or sync
- Undo/redo history
- Photo enhancement (color correction, dust removal, etc.)
- Mobile-optimized layout (desktop browser is the primary target)

---

## User Flow

1. **Load scan** — user drops or selects a scan file (JPEG, PNG, or TIFF)
2. **Auto-detection** — OpenCV.js analyzes the image and draws bounding regions around detected photos
3. **Review & adjust** — user inspects each detected region; can drag corners, delete false positives, or manually define new regions by clicking two opposite diagonal corners
4. **Annotate** — for each selected region, the user fills in:
   - **Date taken** (required): 6-digit format `DDMMYY`, e.g. `030591` = May 3, 1991
   - **City** (optional): free-text field
   - **Orientation**: visual selector with four arrow buttons (0°, 90°, 180°, 270°); app auto-detects a default, user can override
5. **Preview** — a corrected preview of each crop (with orientation applied) is shown below the main canvas as the user works through selections
6. **Export** — user chooses output format (JPEG or PNG) and triggers export; each photo is saved with EXIF metadata embedded

---

## Feature Details

### Photo Detection (OpenCV.js)

- On image load, run contour/edge detection to find rectangular regions likely to be photos
- Each detected region is rendered as an adjustable overlay on the main canvas (via React-Konva)
- Detection sensitivity is not exposed as a slider — instead, users correct results manually

### Manual Selection

- User clicks two diagonally opposite corners to define a rectangular crop region
- Corner handles are draggable for fine-tuning after placement
- Selections can be deleted individually

### Per-Photo Metadata Panel

Each active selection has an associated panel (displayed below the main canvas) containing:

| Field | Type | Required | Notes |
|---|---|---|---|
| Date Taken | Text input | Yes | `DDMMYY` format; validated on export |
| City | Text input | No | Free text |
| Orientation | Button group | Yes | 4 options: ↑ ↓ ← →; default from auto-detect |

### Orientation Handling

- App attempts to auto-detect orientation using OpenCV.js heuristics
- User can override via the orientation selector
- Orientation is applied to the preview and baked into the exported image (pixels are rotated, not just flagged in EXIF)

### Preview

- A live-updating thumbnail for each selection is shown below the main canvas
- Thumbnail reflects the current crop bounds and orientation
- Thumbnails are arranged in a horizontal or grid strip, one per selection

### Export

- User selects output format: JPEG or PNG
- Each photo is exported as a separate file
- EXIF fields written on export:
  - `DateTimeOriginal` — parsed from the `DDMMYY` input
  - `ImageDescription` or `UserComment` — city, if provided
  - Standard orientation tag (value 1 / normal, since pixels are already rotated)
- **Filename format:** `YYYYMMDD_XXXX.ext` where `XXXX` is a random 4-digit number
  - Example: `19910503_4872.jpg`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React + Vite |
| Canvas / UI | React-Konva |
| Computer Vision | OpenCV.js (WASM, loaded async) |
| EXIF writing | `piexifjs` or `exifr` (write-capable fork) |
| File handling | Browser File API + `canvas.toBlob()` |
| Styling | TBD (Tailwind CSS recommended) |

### Key Technical Considerations

- **OpenCV.js load time**: The WASM binary is large (~8MB). Show a loading indicator and defer detection until it's ready.
- **TIFF support**: Native browser canvas does not support TIFF. Use `utif.js` or `tiff.js` to decode TIFF to a raw pixel buffer before passing to canvas/OpenCV.
- **EXIF writing in-browser**: Most EXIF libraries are read-only. `piexifjs` supports writing to JPEG. PNG does not natively support EXIF — use XMP metadata or a custom text chunk as a fallback for PNG exports.
- **Memory**: Large scans (300dpi+) can exceed 50MB as raw pixel data. Use `OffscreenCanvas` or Web Workers for OpenCV processing to avoid blocking the main thread.

---

## Non-Functional Requirements

- Works in current versions of Chrome, Firefox, and Edge (desktop)
- No data leaves the browser — all processing is client-side
- Handles scan files up to ~100MB without crashing
- Export of 10 photos from a single scan completes in under 30 seconds on a modern laptop

---

## Success Criteria

- A user can go from loading a scan to exporting all separated photos in under 5 minutes
- Auto-detection correctly identifies photos in at least 80% of typical scan layouts without manual adjustment
- Exported files open correctly in standard photo viewers with EXIF metadata readable