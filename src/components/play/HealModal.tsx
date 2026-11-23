import { wundstufenVerschiebung } from '../../regelwerk/zustaende';
import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Wahlknopf, useEscape } from '../../fundament';
import React, { useId, useMemo, useState } from 'react';
import { Heart, X, Plus, Minus, Check, Sparkles, Activity } from 'lucide-react';
import type { HealthSlot, StatusCondition } from '../../types';
import { heilkundeAuswirkungen, heiltraenke, standardGesundheitsstufen } from '../../regelwerk/schadenUndHeilung';
import { useHausregeln } from '../../fundament/hausregeln';

export interface HealModalProps {
  onClose: () => void;
  maxLP: number;
  currentHealthSlots: HealthSlot[];
  activeConditions: StatusCondition[];
  /** Gesundheitsstufen (Standard: die fünf des GRW) */
  stufen?: { name: string; wundabzug: number }[];
  /** Für Begleiter: ohne Zustände des Helden; Name für die Überschrift */
  begleiter?: string;
  onApplyHeal: (result: {
    consumedHealed: number;
    exhaustedHealed: number;
    channeledHealed: number;
    /** kanalisierter Schaden, dessen Zustand aufgehoben ist: wird zu Betäubungsschaden (GRW S. 15, 173) */
    kanalisiertFreigegeben?: number;
    conditionsToRemove: string[];
    conditionsToReduceLevel: Array<{ id: string; newLevel: number }>;
    note?: string;
    healMethod?: string;
  }) => void;
}

/*
 * Heilung nach dem Grundregelwerk (S. 119–120, 173–174):
 * - Heilkunde, Heilzauber und Heiltränke heilen echten Schaden. Ob sie auch Betäubungsschaden heilen, regelt das GRW
 *   nicht; die Verteilung auf Betäubung gibt es deshalb nur mit „Hausregeln erlauben“.
 * - Betäubungsschaden heilt die Verschnaufpause, echten Schaden auch die Ruhephase: beides im Abschnitt „Rast“.
 * - Kanalisierter Schaden heilt nicht, solange sein Zustand besteht (S. 173); ist der Zustand aufgehoben, wird er zu
 *   Betäubungsschaden (Beispiel S. 15).
 * - „Freie Heilung“ (beliebige Punkte und Schadensarten) ist ein Werkzeug für Sonderfälle und nur mit Hausregeln wählbar.
 */
type HealMethodType = 'manual' | 'heilkunde' | 'heilmagie' | 'heiltrank';
type HealPriorityType = 'consumed_first' | 'exhausted_first' | 'only_consumed' | 'only_exhausted';

