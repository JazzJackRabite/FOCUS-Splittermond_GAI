/**
 * Erschaffung nach GRW S. 22–30 im Editor.
 * - modulWerte(): was ein Kultur- oder Abstammungsmodul mit der getroffenen Wahl einträgt (in Editor-Namen).
 * - bauAusEditor(): baut aus dem Editor-Charakter einen Bauplan für pruefeErschaffung(). Der Editor speichert nur Summen;
 *   die Punkte jenseits der Module werden so auf Kultur (frei), Abstammung (frei), Ausbildung und Schritt 7 verteilt, dass alle
 *   Grenzen je Schritt eingehalten werden, wenn das überhaupt möglich ist (maximaler Fluss). Gibt es keine solche Verteilung,
 *   meldet die Prüfung genau, welcher Schritt überzogen ist.
 * - pruefeErschaffungImEditor(): Ergebnis mit Namen statt IDs.
 */
import type { Katalog } from './katalog';
import { ERSCHAFFUNG_ID, NAHKAMPF, pruefeErschaffung, type Bau, type ErschaffungsBefund, type ModulWahl } from './erschaffung';
import { aktiverKatalog, ATTRIBUT_NAME, fertigkeitId, idNachName, meisterschaftId, RASSE_ID } from './bruecke';
import type { CharacterState } from '../types';


export type { ModulWahl };

import type { ErschaffungsModulAngewendet as ModulAngewendet, ErschaffungsModulZustand as ErschaffungsModul, ErschaffungsWahl } from '../types';
import { gratisStaerkeDerKultur, grwAlleFertigkeiten } from './grwListen';
export type { ModulAngewendet, ErschaffungsModul, ErschaffungsWahl };

/** Katalog-Fertigkeits-ID → Fertigkeitsname im Editor (z. B. „Geschichte & Mythen“) */
export function editorFertigkeit(k: Katalog, id: string): string | undefined {
  return grwAlleFertigkeiten().find(s => fertigkeitId(k, s) === id);
}

export interface ModulGruppe { index: number; text: string; punkte: number; optionen: { id?: string; text: string; auswahl?: string }[]; restVon?: number }

/** Wahlmöglichkeiten eines Moduls für die Oberfläche */
export function modulGruppen(k: Katalog, modulId: string) {
  const mw = k.get(modulId)?.daten.modulwerte;
  if (!mw) return null;
  const gruppen = (feld: 'fertigkeiten' | 'ressourcen'): ModulGruppe[] =>
    (mw[feld] ?? []).map((g: { text: string; punkte: number; optionen?: ModulGruppe['optionen']; rest_von?: number }, i: number) => ({
      index: i, text: g.text, punkte: g.punkte, optionen: g.optionen ?? [], restVon: g.rest_von,
    }));
  return {
    fertigkeiten: gruppen('fertigkeiten'), ressourcen: gruppen('ressourcen'),
    staerken: (mw.staerke_optionen ?? []) as { id?: string; text: string }[],
    meisterschaften: (mw.meisterschaft_optionen ?? []) as { id?: string; text: string; schwerpunkt?: { fertigkeit: string; name: string } }[],
    kulturkunde: mw.kulturkunde as string | undefined,
  };
}

