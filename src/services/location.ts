import * as Location from 'expo-location';
import type { ExpenseLocation } from '../store/useExpenses';

export async function capturePurchaseLocation(): Promise<ExpenseLocation | null> {
  const current = await Location.getForegroundPermissionsAsync();
  const perm = current.status === 'granted'
    ? current
    : await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return null;

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  let address: string | undefined;
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places[0];
    if (place) {
      const parts = [place.name, place.street, place.city].filter(Boolean);
      address = parts.length > 0 ? parts.join(', ') : undefined;
    }
  } catch {
    address = undefined;
  }

  return {
    lat: latitude,
    lng: longitude,
    ...(address ? { address } : {}),
  };
}
