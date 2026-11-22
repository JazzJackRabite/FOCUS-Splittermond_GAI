/**
 * Begleiter im PDF: je Begleiter ein Wertekasten wie im Blatt des Tabs „Begleiter“ (Werte, Attribute, Angriffe,
 * Fertigkeiten, Fähigkeiten, Angaben der Art wie Abrichtungen oder Vertrautenmagie, Zauber, Notiz) und Kästchen für
 * Lebenspunkte je Gesundheitsstufe und Fokus zum Abhaken. Werte und Gesundheitsstufen kommen aus `begleiterAnsicht`
 * bzw. `regelwerk/vitals.ts`, also aus den geladenen Paketen.
 */
import type { jsPDF } from 'jspdf';
import type { CharacterState } from '../../types';
import type { Katalog } from '../../regelwerk/katalog';
import { gesundheitsstufen } from '../../regelwerk/vitals';
import { begleiterAnsicht, artInfo, type Ansicht } from '../begleiter/ansicht';
import { besitzerBerechnen } from '../begleiter/besitzer';
import { spielDaten } from '../begleiter/BegleiterSpiel';

type AutoTable = (d: jsPDF, options: unknown) => void;
type Farbe = [number, number, number];
export interface PdfFarben { blau: Farbe; gold: Farbe; text: Farbe; hell: Farbe }

const ATTRIBUTE = ['AUS', 'BEW', 'INT', 'KON', 'MYS', 'STÄ', 'VER', 'WIL'];
const ABGELEITET = ['GK', 'GSW', 'LP', 'FO', 'VTD', 'SR', 'KW', 'GW'];

/** Zeichen, die die Standardschrift des PDF nicht kennt, durch gleichbedeutende ersetzen */
export function pdfText(s: unknown): string {
  return String(s ?? '').replace(/[−‒]/g, '-').replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[  ]/g, ' ');
}

const endY = (doc: jsPDF) => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

