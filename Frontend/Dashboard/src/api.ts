const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://undateable-lashawnda-unnectareous.ngrok-free.dev';

export const api = {
  async post(endpoint: string, data: any) {
    const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;
    const response = await fetch(url, {
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
    const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;
    const response = await fetch(url, {
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
    const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;
    const response = await fetch(url, {
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

  async patch(endpoint: string, params?: Record<string, string>) {
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const url = new URL(`${baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    }
    const response = await fetch(url.toString(), {
      method: 'PATCH',
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

  async delete(endpoint: string) {
    const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;
    const response = await fetch(url, {
      method: 'DELETE',
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

  async captureFrame(cameraUrl: string) {
    const data = await this.post('/capture_frame', { camera_url: cameraUrl });
    return data.image;
  },

  async saveLotSetup(lotId: string, cameraUrl: string, slotsData: number[][]) {
    return this.post(`/lots/${lotId}/setup`, {
      camera_url: cameraUrl,
      slots_data: slotsData
    });
  },

  async getPendingLots() {
    return this.get('/lots/pending');
  },

  async verifyLot(lotId: string) {
    return this.patch(`/lots/${lotId}/verify`, { verified: 'true' });
  },

  async unverifyLot(lotId: string) {
    return this.patch(`/lots/${lotId}/verify`, { verified: 'false' });
  },

  async rejectLot(lotId: string) {
    return this.delete(`/lots/${lotId}`);
  }
};
