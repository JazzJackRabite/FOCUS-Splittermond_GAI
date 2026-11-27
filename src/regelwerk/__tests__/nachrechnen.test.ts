/**
 * Nachgerechnet gegen das Buch: Die Sollwerte hier sind von Hand nach den Formeln des Grundregelwerks bestimmt
 * (nicht aus dem Paket gelesen) und werden mit dem verglichen, was der Editor ausrechnet.
 *
 *  Erschaffung  Attribute = Grundwert + Rassenmodifikatoren (GRW S. 32–37)
 *               GSW = BEW + GK, INI = 10 − INT, LP = GK + KON, FO = 2 × (MYS + WIL) (S. 13)
 *               VTD = 12 + BEW + STÄ + Modifikator der GK, GW = 12 + VER + WIL, KW = 12 + KON + WIL (S. 13, 15)
 *               Stärken: Flink GSW +1, Verbesserte Initiative INI −3, Robust LP +1, Erhöhter Fokuspool FO +5,
 *               Hoher Geistiger Widerstand GW +2, Zusätzliche Splitterpunkte +2 (S. 71–74); Splitterpunkte 3 (S. 26)
 *  Steigerung   Kostentabelle S. 86–87 und Steigerungskosten zu Spielbeginn S. 25
 *  Angriff      je volle 3 Punkte über der Schwierigkeit 1 Erfolgsgrad, Triumph +3 EG (S. 17–18)
 *  Zauber       Erfolgsgrade: erschöpft 1 EG, kanalisiert 2 EG, verzehrt 3 EG, Auslösezeit 3 EG (höchstens 2×) (S. 221–222)
 *  Rast         Ruhephase: 2 × KON LP, 2 × WIL verzehrter Fokus, je mindestens 1 (S. 173–174, 196);
 *               Erhöhte Fokusregeneration: 3 × WIL (S. 72)
 *
 * Grimoires (lokal, FOKUS_GRIMOIRES): Für jede Stärke mit festem Bonus auf einen abgeleiteten Wert prüft der Test,
 * dass der Editor genau diesen Bonus einrechnet. Regelnamen aus den Erweiterungen stehen dabei nicht im Code.
 */
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calculateCharacter } from '../../utils/characterCalculations';
import { calculateItemCost } from '../../utils/costCalculations';
import { calculateAttackEG } from '../../utils/combatRules';
import { archetypen, archetypZuCharakter } from '../archetypen';
import { referenceCharacterResources } from '../../utils/gameResourceManager';
import { zauberEgRegeln } from '../zauberEg';
import { ruheregeln, ruhephasenRegeneration, ruhewirkungen } from '../spielwirkungen';
import { erstelleKatalog, grimoireLesen } from '../laden';
import { aktiverKatalog, setzeAktivenKatalog } from '../bruecke';
import { basisAusDateien, GRIMOIRE_ORDNER, istGrimoireDatei } from './hilfen';
import type { CharacterState } from '../../types';

const praeset = (name: string) => {
  const a = archetypen(aktiverKatalog()).find(x => x.name === name)!;
  return referenceCharacterResources(archetypZuCharakter(a.id)!) as CharacterState;
};

/**
 * Sollwerte = die Charakterbögen der Archetypen im GRW (Anhang 3, S. 328–341), Spalte „Wert“ der abgeleiteten Werte;
 * von Hand nachgerechnet nach den Formeln oben. LP/FO ohne, maxLP/maxFO mit Stärken (Robust, Erhöhter Fokuspool).
 */
