import { useRef, useEffect } from 'react';
import type { LoadedImage } from '../utils/imageLoader';

interface CropPreviewProps {
  image: LoadedImage;
  points: number[];
  orientation: 0 | 90 | 180 | 270;
}

export function CropPreview({ image, points, orientation }: CropPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // TL, TR, BR, BL
    const minX = Math.min(points[0], points[2], points[4], points[6]);
    const maxX = Math.max(points[0], points[2], points[4], points[6]);
    const minY = Math.min(points[1], points[3], points[5], points[7]);
    const maxY = Math.max(points[1], points[3], points[5], points[7]);

    const sourceWidth = maxX - minX;
    const sourceHeight = maxY - minY;

    if (sourceWidth <= 0 || sourceHeight <= 0) return;

    // Set preview size (fixed height for horizontal strip)
    const previewHeight = 120;
    const aspectRatio = sourceWidth / sourceHeight;
    
    // We need to account for rotation when calculating canvas dimensions
    let targetWidth: number;
    let targetHeight: number;

    if (orientation === 90 || orientation === 270) {
      targetHeight = previewHeight;
      targetWidth = previewHeight / aspectRatio;
    } else {
      targetHeight = previewHeight;
      targetWidth = previewHeight * aspectRatio;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Move to center to rotate
    // If orientation is 90 (top points right), we rotate -90 (or 270) to fix it.
    ctx.translate(canvas.width / 2, canvas.height / 2);
    const fixRotation = (360 - orientation) % 360;
    ctx.rotate((fixRotation * Math.PI) / 180);

    // Draw image centered
    // drawW/drawH map source proportions (sw/sh) to the rotated coordinate system.
    // When rotated 90/270, the roles of horizontal/vertical are swapped.
    const drawW = (orientation === 90 || orientation === 270) ? targetHeight : targetWidth;
    const drawH = (orientation === 90 || orientation === 270) ? targetWidth : targetHeight;

    ctx.drawImage(
      image.element,
      minX, minY, sourceWidth, sourceHeight,
      -drawW / 2, -drawH / 2, drawW, drawH
    );

    ctx.restore();
  }, [image, points, orientation]);

  return (
    <canvas 
      ref={canvasRef} 
      className="rounded bg-neutral-900 shadow-md border border-neutral-800"
    />
  );
}
