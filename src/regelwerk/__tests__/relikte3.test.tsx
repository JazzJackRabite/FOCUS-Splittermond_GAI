/**
 * Relikte, Stufe 3: Schwerpunkt-Bonus (GRW), Wachsen mit Chronik (Mondstahlklingen), beseelte Gegenstände (Die Götter).
 * Die Teile mit Erweiterungen laufen nur lokal mit FOKUS_GRIMOIRES.
 */
import fs from 'fs';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { basisAusDateien, grimoireDatei } from './hilfen';
import { grimoireLesen, erstelleKatalog } from '../laden';
import {
  aktiveKraefte, beseelungPunkte, beseelungRegeln, domaenen, domaenenKraefte, pruefeBeseelung, pruefeChronik, pruefeRelikt,
  reliktBaukasten, reliktBausteine, reliktSchwerpunktBoni, wachsenRegeln,
} from '../relikte';
import type { Relikt } from '../../types';

const b = basisAusDateien();
const K = new Katalog(b.manifest, [b.basis]);
const relikt = (x: Partial<Relikt>): Relikt => ({ id: 'r1', name: 'Klinge', punkte: 6, art: 'nahkampfwaffe', bausteine: [], inventarId: 'i1', ...x });

describe('Schwerpunkt-Bonus aus Relikten (GRW)', () => {
  const bs = reliktBausteine(K);
  const sp = 'grw:verbesserung:fertigkeitsbonus-auf-einen-schwerpunkt';
  it('summiert je Schwerpunkt, nur für passende Fertigkeit und nur im Inventar', () => {
    const r = relikt({ bausteine: [{ id: sp, anzahl: 1, auswahl: 'Klingenwaffen: Duell' }, { id: sp, anzahl: 1, auswahl: 'Klingenwaffen: Duell' }] });
    const boni = reliktSchwerpunktBoni([r], [{ id: 'i1' }], bs, 'Klingenwaffen');
    expect(boni).toHaveLength(1);
    expect(boni[0]).toMatchObject({ quelle: 'Klinge', wert: 2, text: 'Schwerpunkt Klingenwaffen: Duell' });
    expect(reliktSchwerpunktBoni([r], [{ id: 'i1' }], bs, 'Athletik')).toHaveLength(0);
    expect(reliktSchwerpunktBoni([r], [], bs, 'Klingenwaffen')).toHaveLength(0);
  });
  it('ohne Erweiterungen: keine Regeln zum Wachsen oder zur Beseelung', () => {
    expect(wachsenRegeln(K)).toBeNull();
    expect(beseelungRegeln(K)).toBeNull();
    expect(pruefeChronik(K, [{ id: 'c', art: 'heldengrad', punkte: 1, text: '' }], 2)[0]).toMatch(/nicht geladen/);
  });
});

const pfad = (n: string) => grimoireDatei(n);
const da = (n: string) => !!pfad(n) && fs.existsSync(pfad(n));

describe.skipIf(!da('mondstahl') || !da('goetter'))('Wachsen und Beseelung mit den Buchpaketen (lokal)', () => {
  let KB: Katalog;
  beforeAll(() => {
    KB = erstelleKatalog(b, ['mondstahl', 'goetter'].map(n => grimoireLesen(fs.readFileSync(pfad(n), 'utf-8'), b.manifest))).katalog;
  });

  it('Chronik: legendäre Tat braucht Beschreibung, je Heldengrad ein Punkt', () => {
    expect(wachsenRegeln(KB)?.anlaesse.map(a => a.art)).toEqual(['legendaere_tat', 'heldengrad', 'belohnung']);
    expect(pruefeChronik(KB, [{ id: 'a', art: 'legendaere_tat', punkte: 2, text: 'Hydra erschlagen' }], 1)).toEqual([]);
    expect(pruefeChronik(KB, [{ id: 'a', art: 'legendaere_tat', punkte: 1, text: '' }], 1)[0]).toMatch(/ohne Beschreibung/);
    expect(pruefeChronik(KB, [{ id: 'a', art: 'heldengrad', punkte: 2, text: '', heldengrad: 2 }], 2)[0]).toMatch(/höchstens 1/);
    expect(pruefeChronik(KB, [{ id: 'a', art: 'heldengrad', punkte: 1, text: '', heldengrad: 2 }], 1)[0]).toMatch(/erst 0 neue Heldengrade/);
    expect(pruefeChronik(KB, [{ id: 'a', art: 'heldengrad', punkte: 1, text: '', heldengrad: 2 }, { id: 'b', art: 'heldengrad', punkte: 1, text: '', heldengrad: 2 }], 3))
      .toContain('Chronik: Derselbe Heldengrad zählt nur einmal.');
  });

  it('Beseelung: 2 Punkte mit der ersten Kraft, je weitere Kraft 1 Punkt; Reihenfolge nach Stufe; ruhende Kräfte', () => {
    const R = beseelungRegeln(KB)!;
    const d = domaenen(KB)[0];
    const kr = domaenenKraefte(KB, d.id);
    const i = kr.filter(x => x.stufe === 'I'); const iii = kr.find(x => x.stufe === 'III+');
    expect(i.length).toBeGreaterThan(1);
    const b1 = { domaene: d.id, kraefte: [{ id: i[0].id, queste: 'Q1', erfuellt: true }, { id: i[1].id, queste: 'Q2', erfuellt: true }] };
    expect(beseelungPunkte(R, b1)).toBe(3);
    expect(pruefeBeseelung(KB, b1).warnungen).toEqual([]);
    expect(aktiveKraefte({ ...b1, ruht: 1 })).toEqual([i[0].id]);
    if (iii) expect(pruefeBeseelung(KB, { domaene: d.id, kraefte: [{ id: iii.id, queste: 'Q', erfuellt: true }] }).warnungen.join(' ')).toMatch(/erst als 3\. Kraft/);
    expect(pruefeBeseelung(KB, { domaene: d.id, kraefte: [{ id: i[0].id }, { id: i[1].id, queste: 'Q', erfuellt: true }] }).warnungen.join(' ')).toMatch(/vorherigen Kraft/);
    // Punkte zählen im Relikt mit
    const r = relikt({ punkte: 2, beseelung: b1 });
    const p = pruefeRelikt(r, reliktBausteine(KB), reliktBaukasten(KB), null, { k: KB, heldengrad: 1 });
    expect(p.verwendet).toBe(3);
    expect(p.warnungen.some(w => /kosten 3 Punkte, das Relikt hat 2/.test(w))).toBe(true);
  });
});
