/**
 * Start ohne Netz: Die zuletzt geladene Fassung des Grundregelwerks wird aus dem Browser gelesen und gegen die
 * Prüfsumme im Manifest geprüft (regelwerk/laden.ts, basisAusTexten; RegelwerkContext nutzt sie, wenn public/ nicht erreichbar ist).
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { basisAusTexten, ladeBasis } from '../laden';
import { PUBLIC } from './hilfen';

const manifest = fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf-8');
const paket = fs.readFileSync(path.join(PUBLIC, 'grw.srp.json'), 'utf-8');

describe('Grundregelwerk ohne Netz', () => {
  it('liest die gespeicherte Fassung, Prüfsumme stimmt', async () => {
    const b = await basisAusTexten(manifest, paket);
    expect(b.basis.info.id).toBe('grw');
    expect(b.basis.paket.eintraege.length).toBeGreaterThan(1000);
  });

  it('lehnt eine veränderte Fassung ab', async () => {
    await expect(basisAusTexten(manifest, paket.replace('"grw"', '"grX"'))).rejects.toThrow(/Prüfsumme/);
  });

  it('ladeBasis liefert die Texte zum Speichern mit und nutzt den Basispfad', async () => {
    const abgerufen: string[] = [];
    const modi: (RequestCache | undefined)[] = [];
    const abruf = (async (url: string, init?: RequestInit) => {
      abgerufen.push(url);
      modi.push(init?.cache);
      const text = url.endsWith('manifest.json') ? manifest : paket;
      return new Response(text, { status: 200 });
    }) as unknown as typeof fetch;
    const b = await ladeBasis('/fokus/regelpakete/', abruf);
    expect(abgerufen).toEqual(['/fokus/regelpakete/manifest.json', '/fokus/regelpakete/grw.srp.json']);
    expect(b.roh?.paket.length).toBe(paket.length);
    expect(b.warnungen).toEqual([]);
    // das Hosting schickt „immutable“ für alle Dateien: ohne Nachfrage bliebe der Browser bei einer alten Fassung
    expect(modi).toEqual(['no-cache', 'no-cache']);
  });
});
