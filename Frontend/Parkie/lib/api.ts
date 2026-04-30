import { API_CONFIG } from '../config/api';
import { ParkingLot, LotStatusUpdateResponse } from '../types/parking';

/**
 * Retry wrapper for API calls
 * Automatically retries up to MAX_RETRY_ATTEMPTS times
 */
const retryFetch = async <T>(fetchFn: () => Promise<Response>, maxAttempts = API_CONFIG.MAX_RETRIES || 3): Promise<T> => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchFn();
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json() as T;
    } catch (error: any) {
      lastError = error || new Error('Unknown error during fetch');
      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);
      
      if (attempt < maxAttempts) {
        // Wait before retrying (with exponential backoff)
        await new Promise(resolve => 
          setTimeout(resolve, (API_CONFIG.RETRY_DELAY || 2000) * attempt)
        );
      }
    }
  }
  
  throw lastError;
};

export const apiService = {
  /**
   * Health check - Confirm API is online
   * GET /
   */
  healthCheck: async (): Promise<any> => {
    try {
      return await retryFetch(() =>
        fetch(`${API_CONFIG.BASE_URL}/`, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          }
        })
      );
    } catch (error: any) {
      throw new Error(`Health check failed: ${error?.message || 'Unknown error'}`);
    }
  },

  /**
   * Get all parking lots
   * GET /lots
   * Returns: [{id, name, capacity, available_spots, last_updated, status_color}]
   */
  fetchAllLots: async (): Promise<ParkingLot[]> => {
    try {
      return await retryFetch<ParkingLot[]>(() =>
        fetch(`${API_CONFIG.BASE_URL}/lots`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          }
        })
      );
    } catch (error: any) {
      throw new Error(`Failed to fetch lots: ${error?.message || 'Unknown error'}`);
    }
  },

  /**
   * Get lightweight color updates for all lots
   * GET /lots/colors
   * Returns: [{id, status_color}]
   */
  fetchLotColors: async (): Promise<Pick<ParkingLot, 'id' | 'status_color'>[]> => {
    try {
      return await retryFetch<Pick<ParkingLot, 'id' | 'status_color'>[]>(() =>
        fetch(`${API_CONFIG.BASE_URL}/lots/colors`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          }
        })
      );
    } catch (error: any) {
      throw new Error(`Failed to fetch lot colors: ${error?.message || 'Unknown error'}`);
    }
  },

  /**
   * Get single lot details
   * GET /lots/{lotId}
   * Returns: {id, name, capacity, available_spots, last_updated, status_color}
   */
  fetchLotDetails: async (lotId: string): Promise<ParkingLot> => {
    try {
      return await retryFetch<ParkingLot>(() =>
        fetch(`${API_CONFIG.BASE_URL}/lots/${lotId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          }
        })
      );
    } catch (error: any) {
      throw new Error(`Failed to fetch lot details: ${error?.message || 'Unknown error'}`);
    }
  },

  /**
   * Update lot with detected cars
   * POST /vision/update_lot
   * Payload: {lot_id, detected_cars}
   * Returns: {status, lot_id, available_spots, status_color}
   */
  updateLot: async (lotId: string, detectedCars: number): Promise<LotStatusUpdateResponse> => {
    try {
      return await retryFetch<LotStatusUpdateResponse>(() =>
        fetch(`${API_CONFIG.BASE_URL}/vision/update_lot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            lot_id: lotId,
            detected_cars: detectedCars
          })
        })
      );
    } catch (error: any) {
      throw new Error(`Failed to update lot: ${error?.message || 'Unknown error'}`);
    }
  }
};
