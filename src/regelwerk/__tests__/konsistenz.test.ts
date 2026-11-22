/**
 * Kennzahlen passen zu den Dateien: Prüfsumme, Bytezahl und Eintragszahl im Manifest des Editors,
 * Statistik der Pakete und Ladeangaben der Grimoires (lokal mit FOKUS_GRIMOIRES).
 * Eingeführt am 12.11.2026, nachdem ein Handpatch auf der Datenseite diese Angaben nicht nachgezogen hatte;
 * der Editor meldete daraufhin beim Hochladen „Anzahl ≠ manifest“.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GRIMOIRE_ORDNER, PUBLIC, istGrimoireDatei } from './hilfen';

interface Datei { eintraege: { id: string; typ: string; aktion?: string }[]; statistik?: { eintraege?: number; nach_typ?: Record<string, number>; nach_aktion?: Record<string, number> } }

function zaehlen(d: Datei) {
  const nach_typ: Record<string, number> = {}; const nach_aktion: Record<string, number> = {};
  for (const e of d.eintraege) { nach_typ[e.typ] = (nach_typ[e.typ] ?? 0) + 1; const a = e.aktion ?? 'neu'; nach_aktion[a] = (nach_aktion[a] ?? 0) + 1; }
  return { nach_typ, nach_aktion };
}

function statistikPasst(name: string, d: Datei) {
  const z = zaehlen(d);
  expect(d.statistik?.eintraege, `${name}: statistik.eintraege`).toBe(d.eintraege.length);
  if (d.statistik?.nach_typ) expect(d.statistik.nach_typ, `${name}: statistik.nach_typ`).toEqual(z.nach_typ);
  if (d.statistik?.nach_aktion) expect(d.statistik.nach_aktion, `${name}: statistik.nach_aktion`).toEqual(z.nach_aktion);
  expect(new Set(d.eintraege.map((e) => e.id)).size, `${name}: doppelte IDs`).toBe(d.eintraege.length);
}

describe('Kennzahlen der Regelpakete passen zu den Dateien', () => {
  it('Manifest des Editors: Prüfsumme, Bytezahl und Eintragszahl des Grundregelwerk-Pakets', () => {
    const man = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf-8'));
    const mitDatei = man.pakete.filter((p: { datei?: string }) => p.datei);
    expect(mitDatei.length).toBeGreaterThan(0);
    for (const p of mitDatei) {
      const roh = fs.readFileSync(path.join(PUBLIC, p.datei));
      const d = JSON.parse(roh.toString('utf-8')) as Datei;
      expect(crypto.createHash('sha256').update(roh).digest('hex'), `${p.datei}: sha256`).toBe(p.sha256);
      if (p.bytes !== undefined) expect(roh.length, `${p.datei}: bytes`).toBe(p.bytes);
      expect(d.eintraege.length, `${p.datei}: eintraege`).toBe(p.eintraege);
      statistikPasst(p.datei, d);
    }
  });

  const grimoires = GRIMOIRE_ORDNER && fs.existsSync(GRIMOIRE_ORDNER) ? fs.readdirSync(GRIMOIRE_ORDNER).filter(istGrimoireDatei).sort() : [];
  it.skipIf(!grimoires.length)('Grimoires: Eintragszahl in ladeinfo und Statistik stimmt mit den Einträgen überein', () => {
    for (const f of grimoires) {
      const g = JSON.parse(fs.readFileSync(path.join(GRIMOIRE_ORDNER, f), 'utf-8')) as Datei & { ladeinfo?: { original?: { eintraege?: number } } };
      expect(g.ladeinfo?.original?.eintraege, `${f}: ladeinfo.original.eintraege`).toBe(g.eintraege.length);
      statistikPasst(f, g);
    }
  });
});