const SOLL: Record<string, { attr: string; GSW: number; INI: number; LP: number; FO: number; VTD: number; GW: number; KW: number; maxLP: number; maxFO: number; SP: number }> = {
  // Varg GK 6: GSW 6+3+1 (Flink), VTD 12+3+5−2 (GK 6), LP 6+2, FO 2×(2+1)
  Arrou: { attr: 'AUS1 BEW3 INT4 KON2 MYS2 STA5 VER2 WIL1', GSW: 10, INI: 6, LP: 8, FO: 6, VTD: 18, GW: 15, KW: 15, maxLP: 8, maxFO: 6, SP: 3 },
  // Mensch: Robust LP 8+1, Hoher Geistiger/Körperlicher Widerstand je +2, Zusätzliche Splitterpunkte
  'Cederion von Falkenberg': { attr: 'AUS3 BEW3 INT1 KON3 MYS1 STA4 VER3 WIL2', GSW: 8, INI: 9, LP: 8, FO: 6, VTD: 19, GW: 19, KW: 19, maxLP: 9, maxFO: 6, SP: 5 },
  // Gnom GK 3: Flink GSW 3+2+1, VTD 12+2+1+4, Hoher Geistiger Widerstand GW 20+2
  'Eshi bid-Herar': { attr: 'AUS3 BEW2 INT3 KON1 MYS2 STA1 VER5 WIL3', GSW: 6, INI: 7, LP: 4, FO: 10, VTD: 19, GW: 22, KW: 16, maxLP: 4, maxFO: 10, SP: 3 },
  // Mensch: Flink GSW 5+4+1, Robust LP 7+1, Zusätzliche Splitterpunkte
  'Keira Alvios': { attr: 'AUS2 BEW4 INT4 KON2 MYS2 STA2 VER1 WIL3', GSW: 10, INI: 6, LP: 7, FO: 10, VTD: 18, GW: 16, KW: 17, maxLP: 8, maxFO: 10, SP: 5 },
  // Mensch: Erhöhter Fokuspool zweimal FO 14+10
  'Selesha Maradoh': { attr: 'AUS3 BEW2 INT2 KON2 MYS4 STA1 VER3 WIL3', GSW: 7, INI: 8, LP: 7, FO: 14, VTD: 15, GW: 18, KW: 17, maxLP: 7, maxFO: 24, SP: 5 },
  // Zwerg GK 4: Robust LP 8+1, Erhöhter Fokuspool FO 12+5, VTD 12+1+3+2
  'Telkin Feuerfaust': { attr: 'AUS2 BEW1 INT2 KON4 MYS3 STA3 VER2 WIL3', GSW: 5, INI: 8, LP: 8, FO: 12, VTD: 18, GW: 17, KW: 19, maxLP: 9, maxFO: 17, SP: 3 },
  // Alb GK 5: INI 10−2−3 (Meisterschaft Blitzreflexe), Erhöhter Fokuspool zweimal FO 10+10
  'Tiai Schimmersee': { attr: 'AUS3 BEW5 INT2 KON1 MYS3 STA2 VER2 WIL2', GSW: 10, INI: 5, LP: 6, FO: 10, VTD: 19, GW: 16, KW: 15, maxLP: 6, maxFO: 20, SP: 3 },
};

describe('Erschaffung: Archetypen nachgerechnet (GRW S. 13–15, 32–37, 71–74, Bögen S. 328–341)', () => {
  it('alle Archetypen haben Sollwerte', () => expect(Object.keys(SOLL).sort()).toEqual(archetypen(aktiverKatalog()).map(p => p.name).sort()));
  it.each(Object.entries(SOLL))('%s', (name, s) => {
    const c = praeset(name);
    const r = calculateCharacter({ ...c, inventory: [] }); // Spalte „Wert“ des Bogens: ohne Rüstung und Schild (die stehen unter „temp.“)
    expect(Object.entries(r.currentAttributes).map(([k, v]) => k + v).join(' ')).toBe(s.attr);
    expect(Object.values(c.attrBase).reduce((a, b) => a + b, 0)).toBe(18); // 18 Punkte auf die Attribute (S. 24)
    const { GSW, INI, LP, FO, VTD, GW, KW } = r.derived;
    expect({ GSW, INI, LP, FO, VTD, GW, KW, maxLP: r.maxLP, maxFO: r.maxFO, SP: r.splinterPoints })
      .toEqual({ GSW: s.GSW, INI: s.INI, LP: s.LP, FO: s.FO, VTD: s.VTD, GW: s.GW, KW: s.KW, maxLP: s.maxLP, maxFO: s.maxFO, SP: s.SP });
    expect(r.heldengrad.nr).toBe(1);
    expect(r.xpSpent + r.xpAvailable).toBe(15); // Start-Erfahrung 15 EP (S. 25)
  });
});

describe('Steigerung: Kosten nach der Tabelle (GRW S. 25, 86–87)', () => {
  it('Fertigkeitspunkte 3/5/7/9 EP bis 6/9/12/15', () => {
    expect([1, 6, 7, 9, 10, 12, 13, 15].map(w => calculateItemCost('skill', w))).toEqual([3, 3, 5, 5, 7, 7, 9, 9]);
  });
  it('Attribute 10/15/20/25, Stärken 7 je Stufe, Meisterschaften 5/10/15/20', () => {
    expect([1, 2, 3, 4].map(n => calculateItemCost('attribute', n))).toEqual([10, 15, 20, 25]);
    expect(calculateItemCost('strength', 1)).toBe(7);
    expect([1, 2, 3, 4].map(n => calculateItemCost('mastery', n))).toEqual([5, 10, 15, 20]);
  });
  it('Zauber nach Grad 1/3/6/9/12/15, Ressourcenpunkt 7, Sprache 5', () => {
    expect([0, 1, 2, 3, 4, 5].map(g => calculateItemCost('spell', g))).toEqual([1, 3, 6, 9, 12, 15]);
    expect(calculateItemCost('resource', 1)).toBe(7);
    expect(calculateItemCost('language', 1)).toBe(5);
  });
});

