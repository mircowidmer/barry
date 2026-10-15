export type PushRegistration = 'registered' | 'denied' | 'unavailable';

export const registerForPush = async (): Promise<PushRegistration> => 'unavailable';
