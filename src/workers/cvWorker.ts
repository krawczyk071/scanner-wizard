/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-explicit-any */

declare var cv: any;
declare function importScripts(...urls: string[]): void;

self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    const cvUrl = 'https://docs.opencv.org/4.10.0/opencv.js';
    importScripts(cvUrl);
    const waitForCv = () => {
      if (typeof cv !== 'undefined' && cv.Mat) {
        self.postMessage({ type: 'READY' });
      } else {
        setTimeout(waitForCv, 100);
      }
    };
    waitForCv();
  }

  if (type === 'PROCESS_IMAGE') {
    const { imageData } = payload;
    try {
      const rects = processImageContours(imageData);
      self.postMessage({ type: 'RESULT', payload: { rects } });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', payload: { message: err.toString() } });
    }
  }
};

function processImageContours(imageData: ImageData) {
  const src = cv.matFromImageData(imageData);

  const maxDim = 1000;
  let scale = 1.0;
  if (src.cols > maxDim || src.rows > maxDim) {
    scale = maxDim / Math.max(src.cols, src.rows);
  }

  const resized = new cv.Mat();
  cv.resize(src, resized, new cv.Size(), scale, scale, cv.INTER_AREA);
  src.delete();

  const gray = new cv.Mat();
  cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY, 0);

  const blurred = new cv.Mat();
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

  const H = blurred.rows;
  const W = blurred.cols;

  // ── Background detection via pixel histogram ──────────────────────────────
  // Count how many pixels are very bright (>220) vs very dark (<35).
  // This avoids the corner-sampling trap where dark scanner frames cause wrong detection.
  const tmpBright = new cv.Mat();
  const tmpDark = new cv.Mat();
  cv.threshold(blurred, tmpBright, 220, 255, cv.THRESH_BINARY);
  cv.threshold(blurred, tmpDark, 35, 255, cv.THRESH_BINARY_INV);
  const nBright = cv.countNonZero(tmpBright);
  const nDark = cv.countNonZero(tmpDark);
  tmpBright.delete(); tmpDark.delete();
  const bgIsLight = nBright >= nDark;
  console.log(`OpenCV: bright=${nBright} dark=${nDark} bg=${bgIsLight ? 'LIGHT' : 'DARK'}`);

  // ── Pass 1: Otsu Global Threshold ────────────────────────────────────────
  const otsu = new cv.Mat();
  if (bgIsLight) {
    cv.threshold(blurred, otsu, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  } else {
    cv.threshold(blurred, otsu, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
  }

  // MORPH_OPEN: break thin connections between scanner frame and photo content
  // (dark photo backgrounds can merge with the dark scanner border)
  const openKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(13, 13));
  const opened = new cv.Mat();
  cv.morphologyEx(otsu, opened, cv.MORPH_OPEN, openKernel);
  openKernel.delete();
  otsu.delete();

  // MORPH_CLOSE: fill holes within photos
  const closeKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(11, 11));
  const morphOtsu = new cv.Mat();
  cv.morphologyEx(opened, morphOtsu, cv.MORPH_CLOSE, closeKernel);
  opened.delete();

  // ── Pass 2: Adaptive threshold (catches light-colored photos) ────────────
  const adaptive = new cv.Mat();
  cv.adaptiveThreshold(blurred, adaptive, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 51, 3);

  // Use smaller close kernel for Adaptive to avoid merging adjacent photos
  const adaptiveClose = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
  const morphAdaptive = new cv.Mat();
  cv.morphologyEx(adaptive, morphAdaptive, cv.MORPH_CLOSE, adaptiveClose);
  adaptive.delete(); adaptiveClose.delete();

  // ── Thin border clear (5px) ───────────────────────────────────────────────
  const bp = 5;
  for (const mat of [morphOtsu, morphAdaptive]) {
    cv.rectangle(mat, new cv.Point(0, 0), new cv.Point(W, bp), [0, 0, 0, 255], -1);
    cv.rectangle(mat, new cv.Point(0, 0), new cv.Point(bp, H), [0, 0, 0, 255], -1);
    cv.rectangle(mat, new cv.Point(0, H - bp), new cv.Point(W, H), [0, 0, 0, 255], -1);
    cv.rectangle(mat, new cv.Point(W - bp, 0), new cv.Point(W, H), [0, 0, 0, 255], -1);
  }

  const imgArea = W * H;
  const minArea = imgArea * 0.03; // 3% minimum
  const maxArea = imgArea * 0.65; // 65% maximum

  function extractCandidates(mask: any): any[] {
    const ctrs = new cv.MatVector();
    const hier = new cv.Mat();
    cv.findContours(mask, ctrs, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const results: any[] = [];
    for (let i = 0; i < ctrs.size(); ++i) {
      const c = ctrs.get(i);
      const area = cv.contourArea(c);
      if (area > minArea && area < maxArea) {
        const br = cv.boundingRect(c);
        const hull = new cv.Mat();
        cv.convexHull(c, hull);
        const hullArea = cv.contourArea(hull);
        const solidity = area / hullArea;
        hull.delete();
        const extent = area / (br.width * br.height);
        const aspect = Math.max(br.width, br.height) / Math.min(br.width, br.height);
        console.log(`OpenCV: Cand area=${(area / imgArea * 100).toFixed(1)}% sol=${solidity.toFixed(2)} ext=${extent.toFixed(2)} asp=${aspect.toFixed(1)}`);
        if (solidity > 0.65 && extent > 0.60 && aspect < 5.0) {
          results.push({ area, br, points: brToPoints(br, scale) });
        }
      }
    }
    ctrs.delete(); hier.delete();
    return results;
  }

  const candidatesOtsu = extractCandidates(morphOtsu);
  const candidatesAdaptive = extractCandidates(morphAdaptive);
  console.log(`OpenCV: Otsu:${candidatesOtsu.length} Adaptive:${candidatesAdaptive.length}`);

  function overlaps(a: any, b: any, threshold: number): boolean {
    const ix1 = Math.max(a.br.x, b.br.x);
    const iy1 = Math.max(a.br.y, b.br.y);
    const ix2 = Math.min(a.br.x + a.br.width, b.br.x + b.br.width);
    const iy2 = Math.min(a.br.y + a.br.height, b.br.y + b.br.height);
    if (ix2 <= ix1 || iy2 <= iy1) return false;
    const overlapArea = (ix2 - ix1) * (iy2 - iy1);
    const smallerArea = Math.min(a.br.width * a.br.height, b.br.width * b.br.height);
    return overlapArea > smallerArea * threshold;
  }

  function dedup(candidates: any[]): any[] {
    candidates.sort((a, b) => b.area - a.area);
    const result: any[] = [];
    for (const c of candidates) {
      if (!result.some(e => overlaps(c, e, 0.35))) result.push(c);
    }
    return result;
  }

  // Combine all candidates and deduplicate — larger candidates win
  const all = [...candidatesOtsu, ...candidatesAdaptive];
  const final = dedup(all);
  console.log(`OpenCV: Final: ${final.length} photo regions.`);

  // ── Refine bounding boxes to remove white gap padding ────────────────────
  const refined = final.map((c: any) => {
    const tight = refineBox(c.br, gray, bgIsLight, W, H);
    return { ...c, br: tight, points: brToPoints(tight, scale) };
  });

  // Cleanup
  resized.delete(); gray.delete(); blurred.delete();
  morphOtsu.delete(); morphAdaptive.delete();
  closeKernel.delete();

  return refined.map(c => ({
    points: c.points,
    orientation: 0 as 0 | 90 | 180 | 270
  }));
}

