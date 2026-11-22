/**
 * Katalog: lädt Regelpakete nach dem Lade-Algorithmus des Manifests.
 * Portierung von Pruefsuite/lader.py (Klasse Katalog); gleiche Ergebnisse, geprüft in src/regelwerk/__tests__.
 */
import type { Befund, Eintrag, LadePaket, Manifest, PaketInfo, Regelgruppe, Schwere } from './typen';

const BEDINGUNGSARTEN = ['hat', 'mindestwert', 'schwerpunkt', 'zauber_typus', 'alle', 'einer_von', 'offen',
  'hat_name', 'meisterschaften_anzahl', 'fertigkeiten_anzahl', 'situativ', 'auswahl_einschraenkung',
  'nicht', 'gestaffelt', 'typus', 'groessenklasse', 'fertigkeit_vorhanden'];
const REF_FELDER = ['fertigkeit'];

const tiefeKopie = <T>(x: T): T => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
/** Werte-Gleichheit wie in Python (Reihenfolge der Objektschlüssel egal). */
export function gleich(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => gleich(x, (b as unknown[])[i]));
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  return ka.length === kb.length && ka.every(k => k in (b as object) && gleich((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export class Katalog {
  manifest: Manifest;
  befunde: Befund[] = [];
  eintraege: Record<string, Eintrag> = {};
  erweiterungen: Record<string, Eintrag[]> = {};
  verweise: Record<string, Eintrag> = {};
  geladen: string[] = [];
  alleIds: Record<string, string> = {};
  alias: Record<string, string> = {};
  zusammengefuehrt: Eintrag[] = [];
  geltend: Record<string, string> = {};
  regelgruppen: Record<string, Regelgruppe> = {};
  umbenannt: Record<string, string> = {};
  /** Angaben der geladenen Pakete (Titel, Kürzel, Ladereihenfolge) */
  pakete: Record<string, PaketInfo> = {};
  private idRegex: RegExp;

  constructor(manifest: Manifest, pakete: LadePaket[]) {
    this.manifest = manifest;
    this.idRegex = new RegExp(manifest.id_schema.regex);
    const basis = manifest.basis_paket;
    if (!pakete.some(p => p.info.id === basis)) this.b('fehler', '-', '-', `Basispaket ${basis} fehlt in der Auswahl`);
    const wahl = [...pakete].sort((a, b) => a.info.ladereihenfolge - b.info.ladereihenfolge);
    const ids = new Set(wahl.map(p => p.info.id));
    for (const p of wahl) {
      for (const a of p.info.abhaengigkeiten) if (!ids.has(a)) this.b('fehler', p.info.id, '-', `Abhängigkeit ${a} nicht gewählt`);
      this.lade(p);
    }
    // Regelgruppen: Manifest (falls vorhanden) plus ladeinfo der geladenen Grimoires
    Object.assign(this.regelgruppen, manifest.regelgruppen?.gruppen ?? {});
    for (const p of wahl) Object.assign(this.regelgruppen, p.regelgruppen ?? {});
    this.wendeRegelgruppenAn();
    for (const p of wahl) Object.assign(this.umbenannt, p.umbenannt ?? {});
    for (const [alt, neu] of Object.entries(this.umbenannt)) if (!(alt in this.alias)) this.alias[alt] = this.alias[neu] ?? neu;
  }

  b(schwere: Schwere, paket: string, eid: string, text: string) {
    this.befunde.push([schwere, paket, eid, text]);
  }

  private lade(p: LadePaket) {
    const { info, paket } = p;
    const E = paket.eintraege;
    const soll = p.erwarteteEintraege ?? info.eintraege;
    if (soll !== undefined && E.length !== soll) this.b('fehler', info.id, '-', `Anzahl ${E.length} ≠ manifest ${soll}`);
    for (const e of E) {
      if (e.id in this.alleIds) this.b('fehler', info.id, e.id, 'doppelte ID');
      this.alleIds[e.id] = info.id;
      if (e.quelle.paket !== info.id) this.b('fehler', info.id, e.id, 'quelle.paket passt nicht');
      if (!this.idRegex.test(e.id)) this.b('fehler', info.id, e.id, 'ID verletzt id_schema');
      const akt = e.aktion;
      if (akt === 'neu') {
        this.eintraege[e.id] = tiefeKopie(e);
      } else if (akt === 'ergaenzt' || akt === 'ersetzt') {
        const z = e.ziel ?? '';
        if (!(z in this.eintraege)) { this.b('fehler', info.id, e.id, `Ziel ${e.ziel} nicht geladen`); continue; }
        if (this.eintraege[z].typ !== e.typ) this.b('warnung', info.id, e.id, `Typ ${e.typ} ≠ Ziel-Typ ${this.eintraege[z].typ}`);
        (this.erweiterungen[z] ??= []).push(e);
        const ziel = this.eintraege[z];
        (ziel._quellen ??= []).push(e.quelle);
        if (akt === 'ersetzt') {
          for (const [feld, ae] of Object.entries(e.aenderungen ?? {})) {
            const alt = ziel.daten[feld];
            if (!gleich(alt ?? null, ae.alt ?? null)) {
              this.b('fehler', info.id, e.id, `ersetzt: Feld '${feld}' im Ziel ist ${JSON.stringify(alt ?? null).slice(0, 120)}, aenderungen.alt sagt ${JSON.stringify(ae.alt)}`);
            }
            ziel.daten[feld] = tiefeKopie(ae.neu);
          }
        }
      } else if (akt === 'verweis') {
        this.verweise[e.id] = e;
      } else {
        this.b('fehler', info.id, e.id, `unbekannte aktion ${akt}`);
      }
    }
    this.geladen.push(info.id);
    this.pakete[info.id] = info;
  }

  /** Je Regelgruppe gilt die erste Fassung, deren Paket geladen ist; die übrigen werden zu Aliassen. */
  private wendeRegelgruppenAn() {
    for (const [gid, g] of Object.entries(this.regelgruppen)) {
      const da = g.fassungen.filter(f => f in this.alleIds);
      if (!da.length) continue;
      if (g.art === 'ergaenzt' || g.art === 'ersetzt') {
        const ers = da.filter(f => f !== gid && (this.erweiterungen[gid] ?? []).some(x => x.id === f && x.aktion === 'ersetzt'));
        if (ers.length > 1) {
          const x = this.erweiterungen[gid].find(x => x.id === ers[0])!;
          for (const [feld, ae] of Object.entries(x.aenderungen ?? {})) this.eintraege[gid].daten[feld] = tiefeKopie(ae.neu);
        }
        this.geltend[gid] = gid;
        for (const f of da) if (f !== gid) this.alias[f] = gid;
        continue;
      }
      const akt = da[0];
      this.geltend[gid] = akt;
      for (const f of da.slice(1)) {
        const e = this.eintraege[f];
        if (!e) continue;
        delete this.eintraege[f];
        this.alias[f] = akt;
        (this.eintraege[akt]._quellen ??= []).push(e.quelle);
        this.zusammengefuehrt.push(e);
      }
      if (!(gid in this.alleIds)) this.alias[gid] = akt;
    }
  }

  // ---- Abfragen -------------------------------------------------------
  get(eid: string | null | undefined): Eintrag | undefined {
    if (!eid) return undefined;
    return this.eintraege[this.alias[eid] ?? eid];
  }

  hat(eid: string): boolean {
    return (this.alias[eid] ?? eid) in this.eintraege;
  }

  nachName(typ: string, name: string, fertigkeit?: string): Eintrag[] {
    return Object.values(this.eintraege).filter(e => e.typ === typ && e.name === name && (fertigkeit === undefined || e.daten.fertigkeit === fertigkeit));
  }

  nachTyp(typ: string): Eintrag[] {
    return Object.values(this.eintraege).filter(e => e.typ === typ);
  }

  angeboteneVerweise(): Eintrag[] {
    return Object.values(this.verweise).filter(v => v.ziel && v.ziel in this.eintraege);
  }

  // ---- Referenzprüfung über alle geladenen Einträge -----------------
  pruefeReferenzen() {
    const ref = (paket: string, eid: string, wert: unknown, wo: string) => {
      if (wert === null || wert === undefined) return;
      if (typeof wert !== 'string' || !this.hat(wert)) {
        const zielPaket = String(wert).split(':')[0];
        const schwere: Schwere = this.geladen.includes(zielPaket) ? 'fehler' : 'info';
        this.b(schwere, paket, eid, `${wo} → ${wert} nicht im Katalog` + (schwere === 'info' ? ' (Paket nicht geladen)' : ''));
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bed = (paket: string, eid: string, b: any, wo: string) => {
      if (!b || typeof b !== 'object' || Array.isArray(b)) { this.b('fehler', paket, eid, `${wo}: Bedingung ist kein Objekt`); return; }
      if ('hat' in b) ref(paket, eid, b.hat, wo + '.hat');
      if ('mindestwert' in b) ref(paket, eid, b.mindestwert?.ziel, wo + '.mindestwert.ziel');
      if ('schwerpunkt' in b) ref(paket, eid, b.schwerpunkt?.fertigkeit, wo + '.schwerpunkt.fertigkeit');
      for (const k of ['alle', 'einer_von']) (b[k] ?? []).forEach((t: unknown, i: number) => bed(paket, eid, t, `${wo}.${k}[${i}]`));
      if ('nicht' in b) bed(paket, eid, b.nicht, wo + '.nicht');
      (b.gestaffelt ?? []).forEach((t: { bedingung: unknown }, i: number) => bed(paket, eid, t.bedingung, `${wo}.gestaffelt[${i}]`));
      if ('fertigkeit_vorhanden' in b) ref(paket, eid, b.fertigkeit_vorhanden, wo + '.fertigkeit_vorhanden');
      if ('hat_name' in b && b.hat_name?.fertigkeit) ref(paket, eid, b.hat_name.fertigkeit, wo + '.hat_name.fertigkeit');
      if (!BEDINGUNGSARTEN.some(k => k in b)) this.b('fehler', paket, eid, `${wo}: unbekannte Bedingung ${JSON.stringify(Object.keys(b))}`);
    };
    const alle = [...Object.values(this.eintraege), ...Object.values(this.erweiterungen).flat(), ...this.zusammengefuehrt];
    for (const e of alle) {
      const p = e.quelle.paket; const d = e.daten;
      for (const f of REF_FELDER) if (typeof d[f] === 'string' && d[f].includes(':')) ref(p, e.id, d[f], f);
      for (const f of ['schulen', 'merkmale', 'staerken_refs']) {
        if (Array.isArray(d[f])) d[f].forEach((x: unknown, i: number) => {
          if (x && typeof x === 'object' && 'id' in (x as object)) {
            const xx = x as { id: string | null; text?: string };
            if (xx.id === null && !xx.text) this.b('fehler', p, e.id, `${f}[${i}] ohne id und ohne text`);
            ref(p, e.id, xx.id, `${f}[${i}]`);
          }
        });
      }
      const v = d.voraussetzungen;
      if (v && typeof v === 'object' && !Array.isArray(v) && 'bedingung' in v) bed(p, e.id, v.bedingung, 'voraussetzungen');
      if (d.beschreibung_id) ref(p, e.id, d.beschreibung_id, 'beschreibung_id');
      const walk = (x: unknown, wo: string) => {
        if (Array.isArray(x)) { for (const y of x) walk(y, wo); return; }
        if (!x || typeof x !== 'object') return;
        for (const [k, v2] of Object.entries(x as Record<string, unknown>)) {
          if (k.endsWith('_refs') || k.endsWith('_ref') || k === 'ref') {
            for (const y of Array.isArray(v2) ? v2 : [v2]) {
              if (y && typeof y === 'object' && !Array.isArray(y) && (y as { id?: string }).id) ref(p, e.id, (y as { id: string }).id, `${wo}.${k}`);
              else if (typeof y === 'string' && y.includes(':')) ref(p, e.id, y, `${wo}.${k}`);
              else if (y && typeof y === 'object' && !Array.isArray(y)) walk(y, `${wo}.${k}`);
            }
          } else walk(v2, `${wo}.${k}`);
        }
      };
      walk(d, 'daten');
    }
  }
}
