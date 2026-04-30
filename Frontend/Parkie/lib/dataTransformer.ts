/**
 * Transform backend parking lot data to frontend model
 * Backend: {id, name, capacity, available_spots, last_updated, status_color}
 * Frontend: {id, name, available, occupied, status, capacity, lastUpdated}
 */
export const transformLotData = (backendLot) => {
  if (!backendLot) return null;

  const occupied = backendLot.capacity - backendLot.available_spots;

  return {
    id: backendLot.id,
    name: backendLot.name,
    available: backendLot.available_spots,
    occupied: Math.max(0, occupied), // Ensure non-negative
    status: backendLot.status_color,
    capacity: backendLot.capacity,
    lastUpdated: backendLot.last_updated,
    latitude: backendLot.latitude,
    longitude: backendLot.longitude
  };
};

/**
 * Transform array of backend lots to frontend model
 */
export const transformLotsData = (backendLots) => {
  if (!Array.isArray(backendLots)) return [];
  
  return backendLots.map(lot => transformLotData(lot));
};

/**
 * Format timestamp for display
 * Example: "2:45 PM" or "Just now"
 */
export const formatTimestamp = (isoString) => {
  if (!isoString) return 'Unknown';

  try {
    // Normalize timestamp to always be parsed as UTC.
    // PostgreSQL/Python may return: "2026-03-14 21:25:00" (space, no T, no Z)
    // or "2026-03-14T21:25:00" (T, no Z). Both must be treated as UTC.
    let formattedIso = isoString;
    if (typeof isoString === 'string') {
      // Replace space separator with T (handles Python/Postgres format)
      formattedIso = formattedIso.replace(' ', 'T');
      // Strip microseconds if present (e.g. .123456) to avoid parse issues
      formattedIso = formattedIso.replace(/\.\d+$/, '');
      // Append Z if there is no timezone info at all
      if (!formattedIso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(formattedIso)) {
        formattedIso = `${formattedIso}Z`;
      }
    }

    const date = new Date(formattedIso);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', isoString);
      return 'Unknown';
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    // If timestamp is in the future (can happen due to clock skew)
    if (diffInSeconds < 0) {
      return 'Just now';
    }

    // Less than 1 minute
    if (diffInSeconds < 60) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    }

    // Less than 1 day
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    }

    // Default: HH:MM format
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Failed to format timestamp:', error);
    return 'Unknown';
  }
};
