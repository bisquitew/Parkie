import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing, typography } from '../theme/colors';

// ─── Haversine distance (meters) ─────────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_PRIORITY = { green: 0, yellow: 1, red: 2, gray: 3 };
const STATUS_COLOR = {
  green: colors.statusGreen,
  yellow: colors.statusYellow,
  red: colors.statusRed,
  gray: colors.statusGray,
};

function rankLots(lots, destLat, destLon, radiusMeters = 500) {
  return lots
    .filter(
      (l) =>
        l.latitude &&
        l.longitude &&
        haversineDistance(destLat, destLon, l.latitude, l.longitude) <= radiusMeters
    )
    .map((l) => ({
      ...l,
      distanceM: Math.round(haversineDistance(destLat, destLon, l.latitude, l.longitude)),
      occupancyPct: l.capacity > 0 ? (l.occupied ?? 0) / l.capacity : 1,
    }))
    .sort((a, b) => {
      const occDiff = a.occupancyPct - b.occupancyPct;
      if (Math.abs(occDiff) > 0.01) return occDiff;
      return (STATUS_PRIORITY[a.status] ?? 3) - (STATUS_PRIORITY[b.status] ?? 3);
    });
}

// ─── Nominatim autocomplete (OpenStreetMap, no API key) ──────────────────────
async function fetchSuggestions(query) {
  if (!query || query.trim().length < 3) return [];
  const encoded = encodeURIComponent(query.trim());
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=6&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'ParkieApp/1.0' },
  });
  const data = await res.json();
  return data.map((item) => ({
    label: item.display_name,
    shortLabel: item.name || item.display_name.split(',')[0],
    secondary: item.display_name.split(',').slice(1, 3).join(',').trim(),
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
  }));
}

