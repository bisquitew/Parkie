import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/colors';

export default function TopBar({ onSettingsPress }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity 
        style={styles.iconButton}
        onPress={onSettingsPress}
      >
        <Text style={styles.icon}>⚙️</Text>
      </TouchableOpacity>

      <Text style={styles.logo}>PARKIE</Text>

      <TouchableOpacity style={styles.iconButton}>
        <Text style={styles.icon}>🔔</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.glassBackground,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  icon: {
    fontSize: 20,
  },
  logo: {
    fontSize: typography.xlarge,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 3,
  },
});
