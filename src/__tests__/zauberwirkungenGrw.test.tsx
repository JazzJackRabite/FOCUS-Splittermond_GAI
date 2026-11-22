/**
 * Prüfung der Zauberwirkungen im Spielmodus gegen das Grundregelwerk (Regelpaket public/regelpakete/grw.srp.json).
 * Entstanden bei der Durchsicht des AI-Studio-Stands vom 10.11.2026 (CLAUDE_EDITION Stand 15/16).
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Katalog } from '../regelwerk/katalog';
import { setzeAktivenKatalog } from '../regelwerk/bruecke';
import { basisAusDateien } from '../regelwerk/__tests__/hilfen';
import { spielwerteDesZaubers, wirksameZustaende } from '../regelwerk/zauberwerte';
import { render } from '@testing-library/react';
import {
  INITIAL_EG_ALLOCATIONS,
  begrenzeZauberbonus,
  calculateFinalSpellCosts,
  calculateSpellHealing,
  calculateTotalEGSpent,
  getActiveSpellModifiers,
  getActiveSpellRollBonuses,
  getSpellWeaponDamageBonus,
  parseFocusCost,
  zauberHoechstbonus,
} from '../utils/magicRules';
import { ChanneledSpellsTracker } from '../components/play/ChanneledSpellsTracker';
import type { ChanneledSpell } from '../types';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);
beforeAll(() => setzeAktivenKatalog(K, false));
afterAll(() => setzeAktivenKatalog(null, false));

const zauber = (name: string, verstaerkt = false, extra: Partial<ChanneledSpell> = {}): ChanneledSpell =>
  ({ id: `cs-${name}`, name, channeledFocus: 4, ...(verstaerkt ? { selectedEnhancementIds: ['enh-1'] } : {}), ...extra }) as ChanneledSpell;

describe('Zauberwerte kommen aus dem Regelpaket (daten.spielwerte), nicht aus dem Code', () => {
  it('GRW-Paket: Grundwert, verstärkter Wert, Typus und „nicht kombinierbar“', () => {
    const stein = spielwerteDesZaubers(K, 'Steinhaut')!;
    expect(stein.werte).toEqual([{ bezug: 'VTD', wert: 2 }, { bezug: 'SR', wert: 2, verstaerkt: 3 }]);
    expect(stein.nichtKombinierbar).toEqual(['Haut']);
    expect(spielwerteDesZaubers(K, 'Flammende Waffe')!.werte[0]).toMatchObject({ bezug: 'zusatzschaden', wert: 1, verstaerkt: 2, ziel: 'waffe' });
    expect(spielwerteDesZaubers(K, 'Heilung')!.werte).toEqual([{ bezug: 'heilung_lp', wert: 16, verstaerkt: 24 }]);
  });
  it('ohne Regelpaket gibt es keine Zauberwirkungen (kein Rückfall auf eine Tabelle im Code)', () => {
    expect(getActiveSpellModifiers([zauber('Steinhaut')], undefined, null).vtdBonus).toBe(0);
  });
  it('ein Zauber aus einem Grimoire wirkt genauso (Beispielpaket mit erfundenem Zauber)', () => {
    const buch = { info: { id: 'test', datei: 't.json', eintraege: 1, abhaengigkeiten: ['grw'] }, erwarteteEintraege: 1, paket: { paket: { id: 'test', titel: 'Test' }, eintraege: [{
      id: 'test:zauber:probehaut', typ: 'zauber', name: 'Probehaut', aktion: 'neu', quelle: { buch: 'Test' },
      daten: { typus: ['Haut'], spielwerte: { werte: [{ bezug: 'VTD', wert: 3 }, { bezug: 'SR', wert: 1, verstaerkt: 2 }], nicht_kombinierbar: ['Haut'] } },
    }] } } as never;
    const mitBuch = new Katalog(basis.manifest, [basis.basis, buch]);
    const m = getActiveSpellModifiers([zauber('Probehaut', true), zauber('Rindenhaut')], undefined, mitBuch);
    expect([m.vtdBonus, m.srBonus]).toEqual([3, 2]);
    expect(m.hinweise[0]).toContain('Rindenhaut zählt nicht');
  });
});

describe('Höchstbonus aus Zauberei (GRW S. 18–19)', () => {
  it('3 zu Spielbeginn, +1 je Heldengrad', () => {
    expect(zauberHoechstbonus({ heldengrad: { name: 'Heldengrad 1 (Suchender)' } })).toBe(3);
    expect(zauberHoechstbonus({ heldengrad: { name: 'Heldengrad 3 (Streiter)' } })).toBe(5);
    expect(zauberHoechstbonus({ regelwerk: { hoechstbonus: 4 }, heldengrad: { name: 'Heldengrad 1 (Suchender)' } })).toBe(4);
  });
  it('Stahlhaut: VTD auf 3 begrenzt, Schadensreduktion (kein abgeleiteter Wert) bleibt 4', () => {
    const m = getActiveSpellModifiers([zauber('Stahlhaut')], 3);
    expect(m.vtdBonus).toBe(3);
    expect(m.srBonus).toBe(4);
    expect(m.hinweise.join(' ')).toContain('Höchstbonus 3');
  });
  it('Probenbonus: Sinne verstärken +5 wird auf 3 begrenzt', () => {
    const b = getActiveSpellRollBonuses([zauber('Sinne verstärken')], 'Wahrnehmung');
    expect(b.map((x) => x.bonus)).toEqual([5]);
    expect(begrenzeZauberbonus(5, 3)).toBe(3);
  });
});

describe('Zauberwerte nach GRW', () => {
  it('Zauber des Typus Haut sind nicht kombinierbar – nur der stärkste zählt', () => {
    const m = getActiveSpellModifiers([zauber('Rindenhaut'), zauber('Steinhaut')]);
    expect([m.vtdBonus, m.srBonus]).toEqual([2, 2]);
    expect(m.hinweise[0]).toContain('Rindenhaut zählt nicht');
  });
  it('Widerstandswerte sind VTD, GW und KW (Widerstände erhöhen, Segnung)', () => {
    const m = getActiveSpellModifiers([zauber('Widerstände erhöhen')]);
    expect([m.vtdBonus, m.gwBonus, m.kwBonus]).toEqual([2, 2, 2]);
  });
  it('Verstärkungen: Schmerzen widerstehen 4, Beschleunigen +4, Rindenhaut SR 2', () => {
    expect(getActiveSpellModifiers([zauber('Schmerzen widerstehen', true)]).woundPenaltyReduction).toBe(4);
    expect(getActiveSpellModifiers([zauber('Beschleunigen', true)]).gswBonus).toBe(4);
    expect(getActiveSpellModifiers([zauber('Rindenhaut', true)]).srBonus).toBe(2);
  });
  it('Magieschutz ist ein Malus auf gegnerische Zauber, kein Bonus auf GW/KW; Schutz vor Elementen senkt um 10', () => {
    const m = getActiveSpellModifiers([zauber('Großer Magieschutz'), zauber('Schutz vor Elementen')]);
    expect([m.gwBonus, m.kwBonus]).toEqual([0, 0]);
    expect(m.breakdown.map((b) => b.description).join(' | ')).toContain('−10');
  });
  it('Spinnenlauf gilt für Klettern (Athletik), Weg durch die Natur nur für Überleben – beide nur in der passenden Lage', () => {
    const s = getActiveSpellRollBonuses([zauber('Spinnenlauf')], 'Athletik');
    expect(s.map((x) => [x.bonus, x.active])).toEqual([[4, false]]);
    expect(getActiveSpellRollBonuses([zauber('Weg durch die Natur')], 'Naturkunde')).toEqual([]);
    expect(getActiveSpellRollBonuses([zauber('Weg durch die Natur')], 'Überleben')[0].active).toBe(false);
  });
  it('Attributszauber bei Angriffen nicht vorausgewählt (Attribute hängen von der Waffe ab); Waffe des Lichtes +2 nur gegen bestimmte Wesen', () => {
    const b = getActiveSpellRollBonuses([zauber('Bärenstärke'), zauber('Waffe des Lichtes')], 'Klingenwaffen', true, 'w1');
    expect(b.map((x) => [x.source, x.bonus, x.active])).toEqual([['Bärenstärke', 4, false], ['Waffe des Lichtes', 2, false]]);
  });
  it('Waffenzauber treffen nur die verzauberte Waffe und nie den waffenlosen Angriff; Flammenhand wirkt waffenlos', () => {
    const flamme = zauber('Flammende Waffe', false, { targetItemId: 'w-katar' });
    expect(getSpellWeaponDamageBonus([flamme], 'w-katar', 'Katar').totalDamage).toBe(1);
    expect(getSpellWeaponDamageBonus([flamme], 'w-schwert', 'Langschwert').totalDamage).toBe(0);
    expect(getSpellWeaponDamageBonus([flamme], undefined, 'Waffenlos').totalDamage).toBe(0);
    expect(getSpellWeaponDamageBonus([zauber('Flammende Waffe')], 'waffen|Nahkampf|Handgemenge|Waffenlos').totalDamage).toBe(0);
    expect(getSpellWeaponDamageBonus([zauber('Flammenhand', true)], 'waffenlos').fireDamage).toBe(2);
  });
});

describe('Zustände unterdrücken (Erfrischung, GRW S. 227)', () => {
  const erschoepft = [{ id: 'z1', key: 'Erschöpft', level: 2 }, { id: 'z2', key: 'Liegend' }];
  it('1 Stufe Erschöpft ist unterdrückt, solange der Zauber wirkt; verstärkt 3 Stufen', () => {
    const einfach = wirksameZustaende(K, erschoepft, [zauber('Erfrischung')]);
    expect(einfach.wirksam).toEqual([{ id: 'z1', key: 'Erschöpft', level: 1 }, { id: 'z2', key: 'Liegend' }]);
    expect(einfach.unterdrueckt).toEqual([{ key: 'Erschöpft', stufen: 1, durch: 'Erfrischung' }]);
    expect(wirksameZustaende(K, erschoepft, [zauber('Erfrischung', true)]).wirksam).toEqual([{ id: 'z2', key: 'Liegend' }]);
  });
  it('der gespeicherte Zustand bleibt – ohne den Zauber gilt wieder die volle Stufe', () => {
    expect(wirksameZustaende(K, erschoepft, []).wirksam).toBe(erschoepft);
    expect(erschoepft[0].level).toBe(2);
  });
  it('Zauber heben keinen Zustand mehr beim Wirken auf (Erfrischung, Giftbann)', () => {
    expect(calculateSpellHealing('Erfrischung', INITIAL_EG_ALLOCATIONS)).toBeNull();
    expect(calculateSpellHealing('Giftbann', INITIAL_EG_ALLOCATIONS)).toBeNull();
  });
});

describe('Erfolgsgrade (GRW S. 221–222)', () => {
  it('verzehrter Fokus ist ganz einsparbar, solange 1 erschöpfter oder kanalisierter Punkt bleibt', () => {
    const k = calculateFinalSpellCosts(parseFocusCost('4V1'), { ...INITIAL_EG_ALLOCATIONS, saveConsumedFocus: 1 });
    expect([k.effectiveExhausted, k.effectiveConsumed, k.totalFocus]).toEqual([3, 0, 3]);
  });
  it('Wirkungsbereich kostet 3 EG je Stufe', () => {
    expect(calculateTotalEGSpent({ ...INITIAL_EG_ALLOCATIONS, expandArea: 2 })).toBe(6);
  });
});

describe('Anzeige', () => {
  it('Tracker übersteht den Wechsel von „kein Zauber“ zu „ein Zauber“ (Hooks vor der frühen Rückgabe)', () => {
    const leer = () => {};
    const { rerender, getByText } = render(<ChanneledSpellsTracker channeledSpells={[]} onCancelSpell={leer} onUpdateSpell={leer} isCombatDashboard />);
    expect(() => rerender(<ChanneledSpellsTracker channeledSpells={[zauber('Steinhaut')]} onCancelSpell={leer} onUpdateSpell={leer} isCombatDashboard />)).not.toThrow();
    expect(getByText('Steinhaut')).toBeTruthy();
  });
});
