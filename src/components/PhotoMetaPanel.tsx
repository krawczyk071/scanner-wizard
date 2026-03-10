import { useState } from 'react';
import { ArrowUp, ArrowRight, ArrowDown, ArrowLeft, X, Download } from 'lucide-react';

interface Metadata {
  date?: string;
  city?: string;
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

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">City (Optional)</label>
        <input 
          type="text"
          value={metadata.city || ''}
          onChange={(e) => onChange({ ...metadata, city: e.target.value })}
          placeholder="San Francisco"
          className="bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500 transition-colors"
        />
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
