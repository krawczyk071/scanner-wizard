import type { LoadedImage } from './imageLoader';
import { type Location } from './locationStorage';
import * as piexif from 'piexifjs';

interface ExportMetadata {
  date?: string;
  city?: string;
  location?: Location;
  orientation: 0 | 90 | 180 | 270;
}

export async function exportPhoto(
  image: LoadedImage,
  points: number[],
  metadata: ExportMetadata
): Promise<void> {
  const parseFullYear = (yy: string) => {
    const yearNum = parseInt(yy);
    const currentYear = new Date().getFullYear();
    const currentYY = currentYear % 100;
    const century = yearNum > currentYY ? 1900 : 2000;
    return (century + yearNum).toString();
  };

  const minX = Math.min(points[0], points[2], points[4], points[6]);
  const maxX = Math.max(points[0], points[2], points[4], points[6]);
  const minY = Math.min(points[1], points[3], points[5], points[7]);
  const maxY = Math.max(points[1], points[3], points[5], points[7]);

  const degToExifRational = (deg: number): [[number, number], [number, number], [number, number]] => {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60 * 100);
    return [[degrees, 1], [minutes, 1], [seconds, 100]];
  };

  const sourceWidth = maxX - minX;
  const sourceHeight = maxY - minY;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Invalid selection bounds');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const { orientation } = metadata;
  const isRotated = orientation === 90 || orientation === 270;

  // Set canvas dimensions based on orientation
  if (isRotated) {
    canvas.width = sourceHeight;
    canvas.height = sourceWidth;
  } else {
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  
  // Apply rotation
  // 0: no rotation
  // 90: rotate 90 deg clockwise (top points right)
  // 180: rotate 180 deg (upside down)
  // 270: rotate 270 deg clockwise (top points left)
  // Note: We rotate the canvas to "un-rotate" the image or follow the user preference.
  // Actually, the requirement says "Apply rotation transform to the export canvas based on orientation value".
  // If orientation is 90, it means the photo's "up" is currently pointing right.
  // So we should rotate the canvas -90 degrees (or 270) to make it upright?
  // Or if the user selected 90, maybe they WANT it rotated 90. 
  // Let's assume orientation is "how much we rotate the source to get the final image".
  // The Preview uses (360 - orientation) to fix it. Let's stick to that logic.
  const fixRotation = (360 - orientation) % 360;
  ctx.rotate((fixRotation * Math.PI) / 180);

  const drawW = isRotated ? canvas.height : canvas.width;
  const drawH = isRotated ? canvas.width : canvas.height;

  ctx.drawImage(
    image.element,
    minX, minY, sourceWidth, sourceHeight,
    -drawW / 2, -drawH / 2, drawW, drawH
  );
  ctx.restore();

  // Export to Blob/DataURL
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  let finalDataUrl = dataUrl;

  // Handle EXIF for JPEG
  try {
    const exifObj: any = { "0th": {}, "Exif": {}, "GPS": {} };

    // Orientation 1 is Horizontal (normal)
    exifObj["0th"][piexif.ImageIFD.Orientation] = 1;

    // Date
    if (metadata.date && /^\d{6}$/.test(metadata.date)) {
      const year = parseFullYear(metadata.date.substring(4, 6));
      const month = metadata.date.substring(2, 4);
      const day = metadata.date.substring(0, 2);
      const isoDate = `${year}:${month}:${day} 00:00:00`;
      exifObj["0th"][piexif.ImageIFD.DateTime] = isoDate;
      exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal] = isoDate;
    }

    // City / Description
    if (metadata.location?.city || metadata.city) {
      exifObj["0th"][piexif.ImageIFD.ImageDescription] = metadata.location?.city || metadata.city;
    }

    // GPS
    if (metadata.location) {
      const lat = metadata.location.lat;
      const lon = metadata.location.lon;
      
      exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
      exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = degToExifRational(lat);
      exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lon >= 0 ? "E" : "W";
      exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = degToExifRational(lon);
    }

    const exifStr = piexif.dump(exifObj);
    finalDataUrl = piexif.insert(exifStr, dataUrl);
  } catch (err) {
    console.error('Error writing EXIF:', err);
    // Fallback to original dataUrl if EXIF fails
  }

  // Trigger download
  const filename = generateFilename(metadata.date || 'unknown', 'jpg', parseFullYear);
  const link = document.createElement('a');
  link.download = filename;
  link.href = finalDataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateFilename(dateStr: string, ext: string, yearParser: (yy: string) => string): string {
  let datePart = '00000000';
  if (/^\d{6}$/.test(dateStr)) {
    const year = yearParser(dateStr.substring(4, 6));
    datePart = year + dateStr.substring(2, 4) + dateStr.substring(0, 2);
  }
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  return `${datePart}_${randomPart}.${ext}`;
}
