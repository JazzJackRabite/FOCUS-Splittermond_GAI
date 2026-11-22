/** Zustände wirken auf abgeleitete Werte und Fokus – Zahlen aus den Paketeinträgen (daten.zustandswirkung). */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { Katalog } from '../katalog';
import { erstelleKatalog, grimoireLesen } from '../laden';
import { basisAusDateien, buchfaelle, grimoireDatei } from './hilfen';
import { fokusDurchZustaende, mitZustaenden, textMitZustaenden, zustandswerte } from '../zustandswerte';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Werte } from '../../components/begleiter/Wertekasten';
import { setzeAktivenKatalog } from '../bruecke';
import { getConditionMalus } from '../../utils/conditionModifiers';
import type { StatusCondition } from '../../types';

const basis = basisAusDateien();
const K = new Katalog(basis.manifest, [basis.basis]);
const z = (key: string, level?: number): StatusCondition => ({ id: key, key, ...(level ? { level } : {}) });

describe('Zustände und abgeleitete Werte (GRW S. 168–169)', () => {
  it('Erschöpft 2: Geschwindigkeit −2, Initiative +2', () => {
    const zw = zustandswerte([z('Erschöpft', 2)], K);
    expect(mitZustaenden('GSW', 8, zw)).toBe(6);
    expect(mitZustaenden('INI', 7, zw)).toBe(9);
    expect(mitZustaenden('VTD', 20, zw)).toBe(20);
  });

  it('Ringend: Verteidigung −3, Geschwindigkeit 0', () => {
    const zw = zustandswerte([z('Ringend')], K);
    expect(mitZustaenden('VTD', 20, zw)).toBe(17);
    expect(mitZustaenden('GSW', 8, zw)).toBe(0);
  });

  it('Lahm: halbe Geschwindigkeit (abgerundet), nach Zu- und Abschlägen', () => {
    expect(mitZustaenden('GSW', 9, zustandswerte([z('Lahm')], K))).toBe(4);
    expect(mitZustaenden('GSW', 9, zustandswerte([z('Lahm'), z('Erschöpft', 1)], K))).toBe(4);
  });

  it('Bewusstlos und Schlafend gelten als liegend; Liegend selbst ebenso – als Hinweis, ohne Wertänderung', () => {
    for (const k of ['Bewusstlos', 'Schlafend', 'Liegend']) {
      const zw = zustandswerte([z(k)], K);
      expect(zw.hinweise[0], k).toMatch(/gilt als liegend.*\+6.*−6/);
      expect(mitZustaenden('VTD', 20, zw)).toBe(20);
    }
  });

  it('ohne Paket keine Abzüge', () => {
    expect(mitZustaenden('GSW', 8, zustandswerte([z('Erschöpft', 2)], null))).toBe(8);
  });

  it('Geblendet: bei Angriffen und Zaubern gesetzt, bei Fertigkeitsproben nicht vorausgewählt', () => {
    expect(getConditionMalus(z('Geblendet', 1), { bereich: 'kampf' })?.vorausgewaehlt).toBe(true);
    expect(getConditionMalus(z('Geblendet', 1), { bereich: 'magie' })?.vorausgewaehlt).toBe(true);
    expect(getConditionMalus(z('Geblendet', 1), { bereich: 'allgemein' })?.vorausgewaehlt).toBe(false);
  });

  // Fälle aus den Grimoires stehen in der lokalen Falldatei (hilfen.ts: buchfaelle)
  const F = buchfaelle<{ grimoires: string[]; kombination: { zustaende: [string, number][]; werte: [string, number, number][] }; fokus: [string, number, number, number][] }>('zustandswerte', ['schleier', 'jenseits', 'goetter']);
  it.skipIf(!F)('Zustände aus Grimoires auf Werte und Fokus (lokal)', () => {
    const { katalog: k } = erstelleKatalog(basis, F!.grimoires.map((g) => grimoireLesen(fs.readFileSync(grimoireDatei(g), 'utf-8'), basis.manifest)));
    const zw = zustandswerte(F!.kombination.zustaende.map(([n, l]) => z(n, l || undefined)), k);
    for (const [wert, grund, soll] of F!.kombination.werte) expect(mitZustaenden(wert as never, grund, zw), wert).toBe(soll);
    for (const [n, l, grund, soll] of F!.fokus) expect(fokusDurchZustaende(grund, zustandswerte([z(n, l)], k)), `${n} ${l}`).toBe(soll);
  });
});

describe('Begleiter: Zustände im Wertekasten eingerechnet', () => {
  it('Text mit führender Zahl wird umgerechnet, der Rest bleibt', () => {
    const zw = zustandswerte([z('Erschöpft', 2)], K);
    expect(textMitZustaenden('INI', '7–1W6', zw)).toEqual({ text: '9–1W6', basis: '7–1W6', geaendert: true });
    expect(textMitZustaenden('GSW', '8', zw).text).toBe('6');
    expect(textMitZustaenden('VTD', '20', zw)).toEqual({ text: '20', basis: '20', geaendert: false });
    expect(textMitZustaenden('GSW', '–', zw).geaendert).toBe(false);
  });

  it('Wertekasten zeigt die Werte nach Zuständen, Grundwert in Klammern', () => {
    setzeAktivenKatalog(K);
    const w = { attribute: { BEW: 3 }, abgeleitete_werte: { GSW: '8', VTD: '20', GW: '18', KW: '19', SR: '1' }, waffen: [{ name: 'Biss', wert: '12', schaden: '1W6', wgs: '7', ini: '7', merkmale: '' }] };
    render(React.createElement(Werte, { w: w as never, zustaende: [z('Erschöpft', 2), z('Ringend')] }));
    expect(screen.getByTestId('zustand-wert-GSW').textContent).toBe('0(8)');
    expect(screen.getByTestId('zustand-wert-VTD').textContent).toBe('17(20)');
    expect(screen.getByTestId('zustand-wert-INI').textContent).toBe('9(7)');
    expect(screen.getByTestId('zustand-wert-VTD').getAttribute('title')).toContain('Ringend: −3');
    setzeAktivenKatalog(null);
  });
});