/** Werte, die das Modul mit dieser Wahl einträgt; fehlend = Gruppen ohne gültige Wahl. */
export function modulWerte(k: Katalog, modulId: string, wahl: ModulWahl = {}): { werte: ModulAngewendet; fehlend: string[] } {
  const g = modulGruppen(k, modulId)!;
  const werte: ModulAngewendet = { fertigkeiten: {}, ressourcen: {} };
  const fehlend: string[] = [];
  for (const [feld, ziel] of [['fertigkeiten', werte.fertigkeiten], ['ressourcen', werte.ressourcen]] as const) {
    const gew: Record<number, string | undefined> = {};
    for (const gr of g[feld]) {
      const w = (wahl[feld] ?? {})[String(gr.index)];
      let id: string | undefined;
      if (gr.restVon !== undefined && gr.restVon !== null) {
        const rest = g[feld][gr.restVon].optionen.filter(o => o.id && o.id !== gew[gr.restVon!]).map(o => o.id!);
        id = w && rest.includes(w) ? w : rest.length === 1 ? rest[0] : undefined;
      } else {
        const feste = gr.optionen.filter(o => o.id).map(o => o.id!);
        if (w && (feste.includes(w) || (gr.optionen.some(o => o.auswahl) && k.get(w)))) id = w;
        else if (gr.optionen.length === 1 && feste.length === 1) id = feste[0];
      }
      gew[gr.index] = id;
      if (!id) { fehlend.push(gr.text); continue; }
      const name = feld === 'fertigkeiten' ? editorFertigkeit(k, id) : k.get(id)?.name;
      if (!name) { fehlend.push(gr.text); continue; }
      ziel[name] = (ziel[name] ?? 0) + gr.punkte;
    }
  }
  if (g.staerken.length) {
    const ids = g.staerken.filter(o => o.id).map(o => o.id!);
    const s = wahl.staerke && ids.includes(wahl.staerke) ? wahl.staerke : ids.length === 1 ? ids[0] : undefined;
    if (s) werte.staerke = { name: k.get(s)!.name, stufe: Number(k.get(s)!.daten.stufe) || 1 };
    else fehlend.push('Stärke');
  }
  if (g.meisterschaften.length) {
    const i = wahl.meisterschaft ?? (g.meisterschaften.length === 1 ? 0 : undefined);
    const o = i !== undefined ? g.meisterschaften[i] : undefined;
    if (!o) fehlend.push('Meisterschaft');
    else if (o.id) {
      const m = k.get(o.id)!; const skill = editorFertigkeit(k, m.daten.fertigkeit);
      if (skill) werte.meisterschaft = { skill, name: `${m.name} (S${Number(m.daten.schwelle) || 1})` };
    } else if (o.schwerpunkt) {
      const skill = editorFertigkeit(k, o.schwerpunkt.fertigkeit);
      if (skill) werte.meisterschaft = { skill, name: `Schwerpunkt: ${o.schwerpunkt.name} (S1)` };
    }
  }
  return { werte, fehlend };
}

// ---------------------------------------------------------------- maximaler Fluss (kleine Graphen)
function maxFluss(n: number, kap: number[][], s: number, t: number): number[][] {
  const f = kap.map(r => r.map(() => 0));
  for (;;) {
    const vor = new Array(n).fill(-1); vor[s] = s; const q = [s];
    while (q.length && vor[t] === -1) { const u = q.shift()!; for (let v = 0; v < n; v++) if (vor[v] === -1 && kap[u][v] - f[u][v] > 0) { vor[v] = u; q.push(v); } }
    if (vor[t] === -1) return f;
    let d = Infinity; for (let v = t; v !== s; v = vor[v]) d = Math.min(d, kap[vor[v]][v] - f[vor[v]][v]);
    for (let v = t; v !== s; v = vor[v]) { f[vor[v]][v] += d; f[v][vor[v]] -= d; }
  }
}

export interface EditorPruefung { befunde: ErschaffungsBefund[]; hinweise: string[]; verteilung: Record<string, Record<string, number>> }

