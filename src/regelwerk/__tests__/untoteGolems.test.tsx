/**
 * Begleiter Teil 3: Modifikationen, erhobene Untote und Golems. Die Beispiele ohne Grimoires sind erfunden; die Fälle aus
 * „Die Magie“ (IDs, Namen, Sollwerte) stehen in der lokalen Falldatei (FOKUS_BUCHFAELLE, hilfen.ts: buchfaelle).
 */
import { setzeHausregeln } from '../../fundament/hausregeln';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { baseCharacterReducer, DEFAULT_STATE } from '../../hooks/useCharacterState';
import { CharacterContext } from '../../context/CharacterContext';
import { BegleiterView } from '../../features/begleiter/BegleiterView';
import { validateCharacterImport } from '../../utils/importValidation';
import { Katalog } from '../katalog';
import { abschliessen, basisAusDateien, begleiterErstellen, buchfaelle, grimoireDatei, weiter } from './hilfen';
import { erstelleKatalog, grimoireLesen } from '../laden';
import { anwenden, ausStruktur, iniPlus, schadenPlus, werteblock } from '../modifikationen';
import { attributKosten, erhebungen, fertigkeitKosten, freieSchwelle, grenzHeldengrad, untotWerte, ANGRIFF } from '../untote';
import { golemWerte, korpusse } from '../golem';
import type { Begleiter, CharacterState } from '../../types';

const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
const kat = { aktuell: K as Katalog };
vi.mock('../RegelwerkContext', () => ({ useRegelwerk: () => ({ katalog: kat.aktuell }) }));

describe('Modifikationen-Texte', () => {
  // Das Auslesen der Texte macht die Datenseite (Werkzeuge/regelpakete/textauslese.py, mit Selbsttest beim Bau)
  it('übernimmt das Feld modifikationen_strukturiert', () => {
    const m = ausStruktur({ attribute: { BEW: 2, 'STÄ': 1 }, abgeleitet: { LP: 3, VTD: 1, SR: 1, INI: -2, GK: 1 }, hoechstens: { GK: 6 }, angriff: 3, schaden: 1, wgs: 1,
      fertigkeiten: { 'grw:fertigkeit:athletik': 1 }, merkmale_dazu: ['Laut'], merkmale_weg: ['Friedlich'], waffenmerkmale: ['Spitz'],
      wahlen: [{ art: 'attribut', optionen: ['AUS'], bonus: 1, text: 'eine Wahl' }], text: ['Sonderregel'] });
    expect(m.attribute).toEqual({ BEW: 2, 'STÄ': 1 });
    expect(m.hoechstens).toEqual({ GK: 6 });
    expect([m.angriff, m.schaden, m.wgs]).toEqual([3, 1, 1]);
    expect(m.merkmaleDazu).toEqual(['Laut']);
    expect(m.rest).toEqual(['eine Wahl', 'Sonderregel']);
    expect(ausStruktur(undefined).rest).toEqual([]);
  });
  it('wendet an: Waffen, Initiative, Merkmalskette aus den Daten, Obergrenze', () => {
    const w = werteblock(K, {
      attribute: { KON: '2' }, abgeleitete_werte: { GK: '7', LP: '5', SR: '0' }, merkmale: 'Friedlich, Spröde',
      waffen: [{ name: 'Körper', wert: '4', schaden: '1W10', wgs: '8', ini: '9−1W6', merkmale: '–' }],
    });
    const m = ausStruktur({ abgeleitet: { GK: 1, INI: -2 }, hoechstens: { GK: 7 }, angriff: 2, schaden: 1, merkmale_weg: ['Friedlich'], robuster: 1, robuster_kette: ['Spröde', 'Schwach'] });
    const r = anwenden(K, w, m);
    expect(r.abgeleitet.GK).toBe(7);
    expect(r.waffen[0]).toMatchObject({ wert: 6, schaden: '1W10+1', ini: '7−1W6' });
    expect(r.merkmale).toEqual(['Schwach']);
    // zweimal: das letzte Glied der Kette entfällt; danach LP nach der Feinschliff-Regel (ohne Regel: keine)
    expect(anwenden(K, w, { ...m, robuster: 2 }).merkmale).toEqual([]);
    const regel = { ersetzen: [], stufen_addieren: false, andere_doppelte_entfallen: false, beide_entfallen: [], robuster_lp: 2 };
    expect(anwenden(K, w, { ...m, robuster: 3 }, regel).abgeleitet.LP).toBe(5 + 2);
    expect(anwenden(K, w, { ...m, robuster: 3 }).abgeleitet.LP).toBe(5);
    expect(schadenPlus('2W6+3', -4)).toBe('2W6−1');
    expect(iniPlus('8−1W6', -1)).toBe('7−1W6');
  });
});