// ─── Lot Row ─────────────────────────────────────────────────────────────────
function LotRow({ lot, index, onSelect }) {
  const statusColor = STATUS_COLOR[lot.status] ?? colors.statusGray;
  const freePercent = Math.round((1 - lot.occupancyPct) * 100);
  return (
    <TouchableOpacity style={styles.lotRow} onPress={() => onSelect(lot)}>
      <View style={[styles.rankBadge, { borderColor: statusColor }]}>
        <Text style={[styles.rankText, { color: statusColor }]}>#{index + 1}</Text>
      </View>
      <View style={styles.lotInfo}>
        <Text style={styles.lotName} numberOfLines={1}>{lot.name}</Text>
        <Text style={styles.lotMeta}>{lot.distanceM}m away · {lot.available ?? 0} free spots</Text>
      </View>
      <View style={[styles.freePill, { backgroundColor: statusColor + '33' }]}>
        <Text style={[styles.freeText, { color: statusColor }]}>{freePercent}%</Text>
        <Text style={styles.freeLabel}>free</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NearbySearch({ visible, parkingLots, onClose, onLotSelect, onSearchComplete }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null); // cached coord from suggestion tap
  const debounceRef = useRef(null);

  // ── Debounced autocomplete ─────────────────────────────────────────────────
  useEffect(() => {
    // Clear cached coord if user edits query after selecting a suggestion
    setSelectedSuggestion(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const s = await fetchSuggestions(query);
        setSuggestions(s);
      } catch (e) {
        console.warn('Suggestion fetch failed:', e);
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // ── Suggestion tap — fill input and pre-cache coords ─────────────────────
  const handleSuggestionSelect = (suggestion) => {
    setQuery(suggestion.shortLabel + (suggestion.secondary ? `, ${suggestion.secondary}` : ''));
    setSuggestions([]);
    setSelectedSuggestion(suggestion); // skip geocoding, we already have coords
  };

  // ── Search with pre-cached coords (from suggestion) or geocode ────────────
  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setErrorMsg(null);
    setResults(null);
    setSuggestions([]);

    try {
      let latitude, longitude;

      if (selectedSuggestion) {
        // Already have coords from the suggestion — no extra geocode needed
        ({ latitude, longitude } = selectedSuggestion);
      } else {
        // Fall back to expo-location geocoder
        const geocoded = await Location.geocodeAsync(query.trim());
        if (!geocoded || geocoded.length === 0) {
          setErrorMsg('Address not found. Try a different search or pick a suggestion.');
          setSearching(false);
          return;
        }
        ({ latitude, longitude } = geocoded[0]);
      }

      const ranked = rankLots(parkingLots, latitude, longitude, 500);
      if (onSearchComplete) onSearchComplete({ latitude, longitude }, ranked);

      if (ranked.length === 1) {
        onLotSelect(ranked[0]);
        handleClose();
        return;
      }
      setResults(ranked);
    } catch (err) {
      setErrorMsg('Search failed. Check your connection and try again.');
      console.warn('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleClose = () => {
    setQuery('');
    setSuggestions([]);
    setResults(null);
    setErrorMsg(null);
    setSelectedSuggestion(null);
    onClose();
  };

  const handleLotSelect = (lot) => {
    onLotSelect(lot);
    handleClose();
  };

  const showSuggestions = suggestions.length > 0 || suggestionsLoading;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <Text style={styles.title}>Find Parking Near</Text>
        <Text style={styles.subtitle}>Type your destination to see nearby lots</Text>

        {/* Search input row */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Iulius Mall, Timișoara"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          <TouchableOpacity
            style={[styles.searchBtn, (searching || !query.trim()) && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={searching || !query.trim()}
          >
            {searching ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.searchBtnText}>Go</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Autocomplete suggestions */}
        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            {suggestionsLoading ? (
              <View style={styles.suggestionsLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.suggestionsLoadingText}>Searching places…</Text>
              </View>
            ) : (
              suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.suggestionRow, i < suggestions.length - 1 && styles.suggestionBorder]}
                  onPress={() => handleSuggestionSelect(s)}
                >
                  <Text style={styles.suggestionIcon}>📍</Text>
                  <View style={styles.suggestionText}>
                    <Text style={styles.suggestionPrimary} numberOfLines={1}>{s.shortLabel}</Text>
                    {!!s.secondary && (
                      <Text style={styles.suggestionSecondary} numberOfLines={1}>{s.secondary}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Error */}
        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Results */}
        {results !== null && !showSuggestions && (
          <>
            <Text style={styles.resultsHeader}>
              {results.length === 0
                ? 'No lots found within 500m'
                : `${results.length} lot${results.length > 1 ? 's' : ''} found nearby`}
            </Text>
            {results.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🅿️</Text>
                <Text style={styles.emptyText}>Try a closer destination or check the address.</Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item, index }) => (
                  <LotRow lot={item} index={index} onSelect={handleLotSelect} />
                )}
                style={styles.list}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl + 10,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glassBorder,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: typography.xlarge, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  subtitle: { fontSize: typography.small, color: colors.textSecondary, marginBottom: spacing.md },

  // Input
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontSize: typography.medium,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 56,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnText: { color: colors.white, fontWeight: '800', fontSize: typography.medium },

  // Suggestions dropdown
  suggestionsContainer: {
    backgroundColor: colors.secondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  suggestionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
  },
  suggestionsLoadingText: { color: colors.textSecondary, fontSize: typography.small },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.sm,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  suggestionIcon: { fontSize: 14 },
  suggestionText: { flex: 1 },
  suggestionPrimary: {
    color: colors.textPrimary,
    fontSize: typography.medium,
    fontWeight: '600',
  },
  suggestionSecondary: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginTop: 1,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.statusRed + '50',
  },
  errorText: { color: colors.statusRed, fontSize: typography.small, textAlign: 'center' },

  // Results
  resultsHeader: {
    fontSize: typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  list: { flexGrow: 0 },

  // Lot row
  lotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 16,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.sm,
  },
  rankBadge: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 11, fontWeight: '800' },
  lotInfo: { flex: 1 },
  lotName: { color: colors.textPrimary, fontWeight: '700', fontSize: typography.medium, marginBottom: 2 },
  lotMeta: { color: colors.textSecondary, fontSize: typography.small },
  freePill: { borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'center', minWidth: 44 },
  freeText: { fontWeight: '800', fontSize: typography.medium },
  freeLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: '600', letterSpacing: 0.3 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: typography.medium, textAlign: 'center', maxWidth: 240 },
});
