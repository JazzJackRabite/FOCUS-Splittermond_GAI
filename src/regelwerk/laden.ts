/// <reference types="vite/client" />
/**
 * Laden der Regelpakete im Browser.
 * - Basis (Grundregelwerk) liegt im Editor: public/regelpakete/manifest.json und grw.srp.json.
 * - Grimoires lädt die Nutzerin oder der Nutzer als Datei hoch (Regelpakete/editor/buecher/<id>.grim);
 *   sie bleiben im Browser (siehe paketSpeicher.ts) und werden nie an einen Server geschickt.
 */
import { Katalog } from './katalog';
import type { LadePaket, Manifest, PaketInfo, RegelPaket } from './typen';

export const BASIS_ORDNER = 'regelpakete/';

async function sha256Hex(daten: ArrayBuffer): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const h = await globalThis.crypto.subtle.digest('SHA-256', daten);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export interface Basis { manifest: Manifest; basis: LadePaket; warnungen: string[]; /** geladene Texte, zum Speichern für den Start ohne Netz */ roh?: { manifest: string; paket: string } }

/**
 * Lädt Manifest und Grundregelwerk aus dem public-Ordner des Editors.
 * Immer beim Server nachfragen (cache: 'no-cache'): Das Hosting schickt für alle Dateien „max-age=1 Jahr, immutable“,
 * sonst bliebe der Browser bei einer alten Fassung des Grundregelwerks. Unverändert antwortet der Server kurz mit 304.
 */
const FRISCH: RequestInit = { cache: 'no-cache' };

export async function ladeBasis(basisUrl: string = (import.meta.env?.BASE_URL ?? '/') + BASIS_ORDNER, abruf: typeof fetch = fetch): Promise<Basis> {
  const warnungen: string[] = [];
  const mRes = await abruf(basisUrl + 'manifest.json', FRISCH);
  if (!mRes.ok) throw new Error(`Regelpakete: manifest.json nicht ladbar (${mRes.status})`);
  const manifestText = await mRes.text();
  const manifest = JSON.parse(manifestText) as Manifest;
  const info = manifest.pakete.find(p => p.id === manifest.basis_paket);
  if (!info?.datei) throw new Error('Regelpakete: Basispaket fehlt im Manifest');
  const pRes = await abruf(basisUrl + info.datei, FRISCH);
  if (!pRes.ok) throw new Error(`Regelpakete: ${info.datei} nicht ladbar (${pRes.status})`);
  const roh = await pRes.arrayBuffer();
  const sha = await sha256Hex(roh);
  if (sha && info.sha256 && sha !== info.sha256) warnungen.push(`${info.datei}: Prüfsumme stimmt nicht mit dem Manifest überein`);
  const paketText = new TextDecoder('utf-8').decode(roh);
  const paket = JSON.parse(paketText) as RegelPaket;
  return { manifest, basis: { info, paket, erwarteteEintraege: info.eintraege }, warnungen, roh: { manifest: manifestText, paket: paketText } };
}

/** Grundregelwerk aus gespeicherten Texten (Start ohne Netz); Prüfsumme gegen das gespeicherte Manifest */
export async function basisAusTexten(manifestText: string, paketText: string): Promise<Basis> {
  const manifest = JSON.parse(manifestText) as Manifest;
  const info = manifest.pakete.find(p => p.id === manifest.basis_paket);
  if (!info?.datei) throw new Error('Regelpakete: Basispaket fehlt im gespeicherten Manifest');
  const roh = new TextEncoder().encode(paketText);
  const sha = await sha256Hex(roh.buffer as ArrayBuffer);
  if (sha && info.sha256 && sha !== info.sha256) throw new Error('Gespeichertes Grundregelwerk ist beschädigt (Prüfsumme)');
  const paket = JSON.parse(paketText) as RegelPaket;
  return { manifest, basis: { info, paket, erwarteteEintraege: info.eintraege }, warnungen: [] };
}

/** Liest ein hochgeladenes Grimoire und prüft, ob es zum Editor passt. Wirft einen Fehler mit verständlicher Meldung. */
export function grimoireLesen(text: string, manifest: Manifest): LadePaket {
  let paket: RegelPaket;
  try {
    paket = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  if (paket?.format !== 'splittermond-regelpaket' || !Array.isArray(paket.eintraege) || !paket.paket?.id) {
    throw new Error('Die Datei ist kein Splittermond-Regelpaket (Format „splittermond-regelpaket“).');
  }
  const id = paket.paket.id;
  if (id === manifest.basis_paket) throw new Error('Das Grundregelwerk ist bereits im Editor enthalten.');
  const bekannt = manifest.bekannte_pakete?.find(p => p.id === id);
  const li = paket.ladeinfo;
  if (!li && !bekannt) throw new Error(`Unbekanntes Grimoire „${id}“ ohne Ladeangaben. Bitte das Grimoire (.grim) aus dem Export der Datenseite verwenden.`);
  const info: PaketInfo = {
    id,
    titel: paket.paket.titel,
    kuerzel: paket.paket.kuerzel,
    erscheinungsjahr: paket.paket.erscheinungsjahr,
    ladereihenfolge: li?.ladereihenfolge ?? bekannt!.ladereihenfolge,
    abhaengigkeiten: li?.abhaengigkeiten ?? bekannt!.abhaengigkeiten,
    optionale_pakete: li?.optionale_pakete ?? bekannt?.optionale_pakete ?? [],
    eintraege: paket.eintraege.length,
  };
  return { info, paket, regelgruppen: li?.regelgruppen ?? {}, umbenannt: li?.umbenannt ?? {}, erwarteteEintraege: li?.original.eintraege ?? paket.statistik?.eintraege };
}

/** Baut den Katalog aus Basis und hochgeladenen Grimoires. Grimoires mit fehlenden Pflicht-Abhängigkeiten werden ausgelassen. */
export function erstelleKatalog(basis: Basis, grimoires: LadePaket[]): { katalog: Katalog; ausgelassen: { id: string; grund: string }[] } {
  const da = new Set([basis.basis.info.id, ...grimoires.map(b => b.info.id)]);
  const ausgelassen: { id: string; grund: string }[] = [];
  const nutzbar = grimoires.filter(b => {
    const fehlt = b.info.abhaengigkeiten.filter(a => !da.has(a));
    if (fehlt.length) ausgelassen.push({ id: b.info.id, grund: `benötigt ${fehlt.join(', ')}` });
    return !fehlt.length;
  });
  return { katalog: new Katalog(basis.manifest, [basis.basis, ...nutzbar]), ausgelassen };
}
