/** Die Zustandsauswahl kommt aus den Paketen: 17 Zustände des Grundregelwerks (S. 168–169) plus Kampfposition Liegend. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { Katalog } from '../katalog';
import { erstelleKatalog, grimoireLesen } from '../laden';
import { basisAusDateien, buchfaelle, grimoireDatei } from './hilfen';
import { alleZustaende, zustandHatStufe, zustandQuelle, zustandsliste } from '../zustaende';
import { getConditionDescription, getConditionMalus, probenbereich, zustandTooltip } from '../../utils/conditionModifiers';
import { setzeAktivenKatalog } from '../bruecke';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);
const GRW = ['Angsterfüllt', 'Benommen', 'Bewusstlos', 'Blutend', 'Brennend', 'Erschöpft', 'Geblendet', 'Glaubenskrise', 'Krank', 'Lahm', 'Panisch', 'Rasend', 'Ringend', 'Schlafend', 'Siechtum', 'Sterbend', 'Verwundet'];

describe('Zustände aus den Paketen', () => {
  it('Grundregelwerk-Paket: die 17 Zustände des Grundregelwerks, dazu die Kampfposition Liegend – keine Zustände aus anderen Bänden', () => {
    const erwartet = [...GRW, 'Liegend'].sort((a, b) => a.localeCompare(b, 'de'));
    expect(alleZustaende(K)).toEqual(erwartet);
    expect(alleZustaende(null)).toEqual([]);
    for (const z of zustandsliste(K).filter((x) => x.id)) expect(z.id, z.name).toMatch(/^grw:/);
  });

  it('Stufen laut Paket', () => {
    const mitStufe = zustandsliste(K).filter((z) => z.mitStufe).map((z) => z.name);
    expect(mitStufe).toEqual(['Benommen', 'Blutend', 'Brennend', 'Erschöpft', 'Geblendet', 'Glaubenskrise', 'Siechtum', 'Sterbend', 'Verwundet']);
  });

  it('jeder Zustand des Grundregelwerks hat eine Seite im Paket', () => {
    for (const z of zustandsliste(K).filter((x) => x.id)) expect(z.quelle, z.name).toMatch(/^GRW S\. 1[67]\d/);
  });

  it('Quelle mit Seite für die Anzeige beim Überfahren mit der Maus', () => {
    expect(zustandQuelle('Benommen', K)).toBe('GRW S. 168');
    expect(zustandQuelle('Verwundet', K)).toBe('GRW S. 169');
    expect(zustandQuelle('Liegend', K)).toBe('GRW S. 170 (Kampfposition)');
    setzeAktivenKatalog(K, false);
    expect(zustandTooltip({ id: 'x', key: 'Benommen', level: 1 })).toMatch(/Tick[\s\S]*Quelle: GRW S\. 168$/);
    setzeAktivenKatalog(null, false);
  });

  it('die Beschreibung kommt aus dem Paket', () => {
    setzeAktivenKatalog(K, false);
    expect(getConditionDescription({ id: 'x', key: 'Benommen', level: 1 })).toContain('Tick');
    setzeAktivenKatalog(null, false);
  });

  // Fälle aus den Grimoires (Namen, Seiten, Sollwerte) stehen in der lokalen Falldatei (hilfen.ts: buchfaelle)
  const F = buchfaelle<{ grimoires: string[]; vorhanden: string[]; quelle: [string, string][]; mitStufe: string[]; malus: [string, number, string, number | null][] }>('zustaende', ['schleier', 'jenseits', 'goetter']);
  it.skipIf(!F)('Zustände aus Grimoires: wählbar, mit Quelle, Abzüge aus dem Paket (lokal)', () => {
    const { katalog: k } = erstelleKatalog(basis, F!.grimoires.map((g) => grimoireLesen(fs.readFileSync(grimoireDatei(g), 'utf-8'), basis.manifest)));
    for (const n of F!.vorhanden) expect(alleZustaende(k), n).toContain(n);
    for (const [n, muster] of F!.quelle) expect(zustandQuelle(n, k)).toMatch(new RegExp(muster));
    for (const n of F!.mitStufe) expect(zustandHatStufe(n, k), n).toBe(true);
    setzeAktivenKatalog(k, false);
    for (const [key, level, fertigkeit, soll] of F!.malus) {
      expect(getConditionMalus({ id: 'x', key, level }, { bereich: probenbereich(fertigkeit), fertigkeit })?.malus ?? null, `${key} ${level} ${fertigkeit}`).toBe(soll);
    }
    setzeAktivenKatalog(null, false);
  });

  const alle = ['schleier', 'jenseits', 'goetter'].map((id) => grimoireDatei(id));
  it.skipIf(alle.some((b) => !b || !fs.existsSync(b)))('jeder Zustand aus einem Grimoire ist wählbar und nennt seine Seite (lokal)', () => {
    const gs = alle.map((b) => grimoireLesen(fs.readFileSync(b, 'utf-8'), basis.manifest));
    const { katalog: k } = erstelleKatalog(basis, gs);
    const namen = alleZustaende(k);
    for (const g of gs) for (const e of g.paket.eintraege.filter((x) => x.typ === 'zustand' && k.get(x.id)?.name === x.name)) {
      expect(namen, e.id).toContain(e.name);
      const seite = e.quelle?.buch_seiten?.[0];
      if (seite) expect(zustandQuelle(e.name, k), e.id).toMatch(new RegExp(`S\\. ${seite}`));
    }
  });
});