/** Begleiter-Seiten anhängen; gibt die Zahl der Begleiter zurück */
export function begleiterSeiten(doc: jsPDF, autoTable: AutoTable, k: Katalog, state: CharacterState,
  calc: Parameters<typeof besitzerBerechnen>[2], f: PdfFarben): number {
  const alle = state.begleiter ?? [];
  if (!alle.length) return 0;
  const besitzer = besitzerBerechnen(k, state, calc);
  doc.addPage();
  let y = 20;
  const titel = (t: string, yy: number) => {
    doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(...f.blau); doc.text(pdfText(t), 14, yy);
  };
  titel('BEGLEITER', y);
  y += 6;

  alle.forEach((b, nr) => {
    const a: Ansicht = begleiterAnsicht(k, b, besitzer);
    const w = a.w;
    if (nr > 0 && y > 200) { doc.addPage(); y = 20; }

    // Kopf: Name, Art, Kurzangaben
    doc.setFillColor(...f.hell); doc.rect(14, y, 182, 9, 'F');
    doc.setDrawColor(...f.gold); doc.setLineWidth(0.6); doc.line(14, y + 9, 196, y + 9);
    doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(...f.blau);
    doc.text(pdfText(a.titel), 16, y + 6.2);
    doc.setFont('times', 'normal'); doc.setFontSize(9); doc.setTextColor(...f.text);
    doc.text(pdfText([b.vertrauter ? 'Vertrauter' : artInfo(b.art).name, ...a.kurz.map(x => x.text).filter(x => x !== 'Vertrauter')].join(' · ')), 194, y + 6.2, { align: 'right' });
    y += 11;

    if (!w) {
      doc.text(pdfText(a.fehlt ? 'Nicht im Katalog (Grimoire beim Export nicht geladen).' : 'Keine Werte in den Paketen.'), 16, y + 4);
      y += 10;
      return;
    }

    // Werte und Attribute
    autoTable(doc, {
      startY: y,
      head: [ABGELEITET.map(pdfText)],
      body: [ABGELEITET.map(x => pdfText(w.abgeleitete_werte?.[x] ?? '-'))],
      theme: 'grid',
      headStyles: { fillColor: f.gold, textColor: f.text, font: 'times', fontStyle: 'bold', halign: 'center', fontSize: 9 },
      bodyStyles: { font: 'times', textColor: f.text, halign: 'center', fontStyle: 'bold', fontSize: 10 },
      margin: { left: 14 }, tableWidth: 89,
    });
    autoTable(doc, {
      startY: y,
      head: [ATTRIBUTE.map(pdfText)],
      body: [ATTRIBUTE.map(x => pdfText(w.attribute?.[x] ?? '-'))],
      theme: 'grid',
      headStyles: { fillColor: f.blau, textColor: 255, font: 'times', fontStyle: 'bold', halign: 'center', fontSize: 9 },
      bodyStyles: { font: 'times', textColor: f.text, halign: 'center', fontSize: 10 },
      margin: { left: 107 }, tableWidth: 89,
    });
    y = endY(doc) + 3;

    // Angriffe
    if (w.waffen?.length) {
      autoTable(doc, {
        startY: y,
        head: [['Angriff', 'Wert', 'Schaden', 'WGS', 'INI', 'Merkmale']],
        body: w.waffen.map(x => [x.name, x.wert, x.schaden, x.wgs, x.ini ?? '', x.merkmale ?? ''].map(pdfText)),
        theme: 'grid',
        headStyles: { fillColor: f.blau, textColor: 255, font: 'times', fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { font: 'times', textColor: f.text, fontSize: 9 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 }, 1: { halign: 'center', cellWidth: 14 }, 2: { halign: 'center', cellWidth: 22 }, 3: { halign: 'center', cellWidth: 14 }, 4: { halign: 'center', cellWidth: 20 } },
        margin: { left: 14, right: 14 },
      });
      y = endY(doc) + 3;
    }

    // Fertigkeiten, Fähigkeiten, Angaben der Art, Zauber, Notiz
    const zeilen: [string, string][] = [];
    if (a.fertigkeiten.length) zeilen.push(['Fertigkeiten', a.fertigkeiten.map(x => x.wert !== null ? `${x.name} ${x.wert}` : x.name).join(', ')]);
    if (w.felder?.typus) zeilen.push(['Typus', w.felder.typus]);
    if (w.felder?.merkmale) zeilen.push(['Merkmale', w.felder.merkmale]);
    if (b.art !== 'gefolge' && w.felder?.meisterschaften) zeilen.push(['Meisterschaften', w.felder.meisterschaften]);
    for (const g of a.angaben) {
      const t = g.eintraege.map(e => [e.name, e.zusatz ? `(${e.zusatz})` : ''].filter(Boolean).join(' ')).join(', ');
      if (t || g.leer) zeilen.push([g.titel, t || g.leer || '']);
    }
    if (a.zauber.length) zeilen.push(['Zauber', a.zauber.map(z => `${z.name}${z.info ? ` (${z.info})` : ''}`).join(', ')]);
    for (const t of a.text) zeilen.push(['', t]);
    if (b.notiz) zeilen.push(['Notiz', b.notiz]);
    if (zeilen.length) {
      autoTable(doc, {
        startY: y,
        body: zeilen.map(([t, x]) => [pdfText(t), pdfText(x)]),
        theme: 'plain',
        styles: { font: 'times', fontSize: 9, cellPadding: 1.2, textColor: f.text },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 } },
        margin: { left: 14, right: 14 },
      });
      y = endY(doc) + 2;
    }

    // Kästchen: Lebenspunkte je Gesundheitsstufe, Fokus
    const sd = spielDaten(b, w);
    const stufen = gesundheitsstufen(k, sd.merkmale).stufen;
    const kasten = 3.6;
    const reihe = (text: string, n: number) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.setFont('times', 'normal'); doc.setFontSize(8); doc.setTextColor(...f.text);
      doc.text(pdfText(text), 16, y + 2.8);
      doc.setDrawColor(...f.text); doc.setLineWidth(0.2);
      const proZeile = Math.floor((196 - 60) / (kasten + 0.8));
      for (let i = 0; i < n; i++) {
        const zx = 60 + (i % proZeile) * (kasten + 0.8);
        const zy = y + Math.floor(i / proZeile) * (kasten + 0.8);
        doc.rect(zx, zy, kasten, kasten);
      }
      y += Math.max(1, Math.ceil(n / proZeile)) * (kasten + 0.8) + 0.8;
    };
    if (sd.lp > 0) for (const s of stufen) reihe(`${s.name}${s.wundabzug ? ` (${s.wundabzug})` : ''}`, sd.lp);
    if (sd.fo > 0) reihe('Fokus', sd.fo);
    y += 5;
  });
  return alle.length;
}
