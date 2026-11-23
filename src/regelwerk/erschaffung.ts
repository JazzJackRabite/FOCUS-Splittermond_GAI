/**
 * Prüfung einer Charaktererschaffung nach GRW S. 22–30 (daten.strukturiert von
 * grw:regel:erschaffung-regeln:uebersicht-ueber-die-charaktererschaffung).
 * Portierung von pruefe_erschaffung() und gruppe_passt() aus Pruefsuite/lader.py; Meldungen wortgleich.
 */
import type { Katalog } from './katalog';
import type { Eintrag } from './typen';

export const ERSCHAFFUNG_ID = 'grw:regel:erschaffung-regeln:uebersicht-ueber-die-charaktererschaffung';
export const NAHKAMPF = new Set(['grw:fertigkeit:handgemenge', 'grw:fertigkeit:hiebwaffen', 'grw:fertigkeit:kettenwaffen', 'grw:fertigkeit:klingenwaffen', 'grw:fertigkeit:stangenwaffen']);

export type Punkte = Record<string, number>;
export interface ModulWahl { fertigkeiten?: Record<string, string>; ressourcen?: Record<string, string>; staerke?: string; meisterschaft?: number }
export interface FreieMeisterschaft { id: string; fuer: string }

export interface Bau {
  rasse: string;
  rasse_frei?: string[];
  attribute: Punkte;
  kultur?: { modul: string; wahl?: ModulWahl } | { frei: { fertigkeiten?: Punkte; staerke?: string; meisterschaft?: string } };
  abstammung?: { modul: string; wahl?: ModulWahl } | { frei: { fertigkeiten?: Punkte; ressourcen?: Punkte } };
  ausbildung?: { frei: { fertigkeiten?: Punkte; ressourcen?: Punkte; staerken?: string[]; meisterschaften?: string[] } };
  schritt7?: { staerken?: string[]; ressourcen?: Punkte; fertigkeiten?: Punkte };
  ep?: { attribute?: Punkte; fertigkeiten?: Punkte; staerken?: string[]; meisterschaften?: string[]; zauber?: string[]; ressourcen?: Punkte; sprachen?: number };
  freie_meisterschaften?: Array<string | FreieMeisterschaft>;
  freie_zauber?: string[];
}

export type ErschaffungsBefund = ['fehler' | 'spielleiter', string];

export interface ErschaffenerCharakter {
  attribute: Punkte;
  attribute_start: Punkte;
  rasse: string;
  staerken: string[];
  meisterschaften: string[];
  zauber: string[];
  werte: Punkte;
  hat: Set<string>;
  ep_ausgegeben: number;
  splitterpunkte: number;
}

/** Gilt eine allgemeine Meisterschaftsgruppe für die Fertigkeit? (GRW S. 106/199) */
export function gruppePasst(gruppe: string, fertigkeit: string, kat: Katalog): boolean {
  const kategorie = kat.get(fertigkeit)?.daten.kategorie;
  if (gruppe.endsWith('allgemeine-nahkampfmeisterschaften')) return NAHKAMPF.has(fertigkeit);
  if (gruppe.endsWith('allgemeine-kampfmeisterschaften')) return kategorie === 'Kampffertigkeit';
  if (gruppe.endsWith('allgemeine-magiemeisterschaften')) return kategorie === 'Magieschule';
  return false;
}

const summe = (p: Punkte | undefined) => Object.values(p ?? {}).reduce((a, b) => a + b, 0);

