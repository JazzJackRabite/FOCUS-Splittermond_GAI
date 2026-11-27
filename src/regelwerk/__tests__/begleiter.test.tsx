/**
 * Begleiter: Tiergefährten aus dem GRW (Ressource Kreatur, S. 78; Tierwerte S. 283–286), Tab „Begleiter“,
 * Abrichtungen und Potenzial (Bestienmeister S. 15–23, lokal mit FOKUS_GRIMOIRES).
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
import { kreaturZuordnung } from '../../components/begleiter/besitzer';
import { validateCharacterImport } from '../../utils/importValidation';
import { Katalog } from '../katalog';
import { abschliessen, basisAusDateien, begleiterErstellen, blattWaehlen, buchfaelle, grimoireDatei, weiter } from './hilfen';
import { erstelleKatalog, grimoireLesen } from '../laden';
import { bedingungsCharakter } from '../bruecke';
import {
  abrichtungen, alleTiere, beschwoerbareWesen, diensteFuer, istReittier, kreaturStufe, mehrfachGrenze, potenzial, pruefeAbrichtung,
  tierQualitaeten, tierTraeger, tiergefaehrten, wertekasten,
} from '../begleiter';
import type { Begleiter, CharacterState } from '../../types';

const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
const kat = { aktuell: K as Katalog };
vi.mock('../RegelwerkContext', () => ({ useRegelwerk: () => ({ katalog: kat.aktuell }) }));

describe('Tiergefährten aus dem GRW', () => {
  const tiere = tiergefaehrten(K);
  it('liefert Tiere mit Werten und Stufe', () => {
    expect(tiere.map(t => t.name)).toEqual(expect.arrayContaining(['Taube', 'Pferd', 'Wolf', 'Riesenschlange']));
    for (const t of tiere) { expect(wertekasten(t.eintrag)?.abgeleitete_werte).toBeTruthy(); expect(kreaturStufe(t.eintrag)).toBe(t.stufe); }
    expect([...tiere].map(t => t.stufe)).toEqual([...tiere].map(t => t.stufe).sort((a, c) => a - c));
  });
  it('alle Tiere: auch ohne Merkmal Kreatur (z. B. Bär), Pferd ist Reittier', () => {
    const alle = alleTiere(K);
    expect(alle.find(t => t.name === 'Bär')?.stufe).toBe(0);
    const pferd = alle.find(t => t.name === 'Pferd')!;
    expect(pferd.typus).toContain('Reittier');
    expect(istReittier(K, { id: pferd.id, art: 'tier', name: 'Pferd' })).toBe(true);
  });
  it('ohne Magie-Paket keine beschwörbaren Wesen, ohne Bestienmeister keine Abrichtungen', () => {
    expect(beschwoerbareWesen(K)).toEqual([]);
    expect(abrichtungen(K)).toEqual([]);
  });
});

describe('Regeln ohne Buch', () => {
  it('Mehrfachwahl', () => {
    expect(mehrfachGrenze(null, 2)).toBe(1);
    expect(mehrfachGrenze({ beliebig: true }, 2)).toBe(Infinity);
    expect(mehrfachGrenze({ anzahl: 4 }, 2)).toBe(4);
    expect(mehrfachGrenze({ anzahl: 3 }, 2)).toBe(3);
    expect(mehrfachGrenze({ je_heldengrad: true }, 3)).toBe(3);
    expect(mehrfachGrenze({ spielleitung: true }, 3)).toBe(Infinity);
  });
  it('Zuordnung der Ressourcen Kreatur', () => {
    expect(kreaturZuordnung([3, 2], [2, 3])).toBe(true);
    expect(kreaturZuordnung([3], [3, 1])).toBe(false);
    expect(kreaturZuordnung([2], [3])).toBe(false);
    expect(kreaturZuordnung([], [0, 0])).toBe(true);
  });
  it('Potenzial nur mit Grimoire (Bestienmeister S. 15)', () => {
    // Potenzial ist eine Regel aus dem Bestienmeister: ohne Grimoire keine Werte im Code
    expect(potenzial(K, { id: 'x', art: 'tier', name: 'x', kreatur: 3, vertrauter: true }, []).posten).toEqual([]);
  });
});

describe('Begleiter-Zustand', () => {
  it('Reducer: hinzufügen, ändern, entfernen', () => {
    let s = baseCharacterReducer(DEFAULT_STATE, { type: 'BEGLEITER_HINZU', payload: { id: 'x', art: 'tier', name: 'Wolf' } });
    s = baseCharacterReducer(s, { type: 'BEGLEITER_HINZU', payload: { id: 'y', art: 'tier', name: 'Pferd' } });
    s = baseCharacterReducer(s, { type: 'BEGLEITER_AENDERN', payload: { index: 1, aenderung: { rufname: 'Blitz', abrichtungen: ['a', 'a'] } } });
    expect(s.begleiter?.[1]).toMatchObject({ id: 'y', rufname: 'Blitz', abrichtungen: ['a', 'a'] });
    s = baseCharacterReducer(s, { type: 'BEGLEITER_ENTFERNEN', payload: { index: 0 } });
    expect(s.begleiter?.map(x => x.name)).toEqual(['Pferd']);
  });
  it('Import übernimmt die neuen Felder und den Tab', () => {
    const r = validateCharacterImport({
      ...DEFAULT_STATE, mode: 'begleiter',
      begleiter: [{ id: 'grw:kreatur:pferd', art: 'tier', name: 'Pferd', rufname: 'Blitz', kreatur: 3, qualitaet: 2, vertrauter: true, abrichtungen: ['a', 7] }],
    });
    expect(r.mode).toBe('begleiter');
    expect(r.begleiter?.[0]).toEqual({ id: 'grw:kreatur:pferd', art: 'tier', name: 'Pferd', rufname: 'Blitz', kreatur: 3, qualitaet: 2, vertrauter: true, abrichtungen: ['a'] });
  });
});

const Rahmen: React.FC<{ start: Partial<CharacterState> }> = ({ start }) => {
  const [state, dispatch] = React.useReducer(baseCharacterReducer, { ...DEFAULT_STATE, ...start });
  return <CharacterContext.Provider value={{ state, dispatch, calc: {} as never }}><BegleiterView /></CharacterContext.Provider>;
};

describe('Tab „Begleiter“ (nur GRW)', () => {
  it('Tier erstellen im Assistenten: freie Ressource Kreatur wird zugeordnet, Blatt mit Werten', () => {
    kat.aktuell = K;
    render(<Rahmen start={{ resourcesList: [{ name: 'Kreatur', level: 3, source: 'test' }] }} />);
    expect(screen.getByText(/Noch keine Begleiter/)).toBeTruthy();
    const d = begleiterErstellen('Tier');
    const sel = within(d).getByLabelText('Tier wählen') as HTMLSelectElement;
    const opt = (n: string) => [...sel.options].find(o => o.text.startsWith(`${n} (`))!;
    expect(opt('Wolf').disabled).toBe(false); // auch zu hohe Tiere wählbar (dann ohne Ressource)
    expect((screen.getByRole('button', { name: /^Weiter/ }) as HTMLButtonElement).disabled).toBe(true); // erst ein Tier wählen
    fireEvent.change(sel, { target: { value: opt('Pferd').value } });
    weiter();
    expect(within(d).getByText(/Grimoire „Bestienmeister“/)).toBeTruthy();
    expect((within(d).getByLabelText('Ressource Kreatur') as HTMLSelectElement).value).toBe('3');
    fireEvent.change(within(d).getByPlaceholderText('Pferd'), { target: { value: 'Blitz' } });
    weiter();
    expect(within(screen.getByTestId('assistent-uebersicht')).getByText('GSW')).toBeTruthy();
    abschliessen();
    expect(screen.queryByTestId('begleiter-assistent')).toBeNull();
    const blatt = screen.getByTestId('begleiter-blatt');
    expect(within(blatt).getByRole('heading', { name: 'Blitz (Pferd)' })).toBeTruthy();
    expect(within(blatt).getByText('Kreatur 3')).toBeTruthy();
    expect(within(blatt).getByText('Reittier')).toBeTruthy();
    expect(within(blatt).getAllByTestId('begleiter-waffe').length).toBeGreaterThan(0);

    // zweites Tier: keine freie Ressource mehr → ohne Ressource; das neue Blatt ist gewählt
    begleiterErstellen('Tier');
    fireEvent.change(screen.getByLabelText('Tier wählen'), { target: { value: opt('Wolf').value } });
    abschliessen();
    expect(within(screen.getByTestId('begleiter-blatt')).getByText('ohne Ressource')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Wolf entfernen'));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('tab', { name: /^Wolf/ })).toBeNull();
    expect(within(blattWaehlen(/^Blitz \(Pferd\)/)).getByText('Kreatur 3')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^Blitz \(Pferd\)\s*LP \d+\/\d+/ })).toBeTruthy(); // Kurzstand in der Leiste
  });
  it('Hinweis auf „Die Magie“ bei den Wesen', () => {
    kat.aktuell = K;
    render(<Rahmen start={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Begleiter erstellen$/ }));
    const karte = within(screen.getByTestId('begleiter-assistent')).getByRole('button', { name: /^Beschworenes Wesen/ }) as HTMLButtonElement;
    expect(karte.disabled).toBe(true);
    expect(within(karte).getByText(/Grimoire „Die Magie“/)).toBeTruthy();
  });
});


// Namen, Anzahlen und Sollwerte zu den Grimoires: lokale Falldatei (hilfen.ts: buchfaelle)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FM = buchfaelle<any>('begleiter', ['magie']);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FB = buchfaelle<any>('begleiter', ['bestien']);
const lade = (g: string) => grimoireLesen(fs.readFileSync(grimoireDatei(g), 'utf-8'), b.manifest);

describe.skipIf(!FM)('Beschworene Wesen (lokal)', () => {
  it('Wesen und Dienste: Basisdienste für alle, erweiterte nur mit passender Meisterschaft', () => {
    const { katalog: KM } = erstelleKatalog(b, [lade('magie')]);
    const w = beschwoerbareWesen(KM);
    expect(w.length).toBe(FM.wesen.anzahl); // ohne die Korpusse des Wesen-Baukastens
    const ohne = diensteFuer(KM, w.find(x => x.name === FM.wesen.beispiel)!.id, {});
    expect(ohne.length).toBeGreaterThan(0);
    expect(ohne.every(d => d.art !== 'erweitert')).toBe(true);
  });
});

describe.skipIf(!FB)('Abrichtungen und Potenzial (lokal)', () => {
  let KB = K; let liste: ReturnType<typeof abrichtungen> = [];
  beforeAll(() => {
    KB = erstelleKatalog(b, [lade('bestien')]).katalog;
    liste = abrichtungen(KB);
  });
  const A = (n: string) => liste.find(a => a.name === n)!;
  const AB = FB?.abrichtungen; const P = FB?.potenzial; const W = FB?.wahl;
  const pferd: Begleiter = { id: 'grw:kreatur:pferd', art: 'tier', name: 'Pferd', kreatur: 3 };
  const wolf: Begleiter = { id: 'grw:kreatur:wolf', art: 'tier', name: 'Wolf', kreatur: 4 };
  const fuehrer = (...ms: string[]) => bedingungsCharakter(KB, {
    meisterschaften: ms.map(name => ({ id: name, name, tier: 1, cost: 0, isFree: false, isCreationBonus: false, source: 'test', skill: 'Tierführung' })), fertigkeiten: { Tierführung: 9 },
  });

  it('Liste ohne die Sammel-Abrichtung; Grundausbildungen kosten 1 und brauchen Dompteur', () => {
    expect(liste.length).toBe(AB.anzahl);
    expect(liste.some(a => a.name === AB.sammel)).toBe(false);
    const g = A(AB.grund.name);
    expect(g.grundausbildung).toBe(true);
    expect(g.kosten).toBe(AB.grund.kosten);
    expect(g.voraussetzung?.text).toMatch(new RegExp(AB.grund.voraussetzung));
    expect(A(AB.kostenlos).kosten).toBe(0);
    expect(A(AB.gestaffelt.name).hoechstens).toBe(AB.gestaffelt.hoechstens);
  });
  it('Grundausbildung: Dompteur beim Führer und Typus Reittier beim Tier', () => {
    const g = A(AB.grund.name);
    expect(pruefeAbrichtung(KB, g, fuehrer(), tierTraeger(KB, pferd))).toBe(false);
    expect(pruefeAbrichtung(KB, g, fuehrer('Dompteur'), tierTraeger(KB, pferd))).toBe(true);
    expect(pruefeAbrichtung(KB, g, fuehrer('Dompteur'), tierTraeger(KB, wolf))).toBe(false);
  });
  it('aufbauende Abrichtung braucht die Grundausbildung beim Tier', () => {
    const mit = { ...pferd, abrichtungen: [A(AB.grund.name).id] };
    expect(pruefeAbrichtung(KB, A(AB.aufbauend), fuehrer('Dompteur'), tierTraeger(KB, pferd))).toBe(false);
    expect(pruefeAbrichtung(KB, A(AB.aufbauend), fuehrer('Dompteur'), tierTraeger(KB, mit))).toBe(true);
    expect(istReittier(KB, { ...wolf, abrichtungen: [A(AB.grund.name).id] })).toBe(true);
  });
  it('gestaffelte Abrichtung: zweite Wahl braucht die höhere Meisterschaft', () => {
    const st = AB.gestaffelt;
    const tier = tierTraeger(KB, { ...wolf, abrichtungen: [A(st.vorher).id] });
    expect(pruefeAbrichtung(KB, A(st.name), fuehrer(st.stufe1), tier, 0)).toBe(true);
    expect(pruefeAbrichtung(KB, A(st.name), fuehrer(st.stufe1), tier, 1)).toBe(false);
    expect(pruefeAbrichtung(KB, A(st.name), fuehrer(st.stufe1, st.stufe2), tier, 1)).toBe(true);
  });
  it('Potenzial mit Meisterschaften, Kreatur, Vertrauter und Qualität', () => {
    const ids = (P.meisterschaften as string[]).map(n => Object.values(KB.eintraege).find(e => e.typ === 'meisterschaft' && e.name === n)!.id);
    expect(potenzial(KB, pferd, ids).gesamt).toBe(P.mitKreatur3);
    expect(potenzial(KB, { ...pferd, kreatur: undefined }, ids).gesamt).toBe(P.ohneKreatur);
    expect(potenzial(KB, { id: 'x', art: 'tier', name: 'x' }, []).gesamt).toBe(P.grund);
    expect(potenzial(KB, { id: 'x', art: 'tier', name: 'x', kreatur: 3, vertrauter: true }, []).gesamt).toBe(P.vertrauterKreatur3);
    expect(potenzial(KB, { id: 'x', art: 'tier', name: 'x', qualitaet: 4 }, []).gesamt).toBe(P.qualitaet4);
    expect(tierQualitaeten(KB).map(q => q.potenzial)).toEqual(P.qualitaeten);
    expect(tierQualitaeten(K)).toEqual([]);
  });
  it('Tab: Abrichtung hinzufügen, Potenzial und Status', () => {
    kat.aktuell = KB;
    const name = AB.grund.name as string; const max = P.kreatur3;
    render(<Rahmen start={{
      resourcesList: [{ name: 'Kreatur', level: 3, source: 'test' }],
      begleiter: [pferd],
      masteries: { 'Tierführung': [{ id: 'm1', name: 'Dompteur', tier: 1, cost: 0, isFree: false, isCreationBonus: false, source: 'test', skill: 'Tierführung' }] },
    }} />);
    fireEvent.click(screen.getByRole('button', { name: /^Bearbeiten$/ }));
    weiter(); // Grundangaben → Abrichtungen
    const d = screen.getByTestId('begleiter-assistent');
    const sel = screen.getByLabelText('Abrichtung wählen') as HTMLSelectElement;
    const r1 = [...sel.options].find(o => o.text.startsWith(`${name} (`))!;
    expect(r1.text).not.toMatch(/Voraussetzung fehlt|Spielleitung/); // erfüllt: kein Zusatz (keine Symbole, FUNDAMENT)
    fireEvent.change(sel, { target: { value: r1.value } });
    fireEvent.click(screen.getByRole('button', { name: /Abrichtung hinzufügen/ }));
    expect(within(d).getByText(`Potenzial 1/${max}`)).toBeTruthy();
    expect([...sel.options].find(o => o.value === r1.value)!.disabled).toBe(true);
    expect(within(d).getByText('erfüllt')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(`Abrichtung ${name} entfernen`));
    expect(within(d).getByText(`Potenzial 0/${max}`)).toBeTruthy();
    fireEvent.change(sel, { target: { value: r1.value } });
    fireEvent.click(screen.getByRole('button', { name: /Abrichtung hinzufügen/ }));
    abschliessen();
    const blatt = screen.getByTestId('begleiter-blatt');
    expect(within(blatt).getByText(`Potenzial 1/${max}`)).toBeTruthy();
    expect(within(blatt).getByRole('button', { name })).toBeTruthy();
    kat.aktuell = K;
  });
  it('Tab: Vertrauter erstellen, Abrichtung mit Wahl wirkt auf das Blatt', () => {
    kat.aktuell = KB;
    const { unmount } = render(<Rahmen start={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Begleiter erstellen$/ }));
    expect((within(screen.getByTestId('begleiter-assistent')).getByRole('button', { name: /^Vertrauter/ }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    // Tiervertrauter: das Tier begleitet im Rahmen der Ressource Kreatur (GRW S. 74) – der Wolf braucht Kreatur 4
    render(<Rahmen start={{ strengthsList: [{ name: 'Tiervertrauter', source: 'test' }], resourcesList: [{ name: 'Kreatur', level: 4, source: 'creation' }] } as never} />);
    const d = begleiterErstellen('Vertrauter');
    expect(screen.getByText('Vertrauter erstellen')).toBeTruthy();
    const sel = within(d).getByLabelText('Tier wählen') as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: [...sel.options].find(o => o.text.startsWith('Wolf ('))!.value } });
    weiter();
    expect((within(d).getByLabelText(/^Vertrauter/) as HTMLInputElement).checked).toBe(true);
    weiter(); // → Abrichtungen
    const ab = within(d).getByLabelText('Abrichtung wählen') as HTMLSelectElement;
    fireEvent.change(ab, { target: { value: [...ab.options].find(o => o.text.startsWith(`${W.abrichtung} (`))!.value } });
    setzeHausregeln(true); // Voraussetzungen des Führers hier nicht erfüllt
    fireEvent.click(within(d).getByRole('button', { name: /Abrichtung hinzufügen/ }));
    setzeHausregeln(false);
    fireEvent.change(within(d).getByLabelText(W.feld), { target: { value: W.wert } });
    abschliessen();
    const blatt = screen.getByTestId('begleiter-blatt');
    expect(within(blatt).getAllByText('Vertrauter').length).toBeGreaterThan(0);
    expect(within(blatt).getByText('Vertrautenmagie')).toBeTruthy();
    expect(within(blatt).getByText(/Noch nichts gelernt/)).toBeTruthy();
    expect(within(blatt).getByText('Merkmale').parentElement!.textContent!).not.toContain(W.merkmalWeg);
    expect(within(blatt).getByText(/Boni der Abrichtungen sind in Werten/)).toBeTruthy();
    kat.aktuell = K;
  });
});
