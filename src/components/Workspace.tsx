import { Stage, Layer, Image as KonvaImage, Group, Line as KonvaLine, Rect as KonvaRect, Circle as KonvaCircle } from 'react-konva';
import type { LoadedImage } from '../utils/imageLoader';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { RefreshCw, Loader2, Plus, Minus, Info, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CropPreview } from './CropPreview';
import { PhotoMetaPanel } from './PhotoMetaPanel';
import { exportPhoto } from '../utils/exportUtils';

interface Selection {
  id: string;
  points: number[]; // 8 points [x1, y1, x2, y2, x3, y3, x4, y4]
  isManual?: boolean;
  metadata?: {
    date?: string;
    city?: string;
    orientation: 0 | 90 | 180 | 270;
  };
}

interface WorkspaceProps {
  image: LoadedImage | null;
}

export function Workspace({ image }: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [rects, setRects] = useState<Selection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRectStart, setNewRectStart] = useState<{ x: number, y: number } | null>(null);
  const [newRectEnd, setNewRectEnd] = useState<{ x: number, y: number } | null>(null);

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
        const autoRects: Selection[] = payload.rects.map((r: any) => ({
          id: uuidv4(),
          points: r.points,
          isManual: false,
          metadata: {
            orientation: r.orientation || 0
          }
        }));
        
        // Preserve manual selections
        setRects(prev => [
          ...prev.filter(r => r.isManual),
          ...autoRects
        ]);
        
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

  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const resetZoom = useCallback(() => {
    if (!image || !dimensions.width) return;
    const padding = 40;
    const scaleXWithPadding = (dimensions.width - padding * 2) / image.width;
    const scaleYWithPadding = (dimensions.height - padding * 2) / image.height;
    const initialScale = Math.max(0.05, Math.min(scaleXWithPadding, scaleYWithPadding, 1));
    
    setStageScale(initialScale);
    setStagePos({
      x: (dimensions.width - image.width * initialScale) / 2,
      y: (dimensions.height - image.height * initialScale) / 2,
    });
  }, [image, dimensions]);

  // Initial fit
  useEffect(() => {
    resetZoom();
  }, [image, dimensions.width]); // Reset on image change or container resize

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.05, Math.min(20, newScale));

    setStageScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  const handleZoom = (factor: number) => {
    const oldScale = stageScale;
    const newScale = oldScale * factor;
    const clampedScale = Math.max(0.05, Math.min(20, newScale));
    
    // Zoom relative to center of view
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    
    const mousePointTo = {
      x: (centerX - stagePos.x) / oldScale,
      y: (centerY - stagePos.y) / oldScale,
    };

    setStageScale(clampedScale);
    setStagePos({
      x: centerX - mousePointTo.x * clampedScale,
      y: centerY - mousePointTo.y * clampedScale,
    });
  };

  if (!image) {
    return null;
  }

  const fileSizeMB = (image.fileSize / (1024 * 1024)).toFixed(2);

  const handleMouseDown = (e: any) => {
    // If panning (Space pressed), don't start drawing
    if (isSpacePressed) return;

    const clickedOnEmpty = e.target === e.target.getStage() || e.target.index === 0;
    if (clickedOnEmpty) {
      setSelectedId(null);
      
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      const localPos = {
        x: (pos.x - stagePos.x) / stageScale,
        y: (pos.y - stagePos.y) / stageScale
      };
      
      const constrainedX = Math.max(0, Math.min(image.width, localPos.x));
      const constrainedY = Math.max(0, Math.min(image.height, localPos.y));
      
      setIsDrawing(true);
      setNewRectStart({ x: constrainedX, y: constrainedY });
      setNewRectEnd({ x: constrainedX, y: constrainedY });
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !newRectStart) return;
    
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const localPos = {
      x: (pos.x - stagePos.x) / stageScale,
      y: (pos.y - stagePos.y) / stageScale
    };
    
    const constrainedX = Math.max(0, Math.min(image.width, localPos.x));
    const constrainedY = Math.max(0, Math.min(image.height, localPos.y));
    
    setNewRectEnd({ x: constrainedX, y: constrainedY });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !newRectStart || !newRectEnd) {
      setIsDrawing(false);
      return;
    }
    
    const x1 = newRectStart.x;
    const y1 = newRectStart.y;
    const x2 = newRectEnd.x;
    const y2 = newRectEnd.y;
    
    if (Math.abs(x1 - x2) > 5 && Math.abs(y1 - y2) > 5) {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      
      const newSelection: Selection = {
        id: uuidv4(),
        points: [minX, minY, maxX, minY, maxX, maxY, minX, maxY],
        isManual: true,
        metadata: {
          orientation: 0
        }
      };
      
      setRects([...rects, newSelection]);
      setSelectedId(newSelection.id);
    }
    
    setIsDrawing(false);
    setNewRectStart(null);
    setNewRectEnd(null);
  };

  const deleteSelection = (id: string) => {
    setRects(rects.filter(r => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateSelection = (id: string, newPoints: number[]) => {
    setRects(rects.map(r => r.id === id ? { ...r, points: newPoints } : r));
  };

  const updateMetadata = (id: string, metadata: any) => {
    setRects(rects.map(r => r.id === id ? { ...r, metadata } : r));
  };

  const handleExport = async (selection: Selection) => {
    if (!image) return;
    try {
      await exportPhoto(image, selection.points, {
        date: selection.metadata?.date,
        city: selection.metadata?.city,
        orientation: selection.metadata?.orientation || 0
      });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed for selection ' + selection.id);
    }
  };

  const handleExportAll = async () => {
    if (!image || rects.length === 0) return;
    
    // Validate dates
    const invalidCount = rects.filter(r => !r.metadata?.date || !/^\d{6}$/.test(r.metadata.date)).length;
    if (invalidCount > 0) {
      if (!confirm(`Warning: ${invalidCount} selection(s) are missing a valid date. Export anyway?`)) {
        return;
      }
    }

    for (const r of rects) {
      await handleExport(r);
      // Small delay between downloads to prevent browser blocking/congestion
      await new Promise(res => setTimeout(res, 500));
    }
  };

  const selectedSelection = useMemo(() => rects.find(r => r.id === selectedId), [rects, selectedId]);

  return (
    <div className="flex flex-col w-full h-full relative">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-sm text-neutral-300 shrink-0">
        <div className="font-semibold truncate max-w-md" title={image.fileName}>{image.fileName}</div>
        
        <div className="flex items-center gap-6">
          <div className="flex gap-4 opacity-75 hidden sm:flex">
            <span>{image.width} × {image.height} px</span>
            <span>{fileSizeMB} MB</span>
            <span>{(stageScale * 100).toFixed(0)}%</span>
            <span>{rects.length} selections</span>
          </div>
          
          <button 
            onClick={runDetection}
            disabled={detecting}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-200 border border-neutral-700 rounded-md transition-colors font-medium"
          >
            {detecting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {detecting ? 'Detecting...' : 'Re-detect'}
          </button>

          <button 
            onClick={handleExportAll}
            disabled={rects.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-md transition-colors font-bold border-none"
          >
            <Download size={16} />
            Export All
          </button>
        </div>
      </div>
      
      <div className={`flex-1 w-full bg-neutral-950 overflow-hidden relative ${isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`} ref={containerRef}>
        <Stage 
          width={dimensions.width} 
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          draggable={isSpacePressed}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) {
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }
          }}
        >
          <Layer>
            <Group>
              <KonvaImage image={image.element} />
              
              {rects.map((r) => (
                <SelectionItem 
                  key={r.id}
                  selection={r}
                  imageWidth={image.width}
                  imageHeight={image.height}
                  isSelected={selectedId === r.id}
                  onSelect={() => setSelectedId(r.id)}
                  onDelete={() => deleteSelection(r.id)}
                  onChange={(newPoints) => updateSelection(r.id, newPoints)}
                  finalScale={stageScale}
                />
              ))}

              {isDrawing && newRectStart && newRectEnd && (
                <KonvaRect
                  x={Math.min(newRectStart.x, newRectEnd.x)}
                  y={Math.min(newRectStart.y, newRectEnd.y)}
                  width={Math.abs(newRectStart.x - newRectEnd.x)}
                  height={Math.abs(newRectStart.y - newRectEnd.y)}
                  stroke="#3b82f6"
                  strokeWidth={2 / stageScale}
                  dash={[10 / stageScale, 5 / stageScale]}
                />
              )}
            </Group>
          </Layer>
        </Stage>

        {/* Metadata Panel */}
        {selectedSelection && (
          <div className="absolute top-4 right-4 z-20">
            <PhotoMetaPanel 
              metadata={selectedSelection.metadata || { orientation: 0 }}
              onChange={(m) => updateMetadata(selectedSelection.id, m)}
              onClose={() => setSelectedId(null)}
              onExport={() => handleExport(selectedSelection)}
            />
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
          <div className="flex flex-col bg-neutral-900/90 backdrop-blur border border-neutral-700 rounded-lg overflow-hidden shadow-2xl">
            <button 
              onClick={() => handleZoom(1.5)}
              className="p-3 hover:bg-neutral-800 text-neutral-300 transition-colors border-none"
              title="Zoom In"
            >
              <Plus size={20} />
            </button>
            <div className="h-px bg-neutral-700 w-full" />
            <button 
              onClick={() => handleZoom(1/1.5)}
              className="p-3 hover:bg-neutral-800 text-neutral-300 transition-colors border-none"
              title="Zoom Out"
            >
              <Minus size={20} />
            </button>
            <div className="h-px bg-neutral-700 w-full" />
            <button 
              onClick={resetZoom}
              className="p-3 hover:bg-neutral-800 text-neutral-300 transition-colors border-none text-xs font-bold"
              title="Fit to Screen"
            >
              FIT
            </button>
          </div>
          <div className="bg-neutral-900/90 backdrop-blur border border-neutral-700 rounded-lg px-2 py-1 text-[10px] text-neutral-500 text-center font-mono">
           HOLD SPACE TO PAN
          </div>
        </div>
      </div>

      {/* Preview Strip */}
      {rects.length > 0 && (
        <div className="h-44 w-full bg-neutral-900 border-t border-neutral-800 flex items-center px-4 gap-4 overflow-x-auto shrink-0">
          {rects.map((r) => (
            <div 
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`flex flex-col gap-1 cursor-pointer transition-all ${selectedId === r.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900 rounded scale-105' : 'opacity-80 hover:opacity-100 hover:scale-[1.02]'}`}
            >
              <CropPreview 
                image={image}
                points={r.points}
                orientation={r.metadata?.orientation || 0}
              />
              <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400 px-1 uppercase tracking-tight">
                <span>{r.metadata?.date || 'NO DATE'}</span>
                {r.metadata?.city && <span className="truncate max-w-[60px]">{r.metadata.city}</span>}
              </div>
            </div>
          ))}
          <div className="text-neutral-600 flex flex-col items-center justify-center h-[120px] px-8 text-center border-2 border-dashed border-neutral-800 rounded">
            <Info size={20} className="mb-1 opacity-20" />
            <span className="text-[10px] uppercase font-bold opacity-30">Selection Previews</span>
          </div>
        </div>
      )}
    </div>
  );
}


interface SelectionItemProps {
  selection: Selection;
  imageWidth: number;
  imageHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onChange: (points: number[]) => void;
  finalScale: number;
}

function SelectionItem({ selection, imageWidth, imageHeight, isSelected, onSelect, onDelete, onChange, finalScale }: SelectionItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Derive bounding box for easier handling of axis-aligned rects
  const { points } = selection;
  const x = Math.min(points[0], points[2], points[4], points[6]);
  const y = Math.min(points[1], points[3], points[5], points[7]);
  const width = Math.max(points[0], points[2], points[4], points[6]) - x;
  const height = Math.max(points[1], points[3], points[5], points[7]) - y;

  const handleDragEnd = (e: any) => {
    if (e.target !== e.currentTarget) return; // Ignore bubbling from handles

    const dx = e.target.x();
    const dy = e.target.y();

    // Reset group position
    e.target.x(0);
    e.target.y(0);

    const clampedDx = Math.max(-x, Math.min(imageWidth - width - x, dx));
    const clampedDy = Math.max(-y, Math.min(imageHeight - height - y, dy));

    onChange(points.map((p, i) => i % 2 === 0 ? p + clampedDx : p + clampedDy));
  };

  const handleResize = (handleIndex: number, newX: number, newY: number) => {
    const p = [...points];
    
    // Constrain to image bounds
    const cx = Math.max(0, Math.min(imageWidth, newX));
    const cy = Math.max(0, Math.min(imageHeight, newY));

    // Update corner and adjacent corners to keep it a rectangle
    // TL:0,1  TR:2,3  BR:4,5  BL:6,7
    if (handleIndex === 0) { // top-left
      p[0] = cx; p[1] = cy;
      p[3] = cy; p[6] = cx;
    } else if (handleIndex === 1) { // top-right
      p[2] = cx; p[3] = cy;
      p[1] = cy; p[4] = cx;
    } else if (handleIndex === 2) { // bottom-right
      p[4] = cx; p[5] = cy;
      p[7] = cy; p[2] = cx;
    } else if (handleIndex === 3) { // bottom-left
      p[6] = cx; p[7] = cy;
      p[5] = cy; p[0] = cx;
    }

    onChange(p); // Live update WITHOUT normalization while dragging
  };

  const handleResizeEnd = () => {
    // Normalize coordinates ONCE at the end to TL, TR, BR, BL
    const p = points;
    const minX = Math.min(p[0], p[2], p[4], p[6]);
    const maxX = Math.max(p[0], p[2], p[4], p[6]);
    const minY = Math.min(p[1], p[3], p[5], p[7]);
    const maxY = Math.max(p[1], p[3], p[5], p[7]);

    onChange([
      minX, minY,
      maxX, minY,
      maxX, maxY,
      minX, maxY
    ]);
  };

  const handleSize = 8 / finalScale;
  const corners = [
    { x: points[0], y: points[1] },
    { x: points[2], y: points[3] },
    { x: points[4], y: points[5] },
    { x: points[6], y: points[7] }
  ];

  return (
    <Group 
      draggable={true}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
    >
      <KonvaLine
        points={points}
        closed={true}
        stroke={isSelected ? "#60a5fa" : (isHovered ? "#3b82f6" : "#3b82f6")}
        strokeWidth={(isSelected ? 6 : 4) / finalScale}
        fill={isSelected ? "rgba(59, 130, 246, 0.2)" : (isHovered ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)")}
        tension={0}
      />
      
      {isSelected && corners.map((c, i) => (
        <KonvaCircle
          key={i}
          x={c.x}
          y={c.y}
          radius={handleSize}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={2 / finalScale}
          draggable
          onDragMove={(e) => {
            handleResize(i, e.target.x(), e.target.y());
          }}
          onDragEnd={(e) => {
            // Circle onDragEnd also bubbles, but handleResizeEnd handles it
            e.cancelBubble = true;
            handleResizeEnd();
          }}
          onMouseDown={(e) => {
             e.cancelBubble = true; // Don't trigger Group mousedown when clicking handles
          }}
        />
      ))}

      {(isSelected || isHovered) && (
        <Group
          x={points[2]} // Top-right x
          y={points[3]} // Top-right y
          offsetY={isSelected ? 40 / finalScale : 30 / finalScale}
          offsetX={isSelected ? -10 / finalScale : -10 / finalScale}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete();
          }}
          onMouseDown={(e) => { e.cancelBubble = true; }} // Prevent selection when clicking delete
          className="cursor-pointer"
        >
           <KonvaRect
             width={24 / finalScale}
             height={24 / finalScale}
             fill="#ef4444"
             cornerRadius={4 / finalScale}
             shadowBlur={5 / finalScale}
             shadowOpacity={0.3}
           />
           {/* Visual "X" on the delete button */}
           <KonvaLine
             points={[
               6 / finalScale, 6 / finalScale,
               18 / finalScale, 18 / finalScale
             ]}
             stroke="white"
             strokeWidth={2 / finalScale}
           />
           <KonvaLine
             points={[
               18 / finalScale, 6 / finalScale,
               6 / finalScale, 18 / finalScale
             ]}
             stroke="white"
             strokeWidth={2 / finalScale}
           />
        </Group>
      )}
    </Group>
  );
}

