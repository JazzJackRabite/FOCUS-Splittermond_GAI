/**
 * Validates that free mastery tiers can be assigned given the current skill value.
 * Returns true if the assignment is valid.
 */
export const validateFreeMasteryAssignment = (
  skillVal: number,
  freeMasteriesTiers: number[],
): boolean => {
  const slots: number[] = [];
  if (skillVal >= 6) slots.push(1);
  if (skillVal >= 9) slots.push(2);
  if (skillVal >= 12) slots.push(3);
  if (skillVal >= 15) slots.push(4);

  const needed = [...freeMasteriesTiers].sort((a, b) => b - a);
  slots.sort((a, b) => b - a);

  for (const mTier of needed) {
    const slotIndex = slots.findIndex((s) => s >= mTier);
    if (slotIndex === -1) return false;
    slots.splice(slotIndex, 1);
  }
  return true;
};