describe('Untote: Regeln', () => {
  it('Kosten nach den Kernregeln (Steigerung „von 0 an“)', () => {
    expect([1, 6, 7, 9, 10].map(n => fertigkeitKosten(K, n))).toEqual([3, 18, 23, 33, 40]);
    expect([1, 2, 3].map(n => attributKosten(K, n))).toEqual([10, 25, 45]);
    expect([5, 6, 8, 9, 15].map(n => freieSchwelle(K, n))).toEqual([0, 1, 1, 2, 4]);
    expect([1, 2, 3, 4, 5].map(n => grenzHeldengrad(K, n))).toEqual([null, null, null, null, null]); // Regeltext fehlt ohne den Band
  });
  it('nur GRW: Untote erheben mit Wandelnder Leichnam/Skelett (Werte im GRW-Paket, Steigerungsregeln fehlen)', () => {
    const e = erhebungen(K);
    expect(e.map(x => x.zauber.name)).toEqual(['Untote erheben']);
    expect(e[0]).toMatchObject({ grad: 3, epJeVerstaerkung: 15 });
    const u = untotWerte(K, { id: 'grw:kreatur:skelett', art: 'untoter', name: 'Skelett', erhebung: 'grw:zauber:untote-erheben', verstaerkungen: 1,
      steigerung: { fertigkeiten: { [ANGRIFF]: 3 } } }, { nekromant: false, meisterDerAbnormitaeten: false });
    expect(u).toMatchObject({ epGesamt: 15, epVerbraucht: 9, grenze: 0 });
    expect(u.wertesatz?.id).toBe('grw:kreatur:skelett');
    expect(u.werte?.abgeleitet.LP).toBe(7);
    expect(u.werte?.attribute.VER).toBe(0);
    expect(u.hinweise.some(h => /Steigerung von Untoten fehlen/.test(h))).toBe(true);
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F = buchfaelle<any>('untoteGolems', ['magie']);

describe.skipIf(!F)('Untote und Golems mit Grimoire (lokal)', () => {
  let KM = K;
  beforeAll(() => { KM = erstelleKatalog(b, F.grimoires.map((g: string) => grimoireLesen(fs.readFileSync(grimoireDatei(g), 'utf-8'), b.manifest))).katalog; });
  const bid = (n: string) => Object.values(KM.eintraege).find(e => e.typ === 'golem_baustein' && e.name === n)!.id;
  it('Grenze der neuen Punkte nach Zaubergrad (aus dem Paket)', () => {
    expect([1, 2, 3, 4, 5].map(n => grenzHeldengrad(KM, n))).toEqual(F.grenze);
  });

  it('Erhebungszauber; Untoter: Steigerung wirkt auf abgeleitete Werte, Abnormität, EP', () => {
    expect(erhebungen(KM).map(x => x.zauber.name)).toEqual(F.erhebungen);
    const U = F.untot;
    const u = untotWerte(KM, { id: U.id, art: 'untoter', name: U.name, erhebung: U.erhebung, verstaerkungen: U.verstaerkungen, steigerung: U.steigerung, abnormitaet: U.abnormitaet },
      { nekromant: false, meisterDerAbnormitaeten: true });
    expect(u.werte!.attribute).toMatchObject(U.attribute);
    expect(u.werte!.abgeleitet).toMatchObject(U.abgeleitet);
    expect(u.werte!.fertigkeiten.find(f => f.name === U.fertigkeit[0])?.wert).toBe(U.fertigkeit[1]);
    expect(u.epGesamt).toBe(U.epGesamt);
    expect(u.epVerbraucht).toBe(U.epVerbraucht);
    expect(u.hinweise).toEqual(expect.arrayContaining((U.hinweise as string[]).map(h => expect.stringContaining(h))));
  });

  it('Untote: freie Meisterschaften je erreichter Schwelle, nur mit freiem Platz', () => {
    const U = F.untot; const fid = 'grw:fertigkeit:wahrnehmung';
    const untot: Begleiter = { id: U.id, art: 'untoter', name: U.name, erhebung: U.erhebung, verstaerkungen: 1, steigerung: { fertigkeiten: { [fid]: 6 } } };
    const u = untotWerte(KM, untot, { nekromant: true, meisterDerAbnormitaeten: false });
    expect(u.freieMeisterschaften).toEqual([{ fertigkeitId: fid, fertigkeit: 'Wahrnehmung', schwelle: 1 }]);
    const s1 = Object.values(KM.eintraege).filter(e => e.typ === 'meisterschaft' && e.daten.fertigkeit === fid);
    const eins = s1.find(e => Number(e.daten.schwelle) === 1)!; const zwei = s1.find(e => Number(e.daten.schwelle) === 2)!;
    const mit = untotWerte(KM, { ...untot, meisterschaften: [eins.id] }, { nekromant: true, meisterDerAbnormitaeten: false });
    expect(mit.meisterschaften[0]).toMatchObject({ ok: true, schwelle: 1 });
    expect(mit.werte!.meisterschaften).toContain(eins.name);
    // Schwelle 2 hat keinen Platz (erst ab 9 Punkten), ein zweiter Platz fehlt auch
    const zuviel = untotWerte(KM, { ...untot, meisterschaften: [eins.id, zwei.id] }, { nekromant: true, meisterDerAbnormitaeten: false });
    expect(zuviel.meisterschaften[1].ok).toBe(false);
    expect(zuviel.verstoesse.some(v => v.schluessel === 'meisterschaften')).toBe(true);
  });

  it('Golem: Feinschliff-Wahlen Meisterschaft, Fertigkeit und Punkte mit Grenzen aus den Daten', () => {
    const G = F.golemWahlen;
    const alle = Object.values(KM.eintraege).filter(e => e.typ === 'golem_baustein' && ['Zusätzliche Fähigkeit', 'Rolle'].includes(e.daten.baustein)).map(e => e.id);
    const basis: Begleiter = { id: G.korpus, art: 'golem', name: G.name, material: G.material, bausteine: alle, golemRessource: true };
    const g = golemWerte(KM, basis);
    expect([...new Set(g.wahlen.map(w => w.art))].sort()).toEqual(['attribut', 'fertigkeit', 'meisterschaft', 'punkte']);
    const punkte = g.wahlen.find(w => w.art === 'punkte')!;
    expect(punkte).toMatchObject(G.punkte);
    const ms = g.wahlen.filter(w => w.art === 'meisterschaft').map(w => (w as { schwelle: number }).schwelle);
    expect(ms.every(x => Number.isFinite(x) && x >= 1)).toBe(true);
    expect(ms).toContain(1); expect(ms).toContain(g.meisterschaftSchwelle);
    const f = g.werte!.fertigkeiten.find(x => x.id)!;
    expect(golemWerte(KM, { ...basis, feinschliff: { [punkte.schluessel]: { [f.id!]: G.punkte.max + 1 } } }).verstoesse.some(v => v.schluessel.startsWith('max:'))).toBe(true);
    const gut = golemWerte(KM, { ...basis, feinschliff: { [punkte.schluessel]: { [f.id!]: G.punkte.max } } });
    expect(gut.werte!.fertigkeiten.find(x => x.id === f.id)!.wert).toBe(g.werte!.fertigkeiten.find(x => x.id === f.id)!.wert + G.punkte.max);
    expect(bid(G.baustein)).toBeTruthy();
  });

  it('Golem: Stufe, Werte aus Korpus + Material + Modulen, Applikationen, Preis, Animierung', () => {
    const G = F.golem;
    expect(korpusse(KM).map(e => e.name)).toEqual(G.korpusse);
    const golem: Begleiter = { id: G.korpus, art: 'golem', name: G.name, material: G.material, bausteine: (G.bausteine as string[]).map(bid), sonderausstattung: G.sonderausstattung };
    const g = golemWerte(KM, golem);
    expect(g.stufe).toBe(G.stufe);
    expect(g.sonderausstattungPlaetze).toBe(G.plaetze);
    expect(g.werte!.attribute).toMatchObject(G.attribute);
    expect(g.werte!.abgeleitet).toMatchObject(G.abgeleitet);
    expect(g.werte!.waffen[0]).toMatchObject(G.waffe);
    expect(g.werte!.merkmale).toContain(G.merkmal);
    expect(g.werte!.merkmale).not.toContain(G.merkmalNicht);
    expect(g.applikationenExtra).toBe(G.applikationenExtra);
    expect(g.hinweise).toEqual(expect.arrayContaining([expect.stringContaining(G.hinweis)]));
    expect(g.konstruktion).toEqual(G.konstruktion);
    expect(g.preis).toBe(G.preis);
    expect(g.animierung?.name).toBe(G.animierung);
    expect(g.meisterschaftSchwelle).toBe(G.schwelle);
    // Attributwahl des Feinschliffs aus den Daten
    const attr = g.wahlen.find(w => w.art === 'attribut' && w.quelle === G.wahl.quelle)!;
    expect(attr).toMatchObject({ optionen: G.wahl.optionen, bonus: G.wahl.bonus });
    // gewählt: KON +1 → LP +1 (GK + KON), KW +1 (12 + KON + WIL)
    const mitKon = golemWerte(KM, { ...golem, feinschliff: { [attr.schluessel]: 'KON' } });
    expect(mitKon.werte!.attribute.KON).toBe(g.werte!.attribute.KON + 1);
    expect(mitKon.werte!.abgeleitet.LP).toBe(g.werte!.abgeleitet.LP + 1);
    expect(mitKon.werte!.abgeleitet.KW).toBe(g.werte!.abgeleitet.KW + 1);
    expect(golemWerte(KM, { ...golem, feinschliff: { [attr.schluessel]: 'MYS' } }).werte!.attribute.MYS).toBe(g.werte!.attribute.MYS); // nicht wählbar
    expect(golemWerte(KM, { ...golem, bausteine: [bid(G.allein)] }).hinweise).toEqual(expect.arrayContaining([G.alleinHinweis]));
    // Ressource Golem: eine Applikation je Stufe
    expect(golemWerte(KM, { ...golem, golemRessource: true }).applikationenExtra).toBe(0);
  });

  it('Assistent: Golem bauen und Untoten erheben', () => {
    const A = F.assistent;
    kat.aktuell = KM;
    render(<Rahmen start={{ money: { solare: 50, lunare: 0, telare: 0 }, masteries: { [A.fertigkeit]: [{ id: 'm', name: A.meisterschaft, tier: 1, cost: 0, isFree: false, isCreationBonus: false, source: 't', skill: A.fertigkeit }] } }} />);
    let d = begleiterErstellen('Golem');
    fireEvent.change(within(d).getByLabelText('Korpus (Schritt 1)'), { target: { value: A.korpus } });
    weiter();
    const stand = () => within(d).getByTestId('golem-stand').textContent ?? '';
    expect(stand()).toContain(A.stand1);
    fireEvent.change(within(d).getByLabelText(/Golemmaterial/), { target: { value: A.material } });
    weiter();
    const fa = within(d).getByLabelText('Zusätzliche Fähigkeit wählen') as HTMLSelectElement;
    fireEvent.change(fa, { target: { value: [...fa.options].find(o => o.text.startsWith(A.faehigkeit))!.value } });
    fireEvent.click(within(d).getByRole('button', { name: /^Zusätzliche Fähigkeit hinzufügen$/ }));
    expect(stand()).toContain(A.stand2);
    fireEvent.click(screen.getByRole('button', { name: /Zurück/ }));
    expect(within(d).getByText((t) => t.includes(A.animierung))).toBeTruthy();
    // Kaufpreis wird beim Erstellen abgezogen (ohne Ressource Golem)
    while (screen.queryByRole('button', { name: /^Weiter/ })) weiter();
    expect(screen.getByTestId('golem-kaufen')).toBeTruthy();
    abschliessen();
    expect(JSON.parse(screen.getByTestId('geld').textContent ?? '{}').solare).toBeLessThan(50);
    let blatt = screen.getByTestId('begleiter-blatt');
    expect(within(blatt).getByRole('heading', { name: A.titel })).toBeTruthy();
    expect(within(blatt).getByText(A.stand2)).toBeTruthy();
    expect(within(blatt).getByText(A.faehigkeit)).toBeTruthy();

    d = begleiterErstellen('Erhobener Untoter');
    fireEvent.change(within(d).getByLabelText('Erhebungszauber'), { target: { value: A.erhebung } });
    fireEvent.change(within(d).getByLabelText('Wertesatz'), { target: { value: A.wertesatz } });
    weiter();
    fireEvent.change(within(d).getByLabelText('Anzahl Verstärkungen'), { target: { value: '1' } });
    weiter();
    fireEvent.click(within(d).getByLabelText('KON steigern'));
    expect(within(d).getByText(A.epVorher)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Zurück/ }));
    // mehr EP als verfügbar: ohne Hausregeln gesperrt, mit Hausregeln nur eine Warnung
    fireEvent.change(within(d).getByLabelText('Abnormität'), { target: { value: A.abnormitaet } });
    expect(within(d).getByText(A.epVorher)).toBeTruthy();
    setzeHausregeln(true);
    fireEvent.change(within(d).getByLabelText('Abnormität'), { target: { value: A.abnormitaet } });
    expect(within(d).getByText(A.epNachher)).toBeTruthy();
    abschliessen();
    blatt = screen.getByTestId('begleiter-blatt');
    expect(within(blatt).getByRole('heading', { name: A.wertesatz })).toBeTruthy();
    expect(within(blatt).getByText(A.epNachher)).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    setzeHausregeln(false);
  });
});


const Rahmen: React.FC<{ start: Partial<CharacterState> }> = ({ start }) => {
  const [state, dispatch] = React.useReducer(baseCharacterReducer, { ...DEFAULT_STATE, ...start });
  return <CharacterContext.Provider value={{ state, dispatch, calc: { heldengrad: { maxSkill: 6 } } as never }}><BegleiterView /><output data-testid="geld">{JSON.stringify(state.money)}</output></CharacterContext.Provider>;
};

describe('Import: Golem- und Untoten-Felder', () => {
  it('übernimmt gültige Felder', () => {
    const r = validateCharacterImport({ ...DEFAULT_STATE, begleiter: [
      { id: 'g', art: 'golem', name: 'Mittel', material: 'm', bausteine: ['a', 1], sonderausstattung: ['SR +2'], golemRessource: true },
      { id: 'u', art: 'untoter', name: 'Skelett', erhebung: 'z', verstaerkungen: 2.7, abnormitaet: 'a', steigerung: { attribute: { KON: 1, X: 'y' }, fertigkeiten: { f: 3 } } },
    ] });
    expect(r.begleiter?.[0]).toMatchObject({ art: 'golem', material: 'm', bausteine: ['a'], sonderausstattung: ['SR +2'], golemRessource: true });
    expect(r.begleiter?.[1]).toMatchObject({ art: 'untoter', erhebung: 'z', verstaerkungen: 2, abnormitaet: 'a', steigerung: { attribute: { KON: 1 }, fertigkeiten: { f: 3 } } });
  });
});
