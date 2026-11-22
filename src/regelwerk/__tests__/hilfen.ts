import { fireEvent, screen, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import type { Basis } from '../laden';
import type { LadePaket, Manifest, RegelPaket } from '../typen';
import type { BedingungsCharakter } from '../bedingungen';

export const PUBLIC = path.resolve(__dirname, '../../../public/regelpakete');

export function basisAusDateien(ordner = PUBLIC): Basis {
  const manifest = JSON.parse(fs.readFileSync(path.join(ordner, 'manifest.json'), 'utf-8')) as Manifest;
  const info = manifest.pakete.find(p => p.id === manifest.basis_paket)!;
  const paket = JSON.parse(fs.readFileSync(path.join(ordner, info.datei!), 'utf-8')) as RegelPaket;
  return { manifest, basis: { info, paket, erwarteteEintraege: info.eintraege } as LadePaket, warnungen: [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function charAusJson(c: any): BedingungsCharakter {
  const out: BedingungsCharakter = { hat: new Set(c.hat), werte: c.werte, schwerpunkte: c.schwerpunkte, zauber: c.zauber };
  for (const k of ['tier', 'wesen'] as const) if (c[k]) out[k] = { ...c[k], hat: new Set(c[k].hat ?? []) };
  for (const k of ['typus', 'gk', 'stufe', 'gottheit', 'gewaehlte_magieschule', 'auswahl_geprueft']) if (k in c) (out as unknown as Record<string, unknown>)[k] = c[k];
  return out;
}

/**
 * Ordner mit den Grimoires für lokale Volltests (FOKUS_GRIMOIRES).
 * Leer: die Tests mit Grimoires werden übersprungen.
 */
export const GRIMOIRE_ORDNER = process.env.FOKUS_GRIMOIRES ?? '';

/**
 * Buchspezifische Testfälle (IDs, Namen und Sollwerte aus den Grimoires) aus der lokalen Datei FOKUS_BUCHFAELLE.
 * Sie liegt neben der Volltest-Referenz auf dem Rechner des Projektinhabers und kommt nie ins Repository
 * (FUNDAMENT, Grundsatz 3). Ohne Datei oder ohne die genannten Grimoires: null, die Tests werden übersprungen.
 */
export const BUCHFAELLE = process.env.FOKUS_BUCHFAELLE ?? '';
let buchfaelleCache: Record<string, unknown> | null | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buchfaelle<T = any>(teil: string, grimoires: string[] = []): T | null {
  if (buchfaelleCache === undefined) buchfaelleCache = BUCHFAELLE && fs.existsSync(BUCHFAELLE) ? JSON.parse(fs.readFileSync(BUCHFAELLE, 'utf-8')) : null;
  const f = buchfaelleCache?.[teil];
  if (!f || grimoires.some(g => !fs.existsSync(grimoireDatei(g) || '/nicht-vorhanden'))) return null;
  return f as T;
}

/** Ist das eine Grimoire-Datei (`.grim`)? */
export const istGrimoireDatei = (f: string) => f.endsWith('.grim');

/** Pfad eines Grimoires im Ordner (`<id>.grim`); leer ohne Ordner */
export function grimoireDatei(id: string): string {
  return GRIMOIRE_ORDNER ? path.join(GRIMOIRE_ORDNER, `${id}.grim`) : '';
}

// ---------------------------------------------------------------- Assistent „Begleiter erstellen“ (Oberflächentests)

/** Öffnet den Assistenten und wählt die Art (Wahlkarte, Name am Anfang) */
export function begleiterErstellen(art: string): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: /^Begleiter erstellen$/ }));
  const d = screen.getByTestId('begleiter-assistent');
  fireEvent.click(within(d).getByRole('button', { name: new RegExp(`^${art}`) }));
  return d;
}
/** Nächster Schritt */
export const weiter = () => fireEvent.click(screen.getByRole('button', { name: /^Weiter/ }));
/** Bis zur Übersicht weiterklicken und erstellen bzw. übernehmen */
export function abschliessen() {
  while (screen.queryByRole('button', { name: /^Weiter/ })) weiter();
  fireEvent.click(screen.getByRole('button', { name: /^(Erstellen|Übernehmen)$/ }));
}
/** Blatt eines Begleiters über die Leiste wählen */
export function blattWaehlen(titel: string | RegExp): HTMLElement {
  fireEvent.click(screen.getByRole('tab', { name: titel }));
  return screen.getByTestId('begleiter-blatt');
}
