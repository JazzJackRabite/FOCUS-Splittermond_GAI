/**
 * Waffenmerkmale aus den Paketen (Idee #14, GRW S. 186): Werte der Merkmale, Schadenswurf, Verteidigung, Angriffsdialog.
 * Merkmale aus den Grimoires werden nur über ihre Werte geprüft (keine Namen aus den Bänden im Quelltext, Grundsatz 3).
 */
import React from 'react';
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Katalog } from '../katalog';
import { basisAusDateien, GRIMOIRE_ORDNER, grimoireDatei } from './hilfen';
import { setzeAktivenKatalog } from '../bruecke';
import { merkmalSchaden, meisterschaftsIdsVon, verteidigungDurchWaffen, waffenMerkmale, type MerkmalSchaden } from '../merkmale';
import { executeAttackDamageRoll } from '../../utils/combatRules';
import { CharacterContext } from '../../context/CharacterContext';
import { AttackModal } from '../../components/play/AttackModal';
import { DEFAULT_STATE } from '../../hooks/useCharacterState';
import { erstelleKatalog, grimoireLesen } from '../laden';

const b = basisAusDateien();
const K = new Katalog(b.manifest, [b.basis]);
/** Zufall, der der Reihe nach die angegebenen Augenzahlen liefert */
const wuerfel = (seiten: number, ...augen: number[]) => { let i = 0; return () => (augen[i++ % augen.length] - 0.5) / seiten; };
const leer: MerkmalSchaden = merkmalSchaden([]);

describe('Werte der Merkmale im GRW-Paket (S. 186)', () => {
  it('Merkmale mit Spielwerten werden in der Merkmalsliste einer Waffe erkannt, mit Stufe', () => {
    const l = waffenMerkmale('Durchdringung 2, Scharf 3, Wuchtig, Zweihändig', K);
    expect(l.map((m) => [m.name, m.stufe, m.quelle])).toEqual([['Durchdringung', 2, 'GRW S. 186'], ['Scharf', 3, 'GRW S. 186']]);
    expect(waffenMerkmale('Unscharf', K)).toEqual([]);
    expect(waffenMerkmale(undefined, K)).toEqual([]);
  });

  it('Wirkung auf den Angriff', () => {
    const m = merkmalSchaden(waffenMerkmale('Scharf 2, Durchdringung 1, Stumpf', K));
    expect(m).toMatchObject({ wuerfelMindestens: 2, srIgnorieren: 1, betaeubung: true, schaden: 0 });
    expect([...m.posten].sort()).toEqual(['Durchdringung 1: 1 SR ignoriert', 'Scharf 2: Würfel mindestens 2', 'Stumpf: Betäubungsschaden']);
  });

  it('Bedingungen: zweihändig, Rüstung des Ziels, Meisterschaft, Reittier', () => {
    const viel = waffenMerkmale('Vielseitig', K);
    expect(merkmalSchaden(viel).schaden).toBe(0);
    expect(merkmalSchaden(viel).schalter).toEqual(['zweihaendig']);
    expect(merkmalSchaden(viel, { zweihaendig: true }).schaden).toBe(3);
    const prim = waffenMerkmale('Primitiv', K);
    expect(merkmalSchaden(prim).schadenNachSR).toBe(0);
    expect(merkmalSchaden(prim, { zielRuestungOhnePrimitiv: true }).schadenNachSR).toBe(-2);
    const impro = waffenMerkmale('Improvisiert', K);
    expect(merkmalSchaden(impro)).toMatchObject({ schaden: 0, wgs: 0 });
    const ids = meisterschaftsIdsVon([{ name: 'Improvisation', skill: 'Allgemeine Nahkampfmeisterschaften' }], K);
    expect(merkmalSchaden(impro, { meisterschaftIds: ids })).toMatchObject({ schaden: 2, wgs: -2 });
    const reiter = waffenMerkmale('Reiterwaffe 2', K);
    const reiterkampf = meisterschaftsIdsVon([{ name: 'Reiterkampf', skill: 'Tierführung' }], K);
    expect(merkmalSchaden(reiter, { beritten: true }).schaden).toBe(0);
    expect(merkmalSchaden(reiter, { beritten: true, meisterschaftIds: reiterkampf }).schaden).toBe(2);
    expect(merkmalSchaden(reiter, { meisterschaftIds: reiterkampf }).schaden).toBe(0);
  });

  it('Defensiv: Hinweis zur Aktiven Abwehr', () => {
    expect(merkmalSchaden(waffenMerkmale('Defensiv 2', K)).hinweise).toEqual(['Defensiv 2: +2 EG bei erfolgreicher Aktiver Abwehr mit dieser Waffe (GRW S. 186)']);
  });

  it('Unhandlich: Verteidigung −2, nur wenn geführt, nur einmal', () => {
    expect(verteidigungDurchWaffen([{ attributes: 'Unhandlich', equipped: true }, { attributes: 'Unhandlich, Zweihändig', equipped: true }], K)).toEqual({ wert: -2, quelle: 'Unhandlich (GRW S. 186)' });
    expect(verteidigungDurchWaffen([{ attributes: 'Unhandlich', equipped: false }], K).wert).toBe(0);
  });
});

