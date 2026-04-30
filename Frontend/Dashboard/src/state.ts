export interface User {
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin';
}

export interface ParkingLot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  camera_url: string;
  status_color: string;
  capacity: number;
  available_spots: number;
  slots_data?: number[][];
  is_verified?: boolean;
  owner_id?: string;
}

class State {
  currentUser: User | null = null;
  currentLots: ParkingLot[] = [];
  currentLot: ParkingLot | null = null;
  adminTab: 'pending' | 'all' = 'pending';

  constructor() {
    try {
      this.currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      localStorage.removeItem('user');
    }
  }

  setUser(user: User | null) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }
}

export const state = new State();