describe('Angriff: Erfolgsgrade (GRW S. 17–18)', () => {
  // Cederion greift Keira an (VTD 20 laut Sollwerten oben)
  it('je volle 3 Punkte über der Verteidigung 1 EG', () => {
    expect(calculateAttackEG(20, 20)).toMatchObject({ isSuccess: true, eg: 0 });
    expect(calculateAttackEG(25, 20)).toMatchObject({ isSuccess: true, eg: 1 });
    expect(calculateAttackEG(26, 20)).toMatchObject({ isSuccess: true, eg: 2 });
    expect(calculateAttackEG(19, 20)).toMatchObject({ isSuccess: false, eg: 0 });
  });
  it('Patzer verfehlt immer, Triumph gibt 3 EG mehr', () => {
    expect(calculateAttackEG(30, 20, true)).toMatchObject({ isSuccess: false });
    expect(calculateAttackEG(23, 20, false, true)).toMatchObject({ isSuccess: true, eg: 4 });
  });
});

describe('Zauber: Erfolgsgrade einsetzen (GRW S. 221–222)', () => {
  it('Kosten und Auslösezeit', () => {
    const z = zauberEgRegeln();
    expect([z.erschoepft.eg, z.kanalisiert.eg, z.verzehrt.eg, z.ausloesezeit.eg, z.schaden.eg, z.reichweite.eg]).toEqual([1, 2, 3, 3, 1, 1]);
    expect(z.ausloesezeit.hoechstens).toBe(2);
    expect(z.erschoepft.minimum).toBe(1);
  });
});

describe('Rast: Ruhephase (GRW S. 72, 173–174, 196)', () => {
  it('Grundregel und Fundstelle', () => {
    expect(ruheregeln()).toMatchObject({ lpFaktor: 2, lpMindestens: 1, foFaktor: 2, foMindestens: 1, ruheStunden: 6, verschnaufMinuten: 30, quelle: 'GRW S. 173–174' });
  });
  // KON und WIL nach den Sollwerten oben (2 × KON, 2 × WIL)
  it.each([['Arrou', 4, 2], ['Cederion von Falkenberg', 6, 4], ['Eshi bid-Herar', 2, 6], ['Keira Alvios', 4, 6],
    ['Selesha Maradoh', 4, 6], ['Telkin Feuerfaust', 8, 6], ['Tiai Schimmersee', 2, 4]] as const)('%s: %i LP, %i Fokus', (name, lp, fo) => {
    const c = praeset(name);
    const a = calculateCharacter(c).currentAttributes;
    expect(ruhephasenRegeneration(a.KON, a.WIL, ruhewirkungen(c))).toEqual({ lp, fo });
  });
  it('Erhöhte Fokusregeneration: 3 × WIL (Selesha mit der Stärke: 9 Fokus)', () => {
    const c = praeset('Selesha Maradoh');
    const mit = { ...c, strengthsList: [...c.strengthsList, { name: 'Erhöhte Fokusregeneration', level: 1, source: 'creation', pointCost: 1 }] };
    const a = calculateCharacter(mit).currentAttributes;
    expect(ruhephasenRegeneration(a.KON, a.WIL, ruhewirkungen(mit))).toEqual({ lp: 4, fo: 9 });
  });
});

// ---------------------------------------------------------------- je Grimoire (lokal)
const GRIMS = GRIMOIRE_ORDNER && fs.existsSync(GRIMOIRE_ORDNER) ? fs.readdirSync(GRIMOIRE_ORDNER).filter(istGrimoireDatei).sort() : [];

function testcharakter(teil: Partial<CharacterState> = {}): CharacterState {
  return {
    mode: 'creation', xpTotal: 0, name: 'Test', race: 'Mensch', moonSign: '', homeRegion: '',
    attrBase: { AUS: 2, BEW: 2, INT: 2, KON: 2, MYS: 2, STA: 2, VER: 2, WIL: 2 }, raceBonusAttrs: [],
    attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
    skillsBase: {}, skillsXp: {}, masteries: {}, resourcesList: [], weaknessesList: [], languagesList: [], spellsList: [], strengthsList: [],
    playState: { healthSlots: [], focus: { exhausted: 0, channeled: 0, consumed: 0 }, splitterPoints: 3, channeledSpells: [], dyingLevel: 0, conditions: [], tempHP: 0, tempHPUsed: 0, lpModifier: 0 },
    ...teil,
  } as unknown as CharacterState;
}

type Rechnung = ReturnType<typeof calculateCharacter>;
const WERT: Record<string, (r: Rechnung) => number> = {
  GSW: r => r.derived.GSW, INI: r => r.derived.INI, VTD: r => r.derived.VTD, GW: r => r.derived.GW, KW: r => r.derived.KW,
  LP: r => r.maxLP, FO: r => r.maxFO,
};
interface Wirkung { art?: string; wert?: unknown; gilt?: string; traeger?: string; bedingung?: unknown; bezug?: string; fertigkeit_refs?: { text: string }[] }

