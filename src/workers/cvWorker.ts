/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-explicit-any */

declare var cv: any;
declare function importScripts(...urls: string[]): void;

self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    // Determine the base path for loading OpenCV based on whether we are in dev or prod
    const cvUrl = 'https://docs.opencv.org/4.10.0/opencv.js';
    importScripts(cvUrl);

    // Wait for OpenCV WASM to initialize
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

  const gray = new cv.Mat();
  cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY, 0);

  const blurred = new cv.Mat();
  const ksize = new cv.Size(5, 5);
  cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

  // 1. Canny Edge Detection
  const edges = new cv.Mat();
  // Lower thresholds to catch more subtle edges
  cv.Canny(blurred, edges, 30, 100, 3, false);

  // 2. Morphological closing to thicken and connect edges
  const closing = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  cv.morphologyEx(edges, closing, cv.MORPH_CLOSE, kernel);
  
  // 3. Find Contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(closing, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const imgArea = resized.cols * resized.rows;
  let candidates = [];
  const minArea = imgArea * 0.01; // Back to 1%
  const maxArea = imgArea * 0.95;

  for (let i = 0; i < contours.size(); ++i) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    
    if (area > minArea && area < maxArea) {
      const rect = cv.minAreaRect(contour);
      const rectArea = rect.size.width * rect.size.height;
      const extent = area / rectArea;

      const hull = new cv.Mat();
      cv.convexHull(contour, hull);
      const hullArea = cv.contourArea(hull);
      const solidity = area / hullArea;
      hull.delete();

      const aspect = Math.max(rect.size.width, rect.size.height) / Math.min(rect.size.width, rect.size.height);

      // Log why we might be rejecting candidates
      if (area > imgArea * 0.05) {
          console.log(`OpenCV: Candidate Area: ${(area/imgArea*100).toFixed(1)}%, Solidity: ${solidity.toFixed(2)}, Extent: ${extent.toFixed(2)}, Aspect: ${aspect.toFixed(1)}`);
      }

      // Slightly looser filters
      if (solidity > 0.7 && extent > 0.5 && aspect < 6.0) {
          candidates.push({
              area,
              rect,
              points: getPoints(rect, scale)
          });
      }
    }
  }

  // 4. Deduplicate Overlapping Rects (Strict containment check)
  candidates.sort((a, b) => b.area - a.area);
  const finalCandidates = [];
  
  for (const cand of candidates) {
    let isDuplicate = false;
    for (const existing of finalCandidates) {
        const dx = Math.abs(cand.rect.center.x - existing.rect.center.x);
        const dy = Math.abs(cand.rect.center.y - existing.rect.center.y);
        
        // If center is inside, or they are very close
        if ((dx < existing.rect.size.width / 2 && dy < existing.rect.size.height / 2) || 
            (dx < 20 && dy < 20)) {
            isDuplicate = true;
            break;
        }
    }
    if (!isDuplicate) finalCandidates.push(cand);
  }

  console.log(`OpenCV: Found ${finalCandidates.length} photo regions.`);
  // Cleanup
  src.delete();
  resized.delete();
  gray.delete();
  blurred.delete();
  edges.delete();
  closing.delete();
  kernel.delete();
  contours.delete();
  hierarchy.delete();

  return finalCandidates.map(c => {
    // Simple orientation heuristic: if width > height, assume it's landscape (90 or 270)
    // For now, let's just use 0 as default but we could improve this.
    // If we want to be smart: if aspect ratio > 1.2, maybe it's 90?
    // Let's just default to 0 but show where we'd add it.
    let orientation: 0 | 90 | 180 | 270 = 0;
    if (c.rect.size.width > c.rect.size.height) {
      // Landscape-ish. 
      // We don't know if it's 90 or 270 without content analysis.
      // But usually, scans are upright but photos might be rotated.
    }

    return { 
      points: c.points,
      orientation
    };
  });
}

function getPoints(rect: any, scale: number) {
    const angle = (rect.angle * Math.PI) / 180;
    const w2 = rect.size.width / 2;
    const h2 = rect.size.height / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const corners = [
        { x: -w2, y: -h2 },
        { x:  w2, y: -h2 },
        { x:  w2, y:  h2 },
        { x: -w2, y:  h2 }
    ];
    
    const points: number[] = [];
    corners.forEach(p => {
        const rx = p.x * cos - p.y * sin + rect.center.x;
        const ry = p.x * sin + p.y * cos + rect.center.y;
        points.push(rx / scale);
        points.push(ry / scale);
    });
    return points;
}
