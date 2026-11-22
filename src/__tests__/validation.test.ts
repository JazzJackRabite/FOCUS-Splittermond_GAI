import { describe, it, expect } from 'vitest';
import { validateFreeMasteryAssignment } from '../utils/validation';

describe('validateFreeMasteryAssignment (Splittermond GRW)', () => {
  it('allows Tier 1 mastery with FW 6', () => {
    // FW 6 provides 1 slot of tier 1
    expect(validateFreeMasteryAssignment(6, [1])).toBe(true);
  });

  it('rejects Tier 2 mastery with only FW 6', () => {
    expect(validateFreeMasteryAssignment(6, [2])).toBe(false);
  });

  it('allows Tier 1 and Tier 2 masteries with FW 9', () => {
    // FW 9 provides slots [1, 2]
    expect(validateFreeMasteryAssignment(9, [1, 2])).toBe(true);
    expect(validateFreeMasteryAssignment(9, [1, 1])).toBe(true); // Higher slot (2) can be used for Tier 1
  });

  it('allows two Tier 1 masteries with FW 9 because Tier 2 slot satisfies Tier 1', () => {
    expect(validateFreeMasteryAssignment(9, [1, 1])).toBe(true);
  });

  it('rejects three masteries with only FW 9 (only 2 slots available)', () => {
    expect(validateFreeMasteryAssignment(9, [1, 1, 1])).toBe(false);
  });

  it('allows Tier 1, 2, 3 with FW 12', () => {
    expect(validateFreeMasteryAssignment(12, [1, 2, 3])).toBe(true);
  });

  it('allows Tier 4 mastery with FW 15', () => {
    expect(validateFreeMasteryAssignment(15, [4])).toBe(true);
  });
});
