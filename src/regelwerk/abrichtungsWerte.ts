/**
 * Werte eines Tiers mit seinen Abrichtungen (Bestienmeister S. 16–23). Die Zahlen kommen aus dem Paket:
 * `daten.modifikationen` (Schreibweise der Baukasten-Module) und `daten.wahlen` (Merkmal, Meisterschaft, Fertigkeit),
 * geschrieben von der Datenseite (begleiter_werte.py) mit Belegsätzen. Abrichtungen ohne diese Felder ändern keine Werte
 * (Umstände für den Tierführer, Aktionen, Tricks); ihr Text steht auf dem Blatt.
 */
import type { Katalog } from './katalog';
import type { Begleiter } from '../types';
import { anwenden, ausStruktur, summe, werteblock, type Modifikationen, type ModifikationenStruktur, type Werteblock } from './modifikationen';
import type { Eintrag } from './typen';
import { wahlenAnwenden, type GolemWahl } from './golem';

export interface AbrichtungsWahl {
  art: 'option' | 'meisterschaft' | 'meisterschaften' | 'fertigkeit';
  text: string;
  /** option: wählbare Änderungen */
  optionen?: { text: string; modifikationen: string; modifikationen_strukturiert?: ModifikationenStruktur }[];
  /** meisterschaft: nur in dieser Fertigkeit; feste Schwelle oder höchste der genannten Meisterschaften des Tierführers */
  fertigkeit?: string; schwelle?: number; schwelle_nach?: string[];
  /** meisterschaften: zulässige Zusammenstellungen (z. B. zwei der Schwelle 1 oder eine der Schwelle 2) */
  varianten?: { anzahl: number; schwelle: number }[];
  /** fertigkeit: Wert ohne die Fertigkeit, Zuwachs mit ihr; welche Fertigkeiten; gleiche Gruppe = unterschiedliche Fertigkeiten */
  neu?: number; plus?: number; nur?: 'allgemein' | 'magieschule_vorhanden'; unterschiedlich?: string;
}

/** Eine Wahl einer gewählten Abrichtung: Schlüssel „<Stelle der Abrichtung>:<Nr. der Wahl>“ */
export interface OffeneWahl { schluessel: string; abrichtung: string; stelle: number; w: AbrichtungsWahl; schwelle: number | null }

export interface TierWerte {
  werte: Werteblock | null;
  /** wurde etwas eingerechnet? (sonst bleibt der Wertekasten des Pakets unverändert) */
  geaendert: boolean;
  wahlen: OffeneWahl[];
  hinweise: string[];
  /** Hinweise der Datenseite (z. B. zusätzlicher Zauber ohne Zauberliste des Tieres) */
  texte: string[];
}

/** höchste Schwelle aus `schwelle_nach`: Stelle+1 der höchsten Meisterschaft, die der Tierführer hat (0 = keine) */
function schwelleNach(liste: string[] | undefined, msIds: string[]): number {
  return (liste ?? []).reduce((s, id, i) => (msIds.includes(id) ? i + 1 : s), 0);
}

