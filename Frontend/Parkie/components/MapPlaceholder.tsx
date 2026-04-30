import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, typography } from '../theme/colors';

const { width } = Dimensions.get('window');

export default function MapPlaceholder({ onMapPress }) {
  return (
    <TouchableOpacity 
      style={styles.mapContainer}
      onPress={onMapPress}
      activeOpacity={0.8}
    >
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>🗺️</Text>
        <Text style={styles.placeholderText}>Click on a parking spot</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    width: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  mapText: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  placeholderText: {
    fontSize: typography.medium,
    color: colors.tertiary,
    fontWeight: '500',
  },
});
