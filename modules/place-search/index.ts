import { requireOptionalNativeModule } from 'expo';

export type FoundPlace = { name: string; subtitle: string; latitude: number; longitude: number };

type Near = { latitude: number; longitude: number };

// Only Apple has the module; elsewhere the search finds nothing instead of failing every import of the client module.
const PlaceSearch = requireOptionalNativeModule<{ search(query: string, near: Near | null): Promise<FoundPlace[]> }>('PlaceSearch');

export const searchPlaces = async (query: string, near: Near | null): Promise<FoundPlace[]> =>
  PlaceSearch ? PlaceSearch.search(query, near) : [];
