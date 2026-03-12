import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { type ImageGroup } from './types';
import { ImageCard } from './ImageCard';

interface ImageGridProps {
  groupedItems: ImageGroup[];
  onToggle: (id: string) => void;
  onSelectSameDate: (date: string) => void;
}

export function ImageGrid({ groupedItems, onToggle, onSelectSameDate }: ImageGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start', flexDirection: 'column' }}>
      {groupedItems.map((group) => (
        <div key={group.date} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #262626', paddingBottom: '8px' }}>
            <Calendar size={14} className="text-neutral-500" />
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">{group.date}</h3>
            <span className="text-[10px] text-neutral-600">{group.items.length} images</span>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {group.items.map((item) => (
              <ImageCard 
                key={item.id}
                item={item}
                selected={item.selected}
                hovered={hoveredId === item.id}
                onToggle={onToggle}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onSelectSameDate={onSelectSameDate}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
