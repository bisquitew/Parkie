export interface User {
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin';
  access_token?: string;
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
  accessToken: string | null = null;
  currentLots: ParkingLot[] = [];
  currentLot: ParkingLot | null = null;
  adminTab: 'pending' | 'all' = 'pending';

  constructor() {
    try {
      this.currentUser = JSON.parse(localStorage.getItem('user') || 'null');
      this.accessToken = localStorage.getItem('access_token');
    } catch (e) {
      console.error("Failed to parse user or token from localStorage", e);
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
    }
  }

  setUser(user: User | null) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      if (user.access_token) {
        this.setToken(user.access_token);
      }
    } else {
      localStorage.removeItem('user');
      this.setToken(null);
    }
  }

  setToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getToken(): string | null {
    return this.accessToken || localStorage.getItem('access_token');
  }
}

export const state = new State();
