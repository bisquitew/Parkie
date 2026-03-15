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
import { apiService } from '../lib/api';
import { transformLotsData, transformLotData } from '../lib/dataTransformer';
import { API_CONFIG } from '../config/api';
import { supabase } from '../lib/supabase';

export default function HomeScreen() {
  const [parkingLots, setParkingLots] = useState([]);
  const [selectedParking, setSelectedParking] = useState(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [destinationCoord, setDestinationCoord] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const fetchParkingLots = async () => {
    try {
      const response = await apiService.fetchAllLots();
      if (Array.isArray(response)) {
        const transformedLots = transformLotsData(response);
        setParkingLots(transformedLots);
        setError(null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err?.message || 'Failed to load parking data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParkingLots();

    // Subscribe to realtime updates for the parking_lots table
    const subscription = supabase
      .channel('parking-lots-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'parking_lots',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedLot = transformLotData(payload.new);
            setParkingLots((prevLots) =>
              prevLots.map((lot) => (lot.id === updatedLot.id ? updatedLot : lot))
            );
            
            // If the selected lot was updated, update its state too
            setSelectedParking((prevSelected) => {
              if (prevSelected && prevSelected.id === updatedLot.id) {
                return updatedLot;
              }
              return prevSelected;
            });
          } else if (payload.eventType === 'INSERT') {
            const newLot = transformLotData(payload.new);
            setParkingLots((prevLots) => [...prevLots, newLot]);
          } else if (payload.eventType === 'DELETE') {
            setParkingLots((prevLots) =>
              prevLots.filter((lot) => lot.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Fetch user location for search biasing
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
        console.warn('Could not get user location for search bias:', e);
      }
    })();
  }, []);

  const handleManualRetry = () => {
    setError(null);
    setLoading(true);
    fetchParkingLots();
  };

  const handleMarkerPress = (lot) => {
    setSelectedParking(lot);
    setCardVisible(true);
  };

  const handleCardClose = () => setCardVisible(false);
  const handleNavigationPress = () => setSearchVisible(true);

  const handleSearchComplete = (coord) => {
    setDestinationCoord(coord);
  };

  const handleLotSelect = (lot) => {
    setSelectedParking(lot);
    setCardVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBarWrapper}>
          <TopBar />
        </View>

        {/* Map in the middle */}
        <View style={styles.mapWrapper}>
          <GoogleMaps 
            parkingLots={parkingLots} 
            onMarkerPress={handleMarkerPress}
            destinationCoord={destinationCoord}
            onClearDestination={() => setDestinationCoord(null)}
          />
        </View>

        {/* Floating Bottom Nav */}
        <View style={styles.bottomNavWrapper}>
          <BottomNavBar 
            onNavigationPress={handleNavigationPress}
          />
        </View>

        {/* Parking Card Overlay */}
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
