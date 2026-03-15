import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking } from 'react-native';
import { colors, spacing, typography } from '../theme/colors';
import { formatTimestamp } from '../lib/dataTransformer';

export default function ParkingCard({ visible, parking, onClose }) {
  if (!parking) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'green':
        return colors.statusGreen;
      case 'yellow':
        return colors.statusYellow;
      case 'red':
        return colors.statusRed;
      case 'gray':
        return colors.statusGray;
      default:
        return colors.textSecondary;
    }
  };

  const statusColor = getStatusColor(parking.status);
  const occupancyPercent = parking.capacity > 0
    ? Math.round((parking.occupied / parking.capacity) * 100)
    : 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={() => { }} // Prevent closing when touching card
        >
          {/* Floating Glow Effect (Subtle) */}
          <View style={[styles.glow, { shadowColor: statusColor }]} />

          {/* Parking Name */}
          <Text style={styles.parkingName}>{parking.name}</Text>

          {/* Divider (Violet) */}
          <View style={styles.divider} />

          {/* Info Rows */}
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Available</Text>
              <Text style={[styles.infoValue, { color: colors.statusGreen }]}>{parking.available}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Occupied</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{parking.occupied}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Capacity</Text>
              <Text style={styles.infoValue}>{occupancyPercent}%</Text>
            </View>
          </View>

          {/* Status Badge */}
          <View style={styles.statusBadgeContainer}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>
                {(parking.status ?? 'unknown').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Last Updated */}
          <Text style={styles.lastUpdated}>
            Scanned: {formatTimestamp(parking.lastUpdated)}
          </Text>

          {/* Navigate Button */}
          {parking.latitude && parking.longitude && (
            <TouchableOpacity
              style={styles.navigateButton}
              onPress={() => {
                const lat = parking.latitude;
                const lng = parking.longitude;
                const label = encodeURIComponent(parking.name || 'Parking Lot');
                // Use https Apple Maps URL — works in both Expo Go and standalone builds
                const url = `https://maps.apple.com/?q=${label}&ll=${lat},${lng}&dirflg=d`;
                Linking.openURL(url).catch(() =>
                  console.warn('Could not open Apple Maps')
                );
              }}
            >
              <Text style={styles.navigateText}>🧭  Navigate Here</Text>
            </TouchableOpacity>
          )}

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.glassBackground,
    borderRadius: 30, // High roundedness
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 50,
    zIndex: -1,
  },
  parkingName: {
    fontSize: typography.xlarge,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.primary,
    opacity: 0.3,
    marginBottom: spacing.lg,
    width: '60%',
    alignSelf: 'center',
  },
  infoContainer: {
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: spacing.sm,
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: typography.medium,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: typography.large,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statusBadgeContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 25,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  statusText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: typography.medium,
    letterSpacing: 1,
  },
  lastUpdated: {
    fontSize: typography.small,
    color: colors.textSecondary,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  navigateButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  navigateText: {
    color: colors.white,
    fontSize: typography.medium,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeText: {
    fontSize: typography.large,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
});
