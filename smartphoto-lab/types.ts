export interface User {
  id?: number;
  username: string;
  email: string;
}

export interface Photo {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  timestamp: number; // Upload time
  width: number;
  height: number;
  tags: string[];
  description?: string;
  exif: {
    dateTaken?: string;
    location?: string; // Mocked or AI inferred
    camera?: string; // Mocked or AI inferred
    iso?: string;
    fStop?: string;
  };
}

export interface PhotoFilter {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
}