describe('Schadenswurf mit Merkmalen', () => {
  it('Scharf 2: 1W6+2 mit einer 1 richtet 4 Schaden an (Beispiel GRW S. 186)', () => {
    const r = executeAttackDamageRoll({ baseFormula: '1W6+2', egBonusDamage: 0, merkmale: merkmalSchaden(waffenMerkmale('Scharf 2', K)), zufall: wuerfel(6, 1) });
    expect(r.baseDice).toEqual([2]);
    expect(r.grossDamage).toBe(4);
  });

  it('Scharf gilt nicht für Würfel aus Manövern', () => {
    const r = executeAttackDamageRoll({ baseFormula: '1W6', maneuverExtraFormulas: ['1W6'], egBonusDamage: 0, merkmale: merkmalSchaden(waffenMerkmale('Scharf 3', K)), zufall: wuerfel(6, 1, 1) });
    expect(r.baseDice).toEqual([3]);
    expect(r.maneuverDice).toEqual([1]);
    expect(r.grossDamage).toBe(4);
  });

  it('Durchdringung zählt zur Durchdringung aus Manövern dazu', () => {
    const r = executeAttackDamageRoll({ baseFormula: '1W6+4', egBonusDamage: 0, targetArmorReduction: 4, armorPenetrationEG: 1, merkmale: merkmalSchaden(waffenMerkmale('Durchdringung 2', K)), zufall: wuerfel(6, 6) });
    expect(r.effectiveArmor).toBe(1);
    expect(r.netDamage).toBe(9);
  });

  it('Stumpf: ganzer Schaden als Betäubungsschaden', () => {
    const r = executeAttackDamageRoll({ baseFormula: '1W6', egBonusDamage: 0, merkmale: merkmalSchaden(waffenMerkmale('Stumpf', K)), zufall: wuerfel(6, 3) });
    expect(r.damageType).toBe('Betäubung');
    expect(r.breakdownText).toContain('Betäubungsschaden');
  });

  it('Primitiv: −2 nach der Schadensreduktion, nie unter 0', () => {
    const m = merkmalSchaden(waffenMerkmale('Primitiv', K), { zielRuestungOhnePrimitiv: true });
    expect(executeAttackDamageRoll({ baseFormula: '1W6+3', egBonusDamage: 0, targetArmorReduction: 2, merkmale: m, zufall: wuerfel(6, 4) }).netDamage).toBe(3);
    expect(executeAttackDamageRoll({ baseFormula: '1W6', egBonusDamage: 0, targetArmorReduction: 0, merkmale: m, zufall: wuerfel(6, 1) }).netDamage).toBe(0);
  });

  it('Zusatz je Höchstwurf: 2W10+4 mit 10 und 5 und Stufe 3 ergibt 22', () => {
    const r = executeAttackDamageRoll({ baseFormula: '2W10+4', egBonusDamage: 0, merkmale: { ...leer, jeHoechstwurf: 3 }, zufall: wuerfel(10, 10, 5) });
    expect(r.grossDamage).toBe(22);
  });

  it('Zusatzwürfel: es werden mehr Würfel geworfen, die höchsten zählen', () => {
    const r = executeAttackDamageRoll({ baseFormula: '1W6+3', egBonusDamage: 0, merkmale: { ...leer, zusatzwuerfel: 2 }, zufall: wuerfel(6, 2, 5, 3) });
    expect(r.baseDice).toEqual([5]);
    expect(r.verworfeneWuerfel).toEqual([2, 3]);
    expect(r.grossDamage).toBe(8);
  });

  it('ohne Merkmale unverändert', () => {
    const r = executeAttackDamageRoll({ baseFormula: '2W6+1', egBonusDamage: 2, zufall: wuerfel(6, 1, 6) });
    expect(r.grossDamage).toBe(10);
    expect(r.breakdownText).toBe('[1, 6] + 1 + 2 EG = 10 Brutto → 10 Netto');
  });
});

