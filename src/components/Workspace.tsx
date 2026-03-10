import { Stage, Layer, Image as KonvaImage, Group, Line as KonvaLine, Rect as KonvaRect, Circle as KonvaCircle } from 'react-konva';
import type { LoadedImage } from '../utils/imageLoader';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { RefreshCw, Loader2, Plus, Minus, Info, Download, Map, ChevronDown, ListRestart, PanelLeft, PanelRight, PanelBottom, Maximize, ArrowRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CropPreview } from './CropPreview';
import { PhotoMetaPanel, type Metadata } from './PhotoMetaPanel';
import { LocationSettings } from './LocationSettings';
import { exportPhoto } from '../utils/exportUtils';
import { type Location } from '../utils/locationStorage';

interface Selection {
  id: string;
  points: number[]; // 8 points [x1, y1, x2, y2, x3, y3, x4, y4]
  isManual?: boolean;
  metadata?: {
    date?: string;
    city?: string;
    location?: Location;
    orientation: 0 | 90 | 180 | 270;
  };
}

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
  }, [image, dimensions.width, dimensions.height]); // Reset on image change or container resize

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
      } as any
    })));
  };

  const selectedSelection = useMemo(() => rects.find(r => r.id === selectedId), [rects, selectedId]);

  return (
    <div className="flex flex-col w-full h-screen bg-neutral-950 text-white overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-sm text-neutral-300 shrink-0">
        <div className="flex items-center gap-3">
          <div className="font-semibold truncate max-w-md" title={image.fileName}>{image.fileName}</div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowLocations(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors font-medium border border-neutral-700"
            title="Manage Locations"
          >
            <Map size={16} />
            <span className="hidden sm:inline">Locations</span>
          </button>

          <div className="h-4 w-px bg-neutral-800 mx-1" />

          <button 
            onClick={runDetection}
            disabled={detecting}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-200 border border-neutral-700 rounded-md transition-colors font-medium"
          >
            {detecting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span className="hidden sm:inline">{detecting ? 'Detecting...' : 'Re-detect'}</span>
          </button>

          <button 
            onClick={handleExportAll}
            disabled={rects.length === 0 || exportingAll}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-md transition-colors font-bold border-none"
          >
            {exportingAll ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span className="hidden sm:inline">{exportingAll ? 'Exporting...' : 'Export All'}</span>
          </button>

          <div className="h-4 w-px bg-neutral-800 mx-1" />
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setLeftPanelOpen(prev => !prev)}
              className={`p-1.5 rounded-md transition-all active:scale-95 ${leftPanelOpen ? 'bg-neutral-800 text-blue-400 shadow-inner' : 'text-neutral-500 hover:bg-neutral-800'}`}
              title="Toggle Queue"
            >
              <PanelLeft size={18} />
            </button>
            <button 
              onClick={() => setBottomPanelOpen(prev => !prev)}
              className={`p-1.5 rounded-md transition-all active:scale-95 ${bottomPanelOpen ? 'bg-neutral-800 text-blue-400 shadow-inner' : 'text-neutral-500 hover:bg-neutral-800'}`}
              title="Toggle Previews"
            >
              <PanelBottom size={18} />
            </button>
            <button 
              onClick={() => setRightPanelOpen(prev => !prev)}
              className={`p-1.5 rounded-md transition-all active:scale-95 ${rightPanelOpen ? 'bg-neutral-800 text-blue-400 shadow-inner' : 'text-neutral-500 hover:bg-neutral-800'}`}
              title="Toggle Metadata"
            >
              <PanelRight size={18} />
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-800 mx-1" />

          <button 
            onClick={onNext}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-md transition-colors font-medium"
            title={queue.length > 0 ? `Next: ${queue[0].name}` : 'Finish Session'}
          >
            <span className="hidden sm:inline">{queue.length > 0 ? 'Next Image' : 'Finish'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      
      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Side Panel: Queue */}
        {leftPanelOpen && (
          <div className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0">
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Processing Queue</span>
              <ListRestart size={14} className="text-neutral-600" />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-3">
                <div className="flex flex-col gap-2">
                  {/* Current Image */}
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center shrink-0">
                      <Plus size={16} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-blue-400 truncate uppercase tracking-tight">Processing</p>
                      <p className="text-[10px] text-neutral-400 truncate">{image.fileName}</p>
                    </div>
                  </div>

                  {/* Remaining Queue */}
                  {queue.length > 0 ? (
                    queue.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-neutral-800/30 border border-neutral-800/50 opacity-60">
                        <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-neutral-600">{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-neutral-300 truncate font-medium">{file.name}</p>
                          <p className="text-[9px] text-neutral-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-neutral-600 opacity-30 mt-4">
                      <ListRestart size={24} className="mb-2" />
                      <p className="text-[10px] font-bold uppercase">No more items</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {queue.length > 0 && (
              <div className="p-3 border-t border-neutral-800 bg-neutral-900/50">
                <button 
                  onClick={onNext}
                  className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  Skip to Next
                </button>
              </div>
            )}
          </div>
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
                  {activeDragInfo && (() => {
                    const screenY = activeDragInfo.y * stageScale + stagePos.y;
                    const isNearTop = screenY < 160; // 160px from top
                    const isNearRight = (activeDragInfo.x * stageScale + stagePos.x) > dimensions.width - 160;
                    
                    return (
                      <Group
                        x={activeDragInfo.x}
                        y={activeDragInfo.y}
                        offsetX={isNearRight ? 100 / stageScale : -100 / stageScale}
                        offsetY={isNearTop ? -100 / stageScale : 100 / stageScale}
                      >
                      {/* Outer Ring / Glass */}
                      <KonvaCircle
                        radius={60 / stageScale}
                        fill="black"
                        stroke="#3b82f6"
                        strokeWidth={4 / stageScale}
                        shadowBlur={10 / stageScale}
                        shadowOpacity={0.5}
                      />
                      
                      {/* Magnified Image View */}
                      <Group
                        clipFunc={(ctx) => {
                          ctx.arc(0, 0, 58 / stageScale, 0, Math.PI * 2, false);
                        }}
                      >
                        <KonvaImage
                          image={image.element}
                          x={0}
                          y={0}
                          offsetX={activeDragInfo.x}
                          offsetY={activeDragInfo.y}
                          scaleX={4}
                          scaleY={4}
                        />
                      </Group>

                      {/* Crosshair */}
                      <KonvaLine
                        points={[-15/stageScale, 0, 15/stageScale, 0]}
                        stroke="#ef4444"
                        strokeWidth={1/stageScale}
                      />
                      <KonvaLine
                        points={[0, -15/stageScale, 0, 15/stageScale]}
                        stroke="#ef4444"
                        strokeWidth={1/stageScale}
                      />
                      <KonvaCircle
                        radius={2 / stageScale}
                        stroke="#ef4444"
                        strokeWidth={1 / stageScale}
                      />
                      </Group>
                    );
                  })()}
                </Group>
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
        <div className="h-48 w-full bg-neutral-900 border-t border-neutral-800 flex flex-col shrink-0">
          <div className="px-3 py-1.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Selection Previews ({rects.length})</span>
            <button 
              onClick={() => setBottomPanelOpen(false)}
              className="p-1 hover:bg-neutral-800 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors border-none"
              title="Hide Previews"
            >
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="flex-1 flex items-center px-4 gap-4 overflow-x-auto py-3 custom-scrollbar">
            {rects.map((r) => (
              <div 
                key={r.id}
                onClick={() => zoomToSelection(r.id)}
                className={`flex flex-col gap-1 cursor-pointer transition-all ${selectedId === r.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900 rounded scale-105' : 'opacity-80 hover:opacity-100 hover:scale-[1.02]'}`}
              >
                <CropPreview 
                  image={image}
                  points={r.points}
                  orientation={r.metadata?.orientation || 0}
                />
                <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400 px-1 uppercase tracking-tight">
                  <span>{r.metadata?.date || 'NO DATE'}</span>
                  <span className="truncate max-w-[60px]">{r.metadata?.location?.city || r.metadata?.city || 'NO CITY'}</span>
                </div>
              </div>
            ))}
            <div className="text-neutral-600 flex flex-col items-center justify-center h-[120px] px-8 text-center border-2 border-dashed border-neutral-800 rounded shrink-0">
              <Info size={16} className="mb-1 opacity-20" />
              <span className="text-[10px] uppercase font-bold opacity-30">Add more</span>
            </div>
          </div>
        </div>
      )}

      {showLocations && <LocationSettings onClose={() => setShowLocations(false)} />}
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
  onHandleDragStart?: (index: number, x: number, y: number) => void;
  onHandleDragMove?: (index: number, x: number, y: number) => void;
  onHandleDragEnd?: () => void;
}

function SelectionItem({ 
  selection, imageWidth, imageHeight, isSelected, onSelect, onDelete, onChange, finalScale,
  onHandleDragStart, onHandleDragMove, onHandleDragEnd
}: SelectionItemProps) {
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
        strokeWidth={(isSelected ? 3 : 2) / (finalScale * Math.pow(Math.max(1, finalScale), 1.6))}
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
            const cx = e.target.x();
            const cy = e.target.y();
            handleResize(i, cx, cy);
            onHandleDragMove?.(i, cx, cy);
          }}
          onDragStart={(e) => {
            onHandleDragStart?.(i, e.target.x(), e.target.y());
          }}
          onDragEnd={(e) => {
            // Circle onDragEnd also bubbles, but handleResizeEnd handles it
            e.cancelBubble = true;
            handleResizeEnd();
            onHandleDragEnd?.();
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
