/**
 * Abgleich der TypeScript-Fassung des Laders mit der Python-Referenz (Pruefsuite/lader.py im Ordner SCR4P3).
 * testdaten/referenz_grw.json wurde mit dem Python-Lader auf demselben Grundregelwerk-Paket erzeugt
 * (zufällige Charaktere, Werte und Erschaffungen; Zufallsstartwert fest).
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { erfuellt } from '../bedingungen';
import { abgeleiteteWerte } from '../abgeleitet';
import { pruefeErschaffung, type Bau } from '../erschaffung';
import { grimoireLesen, erstelleKatalog } from '../laden';
import { basisAusDateien, charAusJson } from './hilfen';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REF: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdaten', 'referenz_grw.json'), 'utf-8'));
const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);

describe('Katalog (nur Grundregelwerk)', () => {
  it('enthält dieselben Einträge wie der Python-Lader', () => {
    expect(Object.keys(K.eintraege).sort()).toEqual(REF.katalog.ids);
    expect(K.geladen).toEqual(REF.katalog.geladen);
    expect(K.alias).toEqual(REF.katalog.alias);
    // Regelgruppen kommen im Editor nur mit den Grimoires; ohne Bücher gilt jede Fassung für sich (Python: geltend[x] = x)
    const nichtIdentisch = (g: Record<string, string>) => Object.fromEntries(Object.entries(g).filter(([k, v]) => k !== v));
    expect(nichtIdentisch(K.geltend)).toEqual(nichtIdentisch(REF.katalog.geltend));
    expect(K.befunde).toEqual(REF.katalog.befunde);
  });
  it('findet bei der Referenzprüfung dieselben Befunde', () => {
    const k2 = new Katalog(basis.manifest, [basis.basis]);
    k2.pruefeReferenzen();
    expect(k2.befunde).toEqual(REF.katalog.referenzbefunde);
  });
  it('enthält keine Einträge anderer Bücher', () => {
    expect(Object.keys(K.eintraege).every(i => i.startsWith('grw:'))).toBe(true);
    expect(basis.manifest.pakete.map(p => p.id)).toEqual(['grw']);
  });
});

describe('Voraussetzungen', () => {
  const chars = REF.voraussetzungen.charaktere.map(charAusJson);
  it(`${REF.voraussetzungen.eintraege.length} Einträge × ${chars.length} Charaktere wie in Python`, () => {
    const abw: string[] = [];
    for (const r of REF.voraussetzungen.eintraege) {
      const b = K.get(r.id)!.daten.voraussetzungen.bedingung;
      chars.forEach((c: ReturnType<typeof charAusJson>, i: number) => {
        const ist = erfuellt(c, b, K);
        if (ist !== r.ergebnisse[i]) abw.push(`${r.id} Charakter ${i}: ${ist} statt ${r.ergebnisse[i]}`);
      });
    }
    expect(abw).toEqual([]);
  });
});

describe('Abgeleitete Werte', () => {
  it(`${REF.abgeleitet.length} Fälle wie in Python`, () => {
    for (const f of REF.abgeleitet) {
      const e = f.eingabe;
      const r = abgeleiteteWerte(K, e.attribute, e.rasse, e.staerken, e.heldengrad, e.ausruestung, e.gesundheitsstufe);
      expect(r.werte).toEqual(f.werte);
      expect(r.bedingt.map(b => [b.wert, b.bonus, b.bedingung, b.quelle])).toEqual(f.bedingt);
      expect(r.hinweise).toEqual(f.hinweise);
    }
  });
  it('rechnet den Gnom aus dem Praxistest richtig (GRW S. 13–15)', () => {
    const A = { Ausstrahlung: 2, Beweglichkeit: 2, Intuition: 3, Konstitution: 2, Mystik: 3, Stärke: 1, Verstand: 3, Willenskraft: 3 };
    const r = abgeleiteteWerte(K, A, 'grw:rasse:gnome', ['grw:staerke:flink', 'grw:staerke:hoher-geistiger-widerstand', 'grw:staerke:feensinn']);
    expect(r.werte).toMatchObject({ GK: 3, GSW: 6, INI: 7, LP: 5, LP_gesamt: 25, FO: 12, VTD: 19, GW: 20, KW: 17, SP: 3 });
    expect(r.bedingt).toHaveLength(1);
  });
});

describe('Charaktererschaffung', () => {
  it(`${REF.erschaffung.length} Baupläne wie in Python`, () => {
    for (const f of REF.erschaffung) {
      const { charakter, befunde } = pruefeErschaffung(K, f.bau as Bau);
      const sortiert = (l: string[][]) => [...l].map(x => x.join('§')).sort();
      expect(sortiert(befunde)).toEqual(sortiert(f.befunde));
      expect({ ...charakter, hat: [...charakter.hat].sort() }).toEqual(f.charakter);
    }
  });
  it('der gültige Gnom hat keine Fehler und 11 EP ausgegeben', () => {
    const f = REF.erschaffung[0];
    const { charakter, befunde } = pruefeErschaffung(K, f.bau as Bau);
    expect(befunde.filter(b => b[0] === 'fehler')).toEqual([]);
    expect(charakter.ep_ausgegeben).toBe(11);
  });
});

describe('Grimoires hochladen', () => {
  it('weist das Grundregelwerk und fremde Dateien zurück', () => {
    expect(() => grimoireLesen('kein json', basis.manifest)).toThrow('kein gültiges JSON');
    expect(() => grimoireLesen('{"format":"x"}', basis.manifest)).toThrow('kein Splittermond-Regelpaket');
    expect(() => grimoireLesen(JSON.stringify(basis.basis.paket), basis.manifest)).toThrow('bereits im Editor');
  });
  it('lädt ein Buch mit ladeinfo, wendet Regelgruppen an und lässt Bücher mit fehlender Abhängigkeit aus', () => {
    const buch = {
      format: 'splittermond-regelpaket', format_version: '1.0', erzeugt: '2026-11-05', abhaengigkeiten: [],
      paket: { id: 'testbuch', titel: 'Testbuch', kuerzel: 'T' }, statistik: { eintraege: 2 },
      eintraege: [
        { id: 'testbuch:staerke:flink', typ: 'staerke', aktion: 'ergaenzt', name: 'Flink', ziel: 'grw:staerke:flink', quelle: { paket: 'testbuch' }, daten: {} },
        { id: 'testbuch:staerke:neu', typ: 'staerke', aktion: 'neu', name: 'Neu', quelle: { paket: 'testbuch' }, daten: { stufe: 1 } },
      ],
      ladeinfo: {
        format: 'splittermond-editor-ladeinfo', format_version: '1.0', ladereihenfolge: 99, abhaengigkeiten: ['grw'], optionale_pakete: [],
        regelgruppen: { 'grw:staerke:flink': { typ: 'staerke', name: 'Flink', fassungen: ['grw:staerke:flink', 'testbuch:staerke:flink'], art: 'ergaenzt' } },
        umbenannt: { 'testbuch:staerke:alt': 'testbuch:staerke:neu' }, begleiter: {},
        original: { datei: 'x', sha256: 'x', bytes: 0, eintraege: 2 },
      },
    };
    const lp = grimoireLesen(JSON.stringify(buch), basis.manifest);
    const { katalog, ausgelassen } = erstelleKatalog(basis, [lp]);
    expect(ausgelassen).toEqual([]);
    expect(katalog.befunde).toEqual([]);
    expect(katalog.get('testbuch:staerke:flink')!.id).toBe('grw:staerke:flink');
    expect(katalog.get('testbuch:staerke:alt')!.name).toBe('Neu');
    expect(katalog.get('grw:staerke:flink')!._quellen).toEqual([{ paket: 'testbuch' }]);
    const ohne = grimoireLesen(JSON.stringify({ ...buch, ladeinfo: { ...buch.ladeinfo, abhaengigkeiten: ['grw', 'magie'] } }), basis.manifest);
    expect(erstelleKatalog(basis, [ohne]).ausgelassen).toEqual([{ id: 'testbuch', grund: 'benötigt magie' }]);
  });
});
