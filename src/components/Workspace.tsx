import { Stage, Layer, Image as KonvaImage, Rect as KonvaRect } from 'react-konva';
import type { LoadedImage } from '../utils/imageLoader';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Plus, Minus, Info, Maximize } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { PhotoMetaPanel, type Metadata } from './PhotoMetaPanel';
import { LocationSettings } from './LocationSettings';
import { exportPhoto } from '../utils/exportUtils';
import type { Selection } from '../types/workspace';
import { SelectionItem } from './SelectionItem';
import { WorkspaceHeader } from './WorkspaceHeader';
import { QueuePanel } from './QueuePanel';
import { PreviewsPanel } from './PreviewsPanel';
import { SniperScope } from './SniperScope';
import type Konva from 'konva';

interface WorkspaceProps {
  image: LoadedImage;
  queue: File[];
  onNext: () => void;
}

export function Workspace({ image, queue, onNext }: WorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [rects, setRects] = useState<Selection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRectStart, setNewRectStart] = useState<{ x: number, y: number } | null>(null);
  const [newRectEnd, setNewRectEnd] = useState<{ x: number, y: number } | null>(null);
  
  const [showLocations, setShowLocations] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);

  const [globalMetadata, setGlobalMetadata] = useState<Metadata>({ orientation: 0 });

  // Sniper Scope state
  const [activeDragInfo, setActiveDragInfo] = useState<{
    selectionId: string;
    handleIndex: number;
    x: number;
    y: number;
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const runDetection = () => {
    if (!image) return;
    setDetecting(true);
    
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    const worker = new Worker(new URL('../workers/cvWorker.ts', import.meta.url));
    workerRef.current = worker;
    
    worker.onmessage = (e: MessageEvent) => {
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
        const autoRects: Selection[] = payload.rects.map((r: { points: number[]; orientation?: 0 | 90 | 180 | 270 }) => ({
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
    setTimeout(runDetection, 0);
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, [image]);


  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

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

  const deleteSelection = (id: string) => {
    setRects(rects.filter(r => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateSelection = (id: string, newPoints: number[]) => {
    setRects(rects.map(r => r.id === id ? { ...r, points: newPoints } : r));
  };

  const updateMetadata = useCallback((id: string, metadata: Metadata) => {
    setRects(prev => prev.map(r => r.id === id ? { ...r, metadata } : r));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(true);
      
      // Handle arrow keys for orientation if a selection is active
      if (selectedId && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        const orientationMap: Record<string, 0 | 90 | 180 | 270> = {
          'ArrowUp': 0,
          'ArrowRight': 90,
          'ArrowDown': 180,
          'ArrowLeft': 270
        };

        if (e.key in orientationMap) {
          e.preventDefault();
          const newOrientation = orientationMap[e.key];
          const selection = rects.find(r => r.id === selectedId);
          if (selection) {
            updateMetadata(selectedId, {
              ...(selection.metadata || { orientation: 0 }),
              orientation: newOrientation
            });
          }
        }
      }
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
  }, [selectedId, rects, updateMetadata]);

  // Initial fit
  useEffect(() => {
    setTimeout(resetZoom, 0);
  }, [image, dimensions.width, dimensions.height]); // Reset on image change or container resize

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

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

  const zoomToSelection = useCallback((id: string) => {
    const selection = rects.find(r => r.id === id);
    if (!selection || !image || !dimensions.width) return;

    setSelectedId(id);

    const p = selection.points;
    const minX = Math.min(p[0], p[2], p[4], p[6]);
    const maxX = Math.max(p[0], p[2], p[4], p[6]);
    const minY = Math.min(p[1], p[3], p[5], p[7]);
    const maxY = Math.max(p[1], p[3], p[5], p[7]);

    const selWidth = maxX - minX;
    const selHeight = maxY - minY;

    const padding = 40; // Reduced padding for tighter focus
    const availableWidth = dimensions.width - padding * 2;
    const availableHeight = dimensions.height - padding * 2;

    const scaleX = availableWidth / selWidth;
    const scaleY = availableHeight / selHeight;
    const newScale = Math.max(0.05, Math.min(scaleX, scaleY, 10)); // Increased auto-zoom cap to 10x

    setStageScale(newScale);
    setStagePos({
      x: (dimensions.width / 2) - (minX + selWidth / 2) * newScale,
      y: (dimensions.height / 2) - (minY + selHeight / 2) * newScale,
    });
  }, [rects, image, dimensions]);

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

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // If panning (Space pressed), don't start drawing
    if (isSpacePressed) return;

    const clickedOnEmpty = e.target === e.target.getStage() || e.target.index === 0;
    if (clickedOnEmpty) {
      setSelectedId(null);
      
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
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

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !newRectStart) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
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
          orientation: 0,
          date: globalMetadata.date,
          city: globalMetadata.city,
          location: globalMetadata.location
        }
      };
      
      setRects([...rects, newSelection]);
      setSelectedId(newSelection.id);
    }
    
    setIsDrawing(false);
    setNewRectStart(null);
    setNewRectEnd(null);
  };

  const handleExport = async (selection: Selection) => {
    if (!image) return;
    try {
      await exportPhoto(image, selection.points, {
        date: selection.metadata?.date || globalMetadata.date,
        city: selection.metadata?.city || globalMetadata.city,
        location: selection.metadata?.location || globalMetadata.location,
        orientation: selection.metadata?.orientation || 0
      });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed for selection ' + selection.id);
    }
  };

  const [exportingAll, setExportingAll] = useState(false);

  const handleExportAll = async () => {
    if (!image || rects.length === 0 || exportingAll) return;
    
    // Validate dates
    const invalidCount = rects.filter(r => !r.metadata?.date || !/^\d{6}$/.test(r.metadata.date)).length;
    if (invalidCount > 0) {
      if (!confirm(`Warning: ${invalidCount} selection(s) are missing a valid date. Export anyway?`)) {
        return;
      }
    }

    setExportingAll(true);
    try {
      for (const r of rects) {
        await handleExport(r);
        // Small delay between downloads to prevent browser blocking/congestion
        await new Promise(res => setTimeout(res, 500));
      }

      // Automatically proceed to next image if available
      if (queue.length > 0) {
        // Short delay to let the user see that exports finished
        setTimeout(() => {
          onNext();
          setExportingAll(false);
        }, 1000);
      } else {
        setExportingAll(false);
      }
    } catch (err) {
      console.error('Export all failed:', err);
      setExportingAll(false);
    }
  };

  const applyGlobalToAll = () => {
    setRects(prev => prev.map(r => ({
      ...r,
      metadata: {
        ...r.metadata,
        date: r.metadata?.date || globalMetadata.date,
        city: r.metadata?.city || globalMetadata.city,
        location: r.metadata?.location || globalMetadata.location,
        orientation: r.metadata?.orientation ?? 0
      } as Metadata
    })));
  };

  const selectedSelection = useMemo(() => rects.find(r => r.id === selectedId), [rects, selectedId]);

  return (
    <div className="flex flex-col w-full h-screen bg-neutral-950 text-white overflow-hidden">
      <WorkspaceHeader 
        image={image}
        queue={queue}
        onNext={onNext}
        setShowLocations={setShowLocations}
        runDetection={runDetection}
        detecting={detecting}
        handleExportAll={handleExportAll}
        exportingAll={exportingAll}
        rectsCount={rects.length}
        leftPanelOpen={leftPanelOpen}
        setLeftPanelOpen={setLeftPanelOpen}
        bottomPanelOpen={bottomPanelOpen}
        setBottomPanelOpen={setBottomPanelOpen}
        rightPanelOpen={rightPanelOpen}
        setRightPanelOpen={setRightPanelOpen}
      />
      
      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Side Panel: Queue */}
        {leftPanelOpen && (
          <QueuePanel image={image} queue={queue} onNext={onNext} />
        )}

        {/* Center: Canvas */}
        <div className="flex-1 relative bg-neutral-950 overflow-hidden" ref={containerRef}>
          <div className={`absolute inset-0 ${isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}>
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
                    onHandleDragStart={(index, x, y) => setActiveDragInfo({ selectionId: r.id, handleIndex: index, x, y })}
                    onHandleDragMove={(index, x, y) => setActiveDragInfo({ selectionId: r.id, handleIndex: index, x, y })}
                    onHandleDragEnd={() => setActiveDragInfo(null)}
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

                {/* Sniper Scope Overlay */}
                {activeDragInfo && (
                  <SniperScope 
                    activeDragInfo={activeDragInfo}
                    stageScale={stageScale}
                    stagePos={stagePos}
                    dimensions={dimensions}
                    image={image}
                  />
                )}
              </Layer>
            </Stage>
          </div>

          {/* Floating Zoom Controls */}
          <div className="absolute bottom-8 right-8 flex flex-col items-end gap-3 z-10">
            <div className="flex flex-col items-center bg-neutral-900/80 backdrop-blur-xl border border-neutral-700/50 rounded-2xl py-1 px-1 shadow-2xl ring-1 ring-white/10">
              <button 
                onClick={() => handleZoom(1.5)}
                className="p-2.5 hover:bg-neutral-700/50 text-neutral-300 hover:text-white rounded-xl transition-all active:scale-95 border-none"
                title="Zoom In"
              >
                <Plus size={18} />
              </button>
              
              <div className="h-px w-4 bg-neutral-700/50 my-1" />
              
              <button 
                onClick={() => handleZoom(1/1.5)}
                className="p-2.5 hover:bg-neutral-700/50 text-neutral-300 hover:text-white rounded-xl transition-all active:scale-95 border-none"
                title="Zoom Out"
              >
                <Minus size={18} />
              </button>
              
              <div className="h-px w-4 bg-neutral-700/50 my-1" />
              
              <button 
                onClick={resetZoom}
                className="flex flex-col items-center gap-1 px-2 py-2.5 hover:bg-neutral-700/50 text-neutral-300 hover:text-white rounded-xl transition-all active:scale-95 border-none text-[10px] font-bold tracking-tight uppercase"
                title="Fit to Screen"
              >
                <Maximize size={14} />
                <span>Fit</span>
              </button>
            </div>
            
            <div className="bg-neutral-900/60 backdrop-blur-md border border-neutral-700/30 rounded-full px-3 py-1 text-[9px] text-neutral-400 font-bold tracking-widest uppercase flex items-center gap-2 shadow-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" />
              Space to Pan
            </div>
          </div>
        </div>

        {/* Right Side Panel: Metadata */}
        {rightPanelOpen && (
          <div className="w-80 bg-neutral-900 border-l border-neutral-800 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Metadata Editor</span>
              <Info size={14} className="text-neutral-600" />
            </div>
            <div className="p-4 flex-1">
              {selectedSelection ? (
                <PhotoMetaPanel 
                  metadata={selectedSelection.metadata || { orientation: 0 }}
                  onChange={(m) => updateMetadata(selectedSelection.id, m)}
                  onClose={() => setSelectedId(null)}
                  onExport={() => handleExport(selectedSelection)}
                />
              ) : (
                <PhotoMetaPanel 
                  isGlobal
                  metadata={globalMetadata}
                  onChange={setGlobalMetadata}
                  onApply={applyGlobalToAll}
                />
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom Panel: Previews Strip */}
      {bottomPanelOpen && rects.length > 0 && (
        <PreviewsPanel 
          rects={rects}
          selectedId={selectedId}
          image={image}
          zoomToSelection={zoomToSelection}
          setBottomPanelOpen={setBottomPanelOpen}
        />
      )}

      {showLocations && <LocationSettings onClose={() => setShowLocations(false)} />}
    </div>
  );
}
