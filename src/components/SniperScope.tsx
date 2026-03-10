import { Group, Line as KonvaLine, Circle as KonvaCircle, Image as KonvaImage } from 'react-konva';
import type { LoadedImage } from '../utils/imageLoader';

interface SniperScopeProps {
  activeDragInfo: {
    selectionId: string;
    handleIndex: number;
    x: number;
    y: number;
  };
  stageScale: number;
  stagePos: { x: number; y: number };
  dimensions: { width: number; height: number };
  image: LoadedImage;
}

export function SniperScope({
  activeDragInfo,
  stageScale,
  stagePos,
  dimensions,
  image
}: SniperScopeProps) {
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
}
