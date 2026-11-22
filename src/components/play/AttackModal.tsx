import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Marke, Wahlknopf, useEscape } from '../../fundament';
import React, { useState, useMemo, useEffect, useId, useContext } from 'react';
import {
  Sword,
  Shield,
  Target,
  Dice1,
  Sparkles,
  Zap,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  Flame,
  Award,
} from 'lucide-react';
import type { StatusCondition, ChanneledSpell } from '../../types';
import type { RollEntry } from './DiceLog';
import { getActiveRollModifiers } from '../../utils/conditionModifiers';
import {
  begrenzeZauberbonus,
  getActiveSpellRollBonuses,
  getSpellWeaponDamageBonus,
  istWaffenlos,
  zauberHoechstbonus,
} from '../../utils/magicRules';
import { CharacterContext } from '../../context/CharacterContext';
import {
  calculateAttackEG,
  getAvailableCombatManeuvers,
  parseWeaponDamage,
  executeAttackDamageRoll,
  isMeleeWeapon,
  manoeverRegeln,
  wuchtangriffJeEg,
  kombiniereManoever,
  manoeverHinzufuegbar,
  type AngreiferWerte,
  type CombatManeuver,
  type AttackEGCalculation,
  type DamageRollResult,
} from '../../utils/combatRules';
import { toast } from 'react-hot-toast';

export interface AttackWeaponData {
  id?: string;
  name: string;
  weaponSkill?: string;
  skill?: string;
  damage?: string;
  wgs?: number | string;
  range?: string;
  attributes?: string;
  category?: string;
  equipped?: boolean;
}

export interface AttackTargetConfig {
  weapon: AttackWeaponData;
  skillName: string;
  skillTotal: number;
  customBonus?: number;
  targetVTD?: number;
  /** Großmeister in der Waffenfertigkeit (ab 15 Punkten): zusätzlicher W10 */
  grossmeister?: boolean;
}

export interface AttackSuccessResult {
  weapon: AttackWeaponData;
  maneuver: CombatManeuver;
  totalRoll: number;
  targetVTD: number;
  differenz: number;
  eg: number;
  egDamageSpent: number;
  /** Störender Angriff: EG, je +3 auf die Entschlossenheit-Probe des Ziels (GRW S. 161) */
  egStoerendSpent: number;
  /** Betäubungsschlag (1 EG): Schaden als Betäubungsschaden */
  betaeubungsschlag: boolean;
  /** alle angesagten Meisterschafts-Manöver (GRW S. 161: mehrere gegen denselben Widerstand) */
  maneuvers: CombatManeuver[];
  /** weitere EG für angesagte Manöver (z. B. Abdrängen je 0,5 m), Summe */
  egManoeverExtra: number;
  /** weitere EG je Manöver */
  egManoeverExtraJe: Record<string, number>;
  /** EG, die für die Deckung des Ziels nötig waren (Fernkampf, GRW S. 163) */
  egDeckung: number;
  /** zu wenige EG für das angesagte Manöver: Streiftreffer (GRW S. 161) */
  streiftreffer: boolean;
  isCrit: boolean;
  damageRoll?: DamageRollResult;
  notes?: string;
}

export interface AttackFailureResult {
  weapon: AttackWeaponData;
  maneuver: CombatManeuver;
  totalRoll: number;
  targetVTD: number;
  differenz: number;
  isFumble: boolean;
  notes?: string;
}

export interface AttackModalProps {
  target: AttackTargetConfig;
  characterMasteries?: any[];
  /** Werte des Angreifers für Zusatzschaden aus Manövern (Stärke, Intuition, Geschwindigkeit) */
  angreiferWerte?: AngreiferWerte;
  conditions?: StatusCondition[];
  channeledSpells?: ChanneledSpell[];
  woundPenalty?: number;
  splitterpunkte: number;
  onClose: () => void;
  onSpendSplitterpunkt: () => void;
  onRecordRoll?: (roll: RollEntry) => void;
  onAttackSuccess: (result: AttackSuccessResult) => void;
  onAttackFailure: (result: AttackFailureResult) => void;
  /** Wer greift an: beim Begleiter keine Stärken, Meisterschaften und Relikte des Helden */
  angreifer?: 'held' | 'begleiter';
}

type RollType = 'standard' | 'safe' | 'risk';
import { wuerfeln } from '../../utils/wuerfeln';
import { SituativeBoni, useSituativeBoni } from './SituativeBoni';
import { wurfgrenzen } from '../../regelwerk/proben';
import { ignoriertSituation, kampfsituationen, positionsModifikator, positionsNamen, vorbereitungsBonus } from '../../regelwerk/kampflage';


/** Stabile leere Liste: ein `= []` als Vorgabe erzeugt bei jedem Rendern ein neues Array und löst über den Effekt unten eine Endlosschleife aus. */
const KEINE_ZAUBER: ChanneledSpell[] = [];
const KEINE_WERTE: AngreiferWerte = {};
const WIDERSTAND_TEXT: Record<'VTD' | 'KW' | 'GW', string> = { VTD: 'Verteidigung (VTD)', KW: 'Körperlicher Widerstand (KW)', GW: 'Geistiger Widerstand (GW)' };

/** Zähler (−/+) für Erfolgsgrade und Lage, mindestens 44 Pixel hohe Knöpfe */
const EgZaehler: React.FC<{ titel: string; text: string; wert: number; setze: (f: (v: number) => number) => void; mehrMoeglich: boolean; testid: string; einheit?: string }> = ({ titel, text, wert, setze, mehrMoeglich, testid, einheit = 'EG' }) => (
  <div className="bg-seite p-2.5 rounded-knopf border border-rahmen flex items-center justify-between gap-2" data-testid={testid}>
    <div>
      <span className="font-bold text-schrift block">{titel}</span>
      <span className="text-[11px] text-leise">{text}</span>
    </div>
    <div className="flex items-center gap-1.5">
      <Knopf nurSymbol aria-label={`${titel}: ein ${einheit} weniger`} disabled={wert <= 0} onClick={() => setze((v) => Math.max(0, v - 1))}>−</Knopf>
      <span className="w-6 text-center tabular-nums font-bold text-schrift" data-testid={`${testid}-wert`}>{wert}</span>
      <Knopf nurSymbol aria-label={`${titel}: ein ${einheit} mehr`} disabled={!mehrMoeglich} onClick={() => setze((v) => (mehrMoeglich ? v + 1 : v))}>+</Knopf>
    </div>
  </div>
);

