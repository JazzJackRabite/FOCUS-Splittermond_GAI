/**
 * Wesen-Baukasten: beschwörbare Wesen (Die Magie) und Kreaturen (Bestienmeister). Lokal mit FOKUS_GRIMOIRES und FOKUS_BUCHFAELLE.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import { CharacterContext } from '../../context/CharacterContext';
import { BegleiterView } from '../../features/begleiter/BegleiterView';
import { Katalog } from '../katalog';
import { abschliessen, basisAusDateien, begleiterErstellen, buchfaelle, grimoireDatei, weiter } from './hilfen';
import { erstelleKatalog, grimoireLesen } from '../laden';
import { setzeAktivenKatalog } from '../bruecke';
import { basen, baukastenArt, wesenBaukastenWerte } from '../wesenBaukasten';
import { beschwoerbareWesen } from '../begleiter';
import { validateCharacterImport } from '../../utils/importValidation';
import type { Begleiter, CharacterState } from '../../types';

const b = basisAusDateien();
const kat = { aktuell: new Katalog(b.manifest, [b.basis]) as Katalog };
vi.mock('../RegelwerkContext', () => ({ useRegelwerk: () => ({ katalog: kat.aktuell }) }));

describe('Wesen-Baukasten ohne Grimoires', () => {
  it('keine Basen, Import übernimmt Dienste', () => {
    expect(basen(kat.aktuell, 'beschwoerbar')).toEqual([]);
    const r = validateCharacterImport({ ...DEFAULT_STATE, begleiter: [{ id: 'x', art: 'wesen', name: 'W', bausteine: ['a'], dienste: ['d', 1], basisdienst: 'd' }] });
    expect(r.begleiter?.[0]).toMatchObject({ bausteine: ['a'], dienste: ['d'], basisdienst: 'd' });
  });
});

// Namen und Sollwerte zu den Grimoires: lokale Falldatei (hilfen.ts: buchfaelle)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F = buchfaelle<any>('wesenBaukasten', ['magie', 'bestien']);
const enthaelt = (t: string) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

describe.skipIf(!F)('Wesen-Baukasten mit Grimoires (lokal)', () => {
  let K: Katalog;
  const id = (paket: string, name: string, typ = 'wesen_baukasten_modul') => Object.values(K.eintraege).find(e => e.typ === typ && e.name === name && e.quelle.paket === paket)!.id;
  const WS = F?.wesen; const KR = F?.kreatur;
  beforeAll(() => {
    K = erstelleKatalog(b, F.grimoires.map((n: string) => grimoireLesen(fs.readFileSync(grimoireDatei(n), 'utf-8'), b.manifest))).katalog;
    kat.aktuell = K; setzeAktivenKatalog(K, false);
  });

  it('Basen beider Bücher; Korpusse sind keine fertigen beschwörbaren Wesen', () => {
    expect(basen(K, 'beschwoerbar').map(e => e.name)).toEqual(F.basen.beschwoerbar);
    expect(basen(K, 'kreatur').map(e => e.name)).toEqual(F.basen.kreatur);
    expect(beschwoerbareWesen(K).some(w => K.get(w.id)?.typ === 'wesen_baukasten_basis')).toBe(false);
  });

  it('beschwörbares Wesen: Stufe aus stufe_bonus, Werte aus Modifikationen, Dienste, Feinschliff nach Stufe', () => {
    const basis = id(WS.paket, WS.basis, 'wesen_baukasten_basis');
    const modul = id(WS.paket, WS.modul); const rolle = id(WS.paket, WS.rolle, 'wesen_baukasten_rolle');
    expect(baukastenArt(K.get(basis))).toBe('beschwoerbar');
    const wesen: Begleiter = { id: basis, art: 'wesen', name: 'W', bausteine: [modul, rolle] };
    const w = wesenBaukastenWerte(K, wesen);
    expect(w.stufe).toBe(WS.stufe);
    expect(w.werte!.attribute.AUS).toBe(WS.AUS);
    expect(w.werte!.abgeleitet).toMatchObject(WS.abgeleitet);
    expect(w.werte!.waffen[0].wert).toBe(WS.angriff);
    expect(w.werte!.merkmale).toContain(WS.merkmal);
    expect(w.dienste.map(d => d.name)).toEqual(expect.arrayContaining(WS.dienste));
    expect(w.schritt5).toMatchObject(WS.schritt5);
    expect(w.wahlen.some(x => x.art === 'attribut')).toBe(true);
    expect(w.hinweise).toEqual([]);
    // gewählte Attributwahl wirkt
    const wahl = w.wahlen.find(x => x.art === 'attribut')!;
    expect(wesenBaukastenWerte(K, { ...wesen, feinschliff: { [wahl.schluessel]: 'STÄ' } }).werte!.attribute['STÄ']).toBe(w.werte!.attribute['STÄ'] + 1);
    // Mehrfachwahl über die Grenze; Rollen beliebig oft
    expect(wesenBaukastenWerte(K, { ...wesen, bausteine: [...wesen.bausteine!, modul] }).hinweise.map(h => h.schluessel)).toEqual([`mehrfach:${modul}`]);
    expect(wesenBaukastenWerte(K, { ...wesen, bausteine: [...wesen.bausteine!, rolle] }).hinweise).toEqual([]);
  });

  it('Kreatur: Punkte aus kosten_punkte, Voraussetzungen mit Träger „wesen“, Kosten ohne Zahl', () => {
    const basis = id(KR.paket, KR.basis, 'wesen_baukasten_basis');
    const module = (KR.module as string[]).map(n => id(KR.paket, n));
    const k1: Begleiter = { id: basis, art: 'tier', name: 'K', bausteine: module };
    const w = wesenBaukastenWerte(K, k1);
    expect(w.stufe).toBe(KR.stufe);
    expect(w.werte!.merkmale).toContain(KR.merkmal);
    expect(w.hinweise).toEqual([]);
    const fremd = id(KR.paket, KR.unvertraeglich);
    const mit = wesenBaukastenWerte(K, { ...k1, bausteine: [...module, fremd] });
    expect(mit.hinweise.map(h => h.schluessel).sort()).toEqual([`voraussetzung:${fremd}`, `voraussetzung:${module[1]}`].sort());
    expect(wesenBaukastenWerte(K, { ...k1, bausteine: [id(KR.paket, KR.ohneZahl)] }).ohneZahl.map(e => e.name)).toEqual([KR.ohneZahl]);
    expect(w.werte!.waffen[0].ini).toBe(KR.ini);
  });

  it('Assistent: Wesen bauen, Modul hinzufügen, zweites gleiches Modul gesperrt', () => {
    render(<Rahmen />);
    const d = begleiterErstellen('Beschworenes Wesen');
    fireEvent.click(within(d).getByRole('button', { name: /^Eigenes Wesen bauen/ }));
    fireEvent.change(within(d).getByLabelText('Korpus des Wesens'), { target: { value: id(WS.paket, WS.basis, 'wesen_baukasten_basis') } });
    weiter();
    weiter();
    const auswahl = within(d).getByLabelText('Schritt 3: Zusätzliche Fähigkeiten: Baustein wählen') as HTMLSelectElement;
    const hinzu = () => {
      fireEvent.change(auswahl, { target: { value: id(WS.paket, WS.modul) } });
      fireEvent.click(within(auswahl.closest('div')!.parentElement!.parentElement!).getByRole('button', { name: /Hinzufügen/ }));
    };
    hinzu();
    expect(within(d).getByText(enthaelt(WS.merkmalNachModul))).toBeTruthy();
    hinzu(); // höchstens einmal: gesperrt (ohne Hausregeln)
    expect(within(d).getByText(enthaelt(WS.merkmalNachModul))).toBeTruthy();
    expect(within(d).getAllByRole('button', { name: enthaelt(`${WS.modul} entfernen`) })).toHaveLength(1);
    abschliessen();
    const blatt = screen.getByTestId('begleiter-blatt');
    expect(within(blatt).getByRole('heading', { name: `Eigenes Wesen (${WS.basis})` })).toBeTruthy();
    expect(within(blatt).getByText(WS.stufeNachModul)).toBeTruthy();
  });
});


const Rahmen: React.FC = () => {
  const [state, dispatch] = React.useReducer(baseCharacterReducer, { ...DEFAULT_STATE } as CharacterState);
  return <CharacterContext.Provider value={{ state, dispatch, calc: { heldengrad: { maxSkill: 6 } } as never }}><BegleiterView /></CharacterContext.Provider>;
};
