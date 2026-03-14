import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors } from '../theme/colors';

// ─── Custom Pin Component ─────────────────────────────────────────────────────
function ParkingPin({ status, available, selected }) {
  const pinColor = getPinColor(status);
  return (
    <View style={[styles.pinWrapper, selected && styles.pinWrapperSelected]}>
      <View style={[styles.pinBubble, { backgroundColor: pinColor, borderColor: selected ? '#fff' : pinColor }]}>
        <Text style={styles.pinAvailable}>{available ?? '?'}</Text>
        <Text style={styles.pinLabel}>free</Text>
      </View>
      {/* Triangle tail */}
      <View style={[styles.pinTail, { borderTopColor: pinColor }]} />
    </View>
  );
}

function getPinColor(status) {
  switch (status) {
    case 'green':  return colors.statusGreen;
    case 'yellow': return colors.statusYellow;
    case 'red':    return colors.statusRed;
    default:       return colors.statusGray;
  }
}

// ─── Destination Pin ─────────────────────────────────────────────────────────
function DestinationPin() {
  return (
    <View style={styles.destWrapper}>
      <View style={styles.destBubble}>
        <Text style={styles.destIcon}>📍</Text>
      </View>
      <View style={styles.destTail} />
    </View>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function GoogleMaps({ parkingLots = [], onMarkerPress, destinationCoord }) {
  const [userLocation, setUserLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLotId, setSelectedLotId] = useState(null);
  const mapRef = useRef(null);

  // ── Determine initial region ──────────────────────────────────────────────
  const getInitialRegion = () => {
    if (userLocation) return userLocation;
    if (parkingLots.length > 0 && parkingLots[0].latitude) {
      return {
        latitude: parkingLots[0].latitude,
        longitude: parkingLots[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    return {
      latitude: 45.4642,
      longitude: 9.1900,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  };

  // ── Request Location ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Location permission denied');
          setLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (e) {
        console.warn('Location error:', e);
        setErrorMsg('Could not get your location');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── When lots load, fit map to show all of them ───────────────────────────
  useEffect(() => {
    if (!mapRef.current || parkingLots.length === 0) return;
    const validLots = parkingLots.filter(l => l.latitude && l.longitude);
    if (validLots.length === 0) return;

    const coords = validLots.map(l => ({ latitude: l.latitude, longitude: l.longitude }));
    // Add user location to the fit if available
    if (userLocation) coords.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: true,
    });
  }, [parkingLots, userLocation]);

  // ── Re-fit when destination changes ──────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !destinationCoord) return;
    const coords = [{ latitude: destinationCoord.latitude, longitude: destinationCoord.longitude }];
    // Include any lots near the destination
    parkingLots
      .filter(l => l.latitude && l.longitude)
      .forEach(l => coords.push({ latitude: l.latitude, longitude: l.longitude }));
    if (userLocation) coords.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 100, right: 60, bottom: 140, left: 60 },
      animated: true,
    });
  }, [destinationCoord]);

  // ── Marker press handler ──────────────────────────────────────────────────
  const handleMarkerPress = (lot) => {
    setSelectedLotId(lot.id);
    if (onMarkerPress) onMarkerPress(lot);
  };

  const handleNavigate = (lot) => {
    const lat = lot.latitude;
    const lng = lot.longitude;
    const label = encodeURIComponent(lot.name || 'Parking Lot');
    // Use https Apple Maps URL — works in both Expo Go and standalone builds
    const url = `https://maps.apple.com/?q=${label}&ll=${lat},${lng}&dirflg=d`;
    Linking.openURL(url).catch(() =>
      console.warn('Could not open Apple Maps')
    );
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Calibrating your position…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={getInitialRegion()}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onMapReady={() => console.log('✅ Map Ready')}
        onError={(e) => console.error('❌ Map Error:', e.nativeEvent)}
      >
        {parkingLots
          .filter(lot => lot.latitude && lot.longitude)
          .map((lot) => (
            <Marker
              key={lot.id}
              coordinate={{ latitude: lot.latitude, longitude: lot.longitude }}
              onPress={() => handleMarkerPress(lot)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
            >
              {/* Custom View-based marker — no image needed */}
              <ParkingPin
                status={lot.status}
                available={lot.available}
                selected={selectedLotId === lot.id}
              />
            </Marker>
          ))}

        {/* Destination pin */}
        {destinationCoord && (
          <Marker
            key="destination"
            coordinate={{ latitude: destinationCoord.latitude, longitude: destinationCoord.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <DestinationPin />
          </Marker>
        )}
      </MapView>

      {/* Re-center button */}
      {userLocation && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={() =>
            mapRef.current?.animateToRegion(userLocation, 600)
          }
        >
          <Text style={styles.recenterIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {/* Error banner */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Lot count badge */}
      {parkingLots.length > 0 && (
        <View style={styles.lotCountBadge}>
          <Text style={styles.lotCountText}>
            {parkingLots.filter(l => l.latitude && l.longitude).length} lots nearby
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.secondary,
  },
  map: {
    flex: 1,
  },

  // Loading
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

  // Custom Pin
  pinWrapper: {
    alignItems: 'center',
  },
  pinWrapperSelected: {
    transform: [{ scale: 1.15 }],
  },
  pinBubble: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
    minWidth: 44,
  },
  pinAvailable: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 18,
  },
  pinLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 11,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // border color set dynamically on the element
  },

  // Destination Pin
  destWrapper: {
    alignItems: 'center',
  },
  destBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  destIcon: {
    fontSize: 22,
  },
  destTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
  },

  // Re-center button
  recenterBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glassBackground,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  recenterIcon: {
    color: colors.primary,
    fontSize: 22,
  },

  // Lot count badge
  lotCountBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  lotCountText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Error banner
  errorBanner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 68,
    backgroundColor: 'rgba(239,68,68,0.9)',
    padding: 10,
    borderRadius: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});
