/**
 * Vollabgleich mit allen Büchern – läuft nur lokal, weil die Grimoires nicht im Repo liegen.
 * Aufruf: FOKUS_GRIMOIRES=<SCR4P3>/Regelpakete/editor/grimoires FOKUS_REFERENZ_VOLL=<SCR4P3>/Pruefsuite/editor_referenz_voll.json npx vitest run src/regelwerk
 * Die Vergleichsdatei erzeugt `python editor_referenz.py` im Ordner Pruefsuite (Python-Lader, Katalog mit allen
 * Paketen); nach jedem Bauen der Pakete neu erzeugen. Sie enthält Buchinhalte und kommt nicht ins Repo.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { erfuellt } from '../bedingungen';
import { abgeleiteteWerte } from '../abgeleitet';
import { verfuegbareDienste } from '../dienste';
import { grimoireLesen, erstelleKatalog } from '../laden';
import { basisAusDateien, charAusJson, GRIMOIRE_ORDNER, istGrimoireDatei } from './hilfen';

const ORDNER = GRIMOIRE_ORDNER || undefined;
const REF_DATEI = process.env.FOKUS_REFERENZ_VOLL;
const aktiv = !!(ORDNER && REF_DATEI && fs.existsSync(ORDNER) && fs.existsSync(REF_DATEI));

describe.skipIf(!aktiv)('Vollabgleich mit allen Büchern (lokal)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const REF: any = aktiv ? JSON.parse(fs.readFileSync(REF_DATEI!, 'utf-8')) : null;
  const basis = basisAusDateien();
  const grimoires = aktiv ? fs.readdirSync(ORDNER!).filter(istGrimoireDatei).map(f => grimoireLesen(fs.readFileSync(path.join(ORDNER!, f), 'utf-8'), basis.manifest)) : [];
  const { katalog: K, ausgelassen } = aktiv ? erstelleKatalog(basis, grimoires) : ({} as ReturnType<typeof erstelleKatalog>);

  it('Katalog: Einträge, Aliasse, geltende Fassungen, Daten und Quellen wie in Python', () => {
    expect(ausgelassen).toEqual([]);
    expect(K.befunde).toEqual(REF.katalog.befunde);
    expect(Object.keys(K.eintraege).sort()).toEqual(REF.katalog.ids);
    expect(K.alias).toEqual(REF.katalog.alias);
    expect(K.geltend).toEqual(REF.katalog.geltend);
    const abw: string[] = [];
    for (const [i, d] of Object.entries(REF.katalog.daten)) if (JSON.stringify(sortiere(K.eintraege[i].daten)) !== JSON.stringify(sortiere(d))) abw.push(i);
    expect(abw).toEqual([]);
    const q: Record<string, string[]> = {};
    for (const [i, e] of Object.entries(K.eintraege)) if (e._quellen?.length) q[i] = e._quellen.map(x => JSON.stringify(sortiere(x))).sort();
    expect(q).toEqual(Object.fromEntries(Object.entries(REF.katalog.quellen as Record<string, string[]>).map(([i, l]) => [i, l.map(s => JSON.stringify(sortiere(JSON.parse(s)))).sort()])));
    expect(K.angeboteneVerweise().map(v => v.id).sort()).toEqual(REF.katalog.verweise_angeboten);
  });
  it('Referenzprüfung wie in Python', () => {
    const { katalog } = erstelleKatalog(basis, grimoires);
    katalog.pruefeReferenzen();
    expect(katalog.befunde).toEqual(REF.katalog.referenzbefunde);
  });
  it('Voraussetzungen aller Bücher wie in Python', () => {
    const chars = REF.voraussetzungen.charaktere.map(charAusJson);
    const abw: string[] = [];
    for (const r of REF.voraussetzungen.eintraege) {
      const b = K.get(r.id)!.daten.voraussetzungen.bedingung;
      chars.forEach((c: ReturnType<typeof charAusJson>, i: number) => { const ist = erfuellt(c, b, K); if (ist !== r.ergebnisse[i]) abw.push(`${r.id}/${i}: ${ist} ≠ ${r.ergebnisse[i]}`); });
    }
    expect(abw).toEqual([]);
  });
  it('Abgeleitete Werte mit Stärken und Ausrüstung aller Bücher wie in Python', () => {
    for (const f of REF.abgeleitet) {
      const e = f.eingabe;
      const r = abgeleiteteWerte(K, e.attribute, e.rasse, e.staerken, e.heldengrad, e.ausruestung, e.gesundheitsstufe);
      expect([r.werte, r.bedingt.map(b => [b.wert, b.bonus, b.bedingung, b.quelle]), r.hinweise]).toEqual([f.werte, f.bedingt, f.hinweise]);
    }
  });
  it('Dienste beschworener Wesen wie in Python', () => {
    for (const f of REF.dienste) {
      expect(verfuegbareDienste(K, f.wesen, f.meisterschaften, f.dienstexperte).map(d => [d.id, d.art, d.kosten])).toEqual(f.ergebnis);
    }
  });
});

function sortiere(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sortiere);
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x as object).sort().map(k => [k, sortiere((x as Record<string, unknown>)[k])]));
  return x;
}
