/**
 * PDF-Export der Begleiter (components/export/begleiterPdf.ts): je Begleiter Name, Werte, Angriffe und Kästchen für
 * Lebenspunkte je Gesundheitsstufe. Mit FOKUS_PDF_AUSGABE=<Datei> wird das Beispiel zum Ansehen gespeichert.
 */
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import autoTableModul from 'jspdf-autotable';
import { Katalog } from '../katalog';
import { basisAusDateien } from './hilfen';
import { begleiterSeiten, pdfText } from '../../components/export/begleiterPdf';
import { DEFAULT_STATE } from '../../hooks/useCharacterState';
import { calculateCharacter } from '../../utils/characterCalculations';
import type { CharacterState } from '../../types';

const b = basisAusDateien(); const K = new Katalog(b.manifest, [b.basis]);
const farben = { blau: [27, 54, 93], gold: [197, 160, 89], text: [44, 24, 16], hell: [250, 244, 230] } as const;
const autoTable = autoTableModul as unknown as (d: jsPDF, o: unknown) => void;

describe('Begleiter im PDF', () => {
  it('ohne Begleiter keine Seite', () => {
    const doc = new jsPDF();
    expect(begleiterSeiten(doc, autoTable, K, DEFAULT_STATE, null, farben as never)).toBe(0);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('je Begleiter Name, Werte, Angriff und Gesundheitsstufen', () => {
    const state: CharacterState = {
      ...DEFAULT_STATE, name: 'Test', resourcesList: [{ name: 'Kreatur', level: 3, source: 't' }],
      begleiter: [
        { id: 'grw:kreatur:wolf', art: 'tier', name: 'Wolf', rufname: 'Grauzahn', kreatur: 3, notiz: 'frisst gern Würste' },
        { id: 'grw:kreatur:pferd', art: 'tier', name: 'Pferd', rufname: 'Blitz' },
      ],
    };
    const doc = new jsPDF();
    expect(begleiterSeiten(doc, autoTable, K, state, calculateCharacter(state), farben as never)).toBe(2);
    if (process.env.FOKUS_PDF_AUSGABE) fs.writeFileSync(process.env.FOKUS_PDF_AUSGABE, Buffer.from(doc.output('arraybuffer')));
    const roh = doc.output();
    for (const t of ['BEGLEITER', 'Grauzahn', 'Blitz', 'Wolf', 'Pferd', 'Kreatur 3', 'Angeschlagen', 'Todgeweiht', 'frisst gern', 'Fokus']) {
      expect(roh, t).toMatch(new RegExp(t));
    }
    const wolf = K.get('grw:kreatur:wolf')!.daten;
    expect(roh).toContain(`(${wolf.waffen[0].schaden})`);
  });

  it('Zeichen ohne Glyphe in der Standardschrift werden ersetzt', () => {
    expect(pdfText('7−1W6 → 3')).toBe('7-1W6 -> 3');
  });
});
