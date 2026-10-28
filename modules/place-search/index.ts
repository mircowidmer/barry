import { requireNativeModule } from 'expo';

export type FoundPlace = { name: string; subtitle: string; latitude: number; longitude: number };

type Near = { latitude: number; longitude: number };

const PlaceSearch = requireNativeModule<{ search(query: string, near: Near | null): Promise<FoundPlace[]> }>('PlaceSearch');

export const searchPlaces = (query: string, near: Near | null) => PlaceSearch.search(query, near);
