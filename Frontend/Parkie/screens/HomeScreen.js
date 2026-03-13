import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import TopBar from '../components/TopBar';
import MapPlaceholder from '../components/MapPlaceholder';
import ParkingCard from '../components/ParkingCard';
import BottomNavBar from '../components/BottomNavBar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { colors } from '../theme/colors';
import { apiService } from '../lib/api';
import { transformLotsData } from '../lib/dataTransformer';
import { API_CONFIG } from '../config/api';

export default function HomeScreen() {
  const [parkingLots, setParkingLots] = useState([]);
  const [selectedParking, setSelectedParking] = useState(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  /**
   * Fetch all parking lots from API
   */
  const fetchParkingLots = async () => {
    try {
      console.log('Fetching parking lots...');
      const response = await apiService.fetchAllLots();
      
      if (Array.isArray(response)) {
        const transformedLots = transformLotsData(response);
        setParkingLots(transformedLots);
        setError(null);
        setRetryCount(0);
        console.log(`Successfully fetched ${transformedLots.length} lots`);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching lots:', err);
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      
      // After 5 failed attempts, show error message
      if (newRetryCount >= API_CONFIG.MAX_RETRY_ATTEMPTS) {
        setError(err.message || 'Failed to load parking data. Check your connection.');
        setLoading(false);
      }
    }
  };

  /**
   * Initial load on component mount
   */
  useEffect(() => {
    const initiate = async () => {
      setLoading(true);
      await fetchParkingLots();
      setLoading(false);
    };

    initiate();
  }, []);

  /**
   * Polling: Fetch data every 5 seconds
   */
  useEffect(() => {
    const pollingInterval = setInterval(() => {
      // Only poll if not currently loading and no error
      if (!loading && !error) {
        fetchParkingLots();
      }
    }, API_CONFIG.POLLING_INTERVAL);

    return () => clearInterval(pollingInterval);
  }, [loading, error, retryCount]);

  /**
   * Handle manual retry after max attempts reached
   */
  const handleManualRetry = () => {
    setError(null);
    setRetryCount(0);
    setLoading(true);
    fetchParkingLots().then(() => setLoading(false));
  };

  /**
   * Handle map press - show random parking card
   */
  const handleMapPress = () => {
    if (parkingLots.length === 0) {
      Alert.alert('No Data', 'Parking data not loaded yet. Please wait...');
      return;
    }

    const randomIndex = Math.floor(Math.random() * parkingLots.length);
    setSelectedParking(parkingLots[randomIndex]);
    setCardVisible(true);
  };

  const handleCardClose = () => {
    setCardVisible(false);
  };

  const handleSettingsPress = () => {
    Alert.alert('Settings', 'Settings page coming soon!');
  };

  const handleNavigationPress = () => {
    Alert.alert('Navigate', 'Navigation feature coming soon!');
  };

  const handleTalkPress = () => {
    Alert.alert('Talk', 'Voice feature coming soon!');
  };

  /**
   * Render loading state
   */
  if (loading && parkingLots.length === 0) {
    return (
      <View style={styles.container}>
        <TopBar onSettingsPress={handleSettingsPress} />
        <LoadingSpinner message="Fetching parking data..." />
        <BottomNavBar 
          onNavigationPress={handleNavigationPress}
          onTalkPress={handleTalkPress}
        />
      </View>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <View style={styles.container}>
        <TopBar onSettingsPress={handleSettingsPress} />
        <ErrorMessage 
          error={error}
          retryCount={retryCount}
          maxRetries={API_CONFIG.MAX_RETRY_ATTEMPTS}
          onRetry={handleManualRetry}
        />
        <BottomNavBar 
          onNavigationPress={handleNavigationPress}
          onTalkPress={handleTalkPress}
        />
      </View>
    );
  }

  /**
   * Render normal state with map and data
   */
  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <TopBar onSettingsPress={handleSettingsPress} />

      {/* Main Content */}
      <MapPlaceholder onMapPress={handleMapPress} />

      {/* Parking Card Overlay */}
      <ParkingCard 
        visible={cardVisible}
        parking={selectedParking}
        onClose={handleCardClose}
      />

      {/* Bottom Navigation Bar */}
      <BottomNavBar 
        onNavigationPress={handleNavigationPress}
        onTalkPress={handleTalkPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
});
