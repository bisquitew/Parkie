import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme/colors';

export default function BottomNavBar({ onNavigationPress }) {
  return (
    <View style={styles.navBar}>
      <TouchableOpacity
        style={styles.navButton}
        onPress={onNavigationPress}
      >
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>📍</Text>
        </View>
        <Text style={styles.label}>NAVIGATE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.glassBackground,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
    paddingHorizontal: spacing.md,
  },
  navButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
