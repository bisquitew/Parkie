import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/colors';

export default function LoadingSpinner({ message = 'Loading parking data...' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.secondary} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: typography.medium,
    color: colors.secondary,
    textAlign: 'center',
  },
});
