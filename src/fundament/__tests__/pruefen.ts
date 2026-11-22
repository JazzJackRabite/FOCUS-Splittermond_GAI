/**
 * Messungen für die Fundament-Prüfungen: fest eingetragene Farbwerte und Regelnamen im Programmcode.
 * Wird vom Test (fundament.test.tsx) und zum Fortschreiben der Altlastenliste benutzt.
 */
import fs from 'node:fs';
import path from 'node:path';

export const WURZEL = path.resolve(__dirname, '../../..');
const SRC = path.join(WURZEL, 'src');

function dateien(ordner: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'testdaten') dateien(p, out); }
    else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(WURZEL, p).split(path.sep).join('/');

/** Die einzige Datei, in der Farbwerte stehen dürfen */
export const FARBEN_ERLAUBT = 'src/fundament/fundament.css';

/** Anzahl fest eingetragener Farbwerte (#RGB, #RRGGBB, rgb(), rgba(), hsl()) je Datei */
export function farbwerte(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of dateien(SRC)) {
    const r = rel(p);
    if (r === FARBEN_ERLAUBT) continue;
    const n = (fs.readFileSync(p, 'utf8').match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g) ?? []).length;
    if (n) out[r] = n;
  }
  return out;
}

/** Schaltflächen, die eine Ansicht selbst baut (`<button`) statt mit Knopf oder Wahlknopf, je Datei */
export function eigeneKnoepfe(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of dateien(SRC)) {
    const r = rel(p);
    if (!r.endsWith('.tsx') || r.startsWith('src/fundament/')) continue;
    const n = (fs.readFileSync(p, 'utf8').match(/<button\b/g) ?? []).length;
    if (n) out[r] = n;
  }
  return out;
}

/** Ordner mit Programmcode, in dem keine Regelnamen stehen sollen (src/data sind die eingebauten Listen – eigene Altlast) */
const CODE = ['components', 'context', 'features', 'hooks', 'regelwerk', 'utils', 'fundament'];
const REGELTYPEN = new Set(['zauber', 'meisterschaft', 'staerke']);

/**
 * Zauber-, Meisterschafts- und Stärkennamen des Grundregelwerks, die als Zeichenkette im Programmcode stehen
 * („Datei: Name“). So fällt auf, wenn eine Regel an einem Namen im Code hängt statt an den Daten der Regelpakete.
 */
export function regelnamenImCode(): string[] {
  const paket = JSON.parse(fs.readFileSync(path.join(WURZEL, 'public/regelpakete/grw.srp.json'), 'utf8'));
  const namen = new Set<string>();
  for (const e of paket.eintraege) if (REGELTYPEN.has(e.typ) && e.name.length >= 6) namen.add(e.name.toLowerCase());
  const out = new Set<string>();
  for (const ordner of CODE) {
    const o = path.join(SRC, ordner);
    if (!fs.existsSync(o)) continue;
    for (const p of dateien(o)) {
      if (p.endsWith('.css')) continue;
      const text = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      for (const m of text.matchAll(/'([^'\n]{6,60})'|"([^"\n]{6,60})"|`([^`\n$]{6,60})`/g)) {
        const s = (m[1] ?? m[2] ?? m[3]).trim().toLowerCase();
        if (namen.has(s)) out.add(`${rel(p)}: ${s}`);
      }
    }
  }
  return [...out].sort();
}

/**
 * Suchmuster, die Regeltext lesen (Grundsatz 3): Regex-Literale und Textvergleiche (includes, startsWith, endsWith,
 * indexOf, new RegExp) mit einer Wortfolge aus drei oder mehr Wörtern, sowie Suchmuster mit dem Namen einer Regel
 * (Zauber, Meisterschaft, Stärke, Ressource des GRW). Regeltext liest die Datenseite und schreibt Felder.
 */
export function suchmuster(): string[] {
  const paket = JSON.parse(fs.readFileSync(path.join(WURZEL, 'public/regelpakete/grw.srp.json'), 'utf8'));
  const namen = new Set<string>();
  for (const e of paket.eintraege) if ((REGELTYPEN.has(e.typ) || e.typ === 'ressource') && e.name.length >= 6 && !/\s/.test(e.name)) namen.add(e.name.toLowerCase());
  const wortfolge = /[A-Za-zÄÖÜäöüß]{2,}(?: [A-Za-zÄÖÜäöüß]{2,}){2,}/;
  const ohneSyntax = (r: string) => r.replace(/\\s[+*?]?/g, ' ').replace(/\(\?:|\)\??|\[[^\]]*\][+*?]?|\\[bdwB]|[\^$]/g, '').replace(/\|/g, '  ');
  const out = new Set<string>();
  for (const ordner of CODE) {
    const o = path.join(SRC, ordner);
    if (!fs.existsSync(o)) continue;
    for (const p of dateien(o)) {
      if (p.endsWith('.css')) continue;
      const text = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, '$1');
      const muster: string[] = [];
      for (const m of text.matchAll(/(?<=[(=,:?!&|]\s*|return\s+)\/((?:\\\/|\[[^\]\n]*\]|[^/\n[])+)\/[gimsuy]*/g)) muster.push(m[1]);
      for (const m of text.matchAll(/(?:new RegExp|\.includes|\.startsWith|\.endsWith|\.indexOf)\(\s*'([^'\n]+)'/g)) muster.push(m[1]);
      for (const r of muster) {
        const klar = ohneSyntax(r);
        const w = klar.match(wortfolge);
        if (w) { out.add(`${rel(p)}: ${w[0]}`); continue; }
        const n = [...namen].find((x) => new RegExp(`(^|[^a-zäöüß:])${x}([^a-zäöüß]|$)`).test(klar.toLowerCase()));
        if (n) out.add(`${rel(p)}: ${n}`);
      }
    }
  }
  return [...out].sort();
}

