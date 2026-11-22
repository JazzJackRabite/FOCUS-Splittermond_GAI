/**
 * Spielwerte der Begleiter: Würfeln mit den üblichen Modalen (Probe, Angriff, Zauber) und Lebenspunkte/Fokus je Begleiter.
 * Die Modale bekommen die Werte und Wundabzüge des Begleiters; Boni aus Stärken und Meisterschaften des Charakters gelten
 * nicht (der Charakter-Kontext wird für die Modale ohne Wirkungen weitergegeben), Splitterpunkte hat nur der Abenteurer.
 */
import { fokusDurchZustaende, zustandsErklaerung, zustandswerte } from '../../regelwerk/zustandswerte';
import { alleZustaende, zustandHatStufe, zustandQuelle } from '../../regelwerk/zustaende';
import React, { useContext, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Heart, Sparkles, RotateCcw, Coffee, HeartCrack, HeartPulse, Plus, Moon } from 'lucide-react';
import { ruheAusnahme, ruhephaseBegleiter, verschnaufpauseBegleiter } from '../../regelwerk/begleiterRast';
import { ruheregeln } from '../../regelwerk/spielwirkungen';
import { verschnaufpause } from '../../regelwerk/schadenUndHeilung';
import { MarkeMitEntfernen } from './Wertekasten';
import { CharacterContext, useCharacter } from '../../context/CharacterContext';
import { usePlaySessionOptional } from '../../context/PlaySessionContext';
import { RollModal } from '../play/RollModal';
import { AttackModal, type AttackTargetConfig } from '../play/AttackModal';
import { CastSpellModal } from '../play/CastSpellModal';
import { TakeDamageModal } from '../play/TakeDamageModal';
import { HealModal } from '../play/HealModal';
import type { RollEntry } from '../play/DiceLog';
import { aktiverKatalog } from '../../regelwerk/bruecke';
import { betaeubungsimmun, fokusFrei, gesundheitsfelder, gesundheitsstufen, lebenslage, schadenEintragen, type BegleiterZustand } from '../../regelwerk/vitals';
import type { Begleiter, Spell, StatusCondition } from '../../types';
import type { Wertekasten } from '../../regelwerk/begleiter';
import { generateId } from '../../utils/id';
import { Auswahl, Eingabe, Knopf, Marke, TON } from '../../fundament';
import { getConditionDescription, getConditionMalus, zustandTooltip } from '../../utils/conditionModifiers';

export interface Waffe { name: string; wert: string | number; schaden: string; wgs: string; ini?: string; merkmale?: string }
export interface Aktionen {
  probe: (fertigkeit: string, wert: number) => void;
  angriff: (w: Waffe) => void;
  schaden: (w: Waffe) => void;
  zaubern?: (z: Spell, schulwert: number) => void;
}

const zahl = (s: unknown) => { const n = Number.parseInt(String(s ?? '').replace(/[−–]/g, '-'), 10); return Number.isFinite(n) ? n : 0; };
const zeit = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Charakter-Kontext ohne Wirkungen: so zeigen die Modale keine Boni des Abenteurers */
const OhneCharakterBoni: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ctx = useContext(CharacterContext);
  // ohne Wirkungen des Abenteurers; Höchstbonus aus Zauberei nicht nach seinem Heldengrad (Begleiter: Heldengrad 1)
  const wert = useMemo(() => (ctx ? {
    ...ctx,
    calc: { ...ctx.calc, wirkungen: undefined, heldengrad: undefined, regelwerk: ctx.calc?.regelwerk ? { ...ctx.calc.regelwerk, hoechstbonus: undefined } : ctx.calc?.regelwerk },
  } : null), [ctx]);
  return wert ? <CharacterContext.Provider value={wert as typeof ctx & object}>{children}</CharacterContext.Provider> : <>{children}</>;
};

/** Würfelformel „2W6+3“, „1W10−1“ → Wurf */
export function wirfFormel(formel: string): { wuerfel: number[]; mod: number; summe: number; formel: string } | null {
  const f = formel.replace(/[−–]/g, '-').replace(/\s/g, '').toUpperCase();
  const m = f.match(/^(\d*)W(\d+)([+-]\d+)?/);
  if (!m) return null;
  const n = Number(m[1] || 1); const s = Number(m[2]); const mod = m[3] ? Number(m[3]) : 0;
  const wuerfel = Array.from({ length: n }, () => Math.floor(Math.random() * s) + 1);
  return { wuerfel, mod, summe: wuerfel.reduce((a, b) => a + b, 0) + mod, formel: m[0] };
}

