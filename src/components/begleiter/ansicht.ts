/**
 * Einheitliche Sicht auf einen Begleiter für das Blatt (Spielen) und die Übersicht des Assistenten:
 * Wertekasten, würfelbare Fertigkeiten, Zauber, Kurzangaben, Hinweise und die Angaben, die nur diese Art hat.
 * Rechnet mit denselben Regelwerk-Funktionen wie bisher die Abschnitte (Tiere, Gefolge, Wesen, Untote, Golems).
 */
import { Bot, Feather, PawPrint, Skull, Sparkles, Users, type LucideIcon } from 'lucide-react';
import {
  abrichtungen as alleAbrichtungen, istReittier, kreaturStufe, potenzial, potenzialVerbraucht, wertekasten, wesenStufe, type Wertekasten,
} from '../../regelwerk/begleiter';
import { baukastenArt, wesenBaukastenWerte } from '../../regelwerk/wesenBaukasten';
import { alsWertekasten } from '../../regelwerk/modifikationen';
import { gefolgeWerte } from '../../regelwerk/gefolge';
import { untotWerte } from '../../regelwerk/untote';
import { golemWerte, immerInstruktionen, bausteinInfo } from '../../regelwerk/golem';
import { zauberAlsSpell } from '../../regelwerk/bruecke';
import type { Katalog } from '../../regelwerk/katalog';
import type { Begleiter, Spell } from '../../types';
import { fertigkeitenAusText } from './Wertekasten';
import { tierGrundwerte, tierWerte } from '../../regelwerk/abrichtungsWerte';
import { alleVertrautenMeisterschaften, alleVertrautenZauber, kurzText, vertrautenMeisterschaften, vertrautenZauber } from '../../regelwerk/vertraute';
import type { Besitzer } from './besitzer';

export type BegleiterArt = Begleiter['art'];

/** Art eines Begleiters: Name, Symbol, kurze Beschreibung für die Auswahl im Assistenten */
export const ARTEN: { art: BegleiterArt; name: string; symbol: LucideIcon; text: string }[] = [
  { art: 'tier', name: 'Tier', symbol: PawPrint, text: 'Tiergefährte (Ressource Kreatur), Reittier, Vertrauter oder eine eigene Kreatur aus dem Baukasten.' },
  { art: 'gefolge', name: 'Gefolgsmann', symbol: Users, text: 'Humanoider Begleiter über die Ressource Gefolge: Leibdiener, Knappe, Leibwächter …' },
  { art: 'wesen', name: 'Beschworenes Wesen', symbol: Sparkles, text: 'Wesen aus der Beschwörung mit seinen Diensten oder ein eigenes Wesen aus dem Baukasten.' },
  { art: 'untoter', name: 'Erhobener Untoter', symbol: Skull, text: 'Untoter aus einem Erhebungszauber; Steigerung mit den Erfahrungspunkten der Verstärkung.' },
  { art: 'golem', name: 'Golem', symbol: Bot, text: 'Golem aus dem Baukasten: Korpus, Material, Fähigkeiten, Rollen und Feinschliff.' },
];
export const artInfo = (art: BegleiterArt) => ARTEN.find(a => a.art === art)!;
/** Vertrauter: ein Tier mit der Stärke Tiervertrauter (eigene Wahl im Assistenten) */
export const VERTRAUTER = { name: 'Vertrauter', symbol: Feather, text: 'Tier, das über die Stärke Tiervertrauter an den Zauberer gebunden ist; mit Vertrautenmagie und Abrichtungen für Vertraute.' };

export interface Kurzangabe { text: string; ton?: 'neutral' | 'erschoepft' | 'schaden'; titel?: string }
export interface Fertigkeit { name: string; wert: number | null }
export interface BlattZauber { name: string; info: string; spell: Spell | null; wert: number | null; ok: boolean }
/** Gruppe von Angaben, die nur diese Art hat (z. B. Abrichtungen, Instruktionen) */
export interface Angabe { titel: string; eintraege: { name: string; text?: string; zusatz?: string }[]; leer?: string }

