import Constants from 'expo-constants';

export const API_CONFIG = {
  BASE_URL: Constants.expoConfig?.extra?.backendUrl || 'http://localhost:8000',
  POLLING_INTERVAL: 5000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  TIMEOUT: 10000,
};