export interface BegleiterSpielDaten {
  name: string; lp: number; fo: number; merkmale: string[]; sr?: string | number;
  /** Art und Attribute für die Rast (Konstitution, Willenskraft) */
  art?: Begleiter['art']; attribute?: Record<string, string>;
}

/** Würfeln und Vitalwerte eines Begleiters. Liefert die Aktionen und die Modale (im Eintrag rendern). */
export function useBegleiterSpiel(b: Begleiter, index: number, angaben: BegleiterSpielDaten) {
  const { dispatch } = useCharacter();
  const play = usePlaySessionOptional();
  const k = aktiverKatalog();
  const z: BegleiterZustand = b.zustand ?? {};
  const { stufen, quelle } = useMemo(() => gesundheitsstufen(k, angaben.merkmale), [k, angaben.merkmale]);
  const lage = lebenslage(angaben.lp, stufen, z);
  const [probe, setProbe] = useState<{ name: string; wert: number } | null>(null);
  const [angriff, setAngriff] = useState<AttackTargetConfig | null>(null);
  const [zauber, setZauber] = useState<{ spell: Spell; wert: number } | null>(null);
  const [lpModal, setLpModal] = useState<'schaden' | 'heilen' | null>(null);

  const setze = (zustand: BegleiterZustand) => {
    const a = { type: 'BEGLEITER_AENDERN' as const, payload: { index, aenderung: { zustand } } };
    if (play) play.dispatchWithHistory(a); else dispatch(a);
  };
  const log = (category: 'damage' | 'heal' | 'focus' | 'spell' | 'combat' | 'misc', title: string, description?: string, badge?: { text: string; variant: 'danger' | 'warning' | 'info' | 'success' | 'gold' | 'neutral' }) =>
    play?.logEintrag({ category, title: `${angaben.name}: ${title}`, description, badge });
  const wurfLog = (e: RollEntry) => play?.handleRecordRoll(e);

  const aktionen: Aktionen = {
    probe: (name, wert) => setProbe({ name, wert }),
    angriff: w => setAngriff({
      weapon: { name: w.name, damage: String(w.schaden).replace(/[−–]/g, '-'), wgs: zahl(w.wgs) || w.wgs, attributes: w.merkmale },
      skillName: `${angaben.name}: ${w.name}`, skillTotal: zahl(w.wert),
    }),
    schaden: w => {
      const r = wirfFormel(String(w.schaden));
      if (!r) { toast.error(`Schaden „${w.schaden}“ nicht lesbar`); return; }
      wurfLog({ id: generateId(), type: 'roll', timestamp: zeit(), label: `${angaben.name}: Schaden ${w.name} (${r.formel})`, d10s: r.wuerfel, baseVal: 0, modifier: r.mod, total: r.summe,
        outcome: `[${r.wuerfel.join(', ')}]${r.mod ? (r.mod > 0 ? ` + ${r.mod}` : ` − ${-r.mod}`) : ''} = ${r.summe}` });
      toast.success(`${angaben.name}, ${w.name}: ${r.summe} Schaden (${r.formel} [${r.wuerfel.join(', ')}])`);
    },
    zaubern: (spell, wert) => setZauber({ spell, wert }),
  };
  const zahlSR = zahl(angaben.sr);

  const fokus = z.fokus ?? {};
  const modale = (
    <OhneCharakterBoni>
      {probe && (
        <RollModal wuerfelnder="begleiter" skillName={`${angaben.name}: ${probe.name}`} baseValue={probe.wert} woundPenalty={lage.wundabzug} healthLevelName={lage.stufenName}
          conditions={z.zustaende ?? []} splitterPoints={0} onClose={() => setProbe(null)} onRecordRoll={wurfLog} />
      )}
      {angriff && (
        <AttackModal angreifer="begleiter" target={angriff} conditions={z.zustaende ?? []} woundPenalty={lage.wundabzug} splitterpunkte={0} onClose={() => setAngriff(null)} onSpendSplitterpunkt={() => {}}
          onRecordRoll={wurfLog}
          onAttackSuccess={r => {
            log('combat', `Angriff getroffen: ${r.weapon.name} (${r.eg} EG)${r.damageRoll ? ` · ${r.damageRoll.netDamage} Schaden` : ''}`,
              `Wurf ${r.totalRoll} gegen VTD ${r.targetVTD}${r.damageRoll ? ` · ${r.damageRoll.breakdownText}` : ''}`,
              { text: r.damageRoll ? `${r.damageRoll.netDamage} SP · ${r.eg} EG` : `${r.eg} EG`, variant: r.damageRoll ? 'danger' : 'success' });
            setAngriff(null);
          }}
          onAttackFailure={r => {
            log('combat', `Angriff verfehlt: ${r.weapon.name}`, `Wurf ${r.totalRoll} gegen VTD ${r.targetVTD}${r.isFumble ? ' · Patzer' : ''}`, { text: r.isFumble ? 'Patzer' : 'verfehlt', variant: 'warning' });
            setAngriff(null);
          }} />
      )}
      {zauber && (
        <CastSpellModal zaubernder="begleiter" spell={zauber.spell} conditions={z.zustaende ?? []} schoolSkillTotal={zauber.wert} schoolSkillName={zauber.spell.school}
          availableFocus={Math.max(0, fokusFrei(angaben.fo, z) - fokusDurchZustaende(angaben.fo, zustandswerte(z.zustaende ?? [])))} maxFO={angaben.fo}
          focusState={{ exhausted: fokus.erschoepft ?? 0, channeled: fokus.kanalisiert ?? 0, consumed: fokus.verzehrt ?? 0 }}
          woundPenalty={lage.wundabzug} splitterpunkte={0} onSpendSplitterpunkt={() => {}} onClose={() => setZauber(null)} onRecordRoll={wurfLog}
          onCastSuccess={r => {
            setze({ ...z, fokus: { erschoepft: (fokus.erschoepft ?? 0) + r.exhaustedFocus, kanalisiert: (fokus.kanalisiert ?? 0) + r.channeledFocus, verzehrt: (fokus.verzehrt ?? 0) + r.consumedFocus } });
            log('spell', `Zauber gewirkt: ${r.spell.name} (${r.eg} EG)`, `${r.exhaustedFocus} erschöpft, ${r.channeledFocus} kanalisiert, ${r.consumedFocus} verzehrt`,
              { text: `${r.exhaustedFocus + r.channeledFocus + r.consumedFocus} FO`, variant: 'info' });
            setZauber(null);
          }}
          onCastFailure={r => {
            setze({ ...z, fokus: { ...fokus, erschoepft: (fokus.erschoepft ?? 0) + r.exhaustedFocusLost } });
            log('spell', `Zauber misslungen: ${r.spell.name}`, `${r.exhaustedFocusLost} Fokus erschöpft`, { text: `−${r.exhaustedFocusLost} FO`, variant: 'warning' });
            setZauber(null);
          }} />
      )}
      {lpModal === 'schaden' && (
        <TakeDamageModal begleiter={angaben.name} stufen={stufen} maxLP={angaben.lp} derivedSR={zahlSR} armorSR={0} currentSplitterPoints={0} activeTempHP={0}
          currentHealthSlots={gesundheitsfelder(lage.gesamt, z)} onClose={() => setLpModal(null)}
          onApplyDamage={({ kind, amount, note }) => {
            if (amount <= 0) return;
            if (kind === 'exhausted' && betaeubungsimmun(k, angaben.merkmale)) {
              log('damage', `immun gegen Betäubungsschaden (${amount} ignoriert)`, note, { text: 'immun', variant: 'neutral' });
              return;
            }
            const art = kind;
            setze(schadenEintragen(lage.gesamt, z, art, amount));
            const text = art === 'consumed' ? 'Schaden' : art === 'exhausted' ? 'Betäubungsschaden' : 'kanalisierter Schaden';
            log('damage', `${amount} ${text} erlitten`, note, { text: `−${amount} LP`, variant: 'danger' });
          }} />
      )}
      {lpModal === 'heilen' && (
        <HealModal begleiter={angaben.name} stufen={stufen} maxLP={angaben.lp} currentHealthSlots={gesundheitsfelder(lage.gesamt, z)} activeConditions={z.zustaende ?? []}
          onClose={() => setLpModal(null)}
          onApplyHeal={({ consumedHealed, exhaustedHealed, channeledHealed, note, healMethod }) => {
            const summe = consumedHealed + exhaustedHealed + channeledHealed;
            if (summe <= 0) return;
            setze({ ...z, schaden: Math.max(0, (z.schaden ?? 0) - consumedHealed), betaeubung: Math.max(0, (z.betaeubung ?? 0) - exhaustedHealed), kanalisiert: Math.max(0, (z.kanalisiert ?? 0) - channeledHealed) });
            log('heal', `${summe} LP geheilt${healMethod && healMethod !== 'manual' ? ` (${healMethod.replace('_', ' ')})` : ''}`, note, { text: `+${summe} LP`, variant: 'success' });
          }} />
      )}
    </OhneCharakterBoni>
  );

  return { aktionen, modale, lage, stufenQuelle: quelle, setze, log, zustand: z, schadenModal: () => setLpModal('schaden'), heilenModal: () => setLpModal('heilen') };
}

