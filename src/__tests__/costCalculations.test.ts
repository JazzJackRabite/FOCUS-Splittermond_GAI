import { describe, it, expect } from 'vitest';
import { getSkillXpCost, getAttrXpCost } from '../utils/costCalculations';

describe('costCalculations (Splittermond GRW)', () => {
  describe('getSkillXpCost', () => {
    it('returns 3 EP for skill values 1 to 6', () => {
      for (let v = 1; v <= 6; v++) {
        expect(getSkillXpCost(v)).toBe(3);
      }
    });

    it('returns 5 EP for skill values 7 to 9', () => {
      for (let v = 7; v <= 9; v++) {
        expect(getSkillXpCost(v)).toBe(5);
      }
    });

    it('returns 7 EP for skill values 10 to 12', () => {
      for (let v = 10; v <= 12; v++) {
        expect(getSkillXpCost(v)).toBe(7);
      }
    });

    it('returns 9 EP for skill values 13 to 15', () => {
      for (let v = 13; v <= 15; v++) {
        expect(getSkillXpCost(v)).toBe(9);
      }
    });
  });

  describe('getAttrXpCost', () => {
    it('returns 10 EP for 1st attribute increase (currentInc = 0)', () => {
      expect(getAttrXpCost(0)).toBe(10);
    });

    it('returns 15 EP for 2nd attribute increase (currentInc = 1)', () => {
      expect(getAttrXpCost(1)).toBe(15);
    });

    it('returns 20 EP for 3rd attribute increase (currentInc = 2)', () => {
      expect(getAttrXpCost(2)).toBe(20);
    });

    it('returns 25 EP for 4th attribute increase (currentInc = 3)', () => {
      expect(getAttrXpCost(3)).toBe(25);
    });
  });
});
