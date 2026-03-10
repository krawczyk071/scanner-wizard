import { Stage, Layer, Image as KonvaImage, Group, Rect as KonvaRect } from 'react-konva';
import type { LoadedImage } from '../utils/imageLoader';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';

interface WorkspaceProps {
  image: LoadedImage | null;
}

export function Workspace({ image }: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [rects, setRects] = useState<any[]>([]);
  const [detecting, setDetecting] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const runDetection = () => {
    if (!image) return;
    setDetecting(true);
    
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    const worker = new Worker(new URL('../workers/cvWorker.ts', import.meta.url));
    workerRef.current = worker;
    
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'READY') {
        // Extract raw ImageData to send to the worker
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(image.element, 0, 0);
          const imageData = ctx.getImageData(0, 0, image.width, image.height);
          worker.postMessage({ type: 'PROCESS_IMAGE', payload: { imageData } });
        }
      } else if (type === 'RESULT') {
        setRects(payload.rects);
        setDetecting(false);
        worker.terminate();
      } else if (type === 'ERROR') {
        console.error('CV Error:', payload.message);
        setDetecting(false);
        worker.terminate();
      }
    };

    worker.postMessage({ type: 'INIT' });
  };

  useEffect(() => {
    runDetection();
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, [image]);

  if (!image) {
    return null;
  }

  const padding = 40;
  const scaleXWithPadding = (dimensions.width - padding * 2) / image.width;
  const scaleYWithPadding = (dimensions.height - padding * 2) / image.height;
  
  const finalScale = Math.max(0.05, Math.min(scaleXWithPadding, scaleYWithPadding, 1));
  const x = (dimensions.width - image.width * finalScale) / 2;
  const y = (dimensions.height - image.height * finalScale) / 2;
  const fileSizeMB = (image.fileSize / (1024 * 1024)).toFixed(2);

  return (
    <div className="flex flex-col w-full h-full relative">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-sm text-neutral-300 shrink-0">
        <div className="font-semibold truncate max-w-md" title={image.fileName}>{image.fileName}</div>
        
        <div className="flex items-center gap-6">
          <div className="flex gap-4 opacity-75 hidden sm:flex">
            <span>{image.width} × {image.height} px</span>
            <span>{fileSizeMB} MB</span>
            <span>{(finalScale * 100).toFixed(0)}%</span>
            <span>{rects.length} detected</span>
          </div>
          
          <button 
            onClick={runDetection}
            disabled={detecting}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-md transition-colors font-medium border-none"
          >
            {detecting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {detecting ? 'Detecting...' : 'Re-detect'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 w-full bg-neutral-950 overflow-hidden" ref={containerRef}>
        <Stage width={dimensions.width} height={dimensions.height}>
          <Layer>
            <Group x={x} y={y} scaleX={finalScale} scaleY={finalScale}>
              <KonvaImage image={image.element} />
              
              {rects.map((r, i) => (
                <KonvaRect
                  key={i}
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  offsetX={r.width / 2}
                  offsetY={r.height / 2}
                  rotation={r.angle}
                  stroke="#3b82f6" // blue-500
                  strokeWidth={4 / finalScale} // keep border fixed width visually
                  fill="rgba(59, 130, 246, 0.1)"
                />
              ))}
            </Group>
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
