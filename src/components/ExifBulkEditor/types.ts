import { type Location } from '../../utils/locationStorage';

export interface BulkImageItem {
  id: string;
  file: File;
  handle?: any; // FileSystemFileHandle
  previewUrl: string;
  exifDate?: string; // DDMMYY
  exifTime?: string; // HH:MM
  exifLocation?: string; // City/Location
  exifDescription?: string; // ImageDescription
  location?: Location;
  selected: boolean;
  filename: string;
}

export interface ImageGroup {
  date: string;
  items: BulkImageItem[];
}
