import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type { LoadedImage } from '../utils/imageLoader';
import { useEffect, useRef, useState } from 'react';

interface WorkspaceProps {
  image: LoadedImage | null;
}

export function Workspace({ image }: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    // Initial size update
    updateSize();
    
    // Add event listener
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  if (!image) {
    return null;
  }

  const padding = 40;
  const scaleXWithPadding = (dimensions.width - padding * 2) / image.width;
  const scaleYWithPadding = (dimensions.height - padding * 2) / image.height;
  
  // Calculate final scale, defaulting to 1x if it perfectly fits, else scale down.
  // Don't scale above 1.0 (100%) so small images don't get pixelated
  const finalScale = Math.max(0.05, Math.min(scaleXWithPadding, scaleYWithPadding, 1));

  // Center the image stage in the container
  const x = (dimensions.width - image.width * finalScale) / 2;
  const y = (dimensions.height - image.height * finalScale) / 2;

  const fileSizeMB = (image.fileSize / (1024 * 1024)).toFixed(2);

  return (
    <div className="flex flex-col w-full h-full relative">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-sm text-neutral-300 shrink-0">
        <div className="font-semibold truncate max-w-md" title={image.fileName}>{image.fileName}</div>
        <div className="flex gap-4">
          <span>{image.width} × {image.height} px</span>
          <span>{fileSizeMB} MB</span>
          <span>{(finalScale * 100).toFixed(0)}%</span>
        </div>
      </div>
      
      <div className="flex-1 w-full bg-neutral-950 overflow-hidden" ref={containerRef}>
        <Stage width={dimensions.width} height={dimensions.height}>
          <Layer>
            <KonvaImage
              image={image.element}
              x={x}
              y={y}
              scaleX={finalScale}
              scaleY={finalScale}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
