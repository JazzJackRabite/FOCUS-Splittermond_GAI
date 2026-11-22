/**
 * Ausrüstung aus Grimoires: Bücher bringen Waffen, Rüstungen, Gegenstände usw. in die Auswahllisten,
 * Ersetzungen und Ergänzungen von GRW-Ausrüstung erscheinen in der eingebauten Liste.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { grimoireLesen, erstelleKatalog } from '../laden';
import { AUSRUESTUNGS_TYPEN, alleAusruestung, findeAusruestung, grwAusruestung, grimoireAusruestung } from '../ausruestung';
import { basisAusDateien, GRIMOIRE_ORDNER, istGrimoireDatei } from './hilfen';
import { buchfaelle } from './hilfen';
import type { LadePaket, RegelPaket } from '../typen';

const basis = basisAusDateien();
const K0 = new Katalog(basis.manifest, [basis.basis]);
const grw = (id: string) => K0.get(id)!;

/** Kleines Testbuch mit eigener Ladeinfo */
function testbuch(): LadePaket {
  const waffenlos = grw('grw:waffe:waffenlos:nahkampf');
  const q = (s: number) => ({ paket: 'testbuch', buch_seiten: [s] });
  const paket = {
    format: 'splittermond-regelpaket', format_version: '1.0', erzeugt: '2026-11-06',
    paket: { id: 'testbuch', titel: 'Testbuch', kuerzel: 'TB' }, abhaengigkeiten: ['grw'], statistik: { eintraege: 6 },
    eintraege: [
      { id: 'testbuch:waffe:testklinge:nahkampf', typ: 'waffe', aktion: 'neu', name: 'Testklinge', quelle: q(10),
        daten: { schaden: '1W6+3', wgs: 7, modus: 'Nahkampf', fertigkeit: 'grw:fertigkeit:klingenwaffen', fertigkeit_name: 'Klingenwaffen',
          attribute: ['BEW', 'STÄ'], mindestattribute_text: 'STÄ 2', merkmale_text: 'Scharf 2', preis: { text: '12 L', telare: 1200 }, last: 2, haerte: 6,
          beschreibung: 'Eine Klinge für Tests.' } },
      { id: 'testbuch:ruestung:testpanzer', typ: 'ruestung', aktion: 'neu', name: 'Testpanzer', quelle: q(11),
        daten: { vtd_bonus: 2, sr: 3, behinderung: 2, tick_zuschlag: 2, mindest_staerke: 3, merkmale_text: '–', preis: { text: '30 L' }, last: 5 } },
      { id: 'testbuch:gegenstand:testseil', typ: 'gegenstand', aktion: 'neu', name: 'Testseil', quelle: q(12),
        daten: { gruppe: 'Reiseausrüstung', fertigkeit: 'Athletik', schwerpunkt: 'Klettern', preis: { text: '2 L' }, last: 1, haerte: 2 } },
      { id: 'testbuch:kraut:testkraut', typ: 'kraut', aktion: 'neu', name: 'Testkraut', quelle: q(13),
        daten: { preis: { text: '1 L' }, besonderheiten: 'Duftet nach Test.' } },
      { id: 'testbuch:waffe:waffenlos:nahkampf', typ: 'waffe', aktion: 'ersetzt', name: 'Waffenlos', ziel: waffenlos.id, quelle: q(20),
        aenderungen: { merkmale_text: { alt: waffenlos.daten.merkmale_text, neu: 'Stumpf, Testmerkmal' } }, daten: {} },
      { id: 'testbuch:waffe:dolch:nahkampf', typ: 'waffe', aktion: 'ergaenzt', name: 'Dolch', ziel: 'grw:waffe:dolch:nahkampf', quelle: q(21),
        daten: { beschreibung: 'Der Dolch ist die häufigste Waffe.' } },
    ],
    ladeinfo: { format: 'splittermond-editor-ladeinfo', format_version: '1.0', ladereihenfolge: 50, abhaengigkeiten: ['grw'], optionale_pakete: [],
      regelgruppen: {}, umbenannt: {}, begleiter: {}, original: { datei: 'testbuch.grim', sha256: '', bytes: 0, eintraege: 6 } },
  } as unknown as RegelPaket;
  return grimoireLesen(JSON.stringify(paket), basis.manifest);
}

