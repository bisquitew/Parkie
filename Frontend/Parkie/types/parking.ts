export interface ParkingLot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  available_spots: number;
  status_color: string;
  is_verified: boolean;
  last_updated?: string;
}

export interface TransformedLot extends ParkingLot {
  // Add any extra fields added by transformer
  available: number;
  occupied: number;
  status: string;
}
