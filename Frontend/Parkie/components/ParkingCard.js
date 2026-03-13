import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
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
        return colors.secondary;
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
          onPress={() => {}} // Prevent closing when touching card
        >
          {/* Status Indicator */}
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />

          {/* Parking Name */}
          <Text style={styles.parkingName}>{parking.name}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Info Row 1: Slots Available */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Slots Available</Text>
            <Text style={styles.infoValue}>{parking.available}</Text>
          </View>

          {/* Info Row 2: Slots Occupied */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Slots Occupied</Text>
            <Text style={styles.infoValue}>{parking.occupied}</Text>
          </View>

          {/* Info Row 3: Occupancy Percentage */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Capacity</Text>
            <Text style={styles.infoValue}>{occupancyPercent}%</Text>
          </View>

          {/* Status Badge */}
          <View style={styles.statusBadgeContainer}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>
                {parking.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Last Updated */}
          <Text style={styles.lastUpdated}>
            Last scanned: {formatTimestamp(parking.lastUpdated)}
          </Text>

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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.tertiary,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  statusIndicator: {
    height: 4,
    width: '100%',
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  parkingName: {
    fontSize: typography.xlarge,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infoLabel: {
    fontSize: typography.medium,
    color: colors.secondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: typography.large,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statusBadgeContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  statusText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: typography.medium,
  },
  lastUpdated: {
    fontSize: typography.small,
    color: colors.secondary,
    opacity: 0.7,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: typography.xlarge,
    color: colors.tertiary,
    fontWeight: 'bold',
  },
});
