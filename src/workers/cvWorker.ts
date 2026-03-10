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
  const dst = new cv.Mat();
  const gray = new cv.Mat();

  // 1. Grayscale
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

  // 2. Blur to reduce noise
  const ksize = new cv.Size(5, 5);
  cv.GaussianBlur(gray, gray, ksize, 0, 0, cv.BORDER_DEFAULT);

  // 3. Edge Detection (Canny)
  // Adaptive thresholds could be better, but we'll use a standard wide range first
  cv.Canny(gray, dst, 50, 150, 3, false);

  // 4. Find Contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  // 5. Filter and calculate rects
  const detectedRects = [];
  const imgArea = imageData.width * imageData.height;
  
  // Enforce minimum and maximum photo sizes relative to the full flatbed scan area
  // Assuming a photo is at least 1% of the scanner area and max 95%
  const minArea = imgArea * 0.01;
  const maxArea = imgArea * 0.95;

  for (let i = 0; i < contours.size(); ++i) {
    const contour = contours.get(i);
    const rect = cv.minAreaRect(contour);
    
    // minAreaRect returns dimensions and an angle
    const width = rect.size.width;
    const height = rect.size.height;
    const area = width * height;

    if (area > minArea && area < maxArea) {
      // Very basic aspect ratio check (photos are typically 3:2, 4:3, 1:1, etc - not 10:1 or 1:10)
      const aspect = Math.max(width, height) / Math.min(width, height);
      if (aspect < 5.0) { // arbitrary loose threshold
          detectedRects.push({
            x: rect.center.x,
            y: rect.center.y,
            width: width,
            height: height,
            angle: rect.angle
          });
      }
    }
  }

  // Cleanup
  src.delete();
  dst.delete();
  gray.delete();
  contours.delete();
  hierarchy.delete();

  return detectedRects;
}
