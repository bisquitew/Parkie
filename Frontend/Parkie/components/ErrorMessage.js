import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/colors';

export default function ErrorMessage({
  error,
  retryCount,
  maxRetries,
  onRetry
}) {
  const [countdown, setCountdown] = useState(0);
  const remainingRetries = maxRetries - retryCount;
  const showManualRetry = remainingRetries <= 0;

  useEffect(() => {
    if (!showManualRetry && remainingRetries > 0) {
      setCountdown(3);
    }
  }, [showManualRetry, remainingRetries]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  return (
    <View style={styles.container}>
      {/* Error Icon */}
      <Text style={styles.errorIcon}>⚠️</Text>

      {/* Error Message */}
      <Text style={styles.errorText}>{error}</Text>

      {/* Retry Info */}
      {!showManualRetry ? (
        <View style={styles.retryInfo}>
          <Text style={styles.retryText}>
            Auto-retrying in {countdown}s...
          </Text>
          <Text style={styles.attemptsText}>
            Attempt {retryCount + 1}/{maxRetries}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.manualRetryButton}
          onPress={onRetry}
        >
          <Text style={styles.manualRetryText}>Tap to Retry</Text>
        </TouchableOpacity>
      )}

      {/* Status */}
      <Text style={styles.statusText}>
        {showManualRetry
          ? '❌ All automatic retries failed'
          : '⏳ Attempting connection...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.medium,
    color: colors.statusRed,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  retryInfo: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  retryText: {
    fontSize: typography.medium,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  attemptsText: {
    fontSize: typography.small,
    color: colors.secondary,
    opacity: 0.7,
  },
  manualRetryButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    marginVertical: spacing.lg,
  },
  manualRetryText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: typography.medium,
  },
  statusText: {
    fontSize: typography.small,
    color: colors.secondary,
    marginTop: spacing.md,
    opacity: 0.6,
  },
});
