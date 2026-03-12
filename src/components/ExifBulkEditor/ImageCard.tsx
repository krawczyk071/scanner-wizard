import { 
  CheckSquare, 
  Square, 
  Calendar, 
  MapPin, 
  FileText 
} from 'lucide-react';
import { type BulkImageItem } from './types';

interface ImageCardProps {
  item: BulkImageItem;
  selected: boolean;
  hovered: boolean;
  onToggle: (id: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSelectSameDate: (date: string) => void;
}

export function ImageCard({ 
  item, 
  selected, 
  hovered, 
  onToggle, 
  onMouseEnter, 
  onMouseLeave, 
  onSelectSameDate 
}: ImageCardProps) {
  return (
    <div 
      onClick={() => onToggle(item.id)}
      style={{ width: '75px', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer', position: 'relative' }}
    >
      <div 
        style={{ 
          width: '75px', 
          height: '75px', 
          position: 'relative', 
          borderRadius: '6px', 
          overflow: 'hidden', 
          border: selected ? '2px solid #3b82f6' : '2px solid #262626',
          transition: 'all 0.2s ease'
        }}
      >
        <img 
            src={item.previewUrl} 
            alt={item.filename}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        
        <div style={{ position: 'absolute', top: '4px', left: '4px', pointerEvents: 'none' }}>
          <div style={{ 
            padding: '2px', 
            borderRadius: '2px', 
            backgroundColor: selected ? '#3b82f6' : 'rgba(0,0,0,0.5)', 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {selected ? <CheckSquare size={10} /> : <Square size={10} />}
          </div>
        </div>
      </div>

      {/* Hover Preview */}
      {hovered && (
        <div 
          style={{ 
            position: 'absolute', 
            top: '0', 
            left: '85px', 
            width: '300px', 
            zIndex: 100, 
            backgroundColor: '#0a0a0a', 
            border: '1px solid #262626', 
            borderRadius: '12px', 
            padding: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none'
          }}
        >
          <img 
            src={item.previewUrl} 
            alt={item.filename}
            style={{ width: '100%', borderRadius: '6px', marginBottom: '8px' }}
          />
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-neutral-200 truncate">{item.filename}</p>
            <div className="flex items-center gap-2 text-[10px] text-neutral-500">
              <Calendar size={10} />
              <span>{item.exifDate || 'No date'} {item.exifTime}</span>
            </div>
            {item.exifLocation && (
              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                <MapPin size={10} />
                <span>{item.exifLocation}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div 
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}
      >
        <p style={{ 
          fontSize: '9px', 
          fontWeight: '700', 
          margin: 0, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          color: '#d4d4d4'
        }} title={item.filename}>
          {item.filename}
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#737373', fontSize: '7px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
              <Calendar size={7} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.exifDate || 'No date'}
                {item.exifTime && <span style={{ marginLeft: '4px', color: '#525252' }}>{item.exifTime}</span>}
              </span>
            </div>
            {item.exifDate && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSameDate(item.exifDate!);
                }}
                className="p-0.5 hover:bg-neutral-800 rounded text-blue-500 transition-colors"
                title="Select all from this date"
              >
                <CheckSquare size={7} />
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#737373', fontSize: '7px' }}>
            <MapPin size={7} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.exifLocation || 'No location'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#737373', fontSize: '7px' }}>
            <FileText size={7} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.exifDescription || 'No description'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
