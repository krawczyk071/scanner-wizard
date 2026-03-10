import { Group, Line as KonvaLine, Circle as KonvaCircle, Rect as KonvaRect } from 'react-konva';
import { useState } from 'react';
import type { Selection } from '../types/workspace';

export interface SelectionItemProps {
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

export function SelectionItem({ 
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
