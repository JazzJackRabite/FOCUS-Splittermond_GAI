import type { jsPDF } from 'jspdf';

import { calculateCharacter } from '../../utils/characterCalculations';
import type {
  CharacterState,
  DerivedStats,
  ItemEntry,
  Mastery,
  Spell,
} from '../../types';
import { grwAttribute, grwFertigkeitsKategorien, grwFertigkeitsattribute, grwRassen } from '../../regelwerk/grwListen';
import { aktiverKatalog } from '../../regelwerk/bruecke';
import { begleiterSeiten } from './begleiterPdf';

interface GroupedItem<T> {
  skill: string;
  items: T[];
}

export interface GeneratePdfOptions {
  state: CharacterState;
  derived: DerivedStats;
  heldengrad: { name: string };
  splinterPoints: number;
  xpSpent: number;
  currentAttributes: Record<string, number>;
  groupedMasteries: Array<GroupedItem<Mastery>>;
  groupedSpells: Array<GroupedItem<Spell>>;
  getAttrValue: (key: string) => number;
}

const colBlue: [number, number, number] = [27, 54, 93];
const colGold: [number, number, number] = [197, 160, 89];
const colText: [number, number, number] = [44, 24, 16];
const colLight: [number, number, number] = [250, 244, 230];

export async function generatePdfForState(state: CharacterState): Promise<void> {
  const calc = calculateCharacter(state);
  await generatePDF({
    state,
    derived: calc.derived,
    heldengrad: calc.heldengrad,
    splinterPoints: calc.splinterPoints,
    xpSpent: calc.xpSpent,
    currentAttributes: calc.currentAttributes,
    groupedMasteries: calc.groupedMasteries,
    groupedSpells: calc.groupedSpells,
    getAttrValue: calc.getAttrValue,
  });
}

