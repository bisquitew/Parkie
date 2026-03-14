import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, StatusBar, SafeAreaView } from 'react-native';
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

  const fetchParkingLots = async () => {
    try {
      const response = await apiService.fetchAllLots();
      if (Array.isArray(response)) {
        const transformedLots = transformLotsData(response);
        setParkingLots(transformedLots);
        setError(null);
        setRetryCount(0);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      if (newRetryCount >= (API_CONFIG.MAX_RETRIES || 3)) {
        setError(err?.message || 'Failed to load parking data.');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const initiate = async () => {
      setLoading(true);
      await fetchParkingLots();
      setLoading(false);
    };
    initiate();
  }, []);

  useEffect(() => {
    const pollingInterval = setInterval(() => {
      if (!loading && !error) {
        fetchParkingLots();
      }
    }, API_CONFIG.POLLING_INTERVAL);
    return () => clearInterval(pollingInterval);
  }, [loading, error, retryCount]);

  const handleManualRetry = () => {
    setError(null);
    setRetryCount(0);
    setLoading(true);
    fetchParkingLots().then(() => setLoading(false));
  };

  const handleMapPress = () => {
    if (parkingLots.length === 0) {
      Alert.alert('No Data', 'Parking data not loaded yet.');
      return;
    }
    const randomIndex = Math.floor(Math.random() * parkingLots.length);
    setSelectedParking(parkingLots[randomIndex]);
    setCardVisible(true);
  };

  const handleCardClose = () => setCardVisible(false);
  const handleSettingsPress = () => Alert.alert('Settings', 'Coming soon!');
  const handleNavigationPress = () => Alert.alert('Navigate', 'Coming soon!');
  const handleTalkPress = () => Alert.alert('Talk', 'Voice feature coming soon!');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Map is at the bottom layer */}
        <MapPlaceholder onMapPress={handleMapPress} />

        {/* Floating Top Bar */}
        <View style={styles.topBarWrapper}>
          <TopBar onSettingsPress={handleSettingsPress} />
        </View>

        {/* Parking Card Overlay */}
        <ParkingCard 
          visible={cardVisible}
          parking={selectedParking}
          onClose={handleCardClose}
        />

        {/* Floating Bottom Nav */}
        <View style={styles.bottomNavWrapper}>
          <BottomNavBar 
            onNavigationPress={handleNavigationPress}
            onTalkPress={handleTalkPress}
          />
        </View>

        {loading && parkingLots.length === 0 && (
          <View style={styles.overlayContainer}>
             <LoadingSpinner message="Locating spots..." />
          </View>
        )}

        {error && (
          <View style={styles.overlayContainer}>
            <ErrorMessage 
              error={error}
              retryCount={retryCount}
              maxRetries={API_CONFIG.MAX_RETRIES || 3}
              onRetry={handleManualRetry}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBarWrapper: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    zIndex: 10,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  }
});