/** Dialoge, die ein Dialogfenster bauen, aber keinen Dialogkopf (Titelzeile mit Schließen-Knopf) verwenden */
export function dialogeOhneKopf(): string[] {
  const out: string[] = [];
  for (const p of dateien(path.join(SRC, 'components'))) {
    if (!p.endsWith('.tsx')) continue;
    const t = fs.readFileSync(p, 'utf8');
    if (t.includes('<Dialogfenster') && !t.includes('<Dialogkopf') && !/<Dialog[\s>]/.test(t)) out.push(rel(p));
  }
  return out.sort();
}

/** Zeilen der Tabelle „Regelquellen“ aus FUNDAMENT.md: Felder (Spalte 2) und Dateien (Spalte 3) */
export function regelquellen(): { bereich: string; felder: string[]; dateien: string[] }[] {
  const md = fs.readFileSync(path.join(WURZEL, 'FUNDAMENT.md'), 'utf8');
  const teil = md.slice(md.indexOf('## 2. Regelquellen'), md.indexOf('### Regeln, die noch im Code stehen'));
  const marken = (s: string) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  return teil.split('\n').filter((z) => z.startsWith('| ') && !z.startsWith('| Bereich') && !z.startsWith('|---'))
    .map((z) => z.split('|').map((s) => s.trim()))
    .map(([, bereich, quelle, liest]) => ({ bereich, felder: marken(quelle).filter((f) => /^[a-z_]+$/.test(f)), dateien: marken(liest).map((d) => `src/${d}`) }));
}

/** Befunde, wenn die Tabelle nicht zum Code passt: Datei fehlt oder Feld wird in keiner der genannten Dateien gelesen */
export function regelquellenBefunde(): string[] {
  const out: string[] = [];
  for (const z of regelquellen()) {
    const texte = z.dateien.map((d) => {
      const p = path.join(WURZEL, d);
      if (!fs.existsSync(p)) { out.push(`${z.bereich}: Datei ${d} gibt es nicht`); return ''; }
      return fs.readFileSync(p, 'utf8');
    });
    for (const f of z.felder) {
      if (['id', 'typ', 'name'].includes(f)) continue;
      if (!texte.some((t) => new RegExp(`\\b${f}\\b`).test(t))) out.push(`${z.bereich}: Feld ${f} wird in ${z.dateien.join(', ')} nicht gelesen`);
    }
  }
  return out;
}

/** Dateien außerhalb der Tabelle „Regelquellen“, die selbst in die Paketdaten greifen (…daten.feld) */
export function paketzugriffe(): string[] {
  const erlaubt = new Set(regelquellen().flatMap((z) => z.dateien));
  const out: string[] = [];
  for (const p of dateien(SRC)) {
    const r = rel(p);
    if (p.endsWith('.css') || erlaubt.has(r) || r.startsWith('src/data/') || r === 'src/regelwerk/typen.ts') continue;
    if (/\bdaten\??\.[a-z_]+/.test(fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''))) out.push(r);
  }
  return out.sort();
}

// ---------------------------------------------------------------- Lesbarkeit (Kontrast)

/** Benannte Farben aus fundament.css als RGB */
export function farbtabelle(): Record<string, [number, number, number]> {
  const css = fs.readFileSync(path.join(SRC, 'fundament', 'fundament.css'), 'utf8');
  const out: Record<string, [number, number, number]> = {};
  for (const m of css.matchAll(/--color-([a-z-]+):\s*#([0-9a-fA-F]{6})/g)) {
    out[m[1]] = [0, 2, 4].map((i) => parseInt(m[2].slice(i, i + 2), 16)) as [number, number, number];
  }
  return out;
}

function leuchtdichte([r, g, b]: number[]): number {
  const k = [r, g, b].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
}

/** Kontrastverhältnis nach WCAG (1 = gleich, 21 = Schwarz auf Weiß) */
export function kontrast(a: number[], b: number[]): number {
  const [h, d] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x);
  return (h + 0.05) / (d + 0.05);
}

const mischen = (v: number[], h: number[], a: number) => v.map((x, i) => Math.round(x * a + h[i] * (1 - a)));

