const API_BASE_URL = 'http://localhost:8000';

export const api = {
  async post(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API request failed');
    }
    return response.json();
  },

  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API request failed');
    }
    return response.json();
  },

  async put(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API request failed');
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
