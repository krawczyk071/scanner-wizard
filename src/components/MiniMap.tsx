import { useEffect, useRef } from 'react';
import type { LoadedImage } from '../utils/imageLoader';
import type { Selection } from '../types/workspace';

interface MiniMapProps {
  image: LoadedImage;
  rects: Selection[];
  selectedId: string | null;
}

export function MiniMap({ image, rects, selectedId }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set dimensions keeping aspect ratio
    const maxWidth = 232; // Container width minus padding
    const maxHeight = 160;
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
    
    canvas.width = image.width * ratio;
    canvas.height = image.height * ratio;

    // Draw original image
    ctx.drawImage(image.element, 0, 0, canvas.width, canvas.height);

    // Draw all rects
    rects.forEach(r => {
      const isSelected = r.id === selectedId;
      const p = r.points;
      
      // Calculate bounds in original image coordinates
      const minX = Math.min(p[0], p[2], p[4], p[6]);
      const maxX = Math.max(p[0], p[2], p[4], p[6]);
      const minY = Math.min(p[1], p[3], p[5], p[7]);
      const maxY = Math.max(p[1], p[3], p[5], p[7]);

      // Scale to canvas
      const x = minX * ratio;
      const y = minY * ratio;
      const w = (maxX - minX) * ratio;
      const h = (maxY - minY) * ratio;

      if (isSelected) {
        // Highlight selected
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(x, y, w, h);
      } else {
        // Subtle outline for others
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
      }
      ctx.strokeRect(x, y, w, h);
    });
  }, [image, rects, selectedId]);

  return (
    <div className="flex flex-col gap-2 p-3 bg-neutral-900 border-b border-neutral-800">
      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Scan Overview</span>
      <div className="relative rounded overflow-hidden bg-neutral-950 border border-neutral-800 flex items-center justify-center">
        <canvas 
          ref={canvasRef} 
          className="max-w-full h-auto shadow-lg"
        />
      </div>
    </div>
  );
}
