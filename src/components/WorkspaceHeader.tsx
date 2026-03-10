import { RefreshCw, Loader2, Download, Map, PanelLeft, PanelRight, PanelBottom, ArrowRight } from 'lucide-react';
import type { LoadedImage } from '../utils/imageLoader';

interface WorkspaceHeaderProps {
  image: LoadedImage;
  queue: File[];
  onNext: () => void;
  setShowLocations: (show: boolean) => void;
  runDetection: () => void;
  detecting: boolean;
  handleExportAll: () => void;
  exportingAll: boolean;
  rectsCount: number;
  leftPanelOpen: boolean;
  setLeftPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  bottomPanelOpen: boolean;
  setBottomPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

export function WorkspaceHeader({
  image,
  queue,
  onNext,
  setShowLocations,
  runDetection,
  detecting,
  handleExportAll,
  exportingAll,
  rectsCount,
  leftPanelOpen,
  setLeftPanelOpen,
  bottomPanelOpen,
  setBottomPanelOpen,
  rightPanelOpen,
  setRightPanelOpen
}: WorkspaceHeaderProps) {
  return (
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
          disabled={rectsCount === 0 || exportingAll}
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
  );
}