/** Zahlenwerte einer Abrichtung als Text (Anzeige) */
export const abrichtungWerteText = (k: Katalog, id: string): string | null => k.get(id)?.daten.modifikationen ?? null;
/** Fertigkeiten für Wahlen: allgemeine Fertigkeiten bzw. Magieschulen aus einer Liste */
export const istMagieschule = (k: Katalog, id: string | undefined) => !!id && k.get(id)?.daten.kategorie === 'Magieschule';
export function allgemeineFertigkeitenListe(k: Katalog): { id: string; name: string }[] {
  return Object.values(k.eintraege).filter(e => e.typ === 'fertigkeit' && e.daten.kategorie === 'Allgemeine Fertigkeit')
    .map(e => ({ id: e.id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Werteblock eines Tiers aus dem Katalog (auch „Werte wie … mit folgenden Änderungen“) */
export function tierGrundwerte(k: Katalog, e: Eintrag | undefined): Werteblock | null {
  const d = e ? e.daten.werte_berechnet ?? e.daten : null;
  return d?.abgeleitete_werte ? werteblock(k, d) : null;
}

export function tierWerte(k: Katalog, b: Begleiter, basis: Werteblock | null, msIds: string[]): TierWerte {
  const gewaehlt = (b.abrichtungen ?? []).map((id, stelle) => ({ id, stelle, e: k.get(id) })).filter(x => x.e && (x.e.daten.modifikationen || x.e.daten.wahlen));
  const leer: TierWerte = { werte: basis, geaendert: false, wahlen: [], hinweise: [], texte: [] };
  if (!basis || !gewaehlt.length) return leer;
  const fs = b.abrichtungWahlen ?? {};
  const mods: Modifikationen[] = []; const wahlen: OffeneWahl[] = []; const texte: string[] = []; const hinweise: string[] = [];
  for (const { stelle, e } of gewaehlt) {
    if (e!.daten.modifikationen_strukturiert) mods.push(ausStruktur(e!.daten.modifikationen_strukturiert));
    if (e!.daten.werte_hinweis) texte.push(`${e!.name}: ${e!.daten.werte_hinweis}`);
    ((e!.daten.wahlen ?? []) as AbrichtungsWahl[]).forEach((w, nr) => {
      const schwelle = w.schwelle ?? (w.schwelle_nach ? schwelleNach(w.schwelle_nach, msIds) : null);
      const schluessel = `${stelle}:${nr}`;
      wahlen.push({ schluessel, abrichtung: e!.name, stelle, w, schwelle });
      const v = fs[schluessel];
      if (w.art === 'option' && typeof v === 'string' && w.optionen?.[Number(v)]) mods.push(ausStruktur(w.optionen[Number(v)].modifikationen_strukturiert));
    });
  }
  const werte = anwenden(k, basis, summe(...mods));

  // Meisterschaft und Fertigkeit wie im Feinschliff der Baukästen; eigene Prüfungen (Fertigkeit, Schwelle, Auswahl)
  const golem: GolemWahl[] = []; const golemWerte: Record<string, string> = {};
  const msText: string[] = [];
  for (const o of wahlen) {
    const v = fs[o.schluessel];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
    const { w } = o;
    if (w.art === 'meisterschaft' && typeof v === 'string') {
      const m = k.get(v);
      if (!m) continue;
      if (w.fertigkeit && m.daten.fertigkeit !== w.fertigkeit) hinweise.push(`${o.abrichtung}: ${m.name} ist keine Meisterschaft in ${k.get(w.fertigkeit)?.name ?? w.fertigkeit}.`);
      if (o.schwelle !== null && (Number(m.daten.schwelle) || 1) > o.schwelle) hinweise.push(`${o.abrichtung}: ${m.name} hat Schwelle ${m.daten.schwelle}, erlaubt ist ${o.schwelle || 'keine (Meisterschaft des Abrichters fehlt)'}.`);
      msText.push(`${k.get(m.daten.fertigkeit)?.name ?? ''} (${m.name})`);
    } else if (w.art === 'meisterschaften' && Array.isArray(v)) {
      const ms = v.map(id => k.get(id)).filter(Boolean);
      const passt = (w.varianten ?? []).some(x => ms.length === x.anzahl && ms.every(m => (Number(m!.daten.schwelle) || 1) === x.schwelle));
      if (!passt) hinweise.push(`${o.abrichtung}: ${(w.varianten ?? []).map(x => `${x.anzahl === 1 ? 'eine' : x.anzahl} der Schwelle ${x.schwelle}`).join(' oder ')} wählen.`);
      msText.push(...ms.map(m => `${k.get(m!.daten.fertigkeit)?.name ?? ''} (${m!.name})`));
    } else if (w.art === 'fertigkeit' && typeof v === 'string') {
      const f = k.get(v);
      if (!f) continue;
      if (w.nur === 'allgemein' && f.daten.kategorie !== 'Allgemeine Fertigkeit') hinweise.push(`${o.abrichtung}: ${f.name} ist keine allgemeine Fertigkeit.`);
      if (w.nur === 'magieschule_vorhanden' && (f.daten.kategorie !== 'Magieschule' || !basis.fertigkeiten.some(x => x.id === v))) hinweise.push(`${o.abrichtung}: Das Tier beherrscht die Magieschule ${f.name} nicht.`);
      if (w.unterschiedlich && wahlen.some(p => p !== o && p.stelle === o.stelle && p.w.unterschiedlich === w.unterschiedlich && fs[p.schluessel] === v))
        hinweise.push(`${o.abrichtung}: ${f.name} mehrfach gewählt – die Fertigkeiten müssen unterschiedlich sein.`);
      golem.push({ schluessel: o.schluessel, quelle: o.abrichtung, text: w.text, art: 'fertigkeit', neu: w.neu ?? 0, plus: w.plus ?? 0 });
      golemWerte[o.schluessel] = v;
    }
  }
  wahlenAnwenden(k, werte, golem, msText, golemWerte, t => hinweise.push(t), 'das Tier');
  return { werte, geaendert: true, wahlen, hinweise: [...new Set(hinweise)], texte };
}
