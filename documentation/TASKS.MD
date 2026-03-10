# TASKS: Scanned Photo Splitter

Tasks are grouped by phase. Work through them roughly in order — each phase builds on the last.

---

## Phase 1 — Project Scaffold

- [ ] Init Vite + React project (`npm create vite@latest`)
- [ ] Install core dependencies: `react-konva`, `konva`, `piexifjs`
- [ ] Install TIFF decoder: `utif` or `tiff.js`
- [ ] Set up Tailwind CSS (or preferred styling approach)
- [ ] Create basic folder structure: `/components`, `/hooks`, `/utils`, `/workers`
- [ ] Configure Vite to serve OpenCV.js WASM correctly (set `optimizeDeps.exclude` or copy to `/public`)
- [ ] Confirm OpenCV.js loads in browser and `cv` is accessible; add loading state

---

## Phase 2 — Image Loading

- [ ] Build `ImageDropzone` component — accepts drag-and-drop and file picker
- [ ] Support JPEG, PNG, and TIFF input formats
- [ ] For TIFF: decode with `utif` → convert raw pixel buffer → draw to offscreen canvas → extract as PNG data URL
- [ ] Display loaded scan on a `react-konva` `Stage` scaled to fit the viewport
- [ ] Store original image dimensions and scale factor in app state
- [ ] Show file metadata (name, dimensions, size) in a small info bar

---

## Phase 3 — Auto Photo Detection

- [ ] Move OpenCV processing into a Web Worker to avoid blocking UI
- [ ] Pass image data to worker; run grayscale → blur → edge detection → contour finding pipeline
- [ ] Filter contours by: minimum area, aspect ratio plausibility, rectangularity score
- [ ] Return detected bounding rectangles (possibly rotated) to main thread
- [ ] Render each detection as a `react-konva` `Rect` with corner handles
- [ ] Add a "Re-detect" button that reruns detection on the current image

---

## Phase 4 — Manual Selection & Adjustment

- [ ] Implement two-corner manual selection mode: click point A → click point B → create rect
- [ ] Make existing rects draggable (move entire selection)
- [ ] Make corner handles draggable (resize selection)
- [ ] Add per-selection delete button (visible on hover or selection)
- [ ] Highlight the active/selected region distinctly from inactive ones
- [ ] Constrain selections to within image bounds

---

## Phase 5 — Metadata Panel & Preview

- [ ] Build `PhotoMetaPanel` component tied to each selection
- [ ] Date field: text input, validate `DDMMYY` format (check day/month ranges), show inline error
- [ ] City field: optional free-text input
- [ ] Orientation selector: 4-button group with arrow icons (↑ → ↓ ←); store as 0 / 90 / 180 / 270 degrees
- [ ] Wire orientation auto-detect from OpenCV (use image moments or simple heuristic); pre-fill selector
- [ ] Build `CropPreview` component: extract the crop region from the canvas, apply CSS or canvas rotation, render as thumbnail
- [ ] Arrange previews in a horizontal strip below the main canvas, one per selection
- [ ] Keep previews live-updating as the user adjusts bounds or orientation

---

## Phase 6 — Export

- [ ] Build `exportPhoto(selection, metadata, format)` utility function
- [ ] Use `canvas.drawImage` with source rect to extract the crop
- [ ] Apply rotation transform to the export canvas based on orientation value
- [ ] Parse `DDMMYY` string → full `Date` object → ISO string for EXIF `DateTimeOriginal`
- [ ] Write EXIF using `piexifjs`: `DateTimeOriginal`, `ImageDescription` (city), `Orientation: 1`
- [ ] For PNG exports: embed city + date in a PNG `tEXt` chunk or skip EXIF with a console note
- [ ] Generate filename: `YYYYMMDD_XXXX.ext` (random 4-digit suffix via `Math.random`)
- [ ] Trigger browser download via `URL.createObjectURL` + synthetic `<a>` click
- [ ] Add "Export All" button that iterates all selections and downloads each file
- [ ] Validate all required fields (date) before export; surface errors on incomplete selections

---

## Phase 7 — Polish & Edge Cases

- [ ] Loading spinner / progress bar while OpenCV.js initializes
- [ ] Handle oversized images gracefully (warn if > 100MB; consider downscaling for detection only)
- [ ] Show empty state clearly when no scan is loaded
- [ ] Keyboard shortcut: `Delete` key removes selected region
- [ ] Prevent export if no selections exist
- [ ] Test with: portrait photos, landscape photos, mixed orientations, photos with borders, photos placed at angles
- [ ] Test EXIF output in macOS Preview, Windows Photos, and Exiftool
- [ ] Test TIFF import with a real flatbed scanner output file
- [ ] Basic responsive layout so the app is usable at 1280px wide minimum

---

## Stretch / Nice-to-Have

- [ ] "Smart snap" — snap selection corners to detected edges when dragging near them
- [ ] Zoom in/out on the main canvas for precise corner placement
- [ ] Duplicate a selection (useful for photos that are nearly identical in position)
- [ ] Per-selection notes field (stored in EXIF `UserComment`)
- [ ] Keyboard navigation between selections (Tab / Shift+Tab)