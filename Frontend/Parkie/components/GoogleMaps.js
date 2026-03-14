import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors } from '../theme/colors';

export default function GoogleMaps({ parkingLots, onMarkerPress }) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  // Default region (e.g., a central location if no lots are available)
  const defaultRegion = {
    latitude: 45.4642, // Default to some coordinates if none are available
    longitude: 9.1900,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        setLoading(false);
        return;
      }

      try {
        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (error) {
        setErrorMsg('Could not fetch current location');
        console.warn('Error getting location:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getMarkerColor = (status) => {
    switch (status) {
      case 'green':
        return colors.statusGreen;
      case 'yellow':
        return colors.statusYellow;
      case 'red':
        return colors.statusRed;
      default:
        return colors.statusGray;
    }
  };

  // Determine initial region: User Location > First Lot > Default Region
  const initialRegion = location 
    ? location 
    : parkingLots.length > 0 
      ? {
          latitude: parkingLots[0].latitude,
          longitude: parkingLots[0].longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : defaultRegion;

  if (loading && !location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Calibrating your position...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        // customMapStyle={darkMapStyle} // Temporarily disabled to check for rendering issues
        onMapReady={() => console.log('✅ GoogleMap Component: Map is Ready!')}
        onMapLoaded={() => console.log('✅ GoogleMap Component: Map Tiles Loaded Successfully!')}
        onError={(error) => console.error('❌ GoogleMap Component Error:', error.nativeEvent)}
      >
        {parkingLots.map((lot) => (
          <Marker
            key={lot.id}
            coordinate={{
              latitude: lot.latitude,
              longitude: lot.longitude,
            }}
            pinColor={getMarkerColor(lot.status)}
            onPress={() => onMarkerPress(lot)}
          >
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{lot.name}</Text>
                <Text style={styles.calloutText}>
                  {lot.available} / {lot.capacity} spots available
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      {errorMsg && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 16,
    overflow: 'hidden', // Ensures the map respects the borderRadius
    backgroundColor: colors.secondary,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
    fontSize: 14,
  },
  callout: {
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 150,
  },
  calloutTitle: {
    color: colors.textPrimary,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  calloutText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 120, // Avoid overlapping the BottomNavBar
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});

// Dark map style for a premium look
const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#181818"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#1b1b1b"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#2c2c2c"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#8a8a8a"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#373737"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#3c3c3c"
      }
    ]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#4e4e4e"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#3d3d3d"
      }
    ]
  }
];
