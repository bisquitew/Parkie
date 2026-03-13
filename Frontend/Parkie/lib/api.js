import { API_CONFIG } from '../config/api';

/**
 * Retry wrapper for API calls
 * Automatically retries up to MAX_RETRY_ATTEMPTS times
 */
const retryFetch = async (fetchFn, maxAttempts = API_CONFIG.MAX_RETRY_ATTEMPTS) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchFn();
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, error.message);
      
      if (attempt < maxAttempts) {
        // Wait before retrying (with exponential backoff)
        await new Promise(resolve => 
          setTimeout(resolve, API_CONFIG.RETRY_DELAY * attempt)
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
  healthCheck: async () => {
    try {
      return await retryFetch(() =>
        fetch(`${API_CONFIG.BASE_URL}/`, {
          timeout: API_CONFIG.TIMEOUT
        })
      );
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  },

  /**
   * Get all parking lots
   * GET /lots
   * Returns: [{id, name, capacity, available_spots, last_updated, status_color}]
   */
  fetchAllLots: async () => {
    try {
      return await retryFetch(() =>
        fetch(`${API_CONFIG.BASE_URL}/lots`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        })
      );
    } catch (error) {
      throw new Error(`Failed to fetch lots: ${error.message}`);
    }
  },

  /**
   * Get lightweight color updates for all lots
   * GET /lots/colors
   * Returns: [{id, status_color}]
   */
  fetchLotColors: async () => {
    try {
      return await retryFetch(() =>
        fetch(`${API_CONFIG.BASE_URL}/lots/colors`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        })
      );
    } catch (error) {
      throw new Error(`Failed to fetch lot colors: ${error.message}`);
    }
  },

  /**
   * Get single lot details
   * GET /lots/{lotId}
   * Returns: {id, name, capacity, available_spots, last_updated, status_color}
   */
  fetchLotDetails: async (lotId) => {
    try {
      return await retryFetch(() =>
        fetch(`${API_CONFIG.BASE_URL}/lots/${lotId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        })
      );
    } catch (error) {
      throw new Error(`Failed to fetch lot details: ${error.message}`);
    }
  },

  /**
   * Update lot with detected cars
   * POST /update_lot
   * Payload: {lot_id, detected_cars}
   * Returns: {status, lot_id, available_spots, status_color}
   */
  updateLot: async (lotId, detectedCars) => {
    try {
      return await retryFetch(() =>
        fetch(`${API_CONFIG.BASE_URL}/update_lot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lot_id: lotId,
            detected_cars: detectedCars
          })
        })
      );
    } catch (error) {
      throw new Error(`Failed to update lot: ${error.message}`);
    }
  }
};
