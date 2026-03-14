const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://undateable-lashawnda-unnectareous.ngrok-free.dev';

export const api = {
  async post(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let errorMsg = 'API request failed';
      try {
        const error = await response.json();
        errorMsg = error.detail || errorMsg;
      } catch (e) {
        errorMsg = await response.text();
      }
      throw new Error(errorMsg);
    }
    return response.json();
  },

  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });
    if (!response.ok) {
      let errorMsg = 'API request failed';
      try {
        const error = await response.json();
        errorMsg = error.detail || errorMsg;
      } catch (e) {
        errorMsg = await response.text();
      }
      throw new Error(errorMsg);
    }
    return response.json();
  },

  async put(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let errorMsg = 'API request failed';
      try {
        const error = await response.json();
        errorMsg = error.detail || errorMsg;
      } catch (e) {
        errorMsg = await response.text();
      }
      throw new Error(errorMsg);
    }
    return response.json();
  },

  async captureFrame(cameraUrl: string) {
    const data = await this.post('/capture_frame', { camera_url: cameraUrl });
    return data.image; // Returns base64 string
  },

  async saveLotSetup(lotId: string, cameraUrl: string, slotsData: number[][]) {
    return this.post(`/lots/${lotId}/setup`, {
      camera_url: cameraUrl,
      slots_data: slotsData
    });
  }
};
