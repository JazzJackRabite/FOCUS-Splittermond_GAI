/**
 * Robust UUID generator with crypto.randomUUID fallback
 */
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback below
    }
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};
