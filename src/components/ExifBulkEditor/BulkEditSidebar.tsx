import { useState } from 'react';
import { 
  Calendar, 
  MapPin, 
  X, 
  ChevronDown, 
  ChevronRight, 
  ChevronUp, 
  CheckSquare, 
  Square, 
  Save, 
  Loader2, 
  CheckCircle2 
} from 'lucide-react';
import { type Location } from '../../utils/locationStorage';
import { type BulkImageItem } from './types';

interface BulkEditSidebarProps {
  selectedItems: BulkImageItem[];
  isProcessing: boolean;
  bulkDate: string;
  setBulkDate: (date: string) => void;
  bulkCity: string;
  setBulkCity: (city: string) => void;
  bulkLocation: Location | null;
  setBulkLocation: (loc: Location | null) => void;
  locationSearch: string;
  setLocationSearch: (search: string) => void;
  showLocationDropdown: boolean;
  setShowLocationDropdown: (show: boolean) => void;
  filteredLocations: Location[];
  preserveOrder: boolean;
  setPreserveOrder: (preserve: boolean) => void;
  onMoveItem: (id: string, direction: 'up' | 'down') => void;
  onBulkUpdate: () => void;
}

export function BulkEditSidebar({
  selectedItems,
  isProcessing,
  bulkDate,
  setBulkDate,
  bulkCity,
  setBulkCity,
  bulkLocation,
  setBulkLocation,
  locationSearch,
  setLocationSearch,
  showLocationDropdown,
  setShowLocationDropdown,
  filteredLocations,
  preserveOrder,
  setPreserveOrder,
  onMoveItem,
  onBulkUpdate
}: BulkEditSidebarProps) {
  const [isOrderExpanded, setIsOrderExpanded] = useState(true);

  return (
    <aside className="w-80 border-l border-neutral-800 bg-neutral-900/50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b border-neutral-800">
        <h2 className="text-lg font-bold mb-1">Bulk Edit</h2>
        <p className="text-sm text-neutral-500">{selectedItems.length} images selected</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Date Input */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Set New Date (DDMMYY)</label>
          <div className="relative group/date">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within/date:text-blue-500 transition-colors pointer-events-none" size={16} />
            <input 
              type="text"
              placeholder="e.g. 150885"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ paddingLeft: '3rem' }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        {/* Location Input */}
        <div className="flex flex-col gap-2 relative">
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Set New Location</label>
          <div className="relative group/loc">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within/loc:text-blue-500 transition-colors pointer-events-none" size={16} />
            <input 
              type="text"
              placeholder="Search saved or enter city..."
              value={locationSearch || bulkCity}
              onChange={(e) => {
                setLocationSearch(e.target.value);
                setBulkCity(e.target.value);
                setShowLocationDropdown(true);
              }}
              onFocus={() => setShowLocationDropdown(true)}
              style={{ paddingLeft: '3rem' }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pr-10 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
            {(locationSearch || bulkCity) && (
              <button 
                onClick={() => {
                  setLocationSearch('');
                  setBulkCity('');
                  setBulkLocation(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {showLocationDropdown && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
              {filteredLocations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => {
                    setBulkLocation(loc);
                    setBulkCity(loc.city);
                    setLocationSearch(loc.city);
                    setShowLocationDropdown(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-neutral-800 transition-colors border-b border-neutral-800 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-blue-500 shrink-0" />
                    <span className="text-sm text-neutral-200 font-medium truncate">{loc.street || loc.city}</span>
                  </div>
                  {(loc.street || loc.subarea) && (
                    <div className="pl-6 text-[10px] text-neutral-500 uppercase truncate">
                      {loc.street ? loc.city : loc.subarea}
                    </div>
                  )}
                </button>
              ))}
              {locationSearch && filteredLocations.length === 0 && (
                <div className="p-4 text-center text-xs text-neutral-600 italic">
                  No saved matches. Press Enter to use manual city.
                </div>
              )}
            </div>
          )}
        </div>

        {bulkLocation && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Selected Location</span>
              <button onClick={() => setBulkLocation(null)} className="text-blue-500 hover:text-blue-400">
                <X size={12} />
              </button>
            </div>
            <div className="text-sm font-medium">{bulkLocation.city}</div>
            <div className="text-[10px] text-neutral-500">{bulkLocation.lat.toFixed(4)}, {bulkLocation.lon.toFixed(4)}</div>
          </div>
        )}

        {/* Selected Items Reordering */}
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => setIsOrderExpanded(!isOrderExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest cursor-pointer">Order of Selection</label>
            <div className="text-neutral-500">
              {isOrderExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          </button>
          
          {isOrderExpanded && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {selectedItems.map((item, idx, arr) => (
                <div key={item.id} className="flex items-center gap-2 p-2 border-b border-neutral-800 last:border-0 hover:bg-neutral-900 transition-colors group">
                  <img src={item.previewUrl} className="w-8 h-8 rounded object-cover" alt="" />
                  <span className="text-[10px] text-neutral-300 truncate flex-1">{item.filename}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onMoveItem(item.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button 
                      onClick={() => onMoveItem(item.id, 'down')}
                      disabled={idx === arr.length - 1}
                      className="p-1 hover:bg-neutral-800 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preserve Order Toggle */}
        <div className="flex items-center gap-3 p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
          <button 
            onClick={() => setPreserveOrder(!preserveOrder)}
            className={`p-1 rounded transition-colors ${preserveOrder ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-500'}`}
          >
            {preserveOrder ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-neutral-200">Preserve Order</span>
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest">Add 1 min per photo from oldest</span>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur-md">
        <button 
          onClick={onBulkUpdate}
          disabled={isProcessing || (!bulkDate && !bulkCity && !bulkLocation && !preserveOrder)}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
        >
          {isProcessing ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Save size={20} />
              <span>Save Changes to Files</span>
            </>
          )}
        </button>
        <div className="mt-3 flex items-start gap-2 px-1">
          <CheckCircle2 size={12} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest leading-relaxed">
            Changes will be saved directly to the original files
          </p>
        </div>
      </div>
    </aside>
  );
}