export async function generatePDF(opts: GeneratePdfOptions): Promise<void> {
  const [{ default: jsPDFClass }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = (autoTableModule.default || autoTableModule) as unknown as (d: jsPDF, options: unknown) => void;

  const {
    state,
    derived,
    heldengrad,
    splinterPoints,
    xpSpent,
    currentAttributes,
    groupedMasteries,
    groupedSpells,
    getAttrValue,
  } = opts;
  const {
    name,
    race,
    moonSign,
    homeRegion,
    xpTotal,
    attrBase,
    raceBonusAttrs,
    attrIncrements,
    skillsBase,
    skillsXp,
    strengthsList,
    weaknessesList,
    resourcesList,
    languagesList,
  } = state;

  const doc = new jsPDFClass();
  let y = 20;

  // Title Section
  doc.setFillColor(colBlue[0], colBlue[1], colBlue[2]);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text('SPLITTERMOND', 105, 22, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(colGold[0], colGold[1], colGold[2]);
  doc.text('CHARAKTERDOKUMENT', 105, 29, { align: 'center' });
  doc.setDrawColor(colGold[0], colGold[1], colGold[2]);
  doc.setLineWidth(2);
  doc.line(0, 35, 210, 35);

  // General Info
  y = 45;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(colText[0], colText[1], colText[2]);

  const generalInfo = [
    ['Name', name, 'Rasse', race],
    ['Heldengrad', heldengrad.name, 'Splitterpunkte', String(splinterPoints)],
    ['Mondzeichen', moonSign || '-', 'Region', homeRegion || '-'],
    ['Erfahrung (Gesamt)', String(xpTotal), 'Erfahrung (Investiert)', String(xpSpent)],
  ];

  autoTable(doc, {
    startY: y,
    body: generalInfo,
    theme: 'plain',
    styles: { font: 'times', fontSize: 10, cellPadding: 2, textColor: colText },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 50 },
      2: { fontStyle: 'bold', cellWidth: 35 },
      3: { cellWidth: 'wrap' },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 8;

  // Attributes
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(colBlue[0], colBlue[1], colBlue[2]);
  doc.text('ATTRIBUTE', 14, y);

  const raceData = grwRassen()[race as keyof ReturnType<typeof grwRassen>] as {
    mods: Record<string, number>;
  };
  const attrBody = Object.keys(grwAttribute()).map((k) => {
    const base = attrBase[k as keyof typeof attrBase] ?? 0;
    const raceMod = (raceData?.mods?.[k] ?? 0) as number;
    const bonus = raceBonusAttrs.includes(k) ? 1 : 0;
    const startVal = base + raceMod + bonus;
    return [grwAttribute()[k as keyof ReturnType<typeof grwAttribute>], k, startVal, getAttrValue(k)];
  });

  autoTable(doc, {
    startY: y + 3,
    head: [['Attribut', 'Kürzel', 'Start', 'Wert']],
    body: attrBody,
    theme: 'grid',
    headStyles: { fillColor: colBlue, textColor: 255, font: 'times', fontStyle: 'bold' },
    bodyStyles: { font: 'times', textColor: colText, halign: 'center' },
    columnStyles: { 0: { halign: 'left' } },
    margin: { left: 14 },
    tableWidth: 85,
  });

  doc.text('ABGELEITETE WERTE', 110, y);
  const derivedBody = [
    ['Lebenspunkte (LP)', derived.LP],
    ['Fokus (FO)', derived.FO],
    ['Geschwindigkeit (GSW)', derived.GSW],
    ['Initiative (INI)', derived.INI],
    ['Verteidigung (VTD)', derived.VTD],
    ['Schadensreduktion (SR)', derived.SR],
    ['Geistiger Widerstand (GW)', derived.GW],
    ['Körperlicher Widerstand (KW)', derived.KW],
  ];

  autoTable(doc, {
    startY: y + 3,
    head: [['Wert', 'Gesamt']],
    body: derivedBody,
    theme: 'grid',
    headStyles: { fillColor: colGold, textColor: colText, font: 'times', fontStyle: 'bold' },
    bodyStyles: { font: 'times', textColor: colText, halign: 'center', fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'normal' } },
    margin: { left: 110 },
    tableWidth: 85,
  });

  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Skills
  const skillCats = [
    { key: 'GENERAL', label: 'ALLGEMEINE FERTIGKEITEN' },
    { key: 'COMBAT', label: 'KAMPFFERTIGKEITEN' },
    { key: 'MAGIC', label: 'MAGIESCHULEN' },
  ];

  for (const cat of skillCats) {
    const catSkills = grwFertigkeitsKategorien()[cat.key as keyof ReturnType<typeof grwFertigkeitsKategorien>] as string[];
    const skillsInCat = catSkills.map((s) => {
      const val = (Number(skillsBase[s]) || 0) + (Number(skillsXp[s]) || 0);
      const attrKeys = grwFertigkeitsattribute()[s];
      const total = attrKeys
        ? val + Number(currentAttributes[attrKeys[0]]) + Number(currentAttributes[attrKeys[1]])
        : val;
      return { name: s, val, total };
    });

    if (skillsInCat.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(colBlue[0], colBlue[1], colBlue[2]);
      doc.text(cat.label, 14, y);
      y += 2;

      const rows = [];
      for (let i = 0; i < skillsInCat.length; i += 2) {
        const s1 = skillsInCat[i];
        const s2 = skillsInCat[i + 1];
        rows.push([
          s1.name,
          s1.val === 0 ? '' : s1.val,
          s1.total,
          s2 ? s2.name : '',
          s2 && s2.val !== 0 ? s2.val : '',
          s2 ? s2.total : '',
        ]);
      }

      autoTable(doc, {
        startY: y,
        head: [['Fertigkeit', 'Pkt', 'Wert', 'Fertigkeit', 'Pkt', 'Wert']],
        body: rows,
        theme: 'grid',
        headStyles: {
          fillColor: colBlue,
          textColor: 255,
          font: 'times',
          fontSize: 9,
          halign: 'center',
        },
        bodyStyles: {
          font: 'times',
          textColor: colText,
          fontSize: 9,
          halign: 'center',
          cellPadding: 1.5,
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 },
          1: { cellWidth: 12 },
          2: { cellWidth: 14, fontStyle: 'bold' },
          3: { halign: 'left', fontStyle: 'bold', cellWidth: 45 },
          4: { cellWidth: 12 },
          5: { cellWidth: 14, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
        styles: { overflow: 'linebreak' },
        tableWidth: 142,
      });

      y =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
        8;
    }
  }

  // S/W/R/Languages
  if (y > 220) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(colBlue[0], colBlue[1], colBlue[2]);
  doc.text('STÄRKEN, SCHWÄCHEN & RESSOURCEN', 14, y);

  const swBody: Array<(string | number)[]> = [];
  const maxRows = Math.max(
    strengthsList.length,
    weaknessesList.length,
    resourcesList.length,
    languagesList.length,
  );
  for (let i = 0; i < maxRows; i++) {
    const sItem = strengthsList[i] as ItemEntry | undefined;
    const s = sItem ? (sItem.level > 1 ? `${sItem.name} (${sItem.level})` : sItem.name) : '';
    const w = (weaknessesList[i] as ItemEntry | undefined)?.name ?? '';
    const r = (resourcesList[i] as ItemEntry | undefined)
      ? `${resourcesList[i].name} (${resourcesList[i].level})`
      : '';
    const l = (languagesList[i] as ItemEntry | undefined)?.name ?? '';
    swBody.push([s, w, r, l]);
  }

  if (swBody.length > 0) {
    autoTable(doc, {
      startY: y + 3,
      head: [['Stärken', 'Schwächen', 'Ressourcen', 'Sprachen']],
      body: swBody,
      theme: 'grid',
      headStyles: { fillColor: colGold, textColor: colText, font: 'times' },
      bodyStyles: { font: 'times', textColor: colText, fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 45, overflow: 'linebreak' },
        1: { cellWidth: 45, overflow: 'linebreak' },
        2: { cellWidth: 45, overflow: 'linebreak' },
        3: { cellWidth: 45, overflow: 'linebreak' },
      },
      margin: { left: 14, right: 14 },
      tableWidth: 180,
    });
    y =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
      10;
  }

  // Masteries
  if (groupedMasteries.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(colBlue[0], colBlue[1], colBlue[2]);
    doc.text('MEISTERSCHAFTEN', 14, y);
    y += 5;

    groupedMasteries.forEach((group) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(colLight[0], colLight[1], colLight[2]);
      doc.setDrawColor(colGold[0], colGold[1], colGold[2]);
      doc.rect(14, y, 182, 6, 'F');
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(colBlue[0], colBlue[1], colBlue[2]);
      doc.text(group.skill, 16, y + 4.5);
      y += 6;

      const rows = group.items.map((m) => {
        const showTier = !/\(S\d+\)/.test(m.name);
        const mName = showTier ? `${m.name} (S${m.tier})` : m.name;
        const ref = m.source + (m.page ? ` S. ${m.page}` : '');
        return [mName, ref];
      });

      autoTable(doc, {
        startY: y,
        body: rows,
        theme: 'plain',
        styles: { font: 'times', fontSize: 10, cellPadding: 1.5, textColor: colText },
        columnStyles: { 0: { cellWidth: 110, fontStyle: 'bold' }, 1: { cellWidth: 40 } },
        margin: { left: 14, right: 14 },
        tableWidth: 150,
      });
      y =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
        2;
    });
    y += 5;
  }

  // Spells
  if (groupedSpells.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(colBlue[0], colBlue[1], colBlue[2]);
    doc.text('ZAUBER', 14, y);
    y += 5;

    groupedSpells.forEach((group) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(colLight[0], colLight[1], colLight[2]);
      doc.setDrawColor(colGold[0], colGold[1], colGold[2]);
      doc.rect(14, y, 182, 6, 'F');
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(colBlue[0], colBlue[1], colBlue[2]);
      doc.text(group.skill, 16, y + 4.5);
      y += 6;

      const rows = group.items.map((s) => {
        const ref = (s.source ?? '') + (s.page ? ` S. ${s.page}` : '');
        return [`${s.name} (Grad ${s.grade})`, ref];
      });

      autoTable(doc, {
        startY: y,
        body: rows,
        theme: 'plain',
        styles: { font: 'times', fontSize: 10, cellPadding: 1.5, textColor: colText },
        columnStyles: { 0: { cellWidth: 110, fontStyle: 'bold' }, 1: { cellWidth: 40 } },
        margin: { left: 14, right: 14 },
        tableWidth: 150,
      });
      y =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY +
        2;
    });
  }

  // Begleiter: je Begleiter ein Wertekasten mit Kästchen für LP und Fokus (braucht die geladenen Pakete)
  const katalog = aktiverKatalog();
  if (katalog) begleiterSeiten(doc, autoTable, katalog, state, calculateCharacter(state), { blau: colBlue, gold: colGold, text: colText, hell: colLight });

  doc.save(`${name}_charakter.pdf`);
}