interface Paar { grund?: string; text?: string }
/** Hintergrund und Schriftfarbe je Zustand (Grundzustand, hover, disabled …) aus einer Klassenliste */
function paare(klassen: string): Record<string, Paar> {
  const out: Record<string, Paar> = {};
  for (const k of klassen.split(/\s+/)) {
    const m = k.match(/^((?:[a-z0-9-]+:)*)(bg|text)-([a-z]+(?:-[a-z]+)?(?:\/\d+)?)$/);
    if (!m) continue;
    const zustand = m[1].replace(/(sm|md|lg|xl|2xl):/g, '');
    (out[zustand] ??= {})[m[2] === 'bg' ? 'grund' : 'text'] = m[3];
  }
  return out;
}

/**
 * Sucht Stellen, an denen Schrift und Hintergrund desselben Elements zu wenig Kontrast haben
 * (dunkel auf dunkel, hell auf hell). Geprüft wird je Zeichenkette mit Klassen; bei zusammengesetzten
 * Klassenlisten (`…${bedingung ? 'a' : 'b'}`) jeder Zweig zusammen mit dem festen Teil.
 */
export function kontrastBefunde(mindest: number): string[] {
  const farben = farbtabelle();
  const farbe = (name: string | undefined, hinter: number[]): number[] | null => {
    if (!name) return null;
    const [n, a] = name.split('/');
    if (!farben[n]) return null;
    return a ? mischen(farben[n], hinter, Number(a) / 100) : farben[n];
  };
  const befunde: string[] = [];
  const pruefe = (datei: string, zeile: number, klassen: string) => {
    const p = paare(klassen);
    const basis = p[''] ?? {};
    for (const [zustand, z] of Object.entries(p)) {
      const g = z.grund ?? basis.grund; const t = z.text ?? basis.text;
      if (!g || !t || (!z.grund && !z.text)) continue;
      if (zustand.includes('group-') || zustand.includes('peer-')) continue;
      const gf = farbe(g, farben.flaeche); if (!gf) continue;
      const tf = farbe(t, gf); if (!tf) continue;
      const k = kontrast(gf, tf);
      if (k < mindest) befunde.push(`${datei}:${zeile} ${zustand}bg-${g} + ${zustand && z.text ? zustand : ''}text-${t} (Kontrast ${k.toFixed(1)})`);
    }
  };
  for (const p of dateien(SRC)) {
    if (!p.endsWith('.tsx') || p.includes('__tests__')) continue;
    const text = fs.readFileSync(p, 'utf8');
    const zeileVon = (i: number) => text.slice(0, i).split('\n').length;
    for (const m of text.matchAll(/`([^`]*)`|"([^"\n]*)"|'([^'\n]*)'/g)) {
      if (m[1] !== undefined) {
        const fest = m[1].replace(/\$\{[^}]*\}/g, ' ');
        const zweige = [...m[1].matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)].map((x) => x[1] ?? x[2]).filter((s) => /\b(bg|text)-/.test(s));
        if (!zweige.length) pruefe(rel(p), zeileVon(m.index!), fest);
        for (const z of zweige) pruefe(rel(p), zeileVon(m.index!), `${fest} ${z}`);
      } else if (!/`[^`]*$/.test(text.slice(Math.max(0, m.index! - 400), m.index!).split('\n').slice(-1)[0])) {
        pruefe(rel(p), zeileVon(m.index!), (m[2] ?? m[3])!);
      }
    }
  }
  return [...new Set(befunde)].sort();
}

/**
 * Eintragsnamen aus den Grimoires im Quelltext (alle Dateien unter src, auch Tests), die nicht auch im GRW-Paket stehen
 * („Datei: name“, klein geschrieben). Nur lokal sinnvoll, weil die Grimoires nicht im Repository liegen (Grundsatz 3).
 * `erlaubt`: allgemeine Begriffe, die zufällig auch Eintragsnamen sind (aus der lokalen Falldatei).
 */
export function buchnamenImCode(grimoireNamen: string[], erlaubt: string[]): string[] {
  const paket = JSON.parse(fs.readFileSync(path.join(WURZEL, 'public/regelpakete/grw.srp.json'), 'utf8'));
  const grw = new Set<string>(paket.eintraege.map((e: { name: string }) => e.name.toLowerCase()));
  const frei = new Set(erlaubt.map(x => x.toLowerCase()));
  const namen = [...new Set(grimoireNamen.map(n => n.toLowerCase()))].filter(n => n.length >= 6 && !grw.has(n) && !frei.has(n)).sort((a, b) => b.length - a.length);
  if (!namen.length) return [];
  const flucht = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`(?<![a-zäöüß])(${namen.map(flucht).join('|')})(?![a-zäöüß])`, 'g');
  const alle = (ordner: string, out: string[] = []): string[] => {
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      const p = path.join(ordner, e.name);
      if (e.isDirectory()) alle(p, out); else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
  };
  const out = new Set<string>();
  for (const p of alle(SRC)) for (const m of fs.readFileSync(p, 'utf8').toLowerCase().matchAll(rx)) out.add(`${rel(p)}: ${m[1]}`);
  return [...out].sort();
}
