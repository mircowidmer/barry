import { useLocalSearchParams } from 'expo-router';

/** A route param that holds one string. A missing param, or one given more than once, is undefined. */
export function useStringParam<T extends string = string>(name: string): T | undefined {
  const value = useLocalSearchParams()[name];
  return typeof value === 'string' ? (value as T) : undefined;
}
