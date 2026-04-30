import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiService } from '../lib/api';
import { transformLotsData, transformLotData } from '../lib/dataTransformer';
import { TransformedLot } from '../types/parking';

export function useParkingLots() {
  const [parkingLots, setParkingLots] = useState<TransformedLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParkingLots = async () => {
    try {
      const response = await apiService.fetchAllLots();
      if (Array.isArray(response)) {
        const transformedLots = transformLotsData(response);
        setParkingLots(transformedLots);
        setError(null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load parking data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParkingLots();

    const subscription = supabase
      .channel('parking-lots-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parking_lots',
        },
        (payload: any) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          if (eventType === 'UPDATE' || eventType === 'INSERT') {
            const isVerified = newRecord.is_verified;
            const transformedLot = transformLotData(newRecord);

            setParkingLots((prevLots) => {
              const exists = prevLots.find((l) => l.id === transformedLot.id);
              if (isVerified) {
                if (exists) {
                  return prevLots.map((l) => (l.id === transformedLot.id ? transformedLot : l));
                } else {
                  return [...prevLots, transformedLot];
                }
              } else {
                return prevLots.filter((l) => l.id !== transformedLot.id);
              }
            });
          } else if (eventType === 'DELETE') {
            setParkingLots((prevLots) =>
              prevLots.filter((lot) => lot.id !== oldRecord.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return { parkingLots, loading, error, refresh: fetchParkingLots };
}
