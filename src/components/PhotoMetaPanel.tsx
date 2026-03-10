import { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowRight, ArrowDown, ArrowLeft, X, Download, MapPin, ChevronDown } from 'lucide-react';
import { type Location, getSavedLocations } from '../utils/locationStorage';
import { deleteLocation as _unused_delete } from '../utils/locationStorage'; // Just to avoid confusion with local state

interface Metadata {
  date?: string;
  city?: string;
  location?: Location;
  orientation: 0 | 90 | 180 | 270;
}

interface PhotoMetaPanelProps {
  metadata: Metadata;
  onChange: (metadata: Metadata) => void;
  onClose: () => void;
  onExport: () => void;
}

export function PhotoMetaPanel({ metadata, onChange, onClose, onExport }: PhotoMetaPanelProps) {
  const [dateValue, setDateValue] = useState(metadata.date || '');
  const [dateError, setDateError] = useState<string | null>(null);
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState(metadata.location?.city || metadata.city || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocations(getSavedLocations());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validateDate = (val: string) => {
    if (!val) return true;
    if (!/^\d{6}$/.test(val)) return false;
    
    const day = parseInt(val.substring(0, 2));
    const month = parseInt(val.substring(2, 4));
    
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    
    return true;
  };

  const handleDateChange = (val: string) => {
    // Only allow numbers, max 6 digits
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setDateValue(cleaned);
    
    if (cleaned && !validateDate(cleaned)) {
      setDateError('Use DDMMYY format');
    } else {
      setDateError(null);
      onChange({ ...metadata, date: cleaned });
    }
  };

  const orientations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
  const icons = [ArrowUp, ArrowRight, ArrowDown, ArrowLeft];

  return (
    <div className="flex flex-col gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl w-64">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-neutral-200">METADATA</h3>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-neutral-800 rounded-md text-neutral-500 hover:text-neutral-300 border-none transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Date (DDMMYY)</label>
        <input 
          type="text"
          value={dateValue}
          onChange={(e) => handleDateChange(e.target.value)}
          placeholder="010170"
          className={`bg-neutral-950 border ${dateError ? 'border-red-500' : 'border-neutral-800'} rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500 transition-colors`}
        />
        {dateError && <span className="text-[10px] text-red-500 mt-1">{dateError}</span>}
      </div>

      <div className="flex flex-col gap-1 relative" ref={dropdownRef}>
        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Location</label>
        <div className="relative">
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value;
              setInputValue(val);
              setShowDropdown(true);
              // Clear complex location if typing manually (resets to simple city)
              onChange({ ...metadata, city: val, location: undefined });
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search saved places..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500 transition-colors pr-8"
          />
          <ChevronDown 
            size={14} 
            className={`absolute right-2 top-1/2 -translate-y-1/2 text-neutral-600 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
          />
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-neutral-900 border border-neutral-800 rounded shadow-2xl max-h-48 overflow-y-auto">
            {locations
              .filter(l => 
                l.city.toLowerCase().includes(inputValue.toLowerCase()) || 
                l.subarea.toLowerCase().includes(inputValue.toLowerCase()) ||
                (l.street && l.street.toLowerCase().includes(inputValue.toLowerCase()))
              )
              .map(loc => (
                <button
                  key={loc.id}
                  onClick={() => {
                    onChange({ ...metadata, location: loc, city: loc.city });
                    setInputValue(loc.city);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-neutral-800 transition-colors border-none"
                >
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-blue-500 shrink-0" />
                    <span className="text-sm text-neutral-200 font-medium truncate">{loc.city}</span>
                  </div>
                  <div className="flex items-center gap-1 pl-5">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{loc.subarea}</span>
                    {loc.street && <span className="text-[10px] text-neutral-600 truncate">— {loc.street}</span>}
                  </div>
                </button>
              ))}
            {locations.length === 0 && (
              <div className="px-3 py-4 text-center">
                <p className="text-[10px] text-neutral-600 italic">No locations saved. Add some in the Locations panel.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Orientation</label>
        <div className="flex gap-1">
          {orientations.map((deg, i) => {
            const Icon = icons[i];
            return (
              <button
                key={deg}
                onClick={() => onChange({ ...metadata, orientation: deg })}
                className={`flex-1 flex items-center justify-center p-2 rounded border transition-all ${metadata.orientation === deg ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:border-neutral-700'}`}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onExport}
        disabled={!!dateError}
        className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-md transition-all font-bold text-sm tracking-tight border-none shadow-lg shadow-blue-900/20"
      >
        <Download size={16} />
        EXPORT PHOTO
      </button>
    </div>
  );
}