/** Bauplan für pruefeErschaffung() aus dem Editor-Charakter. */
export function bauAusEditor(k: Katalog, state: CharacterState): { bau: Bau; hinweise: string[]; verteilung: Record<string, Record<string, number>> } {
  const S = k.get('grw:regel:erschaffung-regeln:uebersicht-ueber-die-charaktererschaffung')!.daten.strukturiert;
  const hinweise: string[] = [];
  const wahl: ErschaffungsWahl = state.erschaffung ?? {};
  const fid = (name: string) => { const i = fertigkeitId(k, name); if (!i) hinweise.push(`Fertigkeit „${name}“ steht nicht im Regelwerk`); return i; };
  const istSchule = (i: string) => k.get(i)?.daten.kategorie === 'Magieschule';
  const attr = (a: Record<string, number>) => Object.fromEntries(Object.entries(a).map(([kz, v]) => [ATTRIBUT_NAME[kz] ?? kz, Number(v) || 0]));

  // ---- Fertigkeitspunkte: Module abziehen, Rest auf die freien Schritte verteilen
  const rest: Record<string, number> = {};
  for (const [n, v] of Object.entries(state.skillsBase)) { if (!v) continue; const i = fid(n); if (i) rest[i] = (rest[i] ?? 0) + v; }
  const modulTeil = (m: ErschaffungsModul | null | undefined) => {
    if (!m?.modul || !k.get(m.modul)) return;
    for (const [n, p] of Object.entries(modulWerte(k, m.modul, m.wahl).werte.fertigkeiten)) {
      const i = fertigkeitId(k, n)!; rest[i] = (rest[i] ?? 0) - p;
      if (rest[i] < 0) { hinweise.push(`${n}: weniger Punkte als das Modul ${k.get(m.modul)!.name} vorgibt`); rest[i] = 0; }
    }
  };
  modulTeil(wahl.kultur); modulTeil(wahl.abstammung);
  const kulturFrei = !wahl.kultur?.modul; const abstFrei = !wahl.abstammung?.modul;
  const K3 = S.kultur_frei, K4 = S.abstammung_frei, K5 = S.ausbildung_frei, K7 = S.schritt_7;
  type Topf = { name: string; summe: number; je: (i: string) => number };
  const toepfe: Topf[] = [];
  if (kulturFrei) toepfe.push({ name: 'kultur', summe: K3.fertigkeitspunkte, je: i => (istSchule(i) ? K3.magieschule_max_punkte : K3.max_je_fertigkeit) });
  if (abstFrei) toepfe.push({ name: 'abstammung', summe: K4.fertigkeitspunkte, je: i => (istSchule(i) ? 0 : K4.max_je_fertigkeit) });
  toepfe.push({ name: 'ausbildung', summe: K5.fertigkeitspunkte, je: i => (istSchule(i) ? K5.max_je_magieschule : K5.max_je_fertigkeit) });
  toepfe.push({ name: 'schritt7', summe: K7.fertigkeitspunkte, je: () => 99 });
  const ids = Object.keys(rest).filter(i => rest[i] > 0);
  // Knoten: 0 Quelle, 1..n Fertigkeiten, n+1.. Töpfe, Magie-Sammler für die Kultur (höchstens eine Magieschule), Senke
  const n = ids.length, T0 = n + 1, MAG = T0 + toepfe.length, SENKE = MAG + 1, N = SENKE + 1;
  const kap = Array.from({ length: N }, () => new Array(N).fill(0));
  ids.forEach((i, x) => {
    kap[0][x + 1] = rest[i];
    toepfe.forEach((t, y) => {
      if (t.name === 'kultur' && istSchule(i)) kap[x + 1][MAG] += t.je(i);
      else kap[x + 1][T0 + y] = t.je(i);
    });
  });
  const kultIdx = toepfe.findIndex(t => t.name === 'kultur');
  if (kultIdx >= 0) kap[MAG][T0 + kultIdx] = K3.magieschulen_max_anzahl * K3.magieschule_max_punkte;
  toepfe.forEach((t, y) => { kap[T0 + y][SENKE] = t.summe; });
  const f = maxFluss(N, kap, 0, SENKE);
  const verteilung: Record<string, Record<string, number>> = Object.fromEntries(toepfe.map(t => [t.name, {}]));
  ids.forEach((i, x) => {
    let offen = rest[i];
    toepfe.forEach((t, y) => {
      let m = f[x + 1][T0 + y];
      if (t.name === 'kultur' && istSchule(i)) m = f[x + 1][MAG];
      if (m > 0) { verteilung[t.name][i] = m; offen -= m; }
    });
    if (offen > 0) verteilung.schritt7[i] = (verteilung.schritt7[i] ?? 0) + offen; // nicht unterzubringen: Schritt 7 überzogen → Meldung der Prüfung
  });
  // Schritt 7 überzogen: sagen, welche Fertigkeiten über den Grenzen der freien Schritte liegen (sonst nur „27 statt 30“)
  const s7 = Object.entries(verteilung.schritt7 ?? {}).filter(([, v]) => v > 0);
  if (s7.reduce((a, [, v]) => a + v, 0) > K7.fertigkeitspunkte) {
    hinweise.push(`Schritt 7 trägt ${s7.map(([i, v]) => `${k.get(i)?.name ?? i} +${v}`).join(', ')} – mehr als ${K7.fertigkeitspunkte} Punkte. `
      + `Die Ausbildung gibt je Fertigkeit höchstens +${K5.max_je_fertigkeit} (Magieschule +${K5.max_je_magieschule}); `
      + `Punkte darüber gehen nur über Schritt 7. Weniger auf diese Fertigkeiten, dafür mehr auf andere verteilen.`);
  }

  // ---- Ressourcen
  const res: Record<string, number> = {};
  for (const r of state.resourcesList.filter(r => r.source === 'creation')) {
    const i = idNachName(k, 'ressource', r.name.replace(/\s*\(.*\)$/, ''));
    if (!i) { hinweise.push(`Ressource „${r.name}“ steht nicht im Regelwerk`); continue; }
    res[i] = (res[i] ?? 0) + (Number(r.level) || 1) - (Number(r.xpStufen) || 0);
  }
  for (const m of [wahl.kultur, wahl.abstammung]) {
    if (!m?.modul || !k.get(m.modul)) continue;
    for (const [nm, p] of Object.entries(modulWerte(k, m.modul, m.wahl).werte.ressourcen)) { const i = idNachName(k, 'ressource', nm)!; res[i] = (res[i] ?? 0) - p; }
  }
  const nimm = (punkte: number) => {
    const out: Record<string, number> = {};
    for (const i of Object.keys(res)) { while (punkte > 0 && res[i] > 0) { res[i]--; punkte--; out[i] = (out[i] ?? 0) + 1; } }
    return out;
  };
  const abstRes = abstFrei ? nimm(K4.ressourcenpunkte) : {};
  const ausbRes = nimm(K5.ressourcenpunkte);
  const s7Res = Object.fromEntries(Object.entries(res).filter(([, v]) => v !== 0));

  // ---- Stärken (ohne Rassenstärken und die kostenlose Stärke der Kultur)
  const staerken: string[] = [];
  const gratis = gratisStaerkeDerKultur(k);
  for (const s of state.strengthsList) {
    if (s.isRacial || s.name.startsWith(gratis) || s.source === 'xp') continue;
    const i = idNachName(k, 'staerke', s.name.replace(/\s*\(.*\)$/, ''));
    if (!i) { hinweise.push(`Stärke „${s.name}“ steht nicht im Regelwerk`); continue; }
    for (let j = 0; j < Math.max(1, Number(s.level) || 1); j++) staerken.push(i);
  }
  const stufe = (i: string) => Number(k.get(i)?.daten.stufe) || 1;
  const nehme = (i: string) => { const x = staerken.indexOf(i); if (x >= 0) staerken.splice(x, 1); return x >= 0; };
  let kulturStaerke: string | undefined;
  if (kulturFrei) { kulturStaerke = staerken.find(i => stufe(i) === K3.staerke_punkte); if (kulturStaerke) nehme(kulturStaerke); }
  else if (wahl.kultur?.angewendet?.staerke) { const i = idNachName(k, 'staerke', wahl.kultur.angewendet.staerke.name); if (i) nehme(i); }
  if (!abstFrei && wahl.abstammung?.angewendet?.staerke) { const i = idNachName(k, 'staerke', wahl.abstammung.angewendet.staerke.name); if (i) nehme(i); }
  // Ausbildung: Teilmenge mit genau der Punktzahl (sonst die größte darunter)
  const ausbSt: string[] = []; let beste: number[] = []; let besteSumme = -1;
  const suche = (start: number, sum: number, wahlIdx: number[]) => {
    if (sum > K5.staerke_punkte) return;
    if (sum > besteSumme) { besteSumme = sum; beste = [...wahlIdx]; }
    if (sum === K5.staerke_punkte) return;
    for (let x = start; x < staerken.length; x++) suche(x + 1, sum + stufe(staerken[x]), [...wahlIdx, x]);
  };
  suche(0, 0, []);
  for (const x of beste) ausbSt.push(staerken[x]);
  const s7St = staerken.filter((_, x) => !beste.includes(x));

  // ---- Meisterschaften
  type M = { id: string; fuer?: string; tier: number };
  const zuId = (name: string, skill: string): M | null => {
    // Schwerpunkt: zählt als Meisterschaft der ersten Schwelle (GRW S. 89); im Paket ein Eintrag je Fertigkeit
    if (/^Schwerpunkt/i.test(name)) {
      const fi = fertigkeitId(k, skill);
      const sp = fi ? k.nachTyp('schwerpunkt').find(e => e.daten.fertigkeit === fi) : undefined;
      if (sp) return { id: sp.id, tier: Number(sp.daten.schwelle) || 1 };
    }
    const i = meisterschaftId(k, name, skill);
    if (!i) { if (!/^Schwerpunkt/i.test(name)) hinweise.push(`Meisterschaft „${name}“ (${skill}) steht nicht im Regelwerk`); return null; }
    const e = k.get(i)!; const gruppe = String(e.daten.fertigkeit).startsWith('grw:meisterschaftsgruppe:');
    return { id: i, fuer: gruppe ? fertigkeitId(k, skill) : undefined, tier: Number(e.daten.schwelle) || 1 };
  };
  const erschaffungsM: M[] = []; const freieM: Array<string | { id: string; fuer: string }> = []; const epM: Array<string | { id: string; fuer: string }> = [];
  for (const [skill, liste] of Object.entries(state.masteries)) {
    for (const m of liste) {
      const x = zuId(m.name, skill); if (!x) continue;
      if (m.isFree) freieM.push(x.fuer ? { id: x.id, fuer: x.fuer } : x.id);
      else if (m.isCreationBonus || m.source === 'Erschaffung') erschaffungsM.push(x);
      else epM.push(x.fuer ? { id: x.id, fuer: x.fuer } : x.id);
    }
  }
  let kulturM: string | undefined;
  const modulM = wahl.kultur?.angewendet?.meisterschaft;
  if (!kulturFrei && modulM) { const x = zuId(modulM.name, modulM.skill); const j = x ? erschaffungsM.findIndex(y => y.id === x.id) : -1; if (j >= 0) erschaffungsM.splice(j, 1); }
  if (kulturFrei && erschaffungsM.length) kulturM = erschaffungsM.shift()!.id;

  // ---- Zauber und Start-Erfahrung
  const zauberId = (name: string) => { const i = idNachName(k, 'zauber', name); if (!i) hinweise.push(`Zauber „${name}“ steht nicht im Regelwerk`); return i; };
  const freieZ = state.spellsList.filter(s => s.isFree).map(s => zauberId(s.name)).filter((i): i is string => !!i);
  const startEp = S.start_erfahrung.ep;
  const mitEp = state.xpTotal <= startEp;
  if (!mitEp) hinweise.push(`Start-Erfahrung nicht geprüft: Der Charakter hat schon mehr als ${startEp} EP.`);
  const ep: NonNullable<Bau['ep']> = {};
  if (mitEp) {
    ep.attribute = attr(Object.fromEntries(Object.entries(state.attrIncrements).filter(([, v]) => v)));
    ep.fertigkeiten = Object.fromEntries(Object.entries(state.skillsXp).filter(([, v]) => v).map(([nm, v]) => [fid(nm) ?? nm, v]));
    ep.staerken = state.strengthsList.filter(s => s.source === 'xp').map(s => idNachName(k, 'staerke', s.name)).filter((i): i is string => !!i);
    // mit EP gekaufte Ressourcenstufen: eigene EP-Einträge und EP-Stufen auf Erschaffungs-Einträgen, je Ressource summiert
    ep.ressourcen = {};
    for (const r of state.resourcesList) {
      const n = r.source === 'xp' ? (Number(r.level) || 1) : (Number(r.xpStufen) || 0);
      if (!n) continue;
      const id = idNachName(k, 'ressource', r.name) ?? r.name;
      ep.ressourcen[id] = (ep.ressourcen[id] ?? 0) + n;
    }
    ep.sprachen = state.languagesList.filter(l => l.source === 'xp').length;
    ep.meisterschaften = epM;
    ep.zauber = state.spellsList.filter(s => !s.isFree && s.sourceMode === 'xp').map(s => zauberId(s.name)).filter((i): i is string => !!i);
  }

  const bau: Bau = {
    rasse: RASSE_ID[state.race],
    rasse_frei: (state.raceBonusAttrs ?? []).map(a => ATTRIBUT_NAME[a] ?? a),
    attribute: attr(state.attrBase as unknown as Record<string, number>),
    kultur: kulturFrei
      ? { frei: { fertigkeiten: verteilung.kultur, staerke: kulturStaerke, meisterschaft: kulturM } }
      : { modul: wahl.kultur!.modul, wahl: wahl.kultur!.wahl },
    abstammung: abstFrei ? { frei: { fertigkeiten: verteilung.abstammung, ressourcen: abstRes } } : { modul: wahl.abstammung!.modul, wahl: wahl.abstammung!.wahl },
    ausbildung: { frei: { fertigkeiten: verteilung.ausbildung, ressourcen: ausbRes, staerken: ausbSt, meisterschaften: erschaffungsM.map(m => m.id) } },
    schritt7: { staerken: s7St, ressourcen: s7Res, fertigkeiten: verteilung.schritt7 },
    ep,
    freie_meisterschaften: freieM,
    freie_zauber: freieZ,
  };
  return { bau, hinweise, verteilung };
}

