import fs from 'fs';
import path from 'path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegelwerkProvider, useRegelwerk } from '../RegelwerkContext';
import { RegelpaketeTab } from '../../components/common/RegelpaketeTab';
import { PUBLIC } from './hilfen';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const abruf = (async (url: string) => {
  const datei = path.join(PUBLIC, String(url).split('/').pop()!);
  const buf = fs.readFileSync(datei);
  return { ok: true, status: 200, text: async () => buf.toString('utf-8'), json: async () => JSON.parse(buf.toString('utf-8')), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
}) as unknown as typeof fetch;

const TESTBUCH = {
  format: 'splittermond-regelpaket', format_version: '1.0', erzeugt: '2026-11-05', abhaengigkeiten: [],
  paket: { id: 'testbuch', titel: 'Testbuch der Prüfung', kuerzel: 'T' }, statistik: { eintraege: 1 },
  eintraege: [{ id: 'testbuch:staerke:neu', typ: 'staerke', aktion: 'neu', name: 'Neu', quelle: { paket: 'testbuch' }, daten: { stufe: 1 } }],
  ladeinfo: { format: 'splittermond-editor-ladeinfo', format_version: '1.0', ladereihenfolge: 99, abhaengigkeiten: ['grw'], optionale_pakete: [],
    regelgruppen: {}, umbenannt: {}, begleiter: {}, original: { datei: 'x', sha256: 'x', bytes: 0, eintraege: 1 } },
};

const Zaehler: React.FC = () => {
  const rw = useRegelwerk();
  return <span data-testid="anzahl">{rw.katalog ? Object.keys(rw.katalog.eintraege).length : 0}</span>;
};

// Einträge des eingebauten GRW-Pakets (ändert sich mit jedem Paketbau)
const GRW_ANZAHL = (JSON.parse(fs.readFileSync(path.join(PUBLIC, 'grw.srp.json'), 'utf-8')) as { eintraege: unknown[] }).eintraege.length;

describe('Paketverwaltung', () => {
  it('lädt das Grundregelwerk, nimmt ein Buch auf und entfernt es wieder', async () => {
    vi.stubGlobal('fetch', abruf);
    render(<RegelwerkProvider basisUrl="/regelpakete/"><RegelpaketeTab /><Zaehler /></RegelwerkProvider>);
    await waitFor(() => expect(screen.getByText('Splittermond: Die Regeln (3. erratierte Neuauflage)')).toBeTruthy());
    const vorher = Number(screen.getByTestId('anzahl').textContent);
    expect(vorher).toBe(GRW_ANZAHL);
    const datei = new File([JSON.stringify(TESTBUCH)], 'testbuch.grim', { type: 'application/json' });
    await act(async () => { fireEvent.change(screen.getByTestId('regelpakete-upload'), { target: { files: [datei] } }); });
    await waitFor(() => expect(screen.getByText('Testbuch der Prüfung')).toBeTruthy());
    expect(Number(screen.getByTestId('anzahl').textContent)).toBe(vorher + 1);
    await act(async () => { fireEvent.click(screen.getByLabelText('Testbuch der Prüfung entfernen')); });
    await waitFor(() => expect(screen.queryByText('Testbuch der Prüfung')).toBeNull());
    expect(Number(screen.getByTestId('anzahl').textContent)).toBe(vorher);
    vi.unstubAllGlobals();
  });
});
