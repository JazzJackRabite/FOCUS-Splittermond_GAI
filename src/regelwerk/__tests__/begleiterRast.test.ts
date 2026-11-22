/**
 * Rast der Begleiter (regelwerk/begleiterRast.ts): Ruhephase und Verschnaufpause nach den Kernregeln des GRW-Pakets,
 * Ausnahmen aus `strukturiert.ruhephase_begleiter` in den Grimoires (lokal mit FOKUS_GRIMOIRES): allgemein für jede genannte Art.
 */
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { Katalog } from '../katalog';
import { basisAusDateien, GRIMOIRE_ORDNER, istGrimoireDatei } from './hilfen';
import { erstelleKatalog, grimoireLesen } from '../laden';
import { ruheAusnahme, ruhephaseBegleiter, verschnaufpauseBegleiter } from '../begleiterRast';

const b = basisAusDateien();
const K = new Katalog(b.manifest, [b.basis]);
const verletzt = { schaden: 9, betaeubung: 3, kanalisiert: 1, fokus: { erschoepft: 2, kanalisiert: 1, verzehrt: 5 }, zustaende: [{ id: 'z', key: 'Blutend', level: 1 }] };

describe('Rast der Begleiter mit dem Grundregelwerk', () => {
  it('Ruhephase: Betäubung ganz, LP = 2 × KON, Fokus erschöpft/kanalisiert ganz, verzehrt = 2 × WIL; kanalisierter Schaden und Zustände bleiben (GRW S. 173)', () => {
    const e = ruhephaseBegleiter(K, 'tier', verletzt, { KON: '3', WIL: '2' });
    expect(e.zustand).toMatchObject({ schaden: 3, betaeubung: 0, kanalisiert: 1, fokus: { erschoepft: 0, kanalisiert: 0, verzehrt: 1 } });
    expect(e.zustand.zustaende).toEqual(verletzt.zustaende);
    expect(e.teile).toEqual(['3 Betäubung', '6 LP', '3 FO erschöpft/kanalisiert', '4 FO verzehrt']);
  });

  it('mindestens 1 LP und 1 Fokus, auch bei Konstitution 0; nie mehr als der Schaden', () => {
    expect(ruhephaseBegleiter(K, 'gefolge', { schaden: 4, fokus: { verzehrt: 3 } }, { KON: '0', WIL: '0' }).zustand).toMatchObject({ schaden: 3, fokus: { verzehrt: 2 } });
    expect(ruhephaseBegleiter(K, 'tier', { schaden: 2 }, { KON: '5' }).zustand.schaden).toBe(0);
  });

  it('Verschnaufpause: Betäubungsschaden und erschöpfter Fokus; echter Schaden bleibt', () => {
    const e = verschnaufpauseBegleiter(verletzt);
    expect(e.zustand).toMatchObject({ schaden: 9, betaeubung: 0, kanalisiert: 1, fokus: { erschoepft: 0, kanalisiert: 1, verzehrt: 5 } });
    expect(e.teile).toEqual(['3 Betäubung', '2 FO erschöpft']);
  });

  it('Zustände wie beim Abenteurer nach pause_ende: Verschnaufpause senkt Erschöpft, beendet Lahm; Blutend bleibt', () => {
    const z = { zustaende: [{ id: 'e', key: 'Erschöpft', level: 3 }, { id: 'l', key: 'Lahm' }, { id: 'b', key: 'Blutend', level: 1 }] };
    const v = verschnaufpauseBegleiter(z, K);
    expect(v.zustand.zustaende).toEqual([{ id: 'e', key: 'Erschöpft', level: 2 }, { id: 'b', key: 'Blutend', level: 1 }]);
    expect(v.teile).toContain('Erschöpft 3 → 2, Lahm beendet');
    // Ruhephase: Auslegung wie beim Abenteurer (nachPause), Erschöpft ganz abgebaut
    const r = ruhephaseBegleiter(K, 'tier', z, { KON: '2', WIL: '2' });
    expect(r.zustand.zustaende).toEqual([{ id: 'b', key: 'Blutend', level: 1 }]);
    expect(verschnaufpauseBegleiter({ schaden: 1 }, K).zustand.zustaende).toBeUndefined();
  });

  it('das Grundregelwerk nennt keine Ausnahme: alle Arten regenerieren wie der Abenteurer', () => {
    for (const art of ['tier', 'wesen', 'gefolge', 'golem', 'untoter']) expect(ruheAusnahme(K, art)).toBeNull();
  });
});

const alleGrimoires = GRIMOIRE_ORDNER && fs.existsSync(GRIMOIRE_ORDNER)
  ? fs.readdirSync(GRIMOIRE_ORDNER).filter(istGrimoireDatei).map(f => fs.readFileSync(`${GRIMOIRE_ORDNER}/${f}`, 'utf-8')) : [];

const M = alleGrimoires.length ? erstelleKatalog(b, alleGrimoires.map(t => grimoireLesen(t, b.manifest))).katalog : null;
const arten = M ? ['tier', 'wesen', 'gefolge', 'golem', 'untoter'].filter(art => ruheAusnahme(M, art)) : [];

// läuft, sobald die Grimoires `ruhephase_begleiter` tragen (Datenseite begleiter_werte.py)
describe.skipIf(!arten.length)('Ausnahmen aus den Grimoires (lokal, allgemein)', () => {

  it('jede Art mit Ausnahme: Fundstelle, keine Lebenspunkte in der Ruhephase, Fokus schon', () => {
    for (const art of arten) {
      const a = ruheAusnahme(M!, art)!;
      expect(a.lp).toBe(false);
      expect(a.quelle).toMatch(/S\. \d+/);
      const e = ruhephaseBegleiter(M!, art, verletzt, { KON: '4', WIL: '2' });
      expect(e.zustand).toMatchObject({ schaden: 9, betaeubung: 0, fokus: { verzehrt: 1 } });
      expect(e.hinweis).toContain('keine LP-Regeneration');
    }
  });
});
