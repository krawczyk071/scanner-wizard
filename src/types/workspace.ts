import { type Location } from '../utils/locationStorage';

export interface Selection {
  id: string;
  points: number[]; // 8 points [x1, y1, x2, y2, x3, y3, x4, y4]
  isManual?: boolean;
  metadata?: {
    date?: string;
    city?: string;
    location?: Location;
    orientation: 0 | 90 | 180 | 270;
  };
}
