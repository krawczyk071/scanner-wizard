const { createCanvas, loadImage } = require('canvas');
const cv = require('@techstark/opencv-js');

async function processImage(imagePath) {
  console.log(`\n--- Processing ${imagePath} ---`);
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);

  const src = new cv.Mat(image.height, image.width, cv.CV_8UC4);
  src.data.set(imageData.data);

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

  const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
  const equalized = new cv.Mat();
  clahe.apply(gray, equalized);
  clahe.delete();

  const blurred = new cv.Mat();
  cv.GaussianBlur(equalized, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

  const H = blurred.rows;
  const W = blurred.cols;

  const tmpBright = new cv.Mat();
  const tmpDark = new cv.Mat();
  cv.threshold(blurred, tmpBright, 220, 255, cv.THRESH_BINARY);
  cv.threshold(blurred, tmpDark, 35, 255, cv.THRESH_BINARY_INV);
  const nBright = cv.countNonZero(tmpBright);
  const nDark = cv.countNonZero(tmpDark);
  tmpBright.delete(); tmpDark.delete();
  const bgIsLight = nBright >= nDark;

  const allCandidates = [];

  function extractFromMask(mask, candidates, W, H) {
    const bp = 15;
    cv.rectangle(mask, new cv.Point(0, 0), new cv.Point(W, bp), [0, 0, 0, 255], -1);
    cv.rectangle(mask, new cv.Point(0, 0), new cv.Point(bp, H), [0, 0, 0, 255], -1);
    cv.rectangle(mask, new cv.Point(0, H - bp), new cv.Point(W, H), [0, 0, 0, 255], -1);
    cv.rectangle(mask, new cv.Point(W - bp, 0), new cv.Point(W, H), [0, 0, 0, 255], -1);

    const ctrs = new cv.MatVector();
    const hier = new cv.Mat();
    cv.findContours(mask, ctrs, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < ctrs.size(); ++i) {
      const c = ctrs.get(i);
      const area = cv.contourArea(c);
      if (area > (W * H * 0.01)) {
        const br = cv.boundingRect(c);
        candidates.push({ area, br });
      }
    }
    ctrs.delete(); hier.delete();
  }

  const blockSizes = [31, 61, 91, 121, 151];
  for (const blockSize of blockSizes) {
    const adaptive = new cv.Mat();
    cv.adaptiveThreshold(blurred, adaptive, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, 2);
    extractFromMask(adaptive, allCandidates, W, H);
    adaptive.delete();
  }

  const otsu = new cv.Mat();
  cv.threshold(blurred, otsu, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  extractFromMask(otsu, allCandidates, W, H);
  otsu.delete();

  function dedupAndMerge(candidates) {
    candidates.sort((a, b) => b.area - a.area);
    const result = [];
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
          if (overlapArea > smallerArea * 0.6) {
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
    
    const final = unique.filter(c => {
        const ratio = c.area / bestMedian;
        return (ratio >= 0.6 && ratio <= 1.4) || (ratio >= 1.6 && ratio <= 2.4) || (ratio >= 2.6 && ratio <= 3.4);
    });
    
    const splitFinal = [];
    for (const c of final) {
        const ratio = c.area / bestMedian;
        if (ratio >= 1.6 && ratio <= 2.4) {
            splitFinal.push({ ...c, area: c.area / 2 });
            splitFinal.push({ ...c, area: c.area / 2 });
        } else if (ratio >= 2.6 && ratio <= 3.4) {
            splitFinal.push({ ...c, area: c.area / 3 });
            splitFinal.push({ ...c, area: c.area / 3 });
            splitFinal.push({ ...c, area: c.area / 3 });
        } else {
            splitFinal.push(c);
        }
    }
    console.log(`OpenCV: Final regions: ${splitFinal.length}`);
  }

  resized.delete(); gray.delete(); equalized.delete(); blurred.delete();
}

async function main() {
  cv.onRuntimeInitialized = async () => {
    await processImage('context/four.jpg');
    await processImage('context/five.jpg');
    process.exit(0);
  };
}

main().catch(console.error);
