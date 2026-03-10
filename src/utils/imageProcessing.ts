/**
 * Auto Levels (Contrast Stretching) with percentile-based clipping.
 * This function redistributes the tonal range so that the darkest meaningful
 * pixels become pure black (0) and the brightest become pure white (255).
 * 
 * By using a small clipping percentage (e.g., 0.5%), we ignore outliers
 * like single hot pixels or sensor noise that would otherwise prevent
 * effective stretching.
 */
export function applyAutoLevels(ctx: CanvasRenderingContext2D, width: number, height: number, clipPercent: number = 0.5) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const numPixels = width * height;

  // 1. Create histograms for each channel
  const histR = new Uint32Array(256);
  const histG = new Uint32Array(256);
  const histB = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    histR[data[i]]++;
    histG[data[i + 1]]++;
    histB[data[i + 2]]++;
  }

  // 2. Find "meaningful" min/max using percentiles
  const clipCount = Math.floor(numPixels * (clipPercent / 100));

  const findThresholds = (hist: Uint32Array) => {
    let low = 0, high = 255;
    
    // Find low threshold
    let count = 0;
    for (let i = 0; i < 256; i++) {
      count += hist[i];
      if (count > clipCount) {
        low = i;
        break;
      }
    }

    // Find high threshold
    count = 0;
    for (let i = 255; i >= 0; i--) {
      count += hist[i];
      if (count > clipCount) {
        high = i;
        break;
      }
    }

    return { low, high };
  };

  const rangeR = findThresholds(histR);
  const rangeG = findThresholds(histG);
  const rangeB = findThresholds(histB);

  // 3. Stretch and clip
  // Formula: out = (in - low) / (high - low) * 255
  for (let i = 0; i < data.length; i += 4) {
    // Red
    const r = ((data[i] - rangeR.low) / (rangeR.high - rangeR.low || 1)) * 255;
    data[i] = Math.max(0, Math.min(255, r));

    // Green
    const g = ((data[i + 1] - rangeG.low) / (rangeG.high - rangeG.low || 1)) * 255;
    data[i + 1] = Math.max(0, Math.min(255, g));

    // Blue
    const b = ((data[i + 2] - rangeB.low) / (rangeB.high - rangeB.low || 1)) * 255;
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  ctx.putImageData(imageData, 0, 0);
}