/** Sollwerte aus den Daten des Eintrags: feste Boni auf abgeleitete Werte und Fertigkeiten, die immer und für den Charakter selbst gelten */
function feste(e: { typ: string; daten: Record<string, unknown> }): Record<string, number> {
  const soll: Record<string, number> = {};
  const plus = (k: string, n: number) => { soll[k] = (soll[k] ?? 0) + n; };
  if (e.typ === 'staerke') for (const m of (e.daten.abgeleitete_werte_modifikatoren ?? []) as { abgeleiteter_wert: string; bonus: number; bedingt?: string }[]) {
    if (!m.bedingt && m.abgeleiteter_wert in WERT && typeof m.bonus === 'number') plus(m.abgeleiteter_wert, m.bonus);
  }
  for (const w of (e.daten.wirkungen_strukturiert ?? []) as Wirkung[]) {
    if (w.gilt !== 'immer' || w.traeger !== 'selbst' || w.bedingung || typeof w.wert !== 'number') continue;
    if (w.art === 'bonus' && w.bezug === 'fertigkeit') for (const f of w.fertigkeit_refs ?? []) plus('Fertigkeit ' + f.text, w.wert);
    if (e.typ === 'meisterschaft' && w.bezug && w.bezug in WERT && (w.art === 'bonus' || w.art === 'wert_erhoeht')) plus(w.bezug, w.wert);
  }
  return soll;
}

function istWert(r: Rechnung, k: string): number {
  return k.startsWith('Fertigkeit ') ? r.getSkillBonus(k.slice(11)) : WERT[k](r);
}

/** prüft alle Stärken und Meisterschaften eines Pakets; gibt die Abweichungen und die Zahl der geprüften Einträge zurück */
function festeBoniPruefen(eintraege: { id: string; typ: string; name: string }[], katalog: NonNullable<ReturnType<typeof aktiverKatalog>>): { abweichungen: string[]; geprueft: number } {
    const ohne = calculateCharacter(testcharakter());
    const abweichungen: string[] = [];
    let geprueft = 0;
    for (const roh of eintraege) {
      if (roh.typ !== 'staerke' && roh.typ !== 'meisterschaft') continue;
      const e = katalog.get(roh.id);
      if (!e || e.name !== roh.name) continue;
      const soll = feste(e as unknown as { typ: string; daten: Record<string, unknown> });
      if (!Object.keys(soll).length) continue;
      let c: CharacterState;
      if (e.typ === 'staerke') c = testcharakter({ strengthsList: [{ name: e.name, level: 1, source: 'xp', isFree: false, pointCost: 0, desc: '' }] as CharacterState['strengthsList'] });
      else {
        const f = String(e.daten.fertigkeit ?? '');
        const fname = katalog.get(f)?.typ === 'fertigkeit' ? katalog.get(f)!.name : '';
        if (!fname) continue; // Meisterschaftsgruppe: Fertigkeit wählt der Spieler
        c = testcharakter({ masteries: { [fname]: [{ id: e.id, name: e.name, tier: Number(e.daten.schwelle) || 1, cost: 0, isFree: true, isCreationBonus: false, source: 'xp' }] } as CharacterState['masteries'] });
      }
      const mit = calculateCharacter(c);
      for (const [k, b] of Object.entries(soll)) {
        const d = istWert(mit, k) - istWert(ohne, k);
        if (d !== b) abweichungen.push(`${e.id}: ${k} ${d} statt ${b}`);
      }
      geprueft++;
    }
    return { abweichungen, geprueft };
}

describe('feste Boni von Stärken und Meisterschaften werden eingerechnet', () => {
  const basis = basisAusDateien();
  let vorher: ReturnType<typeof aktiverKatalog> = null;
  beforeAll(() => { vorher = aktiverKatalog(); });
  afterAll(() => setzeAktivenKatalog(vorher, false));
  it('Grundregelwerk', () => {
    const { katalog } = erstelleKatalog(basis, []);
    setzeAktivenKatalog(katalog, false);
    const r = festeBoniPruefen(basis.basis.paket.eintraege, katalog);
    expect(r.abweichungen).toEqual([]);
    expect(r.geprueft).toBeGreaterThan(10);
  });
  it.skipIf(!GRIMS.length).each(GRIMS)('Grimoire %s (lokal)', (datei) => {
    const g = grimoireLesen(fs.readFileSync(path.join(GRIMOIRE_ORDNER, datei), 'utf-8'), basis.manifest);
    const { katalog } = erstelleKatalog(basis, [g]);
    setzeAktivenKatalog(katalog, false);
    const r = festeBoniPruefen(g.paket.eintraege, katalog);
    expect(r.abweichungen).toEqual([]);
  });
});
