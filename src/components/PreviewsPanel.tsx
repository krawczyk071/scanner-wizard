import { ChevronDown, Info } from 'lucide-react';
import { CropPreview } from './CropPreview';
import type { LoadedImage } from '../utils/imageLoader';
import type { Selection } from '../types/workspace';

interface PreviewsPanelProps {
  rects: Selection[];
  selectedId: string | null;
  image: LoadedImage;
  zoomToSelection: (id: string) => void;
  setBottomPanelOpen: (open: boolean) => void;
}

export function PreviewsPanel({
  rects,
  selectedId,
  image,
  zoomToSelection,
  setBottomPanelOpen
}: PreviewsPanelProps) {
  return (
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
  );
}
