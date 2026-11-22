import type { ItemEntry } from '../types';

/**
 * Returns the initial selection for an item modal based on type and available items.
 */
export const getInitialSelection = (
  items: Array<{ name: string; multi?: boolean } | string>,
  existingItems: ItemEntry[],
  type: string,
): string => {
  if (!items || items.length === 0) return '';

  if (type === 'strength') {
    const validItem = items.find((i) => {
      if (!i) return false;
      const itemName = typeof i === 'string' ? i : i.name;
      const isMulti = typeof i === 'string' ? false : i.multi;
      const taken = existingItems.some((ei) => ei.name === itemName);
      return !taken || isMulti;
    });
    if (validItem) {
      return typeof validItem === 'string' ? validItem : (validItem.name ?? '');
    }
    return '';
  }

  const first = items[0];
  if (!first) return '';
  if (typeof first === 'string') return first;
  return first.name ?? '';
};
