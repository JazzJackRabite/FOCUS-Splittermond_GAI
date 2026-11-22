/**
 * Die Listen des Grundregelwerks kommen aus dem GRW-Paket (regelwerk/grwListen.ts); ohne Paket sind sie leer
 * (der Editor startet erst mit geladenem Paket).
 */
import { describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import {
  grwAllgemeineKampfmeisterschaften, grwAllgemeineMagiemeisterschaften, grwFertigkeiten, grwFertigkeitsattribute, grwMeisterschaften,
  grwMondzeichen, grwRessourcen, grwSchwaechen, grwSprachen, grwStaerken, grwZauber, schwellenwert, staerkeHoechstens,
  grwRassen, staerkenBudget, grwAttribute, grwAlleFertigkeiten, grwGesundheitsstufen,
} from '../grwListen';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);

describe('GRW-Listen aus dem Paket', () => {
  it('Zauber: 278 Zauber in 419 Schulen; ohne Paket keine', () => {
    const p = grwZauber(K);
    expect(new Set(p.map((s) => s.name)).size).toBe(278);
    expect(p).toHaveLength(419);
    expect(grwZauber(null)).toEqual([]);
  });

  it('Meisterschaften je Fertigkeit und allgemeine Meisterschaften (IDs aus dem Paket)', () => {
    const p = grwMeisterschaften(K);
    expect(Object.values(p).flat()).toHaveLength(413);
    expect(p['Geschichte & Mythen']).toBe(p['Geschichte und Mythen']);
    expect([grwAllgemeineKampfmeisterschaften(K).length, grwAllgemeineMagiemeisterschaften(K).length]).toEqual([14, 10]);
    expect(p.Klingenwaffen[0].id).toMatch(/^grw:meisterschaft:klingenwaffen:/);
    expect(grwMeisterschaften(null)).toEqual({});
  });

  it('Stärken, Schwächen, Ressourcen, Sprachen, Mondzeichen', () => {
    expect([grwStaerken(K), grwSchwaechen(K), grwRessourcen(K), grwSprachen(K), grwMondzeichen(K)].map((l) => l.length)).toEqual([43, 20, 10, 36, 10]);
    expect([grwStaerken(null), grwSchwaechen(null), grwRessourcen(null), grwSprachen(null), grwMondzeichen(null)].every((l) => l.length === 0)).toBe(true);
  });

  it('Fertigkeiten mit Attributen', () => {
    const p = grwFertigkeiten(K);
    expect([p.allgemein.length, p.kampf.length, p.magie.length]).toEqual([27, 7, 19]);
    expect(Object.keys(grwFertigkeitsattribute(K))).toHaveLength(53);
  });

  it('Meisterschaftsschwellen aus dem Paket (GRW: 6, 9, 12, 15)', () => {
    expect([1, 2, 3, 4].map((s) => schwellenwert(s, K))).toEqual([6, 9, 12, 15]);
  });

  it('Mehrfach wählbare Stärken laut Text (GRW S. 72–74)', () => {
    const s = Object.fromEntries(grwStaerken(K).map((x) => [x.name, [x.max, x.multi]]));
    expect(s.Robust).toEqual([3, true]);                       // „bis zu dreimal“
    expect(s.Lastesel).toEqual([3, true]);
    expect(s['Erhöhter Fokuspool']).toEqual([20, true]);       // „beliebig oft wählbar“
    expect(s['Hoher Geistiger Widerstand']).toEqual([4, true]); // „einmal pro Heldengrad“
    expect(s['Erwählter der [Wesen]']).toEqual([1, true]);      // jede Wahl für einen anderen Typus
    expect(s.Attraktivität).toEqual([1, false]);
    expect(staerkeHoechstens(undefined)).toEqual({ max: 1, multi: false });
  });

  it('Rassen, Stärkenpunkte, Attribute, Gesundheitsstufen (GRW S. 13–15, 23–27, 172)', () => {
    expect(Object.keys(grwRassen(K))).toEqual(['Mensch', 'Alb', 'Zwerg', 'Gnom', 'Varg']);
    expect(['Mensch', 'Alb', 'Gnom'].map((r) => staerkenBudget(r, K))).toEqual([8, 6, 6]);
    expect(Object.keys(grwAttribute(K))).toEqual(['AUS', 'BEW', 'INT', 'KON', 'MYS', 'STA', 'VER', 'WIL']);
    expect(grwAlleFertigkeiten(K)).toHaveLength(53);
    expect(grwGesundheitsstufen(K).map((g) => g.wundabzug)).toEqual([0, -1, -2, -4, -8]);
  });
});

describe('Erschaffung: kostenlose Stärke der Kultur', () => {
  it('Kulturkunde laut GRW-Paket (GRW S. 23)', async () => {
    const { gratisStaerkeDerKultur } = await import('../grwListen');
    expect(gratisStaerkeDerKultur(K)).toBe('Kulturkunde');
    expect(gratisStaerkeDerKultur(null)).toBe('');
  });
});

describe('Heimatregionen: Kulturkunde der Kultur-Module', () => {
  it('die zwölf Kulturen des GRW (S. 39–50)', async () => {
    const { grwHeimatregionen } = await import('../grwListen');
    const r = grwHeimatregionen(K);
    expect(r).toHaveLength(12);
    expect(r).toContain('Albischer Seebund');
    expect(grwHeimatregionen(null)).toEqual([]);
  });
});