/** Regelprüfung der Erschaffung für den Editor; null ohne Katalog oder bei unbekannter Rasse. */
export function pruefeErschaffungImEditor(state: CharacterState, k: Katalog | null = aktiverKatalog()): EditorPruefung | null {
  if (!k || !RASSE_ID[state.race] || !k.get(RASSE_ID[state.race])) return null;
  const { bau, hinweise, verteilung } = bauAusEditor(k, state);
  const { befunde } = pruefeErschaffung(k, bau);
  const lesbar = (t: string) => t.replace(/\b([a-z0-9]+:[a-z_]+:[a-z0-9:-]+)/g, (i) => k.get(i)?.name ?? i);
  return { befunde: befunde.map(([s, t]) => [s, lesbar(t)] as ErschaffungsBefund), hinweise: [...new Set(hinweise)], verteilung };
}

// ---------------------------------------------------------------- Für die Ansicht der Module (Kultur, Abstammung)

/** Text zur freien Erschaffung statt eines Moduls, aus den Kernregeln (`strukturiert.kultur_frei`/`abstammung_frei`, GRW S. 23) */
export function freieErschaffungText(k: Katalog, art: 'kultur' | 'abstammung'): string {
  const e = k.get(ERSCHAFFUNG_ID);
  const s = e?.daten.strukturiert?.[`${art}_frei`];
  if (!s) return '';
  const seite = s.belege?.[0]?.buch_seite ? ` (GRW S. ${s.belege[0].buch_seite})` : '';
  if (art === 'kultur') {
    const ms = s.meisterschaften_schwelle_1 ? `, ${s.meisterschaften_schwelle_1} Meisterschaft` : '';
    const schule = s.magieschulen_max_anzahl ? `, ${s.magieschulen_max_anzahl === 1 ? 'eine' : s.magieschulen_max_anzahl} Magieschule +${s.magieschule_max_punkte}` : ', keine Magieschule';
    return `Frei: ${s.fertigkeitspunkte} Fertigkeitspunkte (je höchstens +${s.max_je_fertigkeit}${schule}), 1 Stärke für ${s.staerke_punkte} Punkt${ms}${seite}`;
  }
  return `Frei: ${s.fertigkeitspunkte} Fertigkeitspunkte (je höchstens +${s.max_je_fertigkeit}${s.magieschulen_erlaubt ? '' : ', keine Magieschule'}), ${s.ressourcenpunkte} Ressourcenpunkte${seite}`;
}

