import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, SafeAreaView } from 'react-native';
import TopBar from '../components/TopBar';
import GoogleMaps from '../components/GoogleMaps';
import ParkingCard from '../components/ParkingCard';
import BottomNavBar from '../components/BottomNavBar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import NearbySearch from '../components/NearbySearch';
import * as Location from 'expo-location';
import { colors } from '../theme/colors';
import { useParkingLots } from '../hooks/useParkingLots';
import { TransformedLot } from '../types/parking';

export default function HomeScreen() {
  const { parkingLots, loading, error, refresh } = useParkingLots();
  const [selectedParking, setSelectedParking] = useState<TransformedLot | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [destinationCoord, setDestinationCoord] = useState<{latitude: number, longitude: number} | null>(null);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);

  // Update selected parking if it's updated in the list
  useEffect(() => {
    if (selectedParking) {
      const updated = parkingLots.find(l => l.id === selectedParking.id);
      if (updated) {
        setSelectedParking(updated);
      } else {
        setSelectedParking(null);
        setCardVisible(false);
      }
    }
  }, [parkingLots]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (e) {
        console.warn('Could not get user location:', e);
      }
    })();
  }, []);

  const handleMarkerPress = (lot: TransformedLot) => {
    setSelectedParking(lot);
    setCardVisible(true);
  };

  const handleCardClose = () => setCardVisible(false);
  const handleNavigationPress = () => setSearchVisible(true);

  const handleSearchComplete = (coord: {latitude: number, longitude: number}) => {
    setDestinationCoord(coord);
  };

  const handleLotSelect = (lot: TransformedLot) => {
    setSelectedParking(lot);
    setCardVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.topBarWrapper}>
          <TopBar />
        </View>

        <View style={styles.mapWrapper}>
          <GoogleMaps
            parkingLots={parkingLots}
            onMarkerPress={handleMarkerPress}
            destinationCoord={destinationCoord}
            onClearDestination={() => setDestinationCoord(null)}
          />
        </View>

        <View style={styles.bottomNavWrapper}>
          <BottomNavBar
            onNavigationPress={handleNavigationPress}
          />
        </View>

        <ParkingCard
          visible={cardVisible}
          parking={selectedParking}
          onClose={handleCardClose}
        />

        <NearbySearch
          visible={searchVisible}
          parkingLots={parkingLots}
          userLocation={userLocation}
          onClose={() => setSearchVisible(false)}
          onLotSelect={handleLotSelect}
          onSearchComplete={handleSearchComplete}
        />

        {loading && parkingLots.length === 0 && (
          <View style={styles.overlayContainer}>
            <LoadingSpinner message="Locating spots..." />
          </View>
        )}

        {error && (
          <View style={styles.overlayContainer}>
            <ErrorMessage
              error={error}
              onRetry={refresh}
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
    marginTop: 10,
    marginHorizontal: 16,
    zIndex: 10,
  },
  bottomNavWrapper: {
    marginBottom: 20,
    marginHorizontal: 16,
    zIndex: 10,
  },
  mapWrapper: {
    flex: 1,
    zIndex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  }
});