describe('Ausrüstung aus Grimoires', () => {
  it('ohne Bücher: GRW-Ausrüstung aus dem Paket; ohne Paket keine', () => {
    expect(alleAusruestung(null)).toEqual([]);
    const grw = grwAusruestung(K0);
    expect(alleAusruestung(K0)).toEqual(grw);
    expect(grimoireAusruestung(K0)).toEqual([]);
    expect(grw.every(i => i.id?.startsWith('grw:'))).toBe(true);
    expect(grw.length).toBeGreaterThan(140);
  });

  const { katalog: K } = erstelleKatalog(basis, [testbuch()]);
  const liste = alleAusruestung(K);
  const finde = (name: string) => liste.filter(i => i.name === name);

  it('Waffen, Rüstungen, Gegenstände und Kräuter des Buchs mit Werten, Quelle und Seite', () => {
    expect(liste.length).toBe(grwAusruestung(K0).length + 4);
    expect(finde('Testklinge')).toEqual([expect.objectContaining({ type: 'weapon', category: 'Nahkampf', skill: 'Klingenwaffen', damage: '1W6+3', wgs: 7,
      price: '12 L', load: 2, attributes: 'Scharf 2', source: 'TB', page: 10 })]);
    expect(finde('Testklinge')[0].desc).toContain('Mindestattribute: STÄ 2');
    expect(finde('Testklinge')[0].desc).toContain('Eine Klinge für Tests.');
    expect(finde('Testpanzer')).toEqual([expect.objectContaining({ type: 'armor', vtdBonus: 2, sr: 3, handicap: 2, tickModifier: 2, minStrength: 3, source: 'TB' })]);
    expect(finde('Testseil')).toEqual([expect.objectContaining({ type: 'gear', category: 'Reiseausrüstung', load: 1, hardness: 2 })]);
    expect(finde('Testkraut')).toEqual([expect.objectContaining({ type: 'alchemika', category: 'Kräuter' })]);
    expect(finde('Testkraut')[0].desc).toContain('Duftet nach Test.');
  });

  it('Ersetzung ändert den GRW-Eintrag, Ergänzung hängt die Beschreibung an', () => {
    const w = finde('Waffenlos');
    expect(w.length).toBe(1);
    expect(w[0]).toEqual(expect.objectContaining({ source: 'GRW', attributes: 'Stumpf, Testmerkmal' }));
    expect(w[0].desc).toContain('Geändert durch TB S. 20: Merkmale Stumpf, Testmerkmal.');
    expect(w[0].desc).toContain('| Merkmale: Stumpf, Testmerkmal');
    const dolch = finde('Dolch').find(i => i.type === 'weapon')!;
    expect(dolch.desc).toContain('TB S. 21: Der Dolch ist die häufigste Waffe.');
  });

  it('jeder Ausrüstungstyp hat eine Zuordnung', () => {
    for (const t of Object.values(AUSRUESTUNGS_TYPEN)) expect(['weapon', 'armor', 'shield', 'gear', 'alchemika']).toContain(t.art);
  });
});

const ORDNER = GRIMOIRE_ORDNER || undefined;
describe.skipIf(!ORDNER || !fs.existsSync(ORDNER))('Ausrüstung aller Bücher (lokal)', () => {
  it('jeder geladene Ausrüstungs-Eintrag der Bücher steht genau einmal in der Liste', () => {
    const grimoires = fs.readdirSync(ORDNER!).filter(istGrimoireDatei).map(f => grimoireLesen(fs.readFileSync(path.join(ORDNER!, f), 'utf-8'), basis.manifest));
    const { katalog: K } = erstelleKatalog(basis, grimoires);
    const soll = Object.values(K.eintraege).filter(e => e.quelle.paket !== 'grw' && e.aktion === 'neu' && e.typ in AUSRUESTUNGS_TYPEN).map(e => e.id).sort();
    const liste = alleAusruestung(K);
    const ids = liste.map(i => i.id).filter((i): i is string => !!i && !i.startsWith('grw:')).sort();
    expect(ids).toEqual(soll);
    for (const i of liste) { expect(i.name).toBeTruthy(); expect(typeof i.desc).toBe('string'); }
    // Sollwerte zu einzelnen Büchern: lokale Falldatei (hilfen.ts: buchfaelle)
    const F = buchfaelle<{ mindestEintraege: number; geaendert: { gegenstand: string; merkmal: string; text: string }; beschreibungen: { muster: string; mindestens: number } }>('ausruestung');
    if (!F) return;
    expect(soll.length).toBeGreaterThan(F.mindestEintraege);
    const g = liste.find(i => i.name === F.geaendert.gegenstand) as { attributes: string; desc?: string };
    expect(g.attributes).toContain(F.geaendert.merkmal);
    expect(g.desc).toContain(F.geaendert.text);
    expect(liste.filter(i => i.source === 'GRW' && new RegExp(F.beschreibungen.muster).test(i.desc ?? '')).length).toBeGreaterThan(F.beschreibungen.mindestens);
  });
});
