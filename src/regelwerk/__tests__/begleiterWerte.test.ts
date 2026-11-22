/**
 * Spielwerte für Begleiter aus den Paketen (Datenseite begleiter_werte.py, 21.11.2026):
 * Abrichtungen mit Zahlen und Wahlen, Zusammenführen doppelter Merkmale, Verbesserte Angriffe, Vertrautenmagie.
 * Teile mit Grimoires laufen nur lokal (FOKUS_GRIMOIRES und FOKUS_BUCHFAELLE).
 */
import fs from 'fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { basisAusDateien, buchfaelle, grimoireDatei } from './hilfen';
import { erstelleKatalog, grimoireLesen } from '../laden';
import { Katalog } from '../katalog';
import { merkmaleZusammenfuehren, ausStruktur, anwenden, type MerkmalRegel } from '../modifikationen';
import { tierGrundwerte, tierWerte } from '../abrichtungsWerte';
import { wesenBaukastenWerte } from '../wesenBaukasten';
import { vertrautenMeisterschaften, alleVertrautenMeisterschaften, alleVertrautenZauber } from '../vertraute';
import type { Begleiter } from '../../types';

const b = basisAusDateien();
const GRW = new Katalog(b.manifest, [b.basis]);

// Die Beispiele ohne Grimoires sind erfunden (Merkmalsnamen und Zahlen), damit hier kein Regeltext aus den Büchern steht.
describe('Merkmale zusammenführen (ohne Grimoires)', () => {
  const regel: MerkmalRegel = {
    ersetzen: [{ merkmal: 'Sicht', ab: 2, wird: 'Weitsicht' }], stufen_addieren: true, andere_doppelte_entfallen: true,
    beide_entfallen: [['Scheu', 'Mutig']], beide_entfallen_ausser_mehrfach: ['Mutig'], robuster_lp: 3,
  };
  it('Ersetzen, Stufen addieren, Aufheben, Doppelte entfallen', () => {
    expect(merkmaleZusammenfuehren(['Sicht', 'Sicht', 'Flugwesen'], regel)).toEqual(['Flugwesen', 'Weitsicht']);
    expect(merkmaleZusammenfuehren(['Zäh 1', 'Zäh 2'], regel)).toEqual(['Zäh 3']);
    expect(merkmaleZusammenfuehren(['Scheu', 'Mutig', 'Flugwesen'], regel)).toEqual(['Flugwesen']);
    expect(merkmaleZusammenfuehren(['Scheu', 'Mutig', 'Mutig'], regel)).toEqual(['Mutig']);
    expect(merkmaleZusammenfuehren(['Flugwesen', 'Flugwesen'], { ...regel, stufen_addieren: false })).toEqual(['Flugwesen']);
  });
  it('Merkmal und Waffenmerkmal mit Stufe: neu mit Stufe N, vorhanden um M erhöht', () => {
    const m = ausStruktur({ angriff: 3, merkmale_stufe: [{ name: 'Laut', neu: 10, plus: 4 }], waffenmerkmale_stufe: [{ name: 'Spitz', neu: 2, plus: 1 }] });
    expect(m.merkmaleStufe).toEqual([{ name: 'Laut', neu: 10, plus: 4 }]);
    expect(m.waffenmerkmaleStufe).toEqual([{ name: 'Spitz', neu: 2, plus: 1 }]);
    const w = { attribute: {}, abgeleitet: { LP: 10 }, fertigkeiten: [], merkmale: ['Laut 10'], waffen: [{ name: 'Biss', wert: 10, schaden: '1W6', wgs: '6', ini: '5', merkmale: 'Spitz 2, Scharf 2' }] };
    const neu = anwenden(GRW, w, m);
    expect(neu.merkmale).toEqual(['Laut 14']);
    expect(neu.waffen[0]).toMatchObject({ wert: 13, merkmale: 'Spitz 3, Scharf 2' });
    expect(anwenden(GRW, { ...w, merkmale: [] }, m).merkmale).toEqual(['Laut 10']);
  });
});

// IDs und Sollwerte zu den Grimoires: lokale Falldatei (hilfen.ts: buchfaelle)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F = buchfaelle<any>('begleiterWerte', ['bestien', 'magie']);

