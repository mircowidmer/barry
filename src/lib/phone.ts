/** A number with country code and nine more digits, such as a Swiss one, reads +41 77 123 45 67. Others stay as they are. */
export const formatPhoneNumber = (number: string): string => {
  const parts = number.replace(/\s/g, '').match(/^\+(\d{2})(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return parts ? `+${parts.slice(1).join(' ')}` : number;
};

/** What a phone number field keeps of the typed text: +, digits and spaces. */
export const phoneInput = (text: string): string => text.replace(/[^+\d ]/g, '');