describe('Angriffsdialog', () => {
  beforeAll(() => setzeAktivenKatalog(K, false));
  afterAll(() => setzeAktivenKatalog(null, false));
  const angriff = (merkmale: string) => render(
    <CharacterContext.Provider value={{ state: DEFAULT_STATE, dispatch: () => {}, calc: { wirkungen: { liste: [], fertigkeitsBoni: {} } } as never }}>
      <AttackModal target={{ weapon: { name: 'Testwaffe', damage: '1W6+2', wgs: 8, attributes: merkmale }, skillName: 'Klingenwaffen', skillTotal: 10 }}
        splitterpunkte={0} onClose={() => {}} onSpendSplitterpunkt={() => {}} onAttackSuccess={() => {}} onAttackFailure={() => {}} />
    </CharacterContext.Provider>,
  );

  it('zeigt die Merkmale mit Wirkung und schaltet Bedingungen', () => {
    const a = angriff('Scharf 2, Vielseitig');
    expect(screen.getByTestId('merkmal-posten').textContent).toContain('Scharf 2: Würfel mindestens 2');
    expect(screen.getByTestId('merkmal-posten').textContent).not.toContain('Vielseitig');
    fireEvent.click(screen.getByTestId('merkmal-schalter-zweihaendig'));
    expect(screen.getByTestId('merkmal-posten').textContent).toContain('Vielseitig: +3 Schaden');
    a.unmount();
  });

  it('Waffe ohne Merkmale mit Spielwerten: kein Abschnitt', () => {
    angriff('Zweihändig');
    expect(screen.queryByTestId('waffenmerkmale')).toBeNull();
  });
});

describe.skipIf(!GRIMOIRE_ORDNER)('Merkmale aus den Grimoires (lokal)', () => {
  it('jedes Grimoire-Merkmal mit Text und bekannter Wirkung trägt Werte; Bände ergänzen die GRW-Merkmale', () => {
    const pakete = fs.readdirSync(GRIMOIRE_ORDNER).filter((f) => f.endsWith('.grim')).map((f) => grimoireLesen(fs.readFileSync(grimoireDatei(f.replace(/\.grim$/, '')), 'utf-8'), b.manifest));
    const KB = erstelleKatalog(b, pakete).katalog;
    const mitWerten = KB.nachTyp('merkmal').filter((e) => e.daten.merkmal_wirkung && !e.id.startsWith('grw:'));
    expect(mitWerten.length).toBeGreaterThan(0);
    // Merkmale, die es nur in den Bänden gibt: Zusatz je Höchstwurf, Zusatzwürfel, Abwehr erschwert
    for (const feld of ['je_hoechstwurf', 'zusatzwuerfel', 'aktive_abwehr_schwierigkeit_je_stufe']) {
      expect(mitWerten.some((e) => e.daten.merkmal_wirkung[feld]), feld).toBe(true);
    }
  });
});