function refineBox(br: any, gray: any, bgIsLight: boolean, imgW: number, imgH: number): any {
  const rx = Math.max(0, br.x);
  const ry = Math.max(0, br.y);
  const rw = Math.min(br.width, imgW - rx);
  const rh = Math.min(br.height, imgH - ry);
  if (rw <= 1 || rh <= 1) return br;

  const roiRect = new cv.Rect(rx, ry, rw, rh);
  const roi = gray.roi(roiRect);
  const mask = new cv.Mat();
  const thresh = bgIsLight ? 210 : 50;
  if (bgIsLight) {
    cv.threshold(roi, mask, thresh, 255, cv.THRESH_BINARY_INV);
  } else {
    cv.threshold(roi, mask, thresh, 255, cv.THRESH_BINARY);
  }

  const ctrs = new cv.MatVector();
  const hier = new cv.Mat();
  cv.findContours(mask, ctrs, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let x1 = rw, y1 = rh, x2 = 0, y2 = 0;
  let hasContent = false;
  for (let i = 0; i < ctrs.size(); ++i) {
    const c = ctrs.get(i);
    if (cv.contourArea(c) > 20) {
      const cb = cv.boundingRect(c);
      x1 = Math.min(x1, cb.x);
      y1 = Math.min(y1, cb.y);
      x2 = Math.max(x2, cb.x + cb.width);
      y2 = Math.max(y2, cb.y + cb.height);
      hasContent = true;
    }
  }
  roi.delete(); mask.delete(); ctrs.delete(); hier.delete();

  if (!hasContent || x2 <= x1 || y2 <= y1) return br;

  const pad = 4;
  return {
    x: Math.max(0, rx + x1 - pad),
    y: Math.max(0, ry + y1 - pad),
    width: Math.min(imgW - (rx + x1 - pad), x2 - x1 + pad * 2),
    height: Math.min(imgH - (ry + y1 - pad), y2 - y1 + pad * 2),
  };
}

function brToPoints(br: any, scale: number): number[] {
  const x1 = br.x / scale;
  const y1 = br.y / scale;
  const x2 = (br.x + br.width) / scale;
  const y2 = (br.y + br.height) / scale;
  return [x1, y1, x2, y1, x2, y2, x1, y2];
}