/** Zustände eines Begleiters: dieselbe Zustandsliste wie beim Abenteurer, Abzüge über getConditionMalus */
const BegleiterZustaende: React.FC<{ spiel: ReturnType<typeof useBegleiterSpiel> }> = ({ spiel }) => {
  const { zustand: z, setze, log } = spiel;
  const [wahl, setWahl] = useState('');
  const [stufe, setStufe] = useState(1);
  const liste = z.zustaende ?? [];
  const mitStufe = zustandHatStufe(wahl);
  const hinzu = () => {
    if (!wahl) return;
    const neu: StatusCondition = { id: generateId(), key: wahl, ...(mitStufe ? { level: Math.max(1, stufe) } : {}) };
    setze({ ...z, zustaende: [...liste.filter(c => c.key !== wahl), neu] });
    log('misc', `Zustand ${wahl}${mitStufe ? ` ${neu.level}` : ''}`, getConditionDescription(neu), { text: 'Zustand', variant: 'warning' });
    setWahl(''); setStufe(1);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-leise">Zustände:</span>
        {liste.length === 0 && <span className="text-leise">keine</span>}
        {liste.map(c => {
          const m = getConditionMalus(c);
          return (
            <MarkeMitEntfernen key={c.id} ton="erschoepft" titel={zustandTooltip(c)} label={`Zustand ${c.key} beenden`}
              onEntfernen={() => { setze({ ...z, zustaende: liste.filter(x => x.id !== c.id) }); log('misc', `Zustand ${c.key} beendet`); }}>
              {c.key}{c.level ? ` ${c.level}` : ''}{m && m.malus ? ` (${m.malus})` : ''}
            </MarkeMitEntfernen>
          );
        })}
      </div>
      {(() => {
        // Wirkung der Zustände (Zahlen aus den Paketeinträgen); im Wertekasten sind sie eingerechnet, hier steht die Erklärung
        const zw = zustandswerte(liste);
        const teile = (['VTD', 'GW', 'KW', 'GSW', 'INI', 'SR'] as const).map((w) => zustandsErklaerung(w, zw) && `${w}: ${zw.erklaerung[w]!.join(', ')}`).filter(Boolean);
        if (zw.erklaerung.FO) teile.push(`Fokus: ${zw.erklaerung.FO.join(', ')}`);
        teile.push(...zw.hinweise);
        return teile.length ? <p className="text-xs text-leise" data-testid="begleiter-zustandswerte">In die Werte eingerechnet – {teile.join(' · ')}</p> : null;
      })()}
      <div className="flex flex-wrap gap-2 items-end">
        <Auswahl beschriftung="Zustand hinzufügen" beschriftungVerborgen value={wahl} onChange={e => setWahl(e.target.value)}>
          <option value="">Zustand wählen …</option>
          {alleZustaende().map(c => <option key={c} value={c} title={`Quelle: ${zustandQuelle(c)}`}>{c}</option>)}
        </Auswahl>
        {mitStufe && <Eingabe beschriftung="Stufe" beschriftungVerborgen type="number" min={1} max={5} className="w-20" value={stufe} onChange={e => setStufe(Number(e.target.value) || 1)} />}
        <Knopf disabled={!wahl} onClick={hinzu}><Plus size={14} aria-hidden />Zustand</Knopf>
      </div>
    </div>
  );
};

