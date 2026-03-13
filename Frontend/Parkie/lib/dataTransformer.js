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
    lastUpdated: backendLot.last_updated
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
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

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