describe.skipIf(!F)('Begleiterwerte mit Grimoires (lokal)', () => {
  let K: Katalog;
  beforeAll(() => {
    K = erstelleKatalog(b, F.grimoires.map((g: string) => grimoireLesen(fs.readFileSync(grimoireDatei(g), 'utf-8'), b.manifest))).katalog;
  });
  const tier = (x: Partial<Begleiter> = {}): Begleiter => ({ id: F.tier.id, art: 'tier', name: F.tier.name, ...x });

  it('Abrichtungen mit Zahlen; Meisterschaftswahl bis zur Schwelle des Abrichters; GSW und Merkmalsstufe', () => {
    const g = tierGrundwerte(K, K.get(F.tier.id))!;
    const angriff = g.waffen[0].wert; const vtd = g.abgeleitet.VTD;
    const z = F.zahlen;
    const t = tierWerte(K, tier({ abrichtungen: z.abrichtungen }), g, []);
    expect(t.geaendert).toBe(true);
    expect(t.werte!.waffen[0].wert).toBe(angriff + z.angriffPlus);
    expect(t.werte!.waffen[0].merkmale).toContain(z.waffenmerkmal);
    expect(t.werte!.abgeleitet.VTD).toBe(vtd + z.vtdPlus);
    expect(t.werte!.merkmale).toContain(z.merkmal);
    expect(t.wahlen.find(w => w.w.art === 'meisterschaft')!.schwelle).toBe(0);
    const mw = F.meisterschaftswahl;
    expect(tierWerte(K, tier({ abrichtungen: [mw.abrichtung] }), g, [mw.meisterschaft]).wahlen[0].schwelle).toBe(mw.schwelle);

    const q = F.gsw;
    const p = tierGrundwerte(K, K.get(q.tier))!;
    const r = tierWerte(K, { id: q.tier, art: 'tier', name: q.name, abrichtungen: [q.abrichtung] }, p, []);
    expect(r.werte!.abgeleitet.GSW).toBe(p.abgeleitet.GSW + q.gswPlus);
    expect(r.werte!.merkmale).toContain(q.merkmal);
  });

  it('Wahlen: Merkmal entfällt; doppelte Wahl derselben Fertigkeit ist ein Hinweis; Abrichtungen ohne Zahlen ändern nichts', () => {
    const g = tierGrundwerte(K, K.get(F.tier.id))!;
    const mw = F.merkmalWeg;
    expect(g.merkmale).toContain(mw.merkmal);
    expect(tierWerte(K, tier({ abrichtungen: [mw.abrichtung], abrichtungWahlen: mw.wahlen }), g, []).werte!.merkmale).not.toContain(mw.merkmal);
    const dw = F.doppelteWahl;
    const vorher = g.fertigkeiten.find(f => f.id === dw.fertigkeit)!.wert;
    const v = tierWerte(K, tier({ abrichtungen: [dw.abrichtung], abrichtungWahlen: { '0:0': dw.fertigkeit, '0:1': dw.fertigkeit } }), g, []);
    expect(v.werte!.fertigkeiten.find(f => f.id === dw.fertigkeit)!.wert).toBe(vorher + dw.plus);
    expect(v.hinweise.some(h => /unterschiedlich/.test(h))).toBe(true);
    expect(tierWerte(K, tier({ abrichtungen: [F.ohneZahlen] }), g, []).geaendert).toBe(false);
  });

  it('Verbesserte Angriffe: Punkte aus Rolle und Korpus, Käufe über die Punkte sind ein Hinweis', () => {
    const va = F.verbesserteAngriffe;
    const basis = Object.values(K.eintraege).find(e => e.typ === 'wesen_baukasten_basis' && e.name === va.basis)!;
    const w0 = wesenBaukastenWerte(K, { id: basis.id, art: 'wesen', name: 'W', bausteine: [va.rolle] });
    expect(w0.verbesserteAngriffe).toMatchObject({ punkte: va.punkte, verbraucht: 0 });
    const n = w0.werte!.waffen.length;
    const w1 = wesenBaukastenWerte(K, { id: basis.id, art: 'wesen', name: 'W', bausteine: [va.rolle], verbesserteAngriffe: va.kaeufe });
    expect(w1.verbesserteAngriffe).toMatchObject({ punkte: va.punkte, verbraucht: va.verbraucht });
    expect(w1.werte!.waffen).toHaveLength(n + 1);
    expect(w1.werte!.waffen.some(x => x.merkmale.includes(va.merkmalNicht))).toBe(false);
    expect(w1.hinweise.some(h => h.schluessel === 'va:punkte')).toBe(true);
  });

  it('Vertrautenmagie: Meisterschaften und Zauber aus den Paketen', () => {
    expect(alleVertrautenMeisterschaften(K).map(e => e.id)).toContain('grw:meisterschaft:naturmagie:vertrautenband');
    expect(alleVertrautenZauber(K).length).toBeGreaterThan(0);
    expect(vertrautenMeisterschaften(K, ['grw:meisterschaft:naturmagie:vertrautenband', 'grw:meisterschaft:handgemenge:umreissen']).map(e => e.id))
      .toEqual(['grw:meisterschaft:naturmagie:vertrautenband']);
  });
});