export function pruefeErschaffung(kat: Katalog, bau: Bau): { charakter: ErschaffenerCharakter; befunde: ErschaffungsBefund[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const S: any = kat.get(ERSCHAFFUNG_ID)!.daten.strukturiert;
  const B: ErschaffungsBefund[] = [];
  const f = (t: string) => { B.push(['fehler', t]); };
  const g = (i: string | null | undefined): Eintrag | undefined => { const e = kat.get(i); if (e === undefined) f(`unbekannte ID ${i ?? 'None'}`); return e; };
  const istSchule = (i: string) => g(i)?.daten.kategorie === 'Magieschule';
  const fert: Punkte = {}; const res: Punkte = {}; const staerken: string[] = []; const meist: string[] = [];
  const add = (d: Punkte, src: Punkte | undefined) => {
    for (const [i, n] of Object.entries(src ?? {})) { if (g(i) === undefined) continue; d[i] = (d[i] ?? 0) + n; }
  };
  // Schritt 2 + 6: Attribute
  const A = S.attribute; const at: Punkte = { ...bau.attribute };
  if (summe(at) !== A.punkte) f(`Attribute: ${summe(at)} statt ${A.punkte} Punkte verteilt`);
  for (const [a, v] of Object.entries(at)) if (!(A.minimum <= v && v <= A.maximum)) f(`Attribut ${a} = ${v}, erlaubt ${A.minimum}–${A.maximum}`);
  const rasse = g(bau.rasse)!; const rm = rasse.daten.attributsmodifikatoren;
  for (const [a, v] of Object.entries(rm.fest as Punkte)) at[a] += v;
  let frei = [...(bau.rasse_frei ?? [])];
  const soll = (rm.frei as { anzahl: number }[]).reduce((s, x) => s + x.anzahl, 0);
  if (frei.length !== soll) f(`freie Rassenmodifikatoren: ${frei.length} statt ${soll} gewählt`);
  for (const x of rm.frei) {
    const wahl = frei.slice(0, x.anzahl); frei = frei.slice(x.anzahl);
    if (x.unterschiedlich && new Set(wahl).size < wahl.length) f(`${rasse.name}: freie Modifikatoren müssen auf unterschiedliche Attribute gehen`);
    for (const a of wahl) {
      if ((x.nicht ?? []).includes(a)) f(`${rasse.name}: freier Modifikator nicht auf ${a}`);
      at[a] += x.bonus;
    }
  }
  for (const r of rasse.daten.staerken_refs ?? []) staerken.push(r.id);

  const modul = (mid: string, wahlIn: ModulWahl | undefined, typ: string) => {
    const m = g(mid);
    if (m === undefined || m.typ !== typ) { f(`${mid} ist kein ${typ}-Modul`); return; }
    const mw = m.daten.modulwerte; const wahl: ModulWahl = wahlIn ?? {};
    for (const [feld, ziel] of [['fertigkeiten', fert], ['ressourcen', res]] as const) {
      const gew: Record<number, string | null> = {};
      const gruppen = mw[feld] ?? [];
      gruppen.forEach((gr: { rest_von?: number; text: string; punkte: number; optionen: { id?: string; auswahl?: string }[] }, k: number) => {
        let i: string | null | undefined;
        const w = (wahl[feld] ?? {}) as Record<string, string>;
        if (gr.rest_von !== undefined && gr.rest_von !== null) {
          const opts = gruppen[gr.rest_von].optionen.filter((o: { id?: string }) => o.id).map((o: { id: string }) => o.id);
          const rest = opts.filter((o: string) => o !== gew[gr.rest_von!]);
          i = w[String(k)] || (rest.length === 1 ? rest[0] : null);
          if (!rest.includes(i)) f(`${m.name}: ${feld}[${k}] („${gr.text}“) braucht eine Wahl aus ${pyListe(rest)}`);
        } else {
          const opts = gr.optionen; i = w[String(k)];
          if ((i === undefined || i === null) && opts.length === 1 && opts[0].id) i = opts[0].id;
          const erlaubt = opts.filter(o => o.id).map(o => o.id as string);
          const platz = opts.filter(o => o.auswahl).map(o => o.auswahl as string);
          let ok = !!i && erlaubt.includes(i);
          if (!ok && i && platz.length) {
            const e = g(i);
            ok = !!e && ((platz.includes('magieschule') && istSchule(i)) ||
              (platz.includes('kampffertigkeit') && kat.get(i)?.daten.kategorie === 'Kampffertigkeit') ||
              (platz.includes('nahkampffertigkeit') && NAHKAMPF.has(i)));
          }
          if (!ok) { f(`${m.name}: ${feld}[${k}] („${gr.text}“) braucht eine gültige Wahl`); return; }
        }
        gew[k] = i ?? null;
        const key = String(i ?? 'None');
        ziel[key] = (ziel[key] ?? 0) + gr.punkte;
      });
    }
    const so = (mw.staerke_optionen ?? []).filter((o: { id?: string }) => o.id).map((o: { id: string }) => o.id);
    if (so.length) {
      const s = wahl.staerke || (so.length === 1 ? so[0] : null);
      if (!so.includes(s)) f(`${m.name}: Stärke aus ${pyListe(so)} wählen`);
      else staerken.push(s);
    }
    const mo = mw.meisterschaft_optionen ?? [];
    if (mo.length) {
      const k = wahl.meisterschaft ?? (mo.length === 1 ? 0 : null);
      if (k === null || !(0 <= k && k < mo.length)) f(`${m.name}: Meisterschaft aus ${mo.length} Optionen wählen`);
      else if (mo[k].id) meist.push(mo[k].id);
    }
    if (mw.kulturkunde) staerken.push('grw:staerke:kulturkunde');
  };

  // Schritt 3: Kultur
  const ku = bau.kultur ?? {} as NonNullable<Bau['kultur']>;
  if ('modul' in ku) modul(ku.modul, ku.wahl, 'kultur');
  else {
    const K3 = S.kultur_frei; const x = ('frei' in ku ? ku.frei : {}) as { fertigkeiten?: Punkte; staerke?: string; meisterschaft?: string };
    const fz = x.fertigkeiten ?? {};
    if (summe(fz) !== K3.fertigkeitspunkte) f(`Kultur (frei): ${summe(fz)} statt ${K3.fertigkeitspunkte} Fertigkeitspunkte`);
    for (const [i, n] of Object.entries(fz)) if (n > K3.max_je_fertigkeit) f(`Kultur (frei): ${i} +${n}, höchstens +${K3.max_je_fertigkeit}`);
    const sch = Object.keys(fz).filter(i => istSchule(i));
    if (sch.length > K3.magieschulen_max_anzahl || sch.some(i => fz[i] > K3.magieschule_max_punkte)) f('Kultur (frei): höchstens eine Magieschule mit +1');
    add(fert, fz);
    const s = x.staerke ? g(x.staerke) : undefined;
    if (!s || s.daten.stufe !== K3.staerke_punkte) f('Kultur (frei): eine Stärke im Wert von 1 Punkt wählen');
    else staerken.push(s.id);
    staerken.push('grw:staerke:kulturkunde');
    if (x.meisterschaft) meist.push(x.meisterschaft);
    else f('Kultur (frei): 1 Meisterschaft der ersten Schwelle wählen');
  }
  // Schritt 4: Abstammung
  const ab = bau.abstammung ?? {} as NonNullable<Bau['abstammung']>;
  if ('modul' in ab) modul(ab.modul, ab.wahl, 'abstammung');
  else {
    const K4 = S.abstammung_frei; const x = ('frei' in ab ? ab.frei : {}) as { fertigkeiten?: Punkte; ressourcen?: Punkte };
    const fz = x.fertigkeiten ?? {}; const rz = x.ressourcen ?? {};
    if (summe(fz) !== K4.fertigkeitspunkte) f(`Abstammung (frei): ${summe(fz)} statt ${K4.fertigkeitspunkte} Fertigkeitspunkte`);
    if (Object.values(fz).some(n => n > K4.max_je_fertigkeit)) f('Abstammung (frei): je Fertigkeit höchstens +1');
    if (Object.keys(fz).some(i => istSchule(i))) f('Abstammung (frei): keine Magieschulen');
    if (summe(rz) !== K4.ressourcenpunkte) f(`Abstammung (frei): ${summe(rz)} statt ${K4.ressourcenpunkte} Ressourcenpunkte`);
    add(fert, fz); add(res, rz);
  }
  // Schritt 5: Ausbildung (nur frei; Ausbildungs-Module sind nicht in den Paketen)
  {
    const K5 = S.ausbildung_frei; const x = bau.ausbildung?.frei ?? {}; const fz = x.fertigkeiten ?? {}; const rz = x.ressourcen ?? {};
    if (summe(fz) !== K5.fertigkeitspunkte) f(`Ausbildung (frei): ${summe(fz)} statt ${K5.fertigkeitspunkte} Fertigkeitspunkte`);
    for (const [i, n] of Object.entries(fz)) {
      const mx = istSchule(i) ? K5.max_je_magieschule : K5.max_je_fertigkeit;
      if (n > mx) f(`Ausbildung (frei): ${i} +${n}, höchstens +${mx}`);
    }
    if (summe(rz) !== K5.ressourcenpunkte) f(`Ausbildung (frei): ${summe(rz)} statt ${K5.ressourcenpunkte} Ressourcenpunkte`);
    const sk = (x.staerken ?? []).reduce((s, i) => { const e = g(i); return e ? s + e.daten.stufe : s; }, 0);
    if (sk !== K5.staerke_punkte) f(`Ausbildung (frei): Stärken für ${sk} statt ${K5.staerke_punkte} Punkte`);
    if ((x.meisterschaften ?? []).length !== K5.meisterschaften_schwelle_1) f(`Ausbildung (frei): ${K5.meisterschaften_schwelle_1} Meisterschaften wählen`);
    add(fert, fz); add(res, rz); staerken.push(...(x.staerken ?? [])); meist.push(...(x.meisterschaften ?? []));
  }
  // Schritt 7
  {
    const K7 = S.schritt_7; const x = bau.schritt7 ?? {};
    const bonus = rasse.name === 'Menschen' ? S.menschen_zusaetzliche_staerkepunkte.punkte : 0;
    const sk = (x.staerken ?? []).reduce((s, i) => { const e = g(i); return e ? s + e.daten.stufe : s; }, 0);
    if (sk !== K7.staerke_punkte + bonus) f(`Schritt 7: Stärken für ${sk} statt ${K7.staerke_punkte + bonus} Punkte`);
    staerken.push(...(x.staerken ?? []));
    const vorher = { ...res }; add(res, x.ressourcen);
    let neg = 0;
    for (const [i, v] of Object.entries(res)) {
      if (kat.get(i)?.daten.art === 'kern') neg += Math.max(0, -Math.min(v, 0) - Math.max(0, -Math.min(vorher[i] ?? 0, 0)));
    }
    const ausgegeben = summe(x.ressourcen);
    if (ausgegeben !== K7.ressourcenpunkte) f(`Schritt 7: ${ausgegeben} statt ${K7.ressourcenpunkte} Ressourcenpunkte (negative Kernressourcen zählen als Gutschrift)`);
    if (neg) B.push(['spielleiter', `Schritt 7: negative Kernressourcen (${neg} Stufen) brauchen die Zustimmung der Spielleitung`]);
    for (const [i, v] of Object.entries(res)) {
      const tab: number[] = (kat.get(i)?.daten.tabelle?.zeilen ?? []).map((z: { punkte?: unknown }) => z.punkte).filter((p: unknown) => Number.isInteger(p));
      if (tab.length && v < Math.min(Math.min(...tab), 0)) f(`Ressource ${i} = ${v} unter dem Mindestwert ${Math.min(...tab)}`);
      if (v > 4) B.push(['spielleiter', `Ressource ${i} = ${v}: Werte über 4 brauchen die Zustimmung der Spielleitung`]);
    }
    const fz = x.fertigkeiten ?? {};
    if (summe(fz) !== K7.fertigkeitspunkte) f(`Schritt 7: ${summe(fz)} statt ${K7.fertigkeitspunkte} Fertigkeitspunkte`);
    add(fert, fz);
    for (const [i, v] of Object.entries(fert)) if (v > K7.fertigkeit_hoechstwert_spielbeginn) f(`Fertigkeit ${i} = ${v} vor Start-Erfahrung, höchstens ${K7.fertigkeit_hoechstwert_spielbeginn}`);
    for (const i of new Set(meist)) {
      const e = g(i);
      if (e && e.typ === 'meisterschaft' && e.daten.schwelle !== 1) f(`Meisterschaft ${i}: bei der Erschaffung nur Schwelle 1`);
    }
  }
  // Schritt 9: Start-Erfahrung
  const K9 = S.steigerungskosten_spielbeginn; const x9 = bau.ep ?? {}; let ep = 0;
  for (const [a, n] of Object.entries(x9.attribute ?? {})) {
    if (n > 1) f(`Start-Erfahrung: Attribut ${a} höchstens Startwert +1`);
    ep += K9.attribut.kosten_ep * n;
  }
  const startAt = { ...at };
  for (const [a, n] of Object.entries(x9.attribute ?? {})) at[a] += n;
  for (const [i, n] of Object.entries(x9.fertigkeiten ?? {})) {
    ep += K9.fertigkeitspunkt.kosten_ep * n; fert[i] = (fert[i] ?? 0) + n;
    if (fert[i] > K9.fertigkeitspunkt.hoechstwert) f(`Start-Erfahrung: Fertigkeit ${i} über ${K9.fertigkeitspunkt.hoechstwert}`);
  }
  ep += K9.staerke_je_stufe * (x9.staerken ?? []).reduce((s, i) => { const e = g(i); return e ? s + e.daten.stufe : s; }, 0);
  staerken.push(...(x9.staerken ?? []));
  for (const [i, n] of Object.entries(x9.ressourcen ?? {})) { ep += K9.ressource_je_stufe.kosten_ep * n; res[i] = (res[i] ?? 0) + n; }
  ep += K9.sprache * (x9.sprachen ?? 0);
  for (const i of x9.meisterschaften ?? []) {
    const e = g(i); ep += K9.meisterschaft.kosten_ep;
    if (e && (fert[e.daten.fertigkeit] ?? 0) < K9.meisterschaft.mindest_fertigkeitspunkte) f(`Start-Erfahrung: Meisterschaft ${i} braucht 6 Punkte in der Fertigkeit`);
  }
  meist.push(...(x9.meisterschaften ?? []));
  const zauber: string[] = [];
  type GradListe = { grad: number; mindest_fertigkeitspunkte_magieschule: number }[];
  const zauberOk = (i: string, liste: GradListe) => {
    const e = g(i);
    if (!e) return null;
    return (e.daten.schulen ?? []).filter((s: { id?: string; grad?: number | null }) => s.id && s.grad !== null && s.grad !== undefined
      && (fert[s.id] ?? 0) >= (liste.find(z => z.grad === s.grad)?.mindest_fertigkeitspunkte_magieschule ?? 99)) as { id: string; grad: number }[];
  };
  for (const i of x9.zauber ?? []) {
    const ok = zauberOk(i, K9.zauber_nach_grad);
    if (!ok || !ok.length) f(`Start-Erfahrung: Zauber ${i} – keine Magieschule mit genug Punkten (oder Grad über 2)`);
    else { const mg = Math.min(...ok.map(s => s.grad)); ep += K9.zauber_nach_grad.find((z: { grad: number }) => z.grad === mg).kosten_ep; }
    zauber.push(i);
  }
  if (ep > S.start_erfahrung.ep) f(`Start-Erfahrung: ${ep} EP ausgegeben, verfügbar ${S.start_erfahrung.ep}`);
  // Schritt 10: freie Meisterschaften und Zauber
  const F10 = S.feinschliff;
  const mit6 = new Set(Object.entries(fert).filter(([, v]) => v >= 6).map(([i]) => i));
  const fmRoh = bau.freie_meisterschaften ?? [];
  const idVon = (x: string | FreieMeisterschaft) => (typeof x === 'object' ? x.id : x);
  const fm = fmRoh.map(idVon);
  const fuer = (x: string | FreieMeisterschaft): string | null => {
    const i = idVon(x); const e = g(i);
    if (!e) return null;
    const fi: string | undefined = e.daten.fertigkeit;
    if (fi && fi.startsWith('grw:meisterschaftsgruppe:')) {
      if (typeof x !== 'object' || !x.fuer) { f(`Feinschliff: ${i} ist eine allgemeine Meisterschaft – Fertigkeit angeben ({"id": …, "fuer": …})`); return null; }
      if (!gruppePasst(fi, x.fuer, kat)) { f(`Feinschliff: ${i} gilt nicht für ${x.fuer}`); return null; }
      return x.fuer;
    }
    return fi ?? null;
  };
  const zaehler = new Map<string | null, number>();
  for (const x of fmRoh) { if (!g(idVon(x))) continue; const k = fuer(x); zaehler.set(k, (zaehler.get(k) ?? 0) + 1); }
  for (const [fi, n] of zaehler) {
    if (fi === null) continue;
    if (!mit6.has(fi) || n > F10.freie_meisterschaft_je_fertigkeit_mit_6_punkten) f(`Feinschliff: freie Meisterschaft in ${fi} nicht zulässig (je Fertigkeit mit 6 Punkten eine)`);
  }
  for (const i of fm) { const e = g(i); if (e && e.daten.schwelle !== 1) f(`Feinschliff: freie Meisterschaft ${i} muss Schwelle 1 haben`); }
  meist.push(...fm);
  // Freie Zauber: je Magieschule ein Platz pro Grad 0/1/2 (bipartites Matching)
  const plaetze = new Map<string, string[]>();
  const liste10: GradListe = F10.freie_zauber_je_magieschule.map((z: { grad: number; ab_fertigkeitspunkten: number }) => ({ grad: z.grad, mindest_fertigkeitspunkte_magieschule: z.ab_fertigkeitspunkten }));
  for (const i of bau.freie_zauber ?? []) {
    const ok = zauberOk(i, liste10);
    if (!ok || !ok.length) { f(`Feinschliff: freier Zauber ${i} – keine passende Magieschule`); continue; }
    plaetze.set(i, ok.map(s => `${s.id}|${s.grad}`)); zauber.push(i);
  }
  const belegt = new Map<string, string>();
  const setze = (i: string, gesehen: Set<string>): boolean => {
    for (const p of plaetze.get(i)!) {
      if (gesehen.has(p)) continue;
      gesehen.add(p);
      if (!belegt.has(p) || setze(belegt.get(p)!, gesehen)) { belegt.set(p, i); return true; }
    }
    return false;
  };
  for (const i of plaetze.keys()) if (!setze(i, new Set())) f(`Feinschliff: für ${i} ist kein freier Platz mehr (je Magieschule ein Zauber pro Grad 0/1/2)`);
  for (const i of new Set(meist)) {
    const e = g(i);
    if (e && e.typ === 'meisterschaft') {
      const fi: string | undefined = e.daten.fertigkeit;
      if (fi && fi.startsWith('grw:fertigkeit:') && (fert[fi] ?? 0) < 1) f(`Meisterschaft ${i}: in ${fi} ist am Ende kein Fertigkeitspunkt`);
    }
  }
  const zaehlerSt = new Map<string, number>();
  for (const s of staerken) zaehlerSt.set(s, (zaehlerSt.get(s) ?? 0) + 1);
  for (const [i, n] of zaehlerSt) {
    const mods = kat.get(i)?.daten.abgeleitete_werte_modifikatoren ?? [];
    const mehrfach = mods.some((m: { mehrfach?: unknown }) => m.mehrfach);
    if (n > 1 && !mehrfach) B.push(['spielleiter', `Stärke ${i} mehrfach erhalten: Punkte neu verteilen (Schritt 7), sofern sie nur einmal wählbar ist`]);
  }
  const charakter: ErschaffenerCharakter = {
    attribute: at, attribute_start: startAt, rasse: bau.rasse, staerken, meisterschaften: meist, zauber,
    werte: { ...fert, ...res }, hat: new Set([...staerken, ...meist, ...zauber, bau.rasse]), ep_ausgegeben: ep,
    splitterpunkte: F10.splitterpunkte,
  };
  return { charakter, befunde: B };
}

/** Python-Darstellung einer Liste von Zeichenketten (für wortgleiche Meldungen mit der Prüfsuite). */
function pyListe(l: (string | null | undefined)[]): string {
  return '[' + l.map(x => (x === null || x === undefined ? 'None' : `'${x}'`)).join(', ') + ']';
}