export interface Ansicht {
  titel: string;
  w: Wertekasten | null;
  fertigkeiten: Fertigkeit[];
  zauber: BlattZauber[];
  kurz: Kurzangabe[];
  angaben: Angabe[];
  /** freier Text unter den Angaben (Regelhinweise der Art) */
  text: string[];
  hinweise: string[];
  /** Eintrag fehlt im Katalog (Grimoire nicht geladen) */
  fehlt: boolean;
}

const plural = (n: number, ein: string, mehr: string) => `${n} ${n === 1 ? ein : mehr}`;

export function begleiterTitel(b: Begleiter): string {
  if (b.art === 'gefolge') return b.rufname ? `${b.rufname} (${b.aufgabe || b.name})` : b.aufgabe ? `${b.aufgabe} (${b.name})` : `Gefolgsmann (${b.name})`;
  if (b.art === 'golem') return b.rufname ? `${b.rufname} (Golem, ${b.name})` : `Golem (${b.name})`;
  return b.rufname ? `${b.rufname} (${b.name})` : b.name;
}

/** Fertigkeiten aus dem Wertekasten („Akrobatik 8, Athletik 10“) */
const ausText = (w: Wertekasten | null): Fertigkeit[] => (w?.felder?.fertigkeiten ? fertigkeitenAusText(w.felder.fertigkeiten).map(f => ({ name: f.name, wert: f.wert })) : []);

/** Kreatur-Stufe, die ein Tier über die Ressource Kreatur braucht, wenn die gewählte Ressource nicht reicht (GRW S. 78); sonst null */
export function kreaturFehlt(k: Katalog, b: Begleiter): number | null {
  if (b.art !== 'tier' || !b.kreatur) return null;
  const e = k.get(b.id);
  const st = e && baukastenArt(e) ? wesenBaukastenWerte(k, b).stufe : e ? kreaturStufe(e) : null;
  return st !== null && st > b.kreatur ? st : null;
}

