/**
 * Archetypen des Grundregelwerks (Anhang 3, GRW S. 323–341) aus dem GRW-Paket (Typ „archetyp“).
 * Jeder Archetyp besteht die Erschaffungsprüfung des Editors ohne Befund, nennt nur Einträge des Pakets und setzt die
 * Start-Erfahrung so ein, wie es der Charakterbogen angibt („eingesetzt“).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { regelIdsErmitteln } from '../ids';
import { aktiverKatalog, setzeAktivenKatalog } from '../bruecke';
import { archetypen, archetypZuCharakter } from '../archetypen';
import { editorFertigkeit, pruefeErschaffungImEditor } from '../erschaffungEditor';
import { pruefeErschaffung, type Bau } from '../erschaffung';
import { alsAusruestung, waffenAttribute } from '../ausruestung';
import { pruefeRelikt, reliktBaukasten, reliktBausteine } from '../relikte';
import { grwMondzeichen, grwRassen } from '../grwListen';
import { referenceCharacterResources } from '../../utils/gameResourceManager';
import { calculateCharacter } from '../../utils/characterCalculations';
import type { CharacterState } from '../../types';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);
let vorher: ReturnType<typeof aktiverKatalog>;
beforeAll(() => { vorher = aktiverKatalog(); setzeAktivenKatalog(K, false); });
afterAll(() => setzeAktivenKatalog(vorher, false));

const charakter = (id: string) => referenceCharacterResources(archetypZuCharakter(id, K)!) as CharacterState;

describe('Archetypen im GRW-Paket', () => {
  it('sieben Archetypen mit Seiten im GRW (Anhang 3)', () => {
    const a = archetypen(K);
    expect(a.map((x) => x.name)).toEqual(['Arrou', 'Cederion von Falkenberg', 'Eshi bid-Herar', 'Keira Alvios', 'Selesha Maradoh', 'Telkin Feuerfaust', 'Tiai Schimmersee']);
    for (const x of a) expect(x.seiten.every((s) => s >= 323 && s <= 341)).toBe(true);
  });

  it.each(archetypen(K).map((a) => [a.name, a.id] as const))('%s: Erschaffung ohne Befund, Start-EP wie im Bogen', (_n, id) => {
    const c = charakter(id);
    const p = pruefeErschaffungImEditor(c, K)!;
    expect(p.befunde).toEqual([]);
    expect(p.hinweise).toEqual([]);
    const r = calculateCharacter(c);
    expect(r.xpSpent).toBe(K.get(id)!.daten.ep.eingesetzt);
    expect(r.xpSpent + r.xpAvailable).toBe(K.get(id)!.daten.ep.gesamt);
    expect(Object.values(c.attrBase).reduce((x, y) => x + y, 0)).toBe(18);
  });

  it.each(archetypen(K).map((a) => [a.name, a.id] as const))('%s: nennt nur Einträge des GRW-Pakets', (_n, id) => {
    const c = charakter(id);
    const ids = regelIdsErmitteln(K, c);
    const fehlt: string[] = [];
    // eigene Schwächen sind erlaubt (GRW S. 83: die Liste enthält nur Vorschläge); das Paket nennt die ohne Eintrag ohne ID
    const eigeneSchwaechen = new Set((K.get(id)!.daten.schwaechen as { name: string; id?: string }[]).filter((s) => !s.id).map((s) => s.name));
    for (const [liste, feld] of [['strengthsList', 'staerken'], ['weaknessesList', 'schwaechen'], ['resourcesList', 'ressourcen']] as const) {
      for (const e of c[liste] ?? []) {
        if (feld === 'schwaechen' && eigeneSchwaechen.has(e.name)) continue;
        const name = e.name.replace(/\s*\(.*\)\s*$/, '');
        if (!ids[feld][e.name] && !regelIdsErmitteln(K, { ...c, [liste]: [{ ...e, name }] })[feld][name]) fehlt.push(`${feld}: ${e.name}`);
      }
    }
    for (const [skill, l] of Object.entries(c.masteries ?? {})) {
      for (const m of l) if (!m.name.startsWith('Schwerpunkt') && !ids.meisterschaften[`${skill}|${m.name}`]) fehlt.push(`Meisterschaft: ${skill}|${m.name}`);
    }
    for (const s of c.spellsList ?? []) if (!ids.zauber[`${s.school}|${s.name}`]) fehlt.push(`Zauber: ${s.school}|${s.name}`);
    expect(fehlt).toEqual([]);
    expect(Object.keys(grwRassen(K))).toContain(c.race);
    expect(grwMondzeichen(K)).toContain(c.moonSign);
    expect((c.advancementLog ?? []).filter((e) => /Quelle: unbekannt/.test(e.detail ?? ''))).toEqual([]);
  });

  it.each(archetypen(K).map((a) => [a.name, a.id] as const))('%s: Bauplan des Pakets besteht die Erschaffungsregeln (wie lader.py der Prüfsuite)', (_n, id) => {
    const d = K.get(id)!.daten;
    const { befunde, charakter } = pruefeErschaffung(K, d.erschaffung as Bau);
    expect(befunde).toEqual([]);
    expect(charakter.ep_ausgegeben).toBe(d.ep.eingesetzt);
  });

  it.each(archetypen(K).map((a) => [a.name, a.id] as const))('%s: Werte wie im Charakterbogen (Fertigkeiten, Waffen, abgeleitete Werte)', (_n, id) => {
    const d = K.get(id)!.daten;
    const c = charakter(id);
    // Spalte „Wert“ des Bogens: ohne Rüstung und Schild
    const r = calculateCharacter({ ...c, inventory: [] });
    const { GSW, INI, LP, FO, VTD, GW, KW } = r.derived;
    expect({ GSW, INI, LP: r.maxLP, FO: r.maxFO, VTD, GW, KW }).toEqual(d.bogen_werte.abgeleitet);
    const fw: Record<string, [number | null, number]> = {};
    for (const [fid, wert] of Object.entries(d.bogen_werte.fertigkeiten as Record<string, number>)) {
      const n = editorFertigkeit(K, fid)!;
      if (r.getSkillTotal(n) !== wert) fw[n] = [r.getSkillTotal(n), wert];
    }
    expect(fw).toEqual({});
    // Waffen: Angriffswert ohne „mod.“ (Relikt-Bonus, solange kein Relikt gebaut ist); WGS mit dem Tick-Zuschlag der Rüstung
    const mit = calculateCharacter(c);
    for (const [wid, w] of Object.entries(d.bogen_werte.waffen as Record<string, { wert: number; wgs?: number; mod?: number; hinweis?: string }>)) {
      const it = c.inventory!.find((x) => x.name === K.get(wid)!.name)!;
      expect(r.getAttackValue(it.weaponSkill!, waffenAttribute({ id: wid, name: it.name, weaponSkill: it.weaponSkill }, K)), it.name).toBe(w.wert - (w.mod ?? 0));
      if (w.wgs !== undefined && !w.hinweis) expect(Number(it.wgs) + mit.gearTickModifier, `WGS ${it.name}`).toBe(w.wgs);
    }
  });

  it('Kreatur als Tiergefährte, Relikte mit Bausteinen ohne Warnung (Arrou, Eshi, Selesha, Telkin)', () => {
    const c = (n: string) => charakter(archetypen(K).find((a) => a.name === n)!.id);
    const arrou = c('Arrou');
    expect(arrou.begleiter).toEqual([{ id: 'grw:kreatur:falke', art: 'tier', name: 'Falke', rufname: 'Rouharr', kreatur: 2, vertrauter: true }]);
    const bs = reliktBausteine(K); const bk = reliktBaukasten(K);
    const alle = ['Arrou', 'Eshi bid-Herar', 'Selesha Maradoh', 'Telkin Feuerfaust'].map(c);
    for (const ch of alle) {
      expect(ch.relikte).toHaveLength(1);
      const r = ch.relikte![0];
      const basis = r.basisId ? alsAusruestung(K.get(r.basisId)!, 'GRW') : null;
      expect(pruefeRelikt(r, bs, bk, basis).warnungen, ch.name).toEqual([]);
      expect(ch.inventory!.some((it) => it.id === r.inventarId), ch.name).toBe(true);
    }
    // Glefe bleibt die Waffe (jetzt als Relikt); Telkins Siegel: +2 GW, solange er es besitzt (Bogen: GW 17, temp. +2)
    expect(arrou.inventory!.filter((it) => it.name === 'Glefe')).toHaveLength(1);
    const telkin = alle[3];
    expect(calculateCharacter(telkin).derived.GW).toBe(19);
  });

  it('Abweichungen vom Modul sind im Paket begründet (Selesha: Kultur, Tiai: Kultur und Abstammung frei)', () => {
    const ab = Object.fromEntries(archetypen(K).map((a) => [a.name, a.abweichungen.length]));
    expect(ab).toEqual({ Arrou: 0, 'Cederion von Falkenberg': 0, 'Eshi bid-Herar': 0, 'Keira Alvios': 0, 'Selesha Maradoh': 1, 'Telkin Feuerfaust': 0, 'Tiai Schimmersee': 2 });
  });
});
