import heic2any from 'heic2any';
import UTIF from 'utif';

export interface LoadedImage {
  element: HTMLImageElement;
  width: number;
  height: number;
  fileSize: number;
  fileName: string;
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  const isTiff = file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

  let objectUrl: string;

  try {
    if (isTiff) {
      objectUrl = await processTiff(file);
    } else if (isHeic) {
      objectUrl = await processHeic(file);
    } else {
      // Normal browser-supported images (JPEG, PNG, WebP)
      objectUrl = URL.createObjectURL(file);
    }
  } catch (err) {
    throw new Error(`Failed to process image: ${err}`);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        element: img,
        width: img.width,
        height: img.height,
        fileSize: file.size,
        fileName: file.name,
      });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${err}`));
    };
    img.src = objectUrl;
  });
}

async function processHeic(file: File): Promise<string> {
  // Convert HEIC to PNG/JPEG blob via heic2any
  try {
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    
    // heic2any can return an array of blobs or a single blob
    const resultBlob = Array.isArray(converted) ? converted[0] : converted;
    return URL.createObjectURL(resultBlob);
  } catch (err) {
    throw new Error(`Failed to decode HEIC image: ${err}`);
  }
}

async function processTiff(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  
  if (ifds.length === 0) {
    throw new Error('No IFDs found in TIFF file.');
  }

  const ifd = ifds[0];
  UTIF.decodeImage(buffer, ifd);
  
  const rgba = UTIF.toRGBA8(ifd);
  
  const width = ifd.width;
  const height = ifd.height;
  
  // Use offscreen canvas to convert ImageData back into a data URL
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get 2D context for TIFF rendering');
  }

  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  ctx.putImageData(imageData, 0, 0);
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error('Failed to create Blob from TIFF canvas'));
      }
    }, 'image/png');
  });
}