export const AttackModal: React.FC<AttackModalProps> = ({
  target,
  characterMasteries = [],
  angreiferWerte = KEINE_WERTE,
  conditions = [],
  channeledSpells = KEINE_ZAUBER,
  woundPenalty = 0,
  splitterpunkte,
  onClose,
  onSpendSplitterpunkt,
  onRecordRoll,
  onAttackSuccess,
  onAttackFailure,
  angreifer = 'held',
}) => {
  const modalHeadingId = useId();
  const { weapon, skillName, skillTotal } = target;
  const situativ = useSituativeBoni('angriff', skillName, angreifer === 'begleiter');

  // Available Maneuvers (Free + Masteries) filtered strictly by weapon category & skill
  const availableManeuvers = useMemo(() => {
    return getAvailableCombatManeuvers(characterMasteries, skillName, weapon.category, angreiferWerte);
  }, [characterMasteries, skillName, weapon.category, angreiferWerte]);
  // Freie Manöver und Streiftreffer aus dem Paket (GRW S. 161)
  const regeln = useMemo(() => manoeverRegeln(), []);
  const nahkampf = isMeleeWeapon(skillName, weapon.category);
  const wuchtJeEg = useMemo(() => wuchtangriffJeEg(weapon.attributes), [weapon.attributes]);
  const stoerend = regeln.freie.find((f) => f.je_eg?.entschlossenheit_erschwert);
  const betaeubung = regeln.freie.find((f) => f.betaeubungsschaden && (!f.nur_nahkampf || nahkampf));

  // Angesagte Meisterschafts-Manöver; leer = Angriff ohne Meisterschafts-Manöver (GRW S. 161)
  const [gewaehlteManoever, setGewaehlteManoever] = useState<CombatManeuver[]>([]);
  useEffect(() => {
    setGewaehlteManoever((g) => (g.every((m) => availableManeuvers.some((a) => a.id === m.id)) ? g : g.filter((m) => availableManeuvers.some((a) => a.id === m.id))));
  }, [availableManeuvers]);
  const kombi = useMemo(() => kombiniereManoever(gewaehlteManoever, regeln), [gewaehlteManoever, regeln]);
  const selectedManeuver = kombi.gesamt;
  const umschaltenManoever = (m: CombatManeuver) => {
    if (m.type !== 'mastery') { setGewaehlteManoever([]); return; }
    setGewaehlteManoever((g) => {
      if (g.some((x) => x.id === m.id)) return g.filter((x) => x.id !== m.id);
      return manoeverHinzufuegbar(g, m, regeln) ? (regeln.kombination.mehrere ? g : [m]) : [...g, m];
    });
  };

  // Step 1: Target Defense & Modifiers
  const [targetVTD, setTargetVTD] = useState<number>(target.targetVTD ?? 15);
  const [targetArmor, setTargetArmor] = useState<number>(0);
  const [situationalMod, setSituationalMod] = useState<number>(0);
  // Lage beim Angriff aus dem Paket (GRW S. 162–163, 170–171)
  const lage = useMemo(() => kampfsituationen(), []);
  const positionen = useMemo(() => positionsNamen(), []);
  const art = nahkampf ? 'nahkampf' as const : 'fernkampf' as const;
  const [eigenePosition, setEigenePosition] = useState<string>(positionen[0] ?? '');
  const [zielPosition, setZielPosition] = useState<string>(positionen[0] ?? '');
  const [taktischeVorteile, setTaktischeVorteile] = useState<number>(0);
  const [ueberzahl, setUeberzahl] = useState<number>(0);
  const [vorbereitungTicks, setVorbereitungTicks] = useState<number>(0);
  const [deckung, setDeckung] = useState<'keine' | 'leicht' | 'schwer'>('keine');
  const [kampfgetuemmel, setKampfgetuemmel] = useState<boolean>(false);
  const scharfschuetze = useMemo(
    () => (nahkampf ? null : ignoriertSituation('kampfgetuemmel', characterMasteries, skillName)),
    [nahkampf, characterMasteries, skillName],
  );
  const [attackNote, setAttackNote] = useState<string>('');

  // Active condition modifiers
  // Zustände für Kampffertigkeiten; der Wundabzug selbst wird unten gesondert gezeigt
  const conditionMods = useMemo(() => getActiveRollModifiers(conditions, woundPenalty, '', 0, false, 'kampf').filter((m) => m.source === 'condition'), [conditions, woundPenalty]);
  const [activeConditionsState, setActiveConditionsState] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    conditionMods.forEach((c) => {
      init[c.id] = c.active;
    });
    return init;
  });

  const totalConditionPenalty = useMemo(() => {
    return conditionMods.reduce((sum, c) => {
      return sum + (activeConditionsState[c.id] ? c.malus : 0);
    }, 0);
  }, [conditionMods, activeConditionsState]);

  // Modifikatoren der Lage, alle Zahlen aus dem Paket
  const lageTeile = useMemo(() => {
    const t: { text: string; wert: number }[] = [];
    const pe = eigenePosition ? positionsModifikator(eigenePosition, art, 'eigene', weapon.name) : 0;
    if (pe) t.push({ text: `eigene Position ${eigenePosition}`, wert: pe });
    const pz = zielPosition ? positionsModifikator(zielPosition, art, 'gegnerisch', weapon.name) : 0;
    if (pz) t.push({ text: `Ziel ${zielPosition}`, wert: pz });
    if (lage.taktischerVorteil && taktischeVorteile > 0) t.push({ text: `Taktischer Vorteil ×${taktischeVorteile}`, wert: taktischeVorteile * lage.taktischerVorteil.bonus });
    if (nahkampf && lage.ueberzahl && ueberzahl > 0) t.push({ text: 'Überzahl', wert: Math.min(lage.ueberzahl.hoechstens, ueberzahl * lage.ueberzahl.bonusJeKaempfer) });
    const vb = vorbereitungsBonus(vorbereitungTicks, art);
    if (vb) t.push({ text: nahkampf ? 'Lücke suchen' : 'Zielen', wert: vb });
    if (!nahkampf && lage.kampfgetuemmel && kampfgetuemmel && !scharfschuetze) t.push({ text: 'Kampfgetümmel', wert: -lage.kampfgetuemmel.malus });
    return t;
  }, [eigenePosition, zielPosition, art, weapon.name, lage, taktischeVorteile, nahkampf, ueberzahl, vorbereitungTicks, kampfgetuemmel, scharfschuetze]);
  const situationPresetBonus = lageTeile.reduce((s, t) => s + t.wert, 0);
  const egDeckung = !nahkampf && lage.deckung && deckung !== 'keine' ? lage.deckung[deckung] : 0;

  const effectiveTargetVTD = targetVTD;

  // Splittermond GRW: Aktive kanalisierte Zauber (Aura des Anführers, Beflügelte Waffe, Flammende Waffe etc.)
  // Waffenlose Angriffe kommen ohne Ausrüstungs-ID an – sonst träfen Waffenzauber ohne Zielangabe auch sie.
  const waffenId = istWaffenlos(weapon.id, weapon.name) ? 'waffenlos' : weapon.id;
  const spellAttackBonuses = useMemo(() => {
    return getActiveSpellRollBonuses(channeledSpells, skillName, true, waffenId);
  }, [channeledSpells, skillName, waffenId]);

  const [activeSpellBonusIds, setActiveSpellBonusIds] = useState<Set<string>>(() => {
    return new Set(spellAttackBonuses.filter((b) => b.active).map((b) => b.id));
  });

  useEffect(() => {
    setActiveSpellBonusIds(new Set(spellAttackBonuses.filter((b) => b.active).map((b) => b.id)));
  }, [spellAttackBonuses]);

  const toggleSpellBonus = (id: string) => {
    setActiveSpellBonusIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Höchstbonus aus Zauberei (GRW S. 18–19): 3 zu Spielbeginn, +1 je Heldengrad
  const hoechstbonusZauber = zauberHoechstbonus(useContext(CharacterContext)?.calc);
  const spellAttackBonusRoh = useMemo(() => {
    return spellAttackBonuses
      .filter((b) => activeSpellBonusIds.has(b.id))
      .reduce((sum, b) => sum + b.bonus, 0);
  }, [spellAttackBonuses, activeSpellBonusIds]);
  const spellAttackBonusTotal = begrenzeZauberbonus(spellAttackBonusRoh, hoechstbonusZauber);

  const spellWeaponDamage = useMemo(() => {
    return getSpellWeaponDamageBonus(channeledSpells, waffenId, weapon.name);
  }, [channeledSpells, waffenId, weapon.name]);

  const extraSpellDmg = spellWeaponDamage.totalDamage;

  // Total modifier applied to the 2W10 roll
  const totalAttackModifier =
    skillTotal +
    woundPenalty +
    totalConditionPenalty +
    situationalMod +
    situationPresetBonus +
    situativ.summe +
    spellAttackBonusTotal +
    (target.customBonus ?? 0);

  // Step 2: Roll Execution & State
  const [hasRolled, setHasRolled] = useState<boolean>(false);
  const [rollDice, setRollDice] = useState<number[]>([0, 0]);
  const [diceSum, setDiceSum] = useState<number>(0);
  const [isFumble, setIsFumble] = useState<boolean>(false);
  const [isCrit, setIsCrit] = useState<boolean>(false);
  const [rollType, setRollType] = useState<RollType>('standard');
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [extraSPBonus, setExtraSPBonus] = useState<number>(0);
  const [manualInputOpen, setManualInputOpen] = useState<boolean>(false);
  const [manualRollVal, setManualRollVal] = useState<string>('');

  // Total rolled result
  const totalRollResult = hasRolled ? diceSum + totalAttackModifier + extraSPBonus : 0;

  // EG calculation
  const egCalculation: AttackEGCalculation | null = useMemo(() => {
    if (!hasRolled) return null;
    return calculateAttackEG(totalRollResult, effectiveTargetVTD, isFumble, isCrit);
  }, [hasRolled, totalRollResult, effectiveTargetVTD, isFumble, isCrit]);

  // Step 3: EG Allocation
  const [egDamageSpent, setEgDamageSpent] = useState<number>(0);
  const [egStoerendSpent, setEgStoerendSpent] = useState<number>(0);
  const [betaeubungsschlag, setBetaeubungsschlag] = useState<boolean>(false);
  const [egManoeverExtraJe, setEgManoeverExtraJe] = useState<Record<string, number>>({});
  const egManoeverExtra = Object.values(egManoeverExtraJe).reduce((a, b) => a + b, 0);

  // Deckung (Fernkampf): zusätzliche EG für einen Treffer, sonst trifft der Angriff die Deckung (GRW S. 163)
  const egGesamt = egCalculation?.eg ?? 0;
  const trifftDeckung = !!egCalculation?.isSuccess && egGesamt < egDeckung;
  const trifft = !!egCalculation?.isSuccess && !trifftDeckung;
  const totalEgAvailable = Math.max(0, egGesamt - egDeckung);
  // Jedes angesagte Meisterschafts-Manöver kostet EG; reichen sie nicht, ist es ein Streiftreffer und alle EG verfallen
  const manoeverKosten = kombi.egKosten;
  const streiftreffer = trifft && totalEgAvailable < manoeverKosten;
  const freieEg = streiftreffer ? 0 : Math.max(0, totalEgAvailable - manoeverKosten);
  const totalEgAllocated = egDamageSpent + egStoerendSpent + (betaeubungsschlag ? (betaeubung?.eg ?? 1) : 0) + egManoeverExtra;
  const remainingEG = Math.max(0, freieEg - totalEgAllocated);
  // Nach dem Wurf ist nichts vorbelegt: Die Spieler verteilen die EG selbst; vor dem Schadenswurf fragt der Dialog nach.
  const [egNachfrage, setEgNachfrage] = useState(false);
  const verteileStandard = (_eg: number, _erfolg: boolean) => {
    setEgNachfrage(false);
    setEgDamageSpent(0);
    setEgStoerendSpent(0);
    setBetaeubungsschlag(false);
    setEgManoeverExtraJe({});
  };

  // Step 4: Integrated Damage Roll
  const [damageRollResult, setDamageRollResult] = useState<DamageRollResult | null>(null);
  const attackCausesDamage = Boolean(weapon.damage !== '0' && weapon.damage !== '-');

  // Execute the attack roll
  const handleExecuteRoll = (forcedType?: RollType) => {
    const typeToUse = forcedType || rollType;
    setIsRolling(true);

    setTimeout(() => {
      let rolledDice: number[] = [];
      let sum = 0;
      let fumble = false;
      let crit = false;

      // Würfel nach GRW S. 16–19 (gemeinsame Würfellogik), mit Großmeister ab 15 Fertigkeitspunkten
      const w = wuerfeln(typeToUse, !!target.grossmeister);
      rolledDice = w.dice;
      sum = w.result;
      fumble = w.isFumble;
      crit = w.isCrit;

      setRollDice(rolledDice);
      setDiceSum(sum);
      setIsFumble(fumble);
      setIsCrit(crit);
      setHasRolled(true);
      setIsRolling(false);
      setDamageRollResult(null);

      // Default EG allocation for damage
      const calc = calculateAttackEG(
        sum + totalAttackModifier + extraSPBonus,
        effectiveTargetVTD,
        fumble,
        crit
      );
      verteileStandard(calc.eg, calc.isSuccess);
    }, 180);
  };

  const handleManualRollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(manualRollVal, 10);
    if (isNaN(val) || val < 2 || val > 30) {
      toast.error('Bitte eine gültige Würfelsumme zwischen 2 und 30 eingeben');
      return;
    }
    const d1 = Math.floor(val / 2);
    const d2 = val - d1;
    setRollDice([d1, d2]);
    setDiceSum(val);
    // Patzer und Triumph nach den Grenzen des Pakets (GRW S. 18: Summe ≤ 3 bzw. ≥ 19)
    const grenzen = wurfgrenzen();
    setIsFumble(val <= grenzen.patzer);
    setIsCrit(val >= grenzen.triumph);
    setHasRolled(true);
    setManualInputOpen(false);
    setDamageRollResult(null);

    const calc = calculateAttackEG(
      val + totalAttackModifier + extraSPBonus,
      effectiveTargetVTD,
      val <= grenzen.patzer,
      val >= grenzen.triumph
    );
    verteileStandard(calc.eg, calc.isSuccess);
  };

  // Perform the Damage Roll
  /** Schaden würfeln; sind noch EG frei, erst nachfragen (Wuchtangriff oder verfallen lassen) */
  useEffect(() => {
    if (egNachfrage) (document.querySelector('[data-testid="eg-nachfrage"]') as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
  }, [egNachfrage]);
  const schadenAnfragen = () => {
    if (!streiftreffer && remainingEG > 0 && !damageRollResult) setEgNachfrage(true);
    else handleRollDamage();
  };
  const handleRollDamage = (zusatzWucht = 0) => {
    setEgNachfrage(false);
    if (zusatzWucht) setEgDamageSpent(w => w + zusatzWucht);
    const egBonus = streiftreffer ? 0 : (egDamageSpent + zusatzWucht) * wuchtJeEg;
    const res = executeAttackDamageRoll({
      baseFormula: weapon.damage || '1W6',
      // Beim Streiftreffer bleiben die Effekte der Manöver aus; Schadenseinschränkungen (halber Schaden) gelten für den ganzen Angriff weiter
      maneuverExtraFormulas: streiftreffer ? [] : kombi.extraDamageFormulas,
      maneuverFixedDamage: streiftreffer ? 0 : kombi.fixedExtraDamage,
      egBonusDamage: egBonus + extraSpellDmg,
      damageMultiplier: kombi.damageMultiplier,
      targetArmorReduction: targetArmor,
      maneuverConditions: streiftreffer ? [] : kombi.zustaende,
      stunDamage: betaeubungsschlag && !streiftreffer,
      streiftrefferAbzug: streiftreffer ? kombi.angesagt * regeln.streiftrefferSchaden : 0,
    });

    setDamageRollResult(res);
    const spellDmgText = extraSpellDmg > 0 ? ` (inkl. ${spellWeaponDamage.bonusText})` : '';
    toast.success(`${res.netDamage} Schaden erzielt! (${res.grossDamage} Brutto - ${res.effectiveArmor} RS)${spellDmgText}`);
  };

  // Complete and Log Attack
  const handleCompleteAttack = () => {
    if (!egCalculation) return;

    if (trifft) {
      // Record to dice protocol
      if (onRecordRoll) {
        const activeSpellLabels = spellAttackBonuses
          .filter((b) => activeSpellBonusIds.has(b.id))
          .map((b) => `${b.source} (+${b.bonus})`);
        const allBuffLabels = [...situativ.labels, ...activeSpellLabels];

        onRecordRoll({
          id: `atk_${Date.now()}`,
          type: 'roll',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          label: `Angriff mit ${weapon.name} (${selectedManeuver.name})${allBuffLabels.length ? ` [${allBuffLabels.join(', ')}]` : ''}`,
          d10s: rollDice,
          baseVal: totalAttackModifier,
          modifier: extraSPBonus,
          total: totalRollResult,
          isTriumph: isCrit,
          isPatzer: isFumble,
          outcome: `${egCalculation.outcomeLabel} (${egCalculation.eg} EG vs. VTD ${effectiveTargetVTD})${
            damageRollResult ? ` · ${damageRollResult.netDamage} Schaden (${damageRollResult.breakdownText})` : ''
          }`,
        });
      }

      onAttackSuccess({
        weapon,
        maneuver: selectedManeuver,
        maneuvers: kombi.angesagt ? kombi.manoever : [],
        totalRoll: totalRollResult,
        targetVTD: effectiveTargetVTD,
        differenz: egCalculation.differenz,
        eg: egCalculation.eg,
        egDamageSpent,
        egStoerendSpent,
        betaeubungsschlag,
        egManoeverExtra,
        egManoeverExtraJe,
        egDeckung,
        streiftreffer,
        isCrit,
        damageRoll: damageRollResult || undefined,
        notes: attackNote,
      });

      const dmgText = damageRollResult ? ` · ${damageRollResult.netDamage} Schaden angerichtet!` : '';
      toast.success(`Treffer mit ${weapon.name}! (${egCalculation.eg} EG)${dmgText}`);
    } else {
      if (onRecordRoll) {
        onRecordRoll({
          id: `atk_miss_${Date.now()}`,
          type: 'roll',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          label: `Angriff mit ${weapon.name} (${selectedManeuver.name})${situativ.labels.length ? ` [${situativ.labels.join(', ')}]` : ''}`,
          d10s: rollDice,
          baseVal: totalAttackModifier,
          modifier: extraSPBonus,
          total: totalRollResult,
          isTriumph: false,
          isPatzer: isFumble,
          outcome: `${trifftDeckung ? 'Trifft die Deckung' : egCalculation.outcomeLabel} (Diff: ${egCalculation.differenz} vs. VTD ${effectiveTargetVTD})`,
        });
      }

      onAttackFailure({
        weapon,
        maneuver: selectedManeuver,
        totalRoll: totalRollResult,
        targetVTD: effectiveTargetVTD,
        differenz: egCalculation.differenz,
        isFumble,
        notes: trifftDeckung ? ['Trifft die Deckung', attackNote].filter(Boolean).join(' · ') : attackNote,
      });

      toast(trifftDeckung ? `Angriff mit ${weapon.name} trifft die Deckung (${egGesamt} von ${egDeckung} EG).` : `Angriff mit ${weapon.name} verfehlt (Diff ${egCalculation.differenz}).`);
    }

    onClose();
  };

  useEscape(onClose);
  return (
    <Dialoghintergrund
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalHeadingId} className="animate-fadeIn"
    >
      <Dialogfenster breite="2xl">
        {/* ── HEADER ── */}
        <Dialogkopf
          titelId={modalHeadingId}
          symbol={<Sword size={22} />}
          ton="schaden"
          titel={<>Angriff: {weapon.name} <Marke klein>{skillName}</Marke></>}
          untertitel={
            <span className="tabular-nums flex items-center gap-2 flex-wrap">
              <span>Basis-AT: <strong className="text-schrift">{skillTotal}</strong></span>
              <span>·</span>
              <span>Schaden: <strong className="text-schrift">{weapon.damage || '1W6'}</strong></span>
              {weapon.wgs && (<><span>·</span><span>WGS: {weapon.wgs} Ticks</span></>)}
              {weapon.attributes && (<><span>·</span><span className="italic truncate max-w-[180px]" title={weapon.attributes}>{weapon.attributes}</span></>)}
            </span>
          }
          aktionen={splitterpunkte > 0 && (
            <Knopf art="sekundaer" onClick={() => { onSpendSplitterpunkt(); setExtraSPBonus((prev) => prev + 3); }} title="Splitterpunkt einsetzen: +3 auf den Wurf">
              <Sparkles size={13} aria-hidden="true" />
              <span>+3 (SP: {splitterpunkte})</span>
            </Knopf>
          )}
          onSchliessen={onClose}
        />

        {/* ── MODAL BODY (Scrollable) ── */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-schrift">
          {/* ── ROW 1: ZIEL-VERTEIDIGUNG & SITUATION ── */}
          <div className="bg-seite border border-rahmen rounded-karte p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-gold fantasy-font flex items-center gap-1.5">
                <Target size={14} /> 1. Ziel &amp; Verteidigung (VTD)
              </span>
              <span className="text-xs tabular-nums font-bold text-schrift bg-seite px-2 py-0.5 rounded-knopf border border-rahmen">
                Effektive VTD: {effectiveTargetVTD}
              </span>
            </div>

            {/* VTD Input & Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-leise block mb-1">{WIDERSTAND_TEXT[selectedManeuver.targetResistance ?? 'VTD']} des Ziels:</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 flex items-center bg-seite border border-rahmen rounded-knopf overflow-hidden">
                    <Knopf
                      onClick={() => setTargetVTD((prev) => Math.max(5, prev - 1))}
                    >
                      −
                    </Knopf>
                    <input
                      type="number"
                      value={targetVTD}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setTargetVTD(Math.max(1, parseInt(e.target.value, 10) || 15))}
                      className="w-full text-center bg-transparent text-schrift tabular-nums font-bold text-sm py-1.5 focus:outline-hidden"
                    />
                    <Knopf
                      onClick={() => setTargetVTD((prev) => prev + 1)}
                    >
                      +
                    </Knopf>
                  </div>
                  {/* Quick Presets */}
                  <div className="flex gap-1">
                    {[15, 18, 21, 24].map((val) => (
                      <Wahlknopf gewaehlt={targetVTD === val} mittig key={val} onClick={() => setTargetVTD(val)} title={`Standard VTD ${val}`} className="text-xs tabular-nums font-semibold">
                        {val}
                      </Wahlknopf>
                    ))}
                  </div>
                </div>
              </div>

              {/* Target Armor (RS) */}
              <div>
                <label className="text-xs text-leise block mb-1">Gegnerische Rüstung (RS):</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 flex items-center bg-seite border border-rahmen rounded-knopf overflow-hidden">
                    <Knopf
                      onClick={() => setTargetArmor((prev) => Math.max(0, prev - 1))}
                    >
                      −
                    </Knopf>
                    <input
                      type="number"
                      value={targetArmor}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setTargetArmor(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full text-center bg-transparent text-schrift tabular-nums font-bold text-sm py-1.5 focus:outline-hidden"
                    />
                    <Knopf
                      onClick={() => setTargetArmor((prev) => prev + 1)}
                    >
                      +
                    </Knopf>
                  </div>
                  <div className="flex gap-1">
                    {[0, 2, 4, 6].map((rs) => (
                      <Wahlknopf gewaehlt={targetArmor === rs} mittig key={rs} onClick={() => setTargetArmor(rs)} className="text-xs tabular-nums font-semibold">
                        {rs}
                      </Wahlknopf>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <SituativeBoni boni={situativ.boni} gewaehlt={situativ.gewaehlt} onToggle={situativ.umschalten} dunkel typen={situativ.typen} zielTypus={situativ.zielTypus} onZielTypus={situativ.setZielTypus} />

            {/* Splittermond GRW: Aktive Zauber-Wirkungen (Aura des Anführers, Beflügelte Waffe, Flammende Waffe, etc.) */}
            {(spellAttackBonuses.length > 0 || spellWeaponDamage.totalDamage > 0) && (
              <div className="bg-magie-grund border border-magie rounded-karte p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-magie flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                    <Sparkles size={13} className="text-magie" /> Aktive Zauber-Wirkungen
                  </span>
                  {spellAttackBonusTotal > 0 && (
                    <span className="tabular-nums font-bold px-2 py-0.5 rounded-knopf bg-magie-grund text-schrift border border-magie">
                      AT-Bonus: +{spellAttackBonusTotal}
                      {spellAttackBonusRoh > spellAttackBonusTotal && ` (von +${spellAttackBonusRoh}, Höchstbonus GRW S. 18)`}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {spellAttackBonuses.map((b) => {
                    const isActive = activeSpellBonusIds.has(b.id);
                    return (
                      <Wahlknopf gewaehlt={isActive} mittig key={b.id} onClick={() => toggleSpellBonus(b.id)} title={`${b.description} (Klicken zum ${isActive ? 'Abwählen' : 'Aktivieren'})`} className="text-xs font-semibold">
                        {isActive ? <Check size={12} className="text-magie" /> : <X size={12} className="text-leise" />}
                        <span>{b.source}</span>
                        <span className="tabular-nums font-bold text-magie">+{b.bonus} AT</span>
                      </Wahlknopf>
                    );
                  })}
                  {spellWeaponDamage.totalDamage > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-knopf text-xs font-semibold bg-erschoepft-grund text-gold-hell border border-erschoepft ">
                      <Flame size={12} className="text-erschoepft" />
                      <span>{spellWeaponDamage.bonusText}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Lage beim Angriff: alle Werte aus dem GRW-Paket (Kampfpositionen S. 170, Situationen S. 162–163, 170–171) */}
            <div className="pt-2 border-t border-rahmen space-y-2 text-xs" data-testid="kampflage">
              {positionen.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1" title={lage.quellen.positionen}>
                    <span className="text-leise">Eigene Position</span>
                    <select value={eigenePosition} onChange={(e) => setEigenePosition(e.target.value)} data-testid="position-eigene"
                      className="min-h-11 bg-seite border border-rahmen rounded-knopf px-2 text-schrift">
                      {positionen.map((p) => { const w = positionsModifikator(p, art, 'eigene', weapon.name); return <option key={p} value={p}>{p}{w ? ` (${w > 0 ? '+' : ''}${w})` : ''}</option>; })}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1" title={lage.quellen.positionen}>
                    <span className="text-leise">Position des Ziels</span>
                    <select value={zielPosition} onChange={(e) => setZielPosition(e.target.value)} data-testid="position-ziel"
                      className="min-h-11 bg-seite border border-rahmen rounded-knopf px-2 text-schrift">
                      {positionen.map((p) => { const w = positionsModifikator(p, art, 'gegnerisch', weapon.name); return <option key={p} value={p}>{p}{w ? ` (${w > 0 ? '+' : ''}${w})` : ''}</option>; })}
                    </select>
                  </label>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {lage.taktischerVorteil && (
                  <EgZaehler titel="Taktische Vorteile" text={`+${lage.taktischerVorteil.bonus} je Vorteil (${lage.quellen.vorteil})`}
                    wert={taktischeVorteile} setze={setTaktischeVorteile} mehrMoeglich testid="lage-vorteil" einheit="Vorteil" />
                )}
                {nahkampf && lage.ueberzahl && (
                  <EgZaehler titel="Überzahl" text={`+${lage.ueberzahl.bonusJeKaempfer} je überzähligem Kämpfer, höchstens +${lage.ueberzahl.hoechstens} (${lage.quellen.ueberzahl})`}
                    wert={ueberzahl} setze={setUeberzahl} mehrMoeglich={ueberzahl * lage.ueberzahl.bonusJeKaempfer < lage.ueberzahl.hoechstens} testid="lage-ueberzahl" einheit="Kämpfer" />
                )}
                {(nahkampf ? lage.lueckeSuchen : lage.zielen) && (() => {
                  const r = (nahkampf ? lage.lueckeSuchen : lage.zielen)!;
                  return (
                    <EgZaehler titel={nahkampf ? 'Lücke suchen' : 'Zielen'} text={`+${r.bonus} je ${r.ticks} Ticks, höchstens +${r.hoechstens} (${nahkampf ? lage.quellen.nah : lage.quellen.fern})`}
                      wert={vorbereitungTicks} setze={setVorbereitungTicks} mehrMoeglich={vorbereitungsBonus(vorbereitungTicks, art) < r.hoechstens} testid="lage-ticks" einheit="Tick" />
                  );
                })()}
                {!nahkampf && lage.deckung && (
                  <div className="bg-seite p-2.5 rounded-knopf border border-rahmen" title={lage.quellen.fern}>
                    <span className="font-bold text-schrift block mb-1">Deckung des Ziels</span>
                    <div className="flex gap-1" role="group" aria-label="Deckung des Ziels">
                      {(['keine', 'leicht', 'schwer'] as const).map((d) => (
                        <Knopf key={d} art={deckung === d ? 'primaer' : 'neutral'} aria-pressed={deckung === d} onClick={() => setDeckung(d)} data-testid={`deckung-${d}`}>
                          {d === 'keine' ? 'Keine' : `${d === 'leicht' ? 'Leicht' : 'Schwer'} (+${lage.deckung![d]} EG)`}
                        </Knopf>
                      ))}
                    </div>
                  </div>
                )}
                {!nahkampf && lage.kampfgetuemmel && (
                  <div className="bg-seite p-2.5 rounded-knopf border border-rahmen flex items-center justify-between gap-2" title={lage.quellen.fern}>
                    <div>
                      <span className="font-bold text-schrift block">Ziel im Kampfgetümmel</span>
                      <span className="text-[11px] text-leise">{scharfschuetze ? `entfällt (${scharfschuetze})` : `−${lage.kampfgetuemmel.malus} auf den Angriff`}</span>
                    </div>
                    <Knopf art={kampfgetuemmel ? 'primaer' : 'neutral'} aria-pressed={kampfgetuemmel} onClick={() => setKampfgetuemmel((v) => !v)} data-testid="lage-getuemmel">
                      {kampfgetuemmel ? 'Ja' : 'Nein'}
                    </Knopf>
                  </div>
                )}
              </div>
              {(lageTeile.length > 0 || egDeckung > 0) && (
                <div className="text-leise" data-testid="lage-summe">
                  Lage: {lageTeile.map((t) => `${t.text} ${t.wert > 0 ? '+' : ''}${t.wert}`).join(', ')}
                  {egDeckung > 0 && `${lageTeile.length ? ' · ' : ''}Deckung: ${egDeckung} EG zusätzlich für einen Treffer`}
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-leise text-xs">Sonstiger Modifikator (Spielleitung):</span>
                <Knopf nurSymbol aria-label="Modifikator −1" onClick={() => setSituationalMod((prev) => prev - 1)}>−</Knopf>
                <span className="w-7 text-center tabular-nums font-bold text-xs text-schrift">
                  {situationalMod >= 0 ? `+${situationalMod}` : situationalMod}
                </span>
                <Knopf nurSymbol aria-label="Modifikator +1" onClick={() => setSituationalMod((prev) => prev + 1)}>+</Knopf>
              </div>
            </div>

            {/* Conditions & Wound Penalty summary */}
            {(woundPenalty !== 0 || conditionMods.length > 0) && (
              <div className="pt-2 border-t border-rahmen flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-leise flex items-center gap-1">
                  <AlertCircle size={13} className="text-gold" />
                  Aktive Abzüge:
                </span>
                {woundPenalty !== 0 && (
                  <span className="bg-schaden-grund text-schrift px-2 py-0.5 rounded-knopf text-[11px] font-bold border border-schaden">
                    Wundabzug: {woundPenalty}
                  </span>
                )}
                {conditionMods.map((c) => (
                  <Wahlknopf gewaehlt={activeConditionsState[c.id]} ton="gefahr" mittig key={c.id} onClick={() =>
                      setActiveConditionsState((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                    } className="text-[11px] font-bold">
                    {c.label} ({c.malus})
                  </Wahlknopf>
                ))}
              </div>
            )}
          </div>

          {/* ── ROW 2: MANÖVER-AUSWAHL (EXAKT NACH REGELWERK) ── */}
          <div className="bg-seite border border-rahmen rounded-karte p-3.5 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-gold fantasy-font flex items-center gap-1.5">
                <Zap size={14} /> 2. Meisterschafts-Manöver ansagen
              </span>
              <span className="text-xs text-leise font-medium" title={regeln.quelle}>
                {regeln.kombination.mehrere ? 'mehrere gegen denselben Widerstand möglich' : `${availableManeuvers.filter((m) => m.type === 'mastery').length} erlernte Meisterschaften`}
              </span>
            </div>

            {/* Maneuvers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableManeuvers.map((m) => {
                const isMastery = m.type === 'mastery';
                const isSelected = isMastery ? gewaehlteManoever.some((g) => g.id === m.id) : gewaehlteManoever.length === 0;
                const sperre = isMastery && !isSelected && regeln.kombination.mehrere ? manoeverHinzufuegbar(gewaehlteManoever, m, regeln) : null;
                return (
                  <Wahlknopf gewaehlt={isSelected} key={m.id} onClick={() => umschaltenManoever(m)} disabled={!!sperre} title={[sperre ?? '', m.page ? `${m.source ?? 'GRW'} S. ${m.page}` : '', ...(m.belege ?? [])].filter(Boolean).join('\n') || undefined} data-testid={`manoever-${m.id}`} className="relative">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-schrift">
                        <span>{m.name}</span>
                      </div>
                      <span
                        className={`text-[11px] px-1.5 py-0.2 rounded-knopf font-semibold uppercase tracking-wider ${
                          isMastery
                            ? 'bg-erschoepft-grund text-gold-hell border border-erschoepft'
                            : 'bg-seite text-schrift'
                        }`}
                      >
                        {isMastery ? `${m.egCost} EG` : 'Ohne'}
                      </span>
                    </div>
                    <p className="text-[11px] text-schrift leading-snug line-clamp-2">
                      {m.shortDesc}
                    </p>
                  </Wahlknopf>
                );
              })}
            </div>

            {/* Beschreibung und Voraussetzungen der angesagten Manöver (aus dem Paket) */}
            {kombi.angesagt > 0 && (
              <div className="bg-seite p-2.5 rounded-knopf border border-rahmen text-xs text-schrift mt-1 space-y-1">
                {kombi.manoever.map((m) => (
                  <div key={m.id}>
                    <span className="font-bold text-gold-hell">{m.name}</span>
                    {m.page ? <span className="text-leise"> ({m.source ?? 'GRW'} S. {m.page})</span> : null}:{' '}
                    <span>{m.description}</span>
                    {m.hoechstensGk && <span> Nur gegen Ziele bis Größenklasse {m.hoechstensGk}.</span>}
                  </div>
                ))}
                {kombi.angesagt > 1 && (
                  <div data-testid="manoever-kombination">
                    Zusammen: {kombi.egKosten} EG, gegen {WIDERSTAND_TEXT[kombi.widerstand]}
                    {kombi.damageMultiplier !== 1 && regeln.kombination.schadenFuerAngriff && `, ${kombi.damageMultiplier === 0 ? 'kein Schaden' : 'halber Schaden'} für den ganzen Angriff`}.
                  </div>
                )}
                {kombi.voraussetzungen.includes('zielen') && (
                  <div data-testid="manoever-voraussetzung" className={!nahkampf && vorbereitungTicks === 0 ? 'text-schaden font-semibold' : ''}>
                    Voraussetzung: mindestens eine Zielen-Aktion vor dem Angriff{!nahkampf && vorbereitungTicks === 0 ? ' – bei „Zielen“ oben sind noch keine Ticks eingetragen.' : '.'}
                  </div>
                )}
                {kombi.voraussetzungen.includes('ringend') && <div data-testid="manoever-voraussetzung">Voraussetzung: Angreifer und Ziel sind ringend.</div>}
              </div>
            )}
          </div>

          {/* ── ROW 3: WURF AUSFÜHREN ── */}
          <div className="bg-seite border border-rahmen rounded-karte p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-gold fantasy-font flex items-center gap-1.5">
                <Dice1 size={14} /> 3. Angriffswurf (2W10 + AT vs. VTD)
              </span>
              <div className="flex items-center gap-1">
                {(['standard', 'safe', 'risk'] as RollType[]).map((mode) => (
                  <Wahlknopf gewaehlt={rollType === mode} mittig key={mode} onClick={() => {
                      setRollType(mode);
                      if (hasRolled) handleExecuteRoll(mode);
                    }} className="text-xs font-medium">
                    {mode === 'standard' ? 'Standard' : mode === 'safe' ? 'Sicherheit' : 'Risiko'}
                  </Wahlknopf>
                ))}
              </div>
            </div>

            {/* Total calculation formula bar */}
            <div className="bg-seite p-2.5 rounded-knopf border border-rahmen flex items-center justify-between text-xs tabular-nums flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-leise">Probe:</span>
                <span className="text-schrift font-bold">2W10</span>
                <span>+</span>
                <span title="Basis-AT">{skillTotal} AT</span>
                {woundPenalty !== 0 && (
                  <span className="text-schaden">({woundPenalty} Wunde)</span>
                )}
                {totalConditionPenalty !== 0 && (
                  <span className="text-schaden">({totalConditionPenalty} Zustand)</span>
                )}
                {situativ.summe !== 0 && (
                  <span className="text-unverletzt">({situativ.summe > 0 ? '+' : ''}{situativ.summe} Stärken/Meisterschaften)</span>
                )}
                {situationalMod + situationPresetBonus !== 0 && (
                  <span className="text-unverletzt">
                    ({situationalMod + situationPresetBonus > 0 ? `+${situationalMod + situationPresetBonus}` : situationalMod + situationPresetBonus} Sit.)
                  </span>
                )}
                {extraSPBonus > 0 && <span className="text-gold">(+{extraSPBonus} SP)</span>}
                <span>=</span>
                <strong className="text-unverletzt text-sm">
                  2W10 {totalAttackModifier + extraSPBonus >= 0 ? `+ ${totalAttackModifier + extraSPBonus}` : `- ${Math.abs(totalAttackModifier + extraSPBonus)}`}
                </strong>
              </div>

              <span className="text-leise">
                Ziel-{selectedManeuver.targetResistance ?? 'VTD'}: <strong className="text-schrift">{effectiveTargetVTD}</strong>
              </span>
            </div>

            {/* Roll trigger buttons */}
            <div className="flex items-center gap-2">
              <Knopf art="primaer"
                onClick={() => handleExecuteRoll()}
                disabled={isRolling}
                className="flex-1 text-sm gap-2 active:scale-98"
              >
                <Dice1 size={18} className="text-gold" />
                <span>{hasRolled ? 'Erneut würfeln' : 'Angriff würfeln'}</span>
              </Knopf>

              <Knopf
                onClick={() => setManualInputOpen((prev) => !prev)}
                className="text-xs"
                title="Ergebnis vom echten Spieltisch eingeben"
              >
                Tisch-Wurf
              </Knopf>
            </div>

            {/* Manual table dice input */}
            {manualInputOpen && (
              <form onSubmit={handleManualRollSubmit} className="flex items-center gap-2 bg-seite p-2 rounded-knopf border border-erschoepft">
                <span className="text-xs text-schrift">Würfelsumme (2W10):</span>
                <input
                  type="number"
                  min="2"
                  max="30"
                  placeholder="z.B. 14"
                  value={manualRollVal}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setManualRollVal(e.target.value)}
                  className="w-20 bg-seite text-schrift tabular-nums font-bold text-center px-2 py-1 rounded-knopf border border-rahmen text-xs"
                />
                <Knopf art="primaer"
                  type="submit"
                  className="text-xs"
                >
                  Übernehmen
                </Knopf>
              </form>
            )}

            {/* ── ROLL RESULT DISPLAY ── */}
            {hasRolled && egCalculation && (
              <div
                className={`p-3.5 rounded-karte border transition-all ${
                  egCalculation.isSuccess
                    ? isCrit
                      ? 'bg-erschoepft-grund border-erschoepft shadow-amber-950/20'
                      : 'bg-unverletzt-grund border-unverletzt'
                    : 'bg-schaden-grund border-schaden'
                }`}
              >
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1">
                      {rollDice.map((d, i) => (
                        <span
                          key={i}
                          className="w-8 h-8 rounded-knopf bg-seite border border-rahmen text-schrift tabular-nums font-extrabold flex items-center justify-center text-sm "
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                    <div>
                      <span className="text-xs text-leise tabular-nums">
                        [{rollDice.join(' + ')}] + {totalAttackModifier + extraSPBonus} =
                      </span>
                      <span className="font-extrabold text-lg text-schrift ml-1.5 tabular-nums">
                        {totalRollResult}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-sm font-bold fantasy-font tracking-wide px-2.5 py-0.5 rounded-knopf border ${
                        trifft
                          ? isCrit
                            ? 'bg-erschoepft-grund text-gold-hell border-erschoepft'
                            : 'bg-unverletzt-grund text-unverletzt border-unverletzt'
                          : 'bg-schaden-grund text-schrift border-schaden'
                      }`}
                    >
                      {egCalculation.outcomeLabel}
                    </span>
                    {trifftDeckung && <div className="text-xs text-schaden font-semibold mt-0.5" data-testid="trifft-deckung">Trifft die Deckung ({egGesamt} von {egDeckung} EG)</div>}
                    <div className="text-xs text-leise tabular-nums mt-0.5">
                      Diff: {egCalculation.differenz >= 0 ? `+${egCalculation.differenz}` : egCalculation.differenz} vs. VTD {effectiveTargetVTD}
                    </div>
                  </div>
                </div>

                {trifft && (
                  <div className="mt-2.5 pt-2.5 border-t border-rahmen flex items-center justify-between text-xs">
                    <span className="font-semibold text-schrift">
                      Erfolgsgrade (EG):{' '}
                      <strong className="text-unverletzt text-sm font-bold tabular-nums">
                        {egCalculation.eg} EG
                      </strong>
                    </span>
                    <span className="text-leise">
                      Verbleibend zum Zuweisen:{' '}
                      <strong
                        className={`tabular-nums font-bold ${
                          remainingEG === 0 ? 'text-schrift' : 'text-gold'
                        }`}
                      >
                        {remainingEG} EG
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── ROW 4: ERFOLGSGRADE EINSETZEN (WENN TREFFER) – freie Manöver und Kosten des Manövers aus dem Paket, GRW S. 161 ── */}
          {hasRolled && egCalculation && trifft && (
            <div className="bg-seite border border-rahmen rounded-karte p-3.5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-gold fantasy-font flex items-center gap-1.5">
                  <Award size={14} /> 4. Erfolgsgrade einsetzen ({egCalculation.eg} EG{egDeckung > 0 ? `, davon ${egDeckung} für die Deckung` : ''})
                </span>
                <span className="text-xs tabular-nums text-leise">
                  Eingesetzt: {totalEgAllocated + (streiftreffer ? 0 : manoeverKosten)} / {totalEgAvailable} EG
                </span>
              </div>

              {egDeckung > 0 && (
                <div className="p-2.5 rounded-knopf bg-erhoeht border border-rahmen text-xs text-schrift" data-testid="eg-deckung" title={lage.quellen.fern}>
                  Deckung: {egDeckung} EG zusätzlich für den Treffer
                </div>
              )}
              {kombi.angesagt > 0 && (
                streiftreffer ? (
                  <div className="p-2.5 rounded-knopf bg-schaden-grund border border-schaden text-xs text-schrift" data-testid="streiftreffer" title={regeln.quelle}>
                    <strong>Streiftreffer:</strong> {selectedManeuver.name} {kombi.angesagt > 1 ? 'brauchen' : 'braucht'} {manoeverKosten} EG. Die Wirkung {kombi.angesagt > 1 ? 'der Manöver' : 'des Manövers'} bleibt aus,
                    alle Erfolgsgrade verfallen, und der Schaden sinkt um {kombi.angesagt * regeln.streiftrefferSchaden} (alternativ {kombi.angesagt * regeln.streiftrefferBetaeubung} Punkte
                    Betäubungsschaden für den Angreifer) – {regeln.quelle}.
                  </div>
                ) : (
                  <div className="p-2.5 rounded-knopf bg-erhoeht border border-rahmen text-xs text-schrift" data-testid="manoever-kosten">
                    {selectedManeuver.name}: {manoeverKosten} EG für {kombi.angesagt > 1 ? 'die angesagten Manöver' : 'das angesagte Manöver'}
                  </div>
                )
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Wuchtangriff */}
                <EgZaehler
                  titel="Wuchtangriff"
                  text={`+${wuchtJeEg} Schaden je EG${wuchtJeEg > 1 ? ' (Merkmal der Waffe)' : ''}`}
                  wert={egDamageSpent}
                  setze={setEgDamageSpent}
                  mehrMoeglich={remainingEG > 0}
                  testid="eg-wucht"
                />

                {/* Störender Angriff */}
                {stoerend && (
                  <EgZaehler
                    titel="Störender Angriff"
                    text={`Entschlossenheit des Ziels gegen Unterbrechung +${stoerend.je_eg?.entschlossenheit_erschwert} je EG`}
                    wert={egStoerendSpent}
                    setze={setEgStoerendSpent}
                    mehrMoeglich={remainingEG > 0}
                    testid="eg-stoerend"
                  />
                )}

                {/* Betäubungsschlag (nur Nahkampf) */}
                {betaeubung && (
                  <div className="bg-seite p-2.5 rounded-knopf border border-rahmen flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-schrift block">Betäubungsschlag</span>
                      <span className="text-[11px] text-leise">{betaeubung.eg ?? 1} EG: Schaden wird Betäubungsschaden</span>
                    </div>
                    <Knopf
                      art={betaeubungsschlag ? 'erholung' : 'neutral'}
                      aria-pressed={betaeubungsschlag}
                      disabled={!betaeubungsschlag && remainingEG < (betaeubung.eg ?? 1)}
                      onClick={() => setBetaeubungsschlag((v) => !v)}
                      data-testid="eg-betaeubung"
                    >
                      {betaeubungsschlag ? 'Gewählt' : `${betaeubung.eg ?? 1} EG`}
                    </Knopf>
                  </div>
                )}

                {/* Weitere EG je angesagtem Manöver */}
                {!streiftreffer && kombi.manoever.filter((m) => m.jeWeiteremEg).map((m) => (
                  <EgZaehler
                    key={m.id}
                    titel={m.name}
                    text={`Je weiterem EG: ${m.jeWeiteremEg}`}
                    wert={egManoeverExtraJe[m.id] ?? 0}
                    setze={(f) => setEgManoeverExtraJe((alt) => ({ ...alt, [m.id]: f(alt[m.id] ?? 0) }))}
                    mehrMoeglich={remainingEG > 0}
                    testid={kombi.manoever.filter((x) => x.jeWeiteremEg).length > 1 ? `eg-manoever-${m.id}` : 'eg-manoever'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── ROW 5: DIREKTER SCHADENSWURF (INTEGRIERTER SCHADEN) ── */}
          {hasRolled && egCalculation && trifft && (
            <div className="bg-seite border border-rahmen rounded-karte p-3.5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-gold fantasy-font flex items-center gap-1.5">
                  <Flame size={14} className="text-schaden" /> 5. Schaden auswürfeln
                </span>
                <span className="text-xs tabular-nums text-schrift">
                  Formel: <strong className="text-schaden">{weapon.damage || '1W6'}</strong>
                  {selectedManeuver.extraDamageFormula && ` + ${selectedManeuver.extraDamageFormula}`}
                  {extraSpellDmg > 0 && ` + ${extraSpellDmg} Zauber`}
                  {!streiftreffer && egDamageSpent > 0 && ` + ${egDamageSpent * wuchtJeEg} EG`}
                </span>
              </div>

              {egNachfrage && (
                <div role="alertdialog" aria-label="Erfolgsgrade nicht eingesetzt" data-testid="eg-nachfrage" className="p-3 rounded-knopf bg-erhoeht border border-gold space-y-2 text-xs text-schrift">
                  <p><strong>{remainingEG} EG</strong> {remainingEG === 1 ? 'ist' : 'sind'} noch nicht eingesetzt.</p>
                  <div className="flex flex-wrap gap-2">
                    <Knopf art="sekundaer" onClick={() => handleRollDamage(remainingEG)} data-testid="eg-nachfrage-wucht">
                      Als Wuchtangriff (+{remainingEG * wuchtJeEg} Schaden) und würfeln
                    </Knopf>
                    <Knopf art="neutral" onClick={() => handleRollDamage()} data-testid="eg-nachfrage-verfallen">Verfallen lassen und würfeln</Knopf>
                    <Knopf art="neutral" onClick={() => setEgNachfrage(false)}>Zurück</Knopf>
                  </div>
                </div>
              )}

              {/* Damage Action Button */}
              <Knopf
                onClick={schadenAnfragen}
                className="w-full damage-roll-btn text-sm gap-2 active:scale-98"
              >
                <Flame size={16} />
                <span>
                  {damageRollResult
                    ? 'Schaden erneut würfeln'
                    : `Schaden würfeln (${weapon.damage || '1W6'}${
                        selectedManeuver.extraDamageFormula ? ` + ${selectedManeuver.extraDamageFormula}` : ''
                      }${extraSpellDmg > 0 ? ` + ${extraSpellDmg} Zauber` : ''}${
                        !streiftreffer && egDamageSpent > 0 ? ` + ${egDamageSpent * wuchtJeEg} EG` : ''
                      })`}
                </span>
              </Knopf>

              {/* Damage Roll Result Details */}
              {damageRollResult && (
                <div className="bg-seite p-3 rounded-karte border border-schaden space-y-2">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-leise tabular-nums">Waffenschaden:</span>
                      <span className="text-sm tabular-nums font-bold text-schrift">
                        [{damageRollResult.baseDice.join(', ')}]
                        {damageRollResult.baseBonus !== 0 && (damageRollResult.baseBonus > 0 ? ` + ${damageRollResult.baseBonus}` : ` - ${Math.abs(damageRollResult.baseBonus)}`)}
                      </span>
                      {damageRollResult.maneuverDice.length > 0 && (
                        <span className="text-xs text-gold-hell tabular-nums">
                          + Manöver [{damageRollResult.maneuverDice.join(', ')}]
                        </span>
                      )}
                      {extraSpellDmg > 0 && (
                        <span className="text-xs text-gold-hell tabular-nums">
                          + {extraSpellDmg} Zauber
                        </span>
                      )}
                      {egDamageSpent > 0 && (
                        <span className="text-xs text-unverletzt tabular-nums">
                          + {egDamageSpent * wuchtJeEg} EG
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-leise mr-1.5">Netto am Ziel:</span>
                      <span className="text-lg font-extrabold text-schaden tabular-nums">
                        {damageRollResult.netDamage} {damageRollResult.damageType}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-rahmen text-xs tabular-nums text-leise flex justify-between items-center flex-wrap gap-2">
                    <span>
                      Brutto: <strong className="text-schrift">{damageRollResult.grossDamage}</strong>
                      {targetArmor > 0 && (
                        <span>
                          {' '}· Rüstung: -{damageRollResult.effectiveArmor} RS
                          {damageRollResult.effectiveArmor < targetArmor && (
                            <span className="text-unverletzt"> ({targetArmor - damageRollResult.effectiveArmor} ignoriert)</span>
                          )}
                        </span>
                      )}
                    </span>

                    {damageRollResult.appliedConditions.length > 0 && (
                      <span className="text-gold font-bold">
                        Effekte: {damageRollResult.appliedConditions.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <input
              type="text"
              value={attackNote}
              onChange={(e) => setAttackNote(e.target.value)}
              placeholder="Notiz zum Ziel / Angriff (optional, z.B. 'Ork-Anführer mit Schild')..."
              className="w-full bg-seite border border-rahmen rounded-knopf text-xs text-schrift px-3 py-2 focus:outline-hidden focus:border-gold"
            />
          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="bg-seite p-3.5 sm:p-4 border-t border-rahmen flex items-center justify-between gap-2 shrink-0">
          <Knopf
            onClick={onClose}
            className="text-xs"
          >
            Abbrechen
          </Knopf>

          <div className="flex items-center gap-2">
            {hasRolled && (
              trifft && attackCausesDamage && !damageRollResult ? (
                <div className="flex items-center gap-2">
                  <Knopf art="primaer"
                    onClick={handleCompleteAttack}
                    className="text-xs underline decoration-dotted"
                    title="Angriff abschließen ohne Schaden auszuwürfeln"
                  >
                    Ohne Schaden vollenden
                  </Knopf>
                  <Knopf art="primaer"
                    onClick={schadenAnfragen}
                    className="text-xs sm:text-sm gap-1.5 active:scale-95"
                  >
                    <Flame size={16} className="text-schaden" />
                    <span>
                      Schaden würfeln ({weapon.damage || '1W6'}
                      {selectedManeuver.extraDamageFormula ? ` + ${selectedManeuver.extraDamageFormula}` : ''}
                      {!streiftreffer && egDamageSpent > 0 ? ` + ${egDamageSpent * wuchtJeEg} EG` : ''})
                    </span>
                  </Knopf>
                </div>
              ) : (
                <Knopf art="primaer"
                  onClick={handleCompleteAttack}
                  className="text-xs sm:text-sm gap-1.5"
                >
                  <Check size={16} />
                  <span>
                    Angriff vollenden
                    {damageRollResult ? ` (· ${damageRollResult.netDamage} Schaden)` : ''}
                  </span>
                </Knopf>
              )
            )}
          </div>
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};

export default AttackModal;
