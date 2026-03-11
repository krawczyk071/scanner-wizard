import { Plus, ListRestart } from 'lucide-react';
import type { LoadedImage } from '../utils/imageLoader';
import { MiniMap } from './MiniMap';
import type { Selection } from '../types/workspace';

interface QueuePanelProps {
  image: LoadedImage;
  queue: File[];
  onNext: () => void;
  rects: Selection[];
  selectedId: string | null;
}

export function QueuePanel({ image, queue, onNext, rects, selectedId }: QueuePanelProps) {
  return (
    <div className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0">
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Processing Queue</span>
        <ListRestart size={14} className="text-neutral-600" />
      </div>

      <MiniMap image={image} rects={rects} selectedId={selectedId} />

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
  );
}