/** Lebenspunkte (je Gesundheitsstufe), Fokus und Zustände eines Begleiters */
export const BegleiterVitals: React.FC<{ spiel: ReturnType<typeof useBegleiterSpiel>; daten: BegleiterSpielDaten; rahmenlos?: boolean }> = ({ spiel, daten: angaben, rahmenlos }) => {
  const { lage, zustand: z, setze, log, stufenQuelle } = spiel;
  const [foMenge, setFoMenge] = useState(1);
  const k = aktiverKatalog();
  const immun = betaeubungsimmun(k, angaben.merkmale);
  const f = z.fokus ?? {};
  const frei = Math.max(0, fokusFrei(angaben.fo, z) - fokusDurchZustaende(angaben.fo, zustandswerte(z.zustaende ?? [])));
  const regeln = ruheregeln(k);
  const pause = verschnaufpause(k);
  const ausnahme = ruheAusnahme(k, angaben.art ?? 'tier');
  const aendern = (neu: BegleiterZustand, titel: string, art: 'damage' | 'heal' | 'focus', badge: string) => {
    setze(neu); log(art, titel, undefined, { text: badge, variant: art === 'damage' ? 'danger' : art === 'heal' ? 'success' : 'info' });
  };

  // Kästchen je Gesundheitsstufe: echter Schaden, Betäubung, kanalisiert (Bedeutung als Rahmen auf Grundton)
  const kaestchen: ('s' | 'b' | 'k' | '')[] = [];
  for (let i = 0; i < lage.gesamt; i++) {
    const s = z.schaden ?? 0; const bt = z.betaeubung ?? 0; const kn = z.kanalisiert ?? 0;
    kaestchen.push(i < s ? 's' : i < s + bt ? 'b' : i < s + bt + kn ? 'k' : '');
  }
  const farbe = { s: TON.schaden, b: TON.erschoepft, k: TON.kanalisiert, '': TON.unverletzt };

  return (
    <div className={rahmenlos ? 'space-y-4' : 'border border-rahmen rounded-knopf p-3 space-y-3 bg-flaeche'} data-testid="begleiter-vitals">
      {angaben.lp > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Heart size={16} aria-hidden />
            <strong className="font-titel text-base">LP {lage.frei}/{lage.gesamt}</strong>
            <Marke ton={lage.ausser || lage.wundabzug ? 'schaden' : 'unverletzt'} klein>{lage.stufenName}</Marke>
            {lage.wundabzug !== 0 && <Marke ton="schaden" klein>Wundabzug {lage.wundabzug}</Marke>}
            <span className="text-leise text-xs">{angaben.lp} je Stufe, {lage.stufen.length} Stufen{stufenQuelle ? ` (${stufenQuelle})` : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Lebenspunkte">
            {lage.stufen.map((st, si) => (
              <div key={si} className="flex flex-col items-start">
                <span className="text-[11px] text-leise">{st.name}{st.wundabzug ? ` (${st.wundabzug})` : ''}</span>
                <div className="flex gap-0.5">
                  {kaestchen.slice(si * angaben.lp, (si + 1) * angaben.lp).map((x, i) => <span key={i} className={`w-3.5 h-3.5 rounded-[3px] border ${farbe[x]}`} />)}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Knopf art="gefahr" onClick={spiel.schadenModal}><HeartCrack size={14} aria-hidden />Schaden erleiden</Knopf>
            <Knopf art="erholung" disabled={!lage.verloren} onClick={spiel.heilenModal}><HeartPulse size={14} aria-hidden />Heilen</Knopf>
            {immun && <span className="text-leise text-xs">immun gegen Betäubungsschaden</span>}
          </div>
        </div>
      )}
      {angaben.fo > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles size={16} aria-hidden />
            <strong className="font-titel text-base">Fokus {frei}/{angaben.fo}</strong>
            {(f.erschoepft ?? 0) > 0 && <Marke ton="erschoepft" klein>erschöpft {f.erschoepft}</Marke>}
            {(f.kanalisiert ?? 0) > 0 && <Marke ton="kanalisiert" klein>kanalisiert {f.kanalisiert}</Marke>}
            {(f.verzehrt ?? 0) > 0 && <Marke ton="schaden" klein>verzehrt {f.verzehrt}</Marke>}
          </div>
          {/* Menge und die drei Arten in einer Zeile, auch auf dem Handy */}
          <div className="grid grid-cols-[4.5rem_repeat(3,minmax(0,1fr))] gap-2 items-end">
            <div className="min-w-0"><Eingabe beschriftung="Menge Fokus" beschriftungVerborgen type="number" min={1} value={foMenge} onChange={e => setFoMenge(Number(e.target.value) || 1)} /></div>
            {([['erschoepft', 'erschöpfen', 'erschöpft'], ['kanalisiert', 'kanalisieren', 'kanalisiert'], ['verzehrt', 'verzehren', 'verzehrt']] as const).map(([feld, text, partizip]) => (
              <Knopf key={feld} eng disabled={frei <= 0} className="min-w-0"
                onClick={() => { const m = Math.min(frei, Math.max(1, foMenge)); aendern({ ...z, fokus: { ...f, [feld]: (f[feld] ?? 0) + m } }, `${m} Fokus ${partizip}`, 'focus', `−${m} FO`); }}>
                {text}
              </Knopf>
            ))}
            {(f.kanalisiert ?? 0) > 0 && (
              <Knopf className="col-span-4" onClick={() => aendern({ ...z, fokus: { ...f, kanalisiert: 0, erschoepft: (f.erschoepft ?? 0) + (f.kanalisiert ?? 0) } }, 'Kanalisierung beendet', 'focus', 'K → erschöpft')}>
                Kanalisierung beenden
              </Knopf>
            )}
          </div>
        </div>
      )}
      <BegleiterZustaende spiel={spiel} />
      <div className="flex flex-wrap gap-2">
        <Knopf art="erholung" title={`${pause.minuten} Minuten: Betäubungsschaden und erschöpfter Fokus erholen sich`}
          onClick={() => { const e = verschnaufpauseBegleiter(z); aendern(e.zustand, `Verschnaufpause${e.teile.length ? `: ${e.teile.join(', ')}` : ''}`, 'heal', 'Pause'); }}><Coffee size={14} aria-hidden />Verschnaufpause</Knopf>
        <Knopf art="erholung" title={`${regeln.ruheStunden} Stunden: Lebenspunkte aus der doppelten Konstitution, verzehrter Fokus aus der doppelten Willenskraft${ausnahme && !ausnahme.lp ? ` (keine Lebenspunkte: ${ausnahme.quelle})` : ''}`}
          onClick={() => { const e = ruhephaseBegleiter(k, angaben.art ?? 'tier', z, angaben.attribute); aendern(e.zustand, `Ruhephase${e.teile.length ? `: ${e.teile.join(', ')}` : ''}${e.hinweis ? ` – ${e.hinweis}` : ''}`, 'heal', 'Ruhe'); }}><Moon size={14} aria-hidden />Ruhephase</Knopf>
        <Knopf onClick={() => aendern({}, 'Werte zurückgesetzt (voll)', 'heal', 'voll')}><RotateCcw size={14} aria-hidden />Alles zurücksetzen</Knopf>
      </div>
    </div>
  );
};

/** Spieldaten aus einem Wertekasten (LP und FO je Stufe, Merkmale) */
export function spielDaten(b: Begleiter, w: Wertekasten | null | undefined): BegleiterSpielDaten {
  const merkmale = String(w?.felder?.merkmale ?? '').split(/,(?![^(]*\))/).map(x => x.trim()).filter(Boolean);
  return { name: b.rufname || b.name, lp: zahl(w?.abgeleitete_werte?.LP), fo: zahl(w?.abgeleitete_werte?.FO), sr: w?.abgeleitete_werte?.SR, merkmale, art: b.art, attribute: w?.attribute };
}

/** Kurzanzeige im Kopf eines Begleiters: LP und Fokus */
export const VitalKurz: React.FC<{ spiel: ReturnType<typeof useBegleiterSpiel>; daten: BegleiterSpielDaten }> = ({ spiel, daten: angaben }) => {
  if (!angaben.lp) return null;
  const { lage } = spiel;
  return (
    <Marke klein ton={lage.ausser || lage.wundabzug ? 'schaden' : 'unverletzt'} title={lage.stufenName}>
      LP {lage.frei}/{lage.gesamt}{angaben.fo ? ` · FO ${fokusFrei(angaben.fo, spiel.zustand)}/${angaben.fo}` : ''}{lage.wundabzug ? ` · ${lage.wundabzug}` : ''}
    </Marke>
  );
};