export function begleiterAnsicht(k: Katalog, b: Begleiter, besitzer: Besitzer): Ansicht {
  const e = k.get(b.id);
  const titel = begleiterTitel(b);
  const leer: Ansicht = { titel, w: null, fertigkeiten: [], zauber: [], kurz: [], angaben: [], text: [], hinweise: [], fehlt: !e };

  if (b.art === 'tier' || b.art === 'wesen') {
    const bk = e && baukastenArt(e) ? wesenBaukastenWerte(k, b) : null;
    // Tier: Abrichtungen mit Zahlen einrechnen (Bestienmeister); sonst der Wertekasten des Pakets
    const tw = b.art === 'tier' ? tierWerte(k, b, bk ? bk.werte : tierGrundwerte(k, e), besitzer.msIds) : null;
    const w = tw?.geaendert && tw.werte ? alsWertekasten(tw.werte) : bk?.werte ? alsWertekasten(bk.werte) : e ? wertekasten(e) : null;
    const a: Ansicht = { ...leer, w, fertigkeiten: ausText(w), hinweise: [...(bk?.hinweise ?? []).map(h => h.text), ...(tw?.hinweise ?? [])] };
    if (b.art === 'tier') {
      const st = bk ? bk.stufe : e ? kreaturStufe(e) : null;
      if (istReittier(k, b)) a.kurz.push({ text: 'Reittier' });
      if (b.vertrauter) a.kurz.push({ text: 'Vertrauter' });
      a.kurz.push({ text: b.kreatur ? `Kreatur ${b.kreatur}` : 'ohne Ressource' });
      if (bk) a.kurz.push({ text: `Baukasten, Kreatur ${bk.stufe}` });
      if (b.kreatur && st !== null && st > b.kreatur) a.hinweise.push(`Das Tier braucht Kreatur ${st}.`);
      if (b.vertrauter) {
        const ms = vertrautenMeisterschaften(k, besitzer.msIds); const zs = vertrautenZauber(k, besitzer.zauber);
        const alle = alleVertrautenMeisterschaften(k).length + alleVertrautenZauber(k).length;
        a.angaben.push({
          titel: 'Vertrautenmagie', leer: alle ? `Noch nichts gelernt (${alle} Meisterschaften und Zauber für Vertraute in den Paketen).` : 'Keine Vertrautenmagie in den Paketen.',
          eintraege: [...ms.map(e2 => ({ name: e2.name, text: kurzText(e2), zusatz: 'Meisterschaft' })), ...zs.map(e2 => ({ name: e2.name, text: kurzText(e2), zusatz: 'Zauber' }))],
        });
        if (!besitzer.tiervertrauter) a.hinweise.push('Vertrauter ohne die Stärke Tiervertrauter.');
      }
      const liste = alleAbrichtungen(k);
      if (liste.length) {
        const gewaehlt = b.abrichtungen ?? [];
        const pot = potenzial(k, b, besitzer.msIds); const verbraucht = potenzialVerbraucht(liste, gewaehlt);
        a.kurz.push({ text: `Potenzial ${verbraucht}/${pot.gesamt}`, ton: verbraucht > pot.gesamt ? 'schaden' : 'neutral' });
        if (verbraucht > pot.gesamt) a.hinweise.push('Mehr Abrichtungen, als das Potenzial erlaubt.');
        const info = new Map(liste.map(x => [x.id, x]));
        a.angaben.push({
          titel: 'Abrichtungen', leer: 'Keine Abrichtungen.',
          eintraege: gewaehlt.map(id => ({ name: info.get(id)?.name ?? k.get(id)?.name ?? id, text: info.get(id)?.beschreibung })),
        });
        if (tw?.geaendert) a.text.push('Boni der Abrichtungen sind in Werten, Angriffen und Fertigkeiten eingerechnet.');
        a.text.push(...(tw?.texte ?? []));
      }
    } else {
      a.kurz.push({ text: `Stufe ${bk ? bk.stufe : wesenStufe(e) ?? '?'}` });
      if (bk) a.kurz.push({ text: 'Baukasten' });
      if (bk && (b.dienste?.length || b.basisdienst)) {
        a.angaben.push({
          titel: 'Dienste',
          eintraege: [...(b.basisdienst ? [{ name: k.get(b.basisdienst)?.name ?? b.basisdienst, zusatz: 'Basisdienst' }] : []),
            ...(b.dienste ?? []).map(id => ({ name: k.get(id)?.name ?? id }))],
        });
      }
    }
    return a;
  }

  if (b.art === 'gefolge') {
    const g = gefolgeWerte(k, b, besitzer.maxFertigkeit);
    return {
      ...leer, w: g.werte,
      fertigkeiten: g.fertigkeiten.filter(f => f.wert !== null).map(f => ({ name: f.name, wert: f.wert })),
      zauber: g.zauber.map(z => {
        const sw = g.fertigkeiten.find(f => f.id === z.schuleId)?.wert ?? null;
        return { name: z.name, info: [z.schule, z.grad !== undefined ? `Grad ${z.grad}` : null].filter(Boolean).join(' '), spell: zauberAlsSpell(k, z.id, z.schuleId), wert: sw, ok: z.ok };
      }),
      kurz: [...(b.rasse ? [{ text: k.get(b.rasse)?.name ?? b.rasse }] : []), { text: plural(g.punkte, 'Gefolge-Punkt', 'Gefolge-Punkte') }],
      angaben: [
        { titel: 'Stärken', leer: 'Keine.', eintraege: g.staerken.map(i => ({ name: k.get(i)?.name ?? i })) },
        { titel: 'Meisterschaften', leer: 'Keine.', eintraege: [
          ...(g.kulturMeisterschaft ? [{ name: g.kulturMeisterschaft.text, zusatz: 'Kultur' }] : []),
          ...g.meisterschaften.map(m => ({ name: m.name, zusatz: [m.fertigkeit, `Schwelle ${m.schwelle}`, m.ok ? null : 'Voraussetzung fehlt'].filter(Boolean).join(', ') })),
        ] },
      ],
      hinweise: g.hinweise,
    };
  }

  if (b.art === 'untoter') {
    const u = untotWerte(k, b, besitzer);
    const w = u.werte ? alsWertekasten(u.werte) : null;
    return {
      ...leer, w, fehlt: false, fertigkeiten: ausText(w),
      kurz: [...(u.erhebung ? [{ text: u.erhebung.zauber.name }] : []), ...(u.abnormitaet ? [{ text: u.abnormitaet.name }] : []),
        { text: `EP ${u.epVerbraucht}/${u.epGesamt}`, ton: u.epVerbraucht > u.epGesamt ? 'schaden' as const : 'neutral' as const }],
      angaben: [
        ...(u.abnormitaet ? [{ titel: 'Abnormität', eintraege: [{ name: u.abnormitaet.name, text: u.abnormitaetText }] }] : []),
        ...(u.meisterschaften.length ? [{ titel: 'Freie Meisterschaften', eintraege: u.meisterschaften.map(m => ({ name: m.name, zusatz: `${m.fertigkeit}, Schwelle ${m.schwelle}` })) }] : []),
      ],
      hinweise: u.hinweise,
    };
  }

  // Golem
  const g = golemWerte(k, b);
  const w = g.werte ? alsWertekasten(g.werte) : null;
  const hinweise = [...g.hinweise];
  if (b.golemRessource && !besitzer.golemPunkte.some(p => p >= g.stufe)) hinweise.push(`Ressource Golem ${g.stufe} nötig`);
  const gruppe = (art: string, titel: string, vorne: string[] = []): Angabe => ({
    titel, leer: 'Keine.',
    eintraege: [...vorne.map(n => ({ name: n, zusatz: 'immer' })),
      ...(b.bausteine ?? []).map(id => k.get(id)).filter(x => x && bausteinInfo(x).art === art).map(x => ({ name: x!.name, text: bausteinInfo(x!).beschreibung }))],
  });
  return {
    ...leer, w, fehlt: !g.korpus, fertigkeiten: ausText(w),
    kurz: [{ text: `Golem ${g.stufe}` }, ...(b.material ? [{ text: k.get(b.material)?.name ?? b.material }] : []),
      { text: b.golemRessource ? 'Ressource Golem' : `${g.preis} L` }],
    angaben: [
      gruppe('Instruktion', 'Instruktionen', immerInstruktionen(k)), gruppe('Verfügung', 'Verfügungen'),
      gruppe('Rolle', 'Rollen'), gruppe('Zusätzliche Fähigkeit', 'Zusätzliche Fähigkeiten'),
      gruppe('Applikation', 'Applikationen'), gruppe('Schwachpunkt', 'Schwachpunkte'),
      ...((b.sonderausstattung ?? []).filter(Boolean).length ? [{ titel: 'Sonderausstattung', eintraege: (b.sonderausstattung ?? []).filter(Boolean).map(s => ({ name: s })) }] : []),
    ],
    text: [
      g.animierung ? `Animierungszauber: ${g.animierung.name}${besitzer.zauber.includes(g.animierung.name) ? ' (bekannt)' : ''}.` : 'Kein Animierungszauber für diese Stufe.',
      ...(g.materialSchwachpunkt ? [`Schwachpunkt des Materials: ${g.materialSchwachpunkt}.`] : []),
      ...g.feinschliff.map(t => `Für die Spielleitung: ${t}`),
    ],
    hinweise,
  };
}