export const HealModal: React.FC<HealModalProps> = ({
  stufen: stufenProp,
  begleiter,
  onClose,
  maxLP,
  currentHealthSlots,
  activeConditions,
  onApplyHeal,
}) => {
  const stufen = useMemo(() => stufenProp ?? standardGesundheitsstufen(), [stufenProp]);
  const hausregeln = useHausregeln();
  const heilkunde = useMemo(() => heilkundeAuswirkungen(), []);
  const traenke = useMemo(() => heiltraenke(), []);
  const [trank, setTrank] = useState<string | null>(null);
  // Current slot damage counts
  const consumedCount = useMemo(
    () => currentHealthSlots.filter((s) => s.type === 'consumed').length,
    [currentHealthSlots]
  );
  const exhaustedCount = useMemo(
    () => currentHealthSlots.filter((s) => s.type === 'exhausted').length,
    [currentHealthSlots]
  );
  const channeledCount = useMemo(
    () => currentHealthSlots.filter((s) => s.type === 'channeled').length,
    [currentHealthSlots]
  );
  const totalDamageCount = consumedCount + exhaustedCount + channeledCount;

  // Selected healing method (GRW S. 119–120, 173–174)
  const [method, setMethod] = useState<HealMethodType>('heilkunde');

  // Amount to heal
  const [healAmount, setHealAmount] = useState<number>(() => (consumedCount > 0 ? Math.min(3, consumedCount) : 1));

  // Priority / target damage type
  const [priorityWahl, setPriority] = useState<HealPriorityType>('only_consumed');
  // ohne Hausregeln heilt jede Methode nur echten Schaden
  const priority: HealPriorityType = hausregeln ? priorityWahl : 'only_consumed';
  const [freigeben, setFreigeben] = useState(0);

  // Condition treatments: set of condition IDs to remove
  const [conditionsToRemove, setConditionsToRemove] = useState<Set<string>>(new Set());

  // Optional note
  const [healNote, setHealNote] = useState<string>('');

  // Handle method presets
  const handleSelectMethod = (selected: HealMethodType) => {
    setMethod(selected);
    setPriority(selected === 'manual' ? 'consumed_first' : 'only_consumed');
  };


  // Toggle condition removal
  const toggleConditionRemoval = (id: string) => {
    setConditionsToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Calculate actual healing breakdown based on healAmount, priority and available damage
  const { actualConsumed, actualExhausted, actualChanneled, totalActualHealed } = useMemo(() => {
    let budget = Math.max(0, healAmount);
    let c = 0;
    let e = 0;
    const ch = 0;

    if (priority === 'consumed_first') {
      c = Math.min(budget, consumedCount);
      budget -= c;
      e = Math.min(budget, exhaustedCount);
    } else if (priority === 'exhausted_first') {
      e = Math.min(budget, exhaustedCount);
      budget -= e;
      c = Math.min(budget, consumedCount);
    } else if (priority === 'only_consumed') {
      c = Math.min(budget, consumedCount);
    } else if (priority === 'only_exhausted') {
      e = Math.min(budget, exhaustedCount);
    }

    return {
      actualConsumed: c,
      actualExhausted: e,
      actualChanneled: ch,
      totalActualHealed: c + e + ch,
    };
  }, [healAmount, priority, consumedCount, exhaustedCount]);

  // Wound preview simulation (GRW S. 172)
  const woundPreview = useMemo(() => {
    const HEALTH_LEVEL_NAMES = stufen.map((x) => x.name);
    const letzte = stufen.length - 1;
    const WOUND_PENALTIES = stufen.map((x) => x.wundabzug);

    let curLevelIndex = 0;
    if (consumedCount > maxLP) {
      curLevelIndex = Math.min(letzte, Math.floor((consumedCount - 1) / maxLP));
    }

    const simConsumed = Math.max(0, consumedCount - actualConsumed);

    let nextLevelIndex = 0;
    if (simConsumed > maxLP) {
      nextLevelIndex = Math.min(letzte, Math.floor((simConsumed - 1) / maxLP));
    }

    const curName = HEALTH_LEVEL_NAMES[curLevelIndex] ?? 'Unverletzt';
    const nextName = HEALTH_LEVEL_NAMES[nextLevelIndex] ?? 'Unverletzt';
    // Verwundet u. ä. verschiebt den Wundabzug um Stufen (Paketfeld wundstufe); beendete Zustände zählen danach nicht mehr
    const schiebenVor = wundstufenVerschiebung(activeConditions);
    const schiebenNach = wundstufenVerschiebung(activeConditions.filter((c) => !conditionsToRemove.has(c.id)));
    const curPenalty = WOUND_PENALTIES[Math.min(letzte, curLevelIndex + schiebenVor)] ?? 0;
    const nextPenalty = WOUND_PENALTIES[Math.min(letzte, nextLevelIndex + schiebenNach)] ?? 0;
    const isWoundImproved = nextLevelIndex < curLevelIndex || nextPenalty > curPenalty;

    return {
      curName,
      nextName,
      curPenalty,
      nextPenalty,
      isWoundImproved,
    };
  }, [consumedCount, actualConsumed, maxLP, stufen, activeConditions, conditionsToRemove]);

  // Submit healing
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const methodNameMap: Record<HealMethodType, string> = {
      manual: 'Freie Eingabe',
      heilkunde: 'Heilkunde',
      heilmagie: 'Heilmagie',
      heiltrank: 'Heiltrank / Elixier',
    };

    onApplyHeal({
      consumedHealed: actualConsumed,
      exhaustedHealed: actualExhausted,
      channeledHealed: actualChanneled,
      kanalisiertFreigegeben: Math.min(freigeben, channeledCount),
      conditionsToRemove: Array.from(conditionsToRemove),
      conditionsToReduceLevel: [],
      note: healNote.trim() || undefined,
      healMethod: methodNameMap[method],
    });

    onClose();
  };

  const titelId = useId();
  useEscape(onClose);
  return (
    <Dialoghintergrund>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId} breite="lg">
        {/* Header */}
        <Dialogkopf
          titelId={titelId}
          symbol={<Heart size={18} />}
          ton="unverletzt"
          titel={begleiter ? `${begleiter}: Heilung anwenden` : 'Heilung anwenden'}
          untertitel="Grundregelwerk (GRW S. 119–120 Heilkunde, S. 173–174 Heilung)"
          onSchliessen={onClose}
        />

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {/* Current Health Overview */}
          <div className="bg-seite border border-unverletzt rounded-knopf p-2.5 sm:p-3 text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-unverletzt">Aktueller Schaden:</span>
            <div className="flex items-center gap-2 tabular-nums text-xs">
              <span className="px-2 py-0.5 rounded-knopf bg-schaden-grund border border-schaden text-schrift" title="Echter Schaden">
                Echt: <strong>{consumedCount}</strong>
              </span>
              <span className="px-2 py-0.5 rounded-knopf bg-erschoepft-grund border border-erschoepft text-schrift" title="Betäubung">
                Betäubung: <strong>{exhaustedCount}</strong>
              </span>
              {channeledCount > 0 && (
                <span className="px-2 py-0.5 rounded-knopf bg-seite border border-rahmen text-schrift" title="Kanalisiert">
                  Kanalisiert: <strong>{channeledCount}</strong>
                </span>
              )}
              <span className="font-bold text-schrift">
                Gesamt: {totalDamageCount} LP
              </span>
            </div>
          </div>

          {/* 1. Heilmethode (GRW S. 119–120, 173–174) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2">
            <label className="block text-xs font-bold text-unverletzt uppercase tracking-wider">
              1. Heilmethode / Kontext
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">

              <Wahlknopf gewaehlt={method === 'heilkunde'} ton="erholung" onClick={() => handleSelectMethod('heilkunde')} title={[heilkunde['Gelungen'], heilkunde['Herausragend']].filter(Boolean).join(' ')}>
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Heilkunde</span>
                  <Activity size={12} className="text-unverletzt" />
                </div>
                <div className="text-[11px] text-leise leading-tight">Probe, Wunde versorgt</div>
              </Wahlknopf>

              <Wahlknopf gewaehlt={method === 'heilmagie'} ton="erholung" onClick={() => handleSelectMethod('heilmagie')}>
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Heilmagie</span>
                  <Sparkles size={12} className="text-unverletzt" />
                </div>
                <div className="text-[11px] text-leise leading-tight">Balsam, etc.</div>
              </Wahlknopf>

              <Wahlknopf gewaehlt={method === 'heiltrank'} ton="erholung" onClick={() => handleSelectMethod('heiltrank')}>
                <div className="font-bold text-xs">Heiltrank / Elixier</div>
                <div className="text-[11px] text-leise leading-tight">Alchemie</div>
              </Wahlknopf>

              <Wahlknopf gewaehlt={method === 'manual'} ton="erholung" onClick={() => handleSelectMethod('manual')} disabled={!hausregeln}
                title={hausregeln ? undefined : 'Nur mit „Hausregeln erlauben“ (Einstellungen → Allgemein)'}>
                <div className="font-bold text-xs">Freie Heilung</div>
                <div className="text-[11px] text-leise leading-tight">{hausregeln ? 'Hausregel: beliebige Punkte' : 'nur mit Hausregeln'}</div>
              </Wahlknopf>
            </div>
            {method === 'heiltrank' && traenke.length > 0 && (
              <div className="flex flex-wrap gap-1.5" data-testid="heiltraenke">
                {traenke.map((t) => (
                  <Wahlknopf key={t.id} mittig gewaehlt={trank === t.id} ton="erholung" className="text-xs"
                    title={`${t.quelle}${t.seite ? ` S. ${t.seite}` : ''}`}
                    onClick={() => { setTrank(t.id); setHealAmount(t.lp); setPriority('only_consumed'); if (!healNote.trim()) setHealNote(t.name); }}>
                    {t.name} ({t.lp} LP)
                  </Wahlknopf>
                ))}
              </div>
            )}
            <p className="text-[11px] text-leise m-0" data-testid="heil-regel">
              Heilkunde, Heilzauber und Heiltränke heilen echten Schaden. Betäubungsschaden heilt die Verschnaufpause, echten
              Schaden auch die Ruhephase: beides im Abschnitt „Rast“ (GRW S. 173–174).
            </p>
          </div>

          {/* 2. Heilmenge (Punkte) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-unverletzt uppercase tracking-wider">
                2. Zu heilende Schadenspunkte
              </label>
              <div className="flex items-center gap-1">
                {hausregeln && exhaustedCount > 0 && (
                  <Knopf
                    onClick={() => {
                      setPriority('only_exhausted');
                      setHealAmount(exhaustedCount);
                    }}
                    className="text-[11px]"
                  >
                    Betäubung ({exhaustedCount})
                  </Knopf>
                )}
                {consumedCount > 0 && (
                  <Knopf art="gefahr"
                    onClick={() => {
                      setPriority('only_consumed');
                      setHealAmount(consumedCount);
                    }}
                    className="text-[11px]"
                  >
                    Echter ({consumedCount})
                  </Knopf>
                )}
                {hausregeln && consumedCount + exhaustedCount > 0 && (
                  <Knopf art="erholung"
                    onClick={() => {
                      setPriority('consumed_first');
                      setHealAmount(consumedCount + exhaustedCount);
                    }}
                    className="text-[11px]"
                  >
                    Alles ({consumedCount + exhaustedCount})
                  </Knopf>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Knopf
                onClick={() => setHealAmount((d) => Math.max(0, d - 5))}
                className="text-xs"
              >
                -5
              </Knopf>
              <Knopf nurSymbol
                onClick={() => setHealAmount((d) => Math.max(0, d - 1))}
              >
                <Minus size={14} />
              </Knopf>

              <div className="flex-1 text-center">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={healAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setHealAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center bg-seite border border-unverletzt rounded-knopf py-1.5 text-2xl tabular-nums font-bold text-unverletzt focus:outline-none focus:border-unverletzt"
                />
              </div>

              <Knopf nurSymbol
                onClick={() => setHealAmount((d) => d + 1)}
              >
                <Plus size={14} />
              </Knopf>
              <Knopf
                onClick={() => setHealAmount((d) => d + 5)}
                className="text-xs"
              >
                +5
              </Knopf>
              <Knopf
                onClick={() => setHealAmount((d) => d + 10)}
                className="text-xs"
              >
                +10
              </Knopf>
            </div>
          </div>

          {/* 3. Ziel-Schadensart / Priorität: nur mit Hausregeln (das GRW regelt nicht, ob diese Heilungen Betäubung heilen) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2">
            <label className="block text-xs font-bold text-unverletzt uppercase tracking-wider">
              3. Zu heilende Schadensart
            </label>
            {!hausregeln && (
              <p className="text-[11px] text-leise m-0">Echter Schaden. Eine andere Verteilung (etwa Betäubung zuerst) ist im GRW nicht geregelt und nur mit „Hausregeln erlauben“ wählbar.</p>
            )}
            {hausregeln && <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
              <Wahlknopf gewaehlt={priority === 'consumed_first'} ton="erholung" onClick={() => setPriority('consumed_first')}>
                <div className="font-bold text-xs text-schrift">Echter Schaden zuerst</div>
                <div className="text-[11px] text-leise">Rest auf Betäubung</div>
              </Wahlknopf>

              <Wahlknopf gewaehlt={priority === 'exhausted_first'} ton="erholung" onClick={() => setPriority('exhausted_first')}>
                <div className="font-bold text-xs text-schrift">Betäubung zuerst</div>
                <div className="text-[11px] text-leise">Rest auf echten Schaden</div>
              </Wahlknopf>

              <Wahlknopf gewaehlt={priority === 'only_consumed'} ton="erholung" onClick={() => setPriority('only_consumed')}>
                <div className="font-bold text-xs text-schaden">Nur Echter Schaden</div>
                <div className="text-[11px] text-leise">Kästen leeren</div>
              </Wahlknopf>

              <Wahlknopf gewaehlt={priority === 'only_exhausted'} ton="erholung" onClick={() => setPriority('only_exhausted')}>
                <div className="font-bold text-xs text-gold-hell">Nur Betäubung</div>
                <div className="text-[11px] text-leise">Kästen leeren</div>
              </Wahlknopf>

            </div>}

            {/* Effective healing summary pill */}
            <div className="text-[11px] bg-seite p-2 rounded-knopf border border-rahmen flex items-center justify-between text-schrift">
              <span>Effektiv geheilt:</span>
              <div className="flex items-center gap-2 tabular-nums font-bold">
                {actualConsumed > 0 && <span className="text-schaden">{actualConsumed} Echt</span>}
                {actualExhausted > 0 && <span className="text-gold-hell">{actualExhausted} Betäubung</span>}
                {actualChanneled > 0 && <span className="text-kanalisiert">{actualChanneled} Kanalisiert</span>}
                <span className="text-unverletzt">= {totalActualHealed} LP</span>
              </div>
            </div>
          </div>

          {!begleiter && (<>
          {/* Kanalisierter Schaden: wird zu Betäubung, wenn sein Zustand aufgehoben ist (GRW S. 15, 173) */}
          {channeledCount > 0 && (
            <div className="bg-seite border border-kanalisiert rounded-knopf p-3 sm:p-3.5 space-y-2" data-testid="kanalisiert-freigeben">
              <label className="block text-xs font-bold text-schrift uppercase tracking-wider">Kanalisierter Schaden ({channeledCount})</label>
              <p className="text-[11px] text-leise m-0">
                Heilt nicht, solange sein Zustand (Krankheit, Fluch …) besteht. Ist der Zustand aufgehoben, wird er zu Betäubungsschaden,
                den die nächste Verschnaufpause heilt (GRW S. 15, 173).
              </p>
              <div className="flex items-center gap-2 text-xs">
                <Knopf nurSymbol aria-label="ein Punkt weniger freigeben" disabled={freigeben <= 0} onClick={() => setFreigeben((n) => Math.max(0, n - 1))}><Minus size={14} aria-hidden /></Knopf>
                <span className="w-6 text-center tabular-nums font-bold text-schrift" data-testid="kanalisiert-freigeben-wert">{freigeben}</span>
                <Knopf nurSymbol aria-label="ein Punkt mehr freigeben" disabled={freigeben >= channeledCount} onClick={() => setFreigeben((n) => Math.min(channeledCount, n + 1))}><Plus size={14} aria-hidden /></Knopf>
                <span className="text-schrift">Punkte werden zu Betäubungsschaden (Zustand aufgehoben)</span>
              </div>
            </div>
          )}

          {/* 4. Zustände lindern / entfernen (GRW S. 168–169) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 sm:p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-unverletzt uppercase tracking-wider">
                4. Zustände beenden (GRW S. 168–169)
              </label>
              <span className="text-[11px] text-leise">
                {activeConditions.length} aktiv
              </span>
            </div>

            {activeConditions.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-leise">
                  Wähle die Zustände, die durch die Behandlung enden:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {activeConditions.map((cond) => {
                    const isSelected = conditionsToRemove.has(cond.id);
                    return (
                      <label
                        key={cond.id}
                        className={`flex items-center justify-between p-2 rounded-knopf border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-unverletzt-grund border-unverletzt text-schrift'
                            : 'bg-seite border-rahmen text-schrift hover:bg-seite'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleConditionRemoval(cond.id)}
                            className="rounded-knopf text-unverletzt focus:ring-0 cursor-pointer w-4 h-4"
                          />
                          <span className="text-xs font-bold">
                            {cond.key} {cond.level && cond.level > 1 ? `Stufe ${cond.level}` : ''}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs text-leise italic bg-seite p-2 rounded-knopf border border-rahmen">
                Keine aktiven Zustände auf dem Charakter vorhanden.
              </div>
            )}
          </div>
          </>)}

          {/* 5. Wundstufen-Vorschau (GRW S. 172) */}
          <div className="bg-seite border border-rahmen rounded-knopf p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-leise font-semibold">Wundstufen-Verbesserung:</span>
              <div className="flex items-center gap-1.5 font-bold">
                <span className="text-schrift">{woundPreview.curName}</span>
                <span className="text-leise">→</span>
                <span className={woundPreview.isWoundImproved ? 'text-unverletzt' : 'text-schrift'}>
                  {woundPreview.nextName}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-rahmen">
              <span className="text-leise">Wundabzug auf Proben:</span>
              <div className="flex items-center gap-1.5 tabular-nums font-bold">
                <span className={woundPreview.curPenalty < 0 ? 'text-schaden' : 'text-leise'}>
                  {woundPreview.curPenalty}
                </span>
                <span className="text-leise">→</span>
                <span className={woundPreview.nextPenalty < 0 ? 'text-gold-hell' : 'text-unverletzt'}>
                  {woundPreview.nextPenalty}
                </span>
              </div>
            </div>
          </div>

          {/* 6. Quelle / Notiz */}
          <div>
            <label className="block text-[11px] font-bold text-leise uppercase tracking-wide mb-1">
              Quelle / Heiler / Zauber (optional)
            </label>
            <input
              type="text"
              placeholder="z. B. Balsam von Elena (4 LP), Erste Hilfe (3 EG), Heiltrank Q2"
              value={healNote}
              onChange={(e) => setHealNote(e.target.value)}
              className="w-full bg-seite border border-rahmen rounded-knopf px-2.5 py-1.5 text-xs text-schrift placeholder-leise focus:outline-none focus:border-unverletzt"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-4 sm:px-5 py-3 border-t border-unverletzt bg-seite flex items-center justify-between gap-3 shrink-0">
          <Knopf
            onClick={onClose}
            className="text-xs"
          >
            Abbrechen
          </Knopf>

          <Knopf art="erholung"
            onClick={() => handleSubmit()}
            disabled={totalActualHealed === 0 && conditionsToRemove.size === 0 && freigeben === 0}
            className="text-xs sm:text-sm gap-1.5 disabled:cursor-not-allowed"
          >
            <Check size={16} />
            <span>
              {totalActualHealed > 0
                ? `${totalActualHealed} LP heilen`
                : conditionsToRemove.size > 0
                ? `${conditionsToRemove.size} Zustand/Zustände beenden`
                : 'Heilung anwenden'}
            </span>
          </Knopf>
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
