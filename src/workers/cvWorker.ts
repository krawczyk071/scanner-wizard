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

  const H = gray.rows;
  const W = gray.cols;

  const allCandidates: any[] = [];

  // ── Strategy: Multiple Channels ───────────────────────────────────────────
  // Process Grayscale, Red, Green, and Blue channels separately
  const channels = new cv.MatVector();
  cv.split(resized, channels);
  
  const matsToProcess = [gray];
  if (channels.size() >= 3) {
    matsToProcess.push(channels.get(0), channels.get(1), channels.get(2));
  }

  for (const mat of matsToProcess) {
    // Apply CLAHE to each channel
    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
    const eq = new cv.Mat();
    clahe.apply(mat, eq);
    clahe.delete();

    const blurred = new cv.Mat();
    cv.GaussianBlur(eq, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    eq.delete();

    // Try multiple adaptive block sizes
    const blockSizes = [41, 81, 121];
    for (const blockSize of blockSizes) {
      const adaptive = new cv.Mat();
      cv.adaptiveThreshold(blurred, adaptive, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, 2);
      
      // Minimal border clear
      const bp = 5;
      cv.rectangle(adaptive, new cv.Point(0, 0), new cv.Point(W, bp), [0, 0, 0, 255], -1);
      cv.rectangle(adaptive, new cv.Point(0, 0), new cv.Point(bp, H), [0, 0, 0, 255], -1);
      cv.rectangle(adaptive, new cv.Point(0, H - bp), new cv.Point(W, H), [0, 0, 0, 255], -1);
      cv.rectangle(adaptive, new cv.Point(W - bp, 0), new cv.Point(W, H), [0, 0, 0, 255], -1);

      const ctrs = new cv.MatVector();
      const hier = new cv.Mat();
      cv.findContours(adaptive, ctrs, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      for (let i = 0; i < ctrs.size(); ++i) {
        const area = cv.contourArea(ctrs.get(i));
        if (area > (W * H * 0.01)) {
          allCandidates.push({ area, br: cv.boundingRect(ctrs.get(i)) });
        }
      }
      adaptive.delete(); ctrs.delete(); hier.delete();
    }
    blurred.delete();
  }

  channels.delete();

  // ── Smart Merging & Deduplication ────────────────────────────────────────
  function dedupAndMerge(candidates: any[]): any[] {
    candidates.sort((a, b) => b.area - a.area);
    const result: any[] = [];

    for (const cand of candidates) {
      let merged = false;
      for (const existing of result) {
        const ix1 = Math.max(cand.br.x, existing.br.x);
        const iy1 = Math.max(cand.br.y, existing.br.y);
        const ix2 = Math.min(cand.br.x + cand.br.width, existing.br.x + existing.br.width);
        const iy2 = Math.min(cand.br.y + cand.br.height, existing.br.y + existing.br.height);
        
        if (ix2 > ix1 && iy2 > iy1) {
          const overlapArea = (ix2 - ix1) * (iy2 - iy1);
          const smallerArea = Math.min(cand.area, existing.area);
          if (overlapArea > smallerArea * 0.5) {
            const x1 = Math.min(cand.br.x, existing.br.x);
            const y1 = Math.min(cand.br.y, existing.br.y);
            const x2 = Math.max(cand.br.x + cand.br.width, existing.br.x + existing.br.width);
            const y2 = Math.max(cand.br.y + cand.br.height, existing.br.y + existing.br.height);
            existing.br = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
            existing.area = existing.br.width * existing.br.height;
            merged = true;
            break;
          }
        }
      }
      if (!merged) result.push(cand);
    }
    return result;
  }

  const unique = dedupAndMerge(allCandidates);

  // ── Size Consensus ──────────────────────────────────────────────────────
  let final = unique;
  if (unique.length > 0) {
    const areas = unique.map(c => c.area).sort((a, b) => a - b);
    let bestMedian = areas[0];
    let maxCount = 0;
    for (const a of areas) {
      const count = areas.filter(other => Math.abs(other - a) / a <= 0.35).length;
      if (count >= maxCount) {
        maxCount = count;
        bestMedian = a;
      }
    }
    
    final = unique.filter(c => {
        const ratio = c.area / bestMedian;
        return (ratio >= 0.6 && ratio <= 1.4) || (ratio >= 1.6 && ratio <= 2.4) || (ratio >= 2.6 && ratio <= 3.4);
    });
    
    const splitFinal: any[] = [];
    for (const c of final) {
        const ratio = c.area / bestMedian;
        if (ratio >= 1.6 && ratio <= 2.4) {
            if (c.br.width > c.br.height) {
                splitFinal.push({ ...c, br: { ...c.br, width: c.br.width / 2 } });
                splitFinal.push({ ...c, br: { ...c.br, x: c.br.x + c.br.width / 2, width: c.br.width / 2 } });
            } else {
                splitFinal.push({ ...c, br: { ...c.br, height: c.br.height / 2 } });
                splitFinal.push({ ...c, br: { ...c.br, y: c.br.y + c.br.height / 2, height: c.br.height / 2 } });
            }
        } else if (ratio >= 2.6 && ratio <= 3.4) {
            const dim = c.br.width > c.br.height ? 'width' : 'height';
            const offset = c.br.width > c.br.height ? 'x' : 'y';
            const size = c.br[dim] / 3;
            for (let k = 0; k < 3; k++) {
                const newC = { ...c, br: { ...c.br } };
                newC.br[dim] = size;
                newC.br[offset] = c.br[offset] + k * size;
                splitFinal.push(newC);
            }
        } else {
            splitFinal.push(c);
        }
    }
    final = splitFinal;
  }

  const refined = final.map((c: any) => {
    const tight = refineBox(c.br, gray, true, W, H); // Assume light bg for refinement
    return { points: brToPoints(tight, scale), orientation: 0 as 0 | 90 | 180 | 270 };
  });

  resized.delete(); gray.delete();
  return refined;
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
  const thresh = bgIsLight ? 215 : 40;
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

  const pad = 2;
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