/** Module einer Art mit Modulwerten, alphabetisch */
export function moduleDerArt(k: Katalog, art: 'kultur' | 'abstammung') {
  return k.nachTyp(art).filter(e => e.daten.modulwerte).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Wählbare Einträge einer Modulgruppe: feste Optionen und Platzhalter (Magieschule, Kampffertigkeit) aus den Fertigkeiten */
export function modulAuswahlListe(k: Katalog, gr: ModulGruppe): { id: string; text: string }[] {
  const feste = gr.optionen.filter(o => o.id).map(o => ({ id: o.id!, text: o.text }));
  const platz = gr.optionen.filter(o => o.auswahl).map(o => o.auswahl!);
  const extra = k.nachTyp('fertigkeit').filter(e => !feste.some(f => f.id === e.id) && (
    (platz.includes('magieschule') && e.daten.kategorie === 'Magieschule') ||
    (platz.includes('kampffertigkeit') && e.daten.kategorie === 'Kampffertigkeit') ||
    // „eine Nahkampffertigkeit“: ohne Schuss- und Wurfwaffen
    (platz.includes('nahkampffertigkeit') && NAHKAMPF.has(e.id))))
    .map(e => ({ id: e.id, text: e.name }));
  return [...feste, ...extra];
}

/** Beschreibungen der Stärken, Ressourcen und der Meisterschaft, die ein Modul einträgt */
export function modulBeschreibungen(k: Katalog, meisterschaft?: { name: string }): Record<string, string> {
  const b: Record<string, string> = {};
  for (const e of [...k.nachTyp('ressource'), ...k.nachTyp('staerke')]) b[e.name] = e.daten.beschreibung ?? '';
  if (meisterschaft) { const e = k.nachTyp('meisterschaft').find(x => `${x.name} (S${x.daten.schwelle})` === meisterschaft.name); if (e) b[meisterschaft.name] = e.daten.beschreibung ?? ''; }
  return b;
}
