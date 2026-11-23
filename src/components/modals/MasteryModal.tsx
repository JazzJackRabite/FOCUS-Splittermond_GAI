import { calculateItemCost } from '../../utils/costCalculations';
import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Wahlknopf, useEscape } from '../../fundament';
import { useHausregeln } from '../../fundament/hausregeln';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MasteryEntry as DbMasteryEntry } from '../../types/regeldaten';

import { validateFreeMasteryAssignment } from '../../utils/validation';
import { getMasteryDescription, getResolvedMasteries } from '../../utils/gameResourceManager';
import { useRegelwerk } from '../../regelwerk/RegelwerkContext';
import {
  checkMasteryPrerequisites,
  getMasteryTier,
  getRequiredSkillValue,
  type PrerequisiteCheckResult,
} from '../../utils/prerequisiteValidator';
import type { Mastery } from '../../types';
import { grwAllgemeineKampfmeisterschaften, grwAllgemeineMagiemeisterschaften, grwFertigkeitsKategorien,
  schwerpunktAuswahl, schwerpunktHoechstensJeHeldengrad, schwerpunktRegel } from '../../regelwerk/grwListen';

interface MasteryModalProps {
  skillName: string;
  skillVal: number;
  currentFreeTiers: number[];
  onClose: () => void;
  onAdd: (
    name: string,
    tier: number,
    isFree: boolean,
    cost: number,
    page: number | undefined,
    desc: string | undefined,
    isCreationBonus: boolean,
    source: string,
    userNote: string,
  ) => void;
  existingMasteries: Mastery[];
  allCharacterMasteries?: Array<Mastery | string>;
  skills?: Record<string, number>;
  resources?: Array<{ name: string; level?: number; [k: string]: any }>;
  spells?: Array<{ name: string; school?: string; [k: string]: any }>;
  culture?: string;
  race?: string;
  creationMode?: boolean;
  creationBudget?: number;
  /** Nummer des Heldengrads (Schwerpunkte: je Heldengrad einmal derselbe) */
  heldengrad?: number;
}

export const MasteryModal: React.FC<MasteryModalProps> = ({
  skillName,
  skillVal,
  currentFreeTiers,
  onClose,
  onAdd,
  existingMasteries,
  allCharacterMasteries,
  skills,
  resources,
  spells,
  culture,
  race,
  creationMode = false,
  creationBudget = 0,
  heldengrad = 1,
}) => {
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [customName, setCustomName] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [tier, setTier] = useState(1);
  const [isFree, setIsFree] = useState(false);
  const [isCreationBonus, setIsCreationBonus] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [schwerpunktName, setSchwerpunktName] = useState('');

  // Maximum tier theoretically reachable based on skill value
  const maxTier =
    skillVal >= 15 ? 4 : skillVal >= 12 ? 3 : skillVal >= 9 ? 2 : 1;

  // Validation context for prerequisite & threshold evaluation
  const validationContext = useMemo(() => {
    return {
      allCharacterMasteries: allCharacterMasteries || existingMasteries,
      skills: skills || { [skillName]: skillVal },
      resources: resources || [],
      spells: spells || [],
      culture,
      race,
      mode: creationMode ? ('creation' as const) : ('xp' as const),
      creationBudget,
      isCreationBonus,
    };
  }, [allCharacterMasteries, existingMasteries, skills, skillName, skillVal, resources, spells, culture, race, creationMode, creationBudget, isCreationBonus]);

  const { katalog } = useRegelwerk();
  // Schwerpunkte der Fertigkeit (Paket: Einträge vom Typ „schwerpunkt“); Name der Meisterschaft „Schwerpunkt: X (S1)“
  const sp = useMemo(() => schwerpunktAuswahl(skillName), [skillName, katalog]);
  const isSchwerpunkt = selectedName === 'schwerpunkt';
  const spName = schwerpunktName.trim();
  const spVoll = sp && spName ? `Schwerpunkt: ${spName} (S${sp.schwelle})` : '';
  const spAnzahl = spVoll ? existingMasteries.filter((m) => m.name === spVoll).length : 0;
  const spJe = schwerpunktHoechstensJeHeldengrad();
  const spGrenze = spJe !== null ? spJe * Math.max(1, heldengrad) : null;
  const spZuOft = spGrenze !== null && spAnzahl >= spGrenze;
  const filteredMasteries = useMemo(() => {
    let opts: DbMasteryEntry[] = getResolvedMasteries(skillName);
    if (grwFertigkeitsKategorien().COMBAT.includes(skillName)) {
      // General combat masteries (+ allgemeine Kampf-/Nahkampfmeisterschaften aus geladenen Regelpaketen)
      opts = [...opts, ...grwAllgemeineKampfmeisterschaften(), ...getResolvedMasteries('Allgemeine Nahkampfmeisterschaften'), ...getResolvedMasteries('Allgemeine Kampfmeisterschaften')];
    }
    if (grwFertigkeitsKategorien().MAGIC.includes(skillName)) {
      // General magic masteries (+ aus geladenen Regelpaketen)
      opts = [...opts, ...grwAllgemeineMagiemeisterschaften(), ...getResolvedMasteries('Allgemeine Magiemeisterschaften')];
    }
    // Deduplicate by name
    const uniqueMap = new Map<string, DbMasteryEntry>();
    for (const item of opts) {
      if (!uniqueMap.has(item.name)) {
        uniqueMap.set(item.name, item);
      }
    }
    const resolvedOpts = Array.from(uniqueMap.values()).map((m) => {
      const customDesc = getMasteryDescription(skillName, m.name, m.desc || '');
      return { ...m, desc: customDesc };
    });
    return resolvedOpts.sort((a, b) => {
      const tA = a.tier ?? parseInt((a.name.match(/\(S(\d)\)/) ?? [null, '0'])[1] ?? '0', 10);
      const tB = b.tier ?? parseInt((b.name.match(/\(S(\d)\)/) ?? [null, '0'])[1] ?? '0', 10);
      if (tA !== tB) return tA - tB;
      return a.name.localeCompare(b.name, 'de');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillName, katalog]);

  // Pre-evaluate checks for each mastery to drive filtering & dropdown status
  const masteryCheckMap = useMemo(() => {
    const map = new Map<string, PrerequisiteCheckResult>();
    for (const m of filteredMasteries) {
      const check = checkMasteryPrerequisites(m, skillName, skillVal, validationContext);
      map.set(m.name, check);
    }
    return map;
  }, [filteredMasteries, skillName, skillVal, validationContext]);

  // GRW S. 92: Sind auf einer Schwelle nur Meisterschaften wählbar, deren Voraussetzung nicht erfüllt ist,
  // darf eine davon trotzdem als freie Meisterschaft gewählt werden (nutzbar erst mit erfüllter Voraussetzung).
  const nurUnerfuellbar = useMemo(() => {
    const proSchwelle = new Map<number, boolean>();
    for (const m of filteredMasteries) {
      const c = masteryCheckMap.get(m.name);
      if (!c || !c.thresholdMet) continue;
      const taken = existingMasteries.some((em) => em.name === m.name) && !m.mehrfach;
      if (taken) continue;
      const t = c.tier;
      proSchwelle.set(t, (proSchwelle.get(t) ?? true) && !c.prerequisitesMet);
    }
    return proSchwelle;
  }, [filteredMasteries, masteryCheckMap, existingMasteries]);
  const freiTrotzVoraussetzung = (name: string) => {
    const c = masteryCheckMap.get(name);
    return !!c && c.thresholdMet && !c.prerequisitesMet && nurUnerfuellbar.get(c.tier) === true;
  };

  const searchedMasteries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filteredMasteries.filter((m) => {
      const check = masteryCheckMap.get(m.name);
      const isTaken = existingMasteries.some((em) => em.name === m.name);
      const isRepeatable = !!m.mehrfach;

      if (onlyAvailable) {
        if (isTaken && !isRepeatable) return false;
        if (check && !check.canLearn && !freiTrotzVoraussetzung(m.name)) return false;
      }

      if (!q) return true;
      const matchesName = m.name.toLowerCase().includes(q);
      const matchesDesc = (m.desc || '').toLowerCase().includes(q);
      const matchesPrereq = (m.prerequisiteText || '').toLowerCase().includes(q);
      return matchesName || matchesDesc || matchesPrereq;
    });
  }, [filteredMasteries, search, onlyAvailable, masteryCheckMap, existingMasteries]);

  const selectedEntry = useMemo(() => {
    if (selectedName === 'custom') return undefined;
    return filteredMasteries.find((m) => m.name === selectedName);
  }, [filteredMasteries, selectedName]);

  // Validation result of the currently selected mastery
  const currentValidation = useMemo((): PrerequisiteCheckResult | null => {
    if (selectedName === 'custom' || selectedName === 'schwerpunkt') {
      const reqVal = getRequiredSkillValue(tier);
      const thresholdMet = creationMode
        ? tier === 1 && (skillVal >= 6 || isCreationBonus || creationBudget > 0)
        : skillVal >= reqVal;
      return {
        canLearn: thresholdMet,
        thresholdMet,
        prerequisitesMet: true,
        tier,
        minSkillValue: reqVal,
        currentSkillVal: skillVal,
        thresholdReason: thresholdMet
          ? undefined
          : creationMode && tier > 1
          ? `In der Heldenerstellung können nur Schwelle-1-Meisterschaften gewählt werden.`
          : `Schwelle ${tier} erfordert Fertigkeitspunkte ${reqVal} (aktuell: ${skillVal}).`,
        missingPrerequisites: [],
      };
    }
    if (!selectedEntry) return null;
    return masteryCheckMap.get(selectedEntry.name) || null;
  }, [selectedName, selectedEntry, tier, creationMode, skillVal, isCreationBonus, creationBudget, masteryCheckMap]);

  const canBeFreeRank = validateFreeMasteryAssignment(skillVal, [...currentFreeTiers, tier]);
  const canBeCreationBonus = creationMode && creationBudget > 0 && skillVal >= 1 && tier === 1;

  // Ist eine freie Meisterschaft offen, ist „Gratis-Slot nutzen“ vorgewählt (wie beim Zauber); abwählen bleibt möglich
  const freiVorbelegt = useRef(false);
  useEffect(() => {
    if (freiVorbelegt.current) return;
    // bei der Erschaffung zuerst die Start-Meisterschaften (Kultur, Ausbildung), danach freie Meisterschaften der Schwelle
    if (canBeCreationBonus) { freiVorbelegt.current = true; setIsCreationBonus(true); }
    else if (canBeFreeRank && !isCreationBonus) { freiVorbelegt.current = true; setIsFree(true); }
  }, [canBeFreeRank, canBeCreationBonus, isCreationBonus]);

  useEffect(() => {
    if (!canBeFreeRank && isFree) setIsFree(false);
    if (!canBeCreationBonus && isCreationBonus) setIsCreationBonus(false);
  }, [tier, canBeFreeRank, canBeCreationBonus]);

  const handleFreeChange = (checked: boolean) => {
    setIsFree(checked);
    if (checked) setIsCreationBonus(false);
  };

  const handleCreationBonusChange = (checked: boolean) => {
    setIsCreationBonus(checked);
    if (checked) {
      setIsFree(false);
      setTier(1);
    }
  };

  // Sync selectedName with searchedMasteries whenever search/filter changes
  useEffect(() => {
    if (selectedName === 'custom' || selectedName === 'schwerpunkt') return;
    const exists = searchedMasteries.some((m) => m.name === selectedName);
    if (!exists) {
      const available = searchedMasteries.find((m) => {
        const isTaken = existingMasteries.some((em) => em.name === m.name);
        const isRepeatable = !!m.mehrfach;
        const check = masteryCheckMap.get(m.name);
        return (!isTaken || isRepeatable) && check?.canLearn;
      });
      if (available) {
        setSelectedName(available.name);
        const mTier = available.tier ?? getMasteryTier(available);
        setTier(mTier);
      } else if (searchedMasteries.length > 0) {
        setSelectedName(searchedMasteries[0].name);
        const mTier = searchedMasteries[0].tier ?? getMasteryTier(searchedMasteries[0]);
        setTier(mTier);
      } else {
        setSelectedName('custom');
      }
    }
  }, [searchedMasteries, selectedName, existingMasteries, masteryCheckMap]);

  const cost = isFree || isCreationBonus ? 0 : calculateItemCost('mastery', tier);

  const hausregeln = useHausregeln();
  const isCustom = selectedName === 'custom';
  const isSelectionInvalid = isSchwerpunkt
    ? !spVoll || ((spZuOft || !(currentValidation?.canLearn ?? true)) && !hausregeln)
    : isCustom
    ? !customName.trim() || (!(currentValidation?.canLearn ?? true) && !hausregeln)
    : !selectedName ||
      (existingMasteries.some((m) => m.name === selectedName) && !selectedEntry?.mehrfach) ||
      (currentValidation ? !currentValidation.canLearn && !hausregeln && !(isFree && freiTrotzVoraussetzung(selectedName)) : false);

  const handleAdd = () => {
    if (isSchwerpunkt && sp) {
      if (!spVoll) return;
      onAdd(spVoll, sp.schwelle, isFree, cost, sp.seite, schwerpunktRegel()?.text, isCreationBonus, sp.quelle, userNote);
      onClose();
      return;
    }
    const finalName = isCustom ? customName.trim() : selectedName;
    if (!finalName) return;

    const entry = filteredMasteries.find((m) => m.name === finalName);
    const page = entry?.page;
    const desc = entry?.desc;
    const source = isCustom ? (customSource || 'Eigen') : (entry?.source || 'GRW');

    onAdd(finalName, tier, isFree, cost, page, desc, isCreationBonus, source, userNote);
    onClose();
  };

  const titelId = useId();
  useEscape(onClose);
  return (
    <Dialoghintergrund>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId}
        id="mastery-modal-dialog" breite="lg"
      >
        <Dialogkopf
          titelId={titelId}
          titel="Meisterschaft hinzufügen"
          untertitel={<>für <span className="font-semibold text-schrift">{skillName}</span> (Fertigkeitspunkte: <span className="font-bold text-schrift tabular-nums">{skillVal}</span>{creationMode ? ' – Erstellung' : ` – Max Schwelle: S${maxTier}`})</>}
          onSchliessen={onClose}
        />

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm custom-scrollbar modal-body-scroll">
          {/* Search & Filter bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] uppercase text-gold font-bold tracking-wider">
                Auswahl &amp; Suche
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] text-leise cursor-pointer hover:text-schrift">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                    className="rounded-knopf border-rahmen bg-seite text-gold focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Nur erlernbare ({filteredMasteries.filter((m) => masteryCheckMap.get(m.name)?.canLearn).length})</span>
                </label>
                <span className="text-[11px] text-leise">
                  {searchedMasteries.length} Treffer
                </span>
              </div>
            </div>

            <div className="relative mb-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nach Name, Manöver oder Voraussetzung filtern..."
                className="w-full p-2 pr-8 border border-rahmen rounded-knopf bg-seite text-schrift text-xs focus:ring-1 focus:ring-gold focus:border-gold outline-none"
              />
              {search && (
                <Knopf nurSymbol onClick={() => setSearch('')} title="Suche leeren" className="absolute right-2 top-1/2 -translate-y-1/2" aria-label="Suche leeren">
                  ✕
                </Knopf>
              )}
            </div>

            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] uppercase text-leise font-bold">
                Meisterschaft wählen
              </label>
              {searchedMasteries.some((m) => m.manoever) && (
                <span className="text-[11px] text-gold font-medium" title="Manöver sind aktive Kampftechniken, die bei einem Angriff/einer Aktion angesagt werden">
                  [M] = Manöver (aktive Kampfaktion)
                </span>
              )}
            </div>

            <select
              value={selectedName}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedName(val);
                if (val === 'schwerpunkt') { setTier(sp?.schwelle ?? 1); return; }
                if (val !== 'custom') {
                  setCustomSource('');
                  const m = filteredMasteries.find((it) => it.name === val);
                  const mTier = m?.tier ?? getMasteryTier(m || { name: val });
                  setTier(mTier);
                }
              }}
              className="w-full p-2.5 border border-rahmen rounded-knopf bg-seite text-schrift text-xs sm:text-sm focus:ring-1 focus:ring-gold focus:border-gold outline-none"
            >
              {searchedMasteries.map((m) => {
                const isTaken = existingMasteries.some((em) => em.name === m.name);
                const isRepeatable = !!m.mehrfach;
                const check = masteryCheckMap.get(m.name);
                const isTierTooHigh = check ? !check.thresholdMet : false;
                const isMissingPrereqs = check ? !check.prerequisitesMet : false;
                const disabled = (isTaken && !isRepeatable) || (!check?.canLearn && !hausregeln && !freiTrotzVoraussetzung(m.name));

                let label = m.name;
                if (m.manoever) {
                  label = `[M] ${label}`;
                }
                if (isTaken && !isRepeatable) {
                  label += ' (Bereits gewählt)';
                } else if (isTierTooHigh) {
                  const reqVal = m.minSkillValue || getRequiredSkillValue(m.tier || 1);
                  label += ` (ab FP ${reqVal})`;
                } else if (isMissingPrereqs && check?.missingPrerequisites.length) {
                  label += ` (Fehlt: ${check.missingPrerequisites[0]})`;
                } else {
                  label = `✓ ${label}`;
                }

                return (
                  <option key={m.name} value={m.name} disabled={disabled}>
                    {label}
                  </option>
                );
              })}
              {sp && <option value="schwerpunkt">Schwerpunkt (S{sp.schwelle}) …</option>}
              <option value="custom">-- Eigene Eingabe --</option>
            </select>
          </div>

          {isSchwerpunkt && sp && (
            <div className="space-y-2 bg-seite p-3 rounded-knopf border border-gold" data-testid="schwerpunkt-auswahl">
              <label className="block text-[11px] uppercase text-gold font-bold" htmlFor={`${titelId}-sp`}>Schwerpunkt *</label>
              <input id={`${titelId}-sp`} type="text" list={`${titelId}-sp-liste`} value={schwerpunktName}
                onChange={(e) => setSchwerpunktName(e.target.value)} autoFocus
                className="w-full p-2 border border-rahmen rounded-knopf bg-seite text-schrift text-xs" placeholder="aus der Liste wählen oder selbst benennen" />
              <datalist id={`${titelId}-sp-liste`}>
                {sp.vorschlaege.map((v) => <option key={v} value={v} />)}
              </datalist>
              {sp.vorschlaege.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {sp.vorschlaege.map((v) => (
                    <Wahlknopf key={v} mittig gewaehlt={spName === v} className="text-[11px]" onClick={() => setSchwerpunktName(v)}>{v}</Wahlknopf>
                  ))}
                </div>
              )}
              {sp.platzhalter.length > 0 && (
                <p className="text-[11px] text-leise">Selbst benennen: {sp.platzhalter.join(', ')}</p>
              )}
              <p className="text-[11px] text-leise">{sp.quelle}{sp.seite ? ` S. ${sp.seite}` : ''} · Die Liste ist nicht abschließend; eigene Schwerpunkte mit Zustimmung der Spielleitung.</p>
              {spAnzahl > 0 && (
                <p className="text-[11px] text-schrift" data-testid="schwerpunkt-anzahl">
                  Bereits {spAnzahl}× erworben{spGrenze !== null ? ` – höchstens ${spGrenze}× bei Heldengrad ${Math.max(1, heldengrad)}` : ''}.
                  {spZuOft ? (hausregeln ? ' Hausregel: trotzdem wählbar.' : ' Derselbe Schwerpunkt erst wieder im nächsten Heldengrad.') : ''}
                </p>
              )}
            </div>
          )}

          {/* Custom mastery input */}
          {selectedName === 'custom' && (
            <div className="space-y-2 bg-seite p-3 rounded-knopf border border-gold ">
              <div>
                <label className="block text-[11px] uppercase text-gold font-bold mb-1">
                  Eigener Name *
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full p-2 border border-rahmen rounded-knopf bg-seite text-schrift text-xs"
                  placeholder="z.B. Waffenmeister (S2)"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] uppercase text-leise font-bold mb-1">
                    Schwelle
                  </label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(parseInt(e.target.value, 10))}
                    className="w-full p-2 border border-rahmen rounded-knopf bg-seite text-schrift text-xs"
                  >
                    {[1, 2, 3, 4].map((t) => {
                      const reqVal = getRequiredSkillValue(t);
                      const disabled = !hausregeln && (creationMode ? t > 1 : t > maxTier);
                      return (
                        <option key={t} value={t} disabled={disabled}>
                          Schwelle {t} (S{t}){t > maxTier ? ` (ab FW ${reqVal})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase text-leise font-bold mb-1">
                    Quelle
                  </label>
                  <input
                    type="text"
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                    className="w-full p-2 border border-rahmen rounded-knopf bg-seite text-schrift text-xs"
                    placeholder="z.B. Eigen, Erw."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Details & Requirement Status for Selected Mastery */}
          {!isCustom && selectedEntry && (
            <div className="bg-seite p-3 rounded-knopf border border-rahmen text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-leise font-medium">Schwellenvoraussetzung:</span>
                <span
                  className={`font-bold tabular-nums px-2 py-0.5 rounded-knopf text-[11px] flex items-center gap-1 ${
                    currentValidation?.thresholdMet
                      ? 'bg-unverletzt-grund text-unverletzt border border-unverletzt'
                      : 'bg-erschoepft-grund text-gold-hell border border-erschoepft'
                  }`}
                >
                  {currentValidation?.thresholdMet ? '✓' : '✕'} Schwelle {tier} (FP ≥{' '}
                  {selectedEntry.minSkillValue || getRequiredSkillValue(tier)}, aktuell: {skillVal})
                </span>
              </div>

              {selectedEntry.manoever && (
                <div className="flex items-center gap-2 py-1 px-2 rounded-knopf bg-erschoepft-grund border border-erschoepft text-gold-hell">
                  <span className="font-bold text-[11px] uppercase tracking-wider bg-erschoepft-grund px-1.5 py-0.5 rounded-knopf text-gold-hell shrink-0">
                    Manöver
                  </span>
                  <span className="text-[11px] text-gold-hell leading-tight">
                    Aktive Kampftechnik: Muss vor einem Angriff oder einer Aktion angesagt werden (pro Aktion ist maximal 1 Manöver erlaubt).
                  </span>
                </div>
              )}

              {selectedEntry.prerequisiteText && (
                <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-1 pt-1.5 border-t border-rahmen">
                  <span className="text-leise shrink-0 font-medium">Voraussetzungen:</span>
                  <span
                    className={`font-semibold text-right flex items-center gap-1 ${
                      currentValidation?.prerequisitesMet ? 'text-unverletzt' : 'text-gold'
                    }`}
                  >
                    <span>{currentValidation?.prerequisitesMet ? '✓ Erfüllt:' : 'Fehlend:'}</span>
                    <span>{selectedEntry.prerequisiteText}</span>
                  </span>
                </div>
              )}

              {/* Warning box if mastery cannot be learned */}
              {currentValidation && !currentValidation.canLearn && (
                <div className="p-2.5 rounded-knopf bg-erschoepft-grund border border-gold text-gold-hell text-xs mt-1.5 space-y-1">
                  {!currentValidation.thresholdMet && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-gold font-bold shrink-0">✕ Schwelle:</span>
                      <span>{currentValidation.thresholdReason}</span>
                    </div>
                  )}
                  {!currentValidation.prerequisitesMet && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-gold font-bold shrink-0">✕ Voraussetzung:</span>
                      <span>{currentValidation.prerequisiteReason}</span>
                    </div>
                  )}
                  {freiTrotzVoraussetzung(selectedEntry.name) && (
                    <div className="flex items-start gap-1.5" data-testid="frei-trotz-voraussetzung">
                      <span className="text-gold font-bold shrink-0">ℹ</span>
                      <span>Auf dieser Schwelle ist keine Meisterschaft erfüllbar. Als <strong>freie Meisterschaft</strong> darfst du sie trotzdem wählen; nutzbar ist sie erst, wenn die Voraussetzung erfüllt ist (GRW S. 92).</span>
                    </div>
                  )}
                </div>
              )}

              {selectedEntry.page && (
                <div className="flex justify-between text-[11px] text-leise pt-1 border-t border-rahmen">
                  <span>Regelwerk-Nachweis:</span>
                  <span className="tabular-nums text-schrift">{selectedEntry.source || 'GRW'} S. {selectedEntry.page}</span>
                </div>
              )}

              {selectedEntry.desc && (
                <div className="text-schrift italic pt-1.5 border-t border-rahmen leading-relaxed text-[11px] sm:text-xs">
                  {selectedEntry.desc}
                </div>
              )}
            </div>
          )}

          {/* Free mastery slot */}
          <div
            id="mastery-modal-free-slot"
            className={`p-3 rounded-knopf border transition-all ${
              canBeFreeRank
                ? 'bg-flaeche border-gold dark-theme-slot-active'
                : 'bg-seite border-rahmen dark-theme-slot-inactive'
            }`}
          >
            <label
              className={`flex items-center space-x-2 ${
                canBeFreeRank ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => handleFreeChange(e.target.checked)}
                disabled={!canBeFreeRank}
                className="w-4 h-4 text-gold accent-gold rounded-knopf cursor-pointer"
              />
              <span className="font-bold text-schrift">Gratis-Slot nutzen</span>
            </label>
            {!canBeFreeRank && (
              <div className="text-xs text-gold font-medium mt-1 ml-6">
                Kein passender Gratis-Slot für Schwelle {tier} verfügbar.
                {(() => {
                  // höchste Schwelle, für die noch ein Platz frei ist (Plätze der Schwellen 1–4 je erreichter Schwelle)
                  const frei = [4, 3, 2, 1].find((t) => validateFreeMasteryAssignment(skillVal, [...currentFreeTiers, t]));
                  if (frei) return ` Frei ist noch ein Platz für Schwelle ${frei} oder niedriger.`;
                  return currentFreeTiers.some((t) => t < tier)
                    ? ' Alle Plätze sind belegt; gratis gewählte Meisterschaften niedrigerer Schwelle können höhere Plätze belegen.'
                    : '';
                })()}
              </div>
            )}
          </div>

          {/* Creation bonus mastery slot */}
          {creationMode && (
            <div
              id="mastery-modal-creation-slot"
              className={`p-3 rounded-knopf border transition-all ${
                canBeCreationBonus
                  ? 'bg-flaeche border-gold dark-theme-slot-active'
                  : 'bg-seite border-rahmen dark-theme-slot-inactive'
              }`}
            >
              <label
                className={`flex items-center space-x-2 ${
                  canBeCreationBonus ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isCreationBonus}
                  onChange={(e) => handleCreationBonusChange(e.target.checked)}
                  disabled={!canBeCreationBonus}
                  className="w-4 h-4 text-gold accent-gold rounded-knopf cursor-pointer"
                />
                <span className="font-bold text-schrift">Als Start-Meisterschaft wählen (Schwelle 1)</span>
              </label>
              {canBeCreationBonus ? (
                <div className="text-xs text-kanalisiert font-medium mt-1 ml-6">
                  Verfügbar ({creationBudget} übrig).
                </div>
              ) : (
                <div className="text-xs text-gold font-medium mt-1 ml-6">
                  {tier > 1
                    ? 'Start-Meisterschaften können nur für Schwelle 1 vergeben werden.'
                    : 'Keine Start-Meisterschaften mehr verfügbar.'}
                </div>
              )}
            </div>
          )}

          {/* Optional user note */}
          <div>
            <label className="block text-[11px] uppercase text-leise font-bold tracking-wider mb-1">
              Zusatztext / Spezialisierung (optional)
            </label>
            <input
              type="text"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              className="w-full p-2 border border-rahmen rounded-knopf bg-seite text-schrift text-xs sm:text-sm focus:ring-1 focus:ring-gold focus:border-gold outline-none"
              placeholder="z.B. Sinn: Gehör, Spezifikation..."
            />
          </div>

          {/* Cost display */}
          <div className="flex justify-between items-baseline border-t border-rahmen pt-3">
            <span className="text-xs uppercase text-leise font-bold tracking-wider">Kosten:</span>
            <span className="font-bold text-gold tabular-nums text-lg">{cost} EP</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 py-3.5 border-t border-rahmen bg-black/20 flex justify-end space-x-2 shrink-0">
          <Knopf
            onClick={onClose}
            className="text-xs sm:text-sm"
          >
            Abbrechen
          </Knopf>
          <Knopf art="primaer"
            onClick={handleAdd}
            disabled={isSelectionInvalid || (!selectedName && !customName)}
            className="text-xs sm:text-sm disabled:cursor-not-allowed"
            title={
              currentValidation && !currentValidation.canLearn
                ? `${currentValidation.thresholdReason || ''} ${currentValidation.prerequisiteReason || ''}`.trim()
                : undefined
            }
          >
            + Hinzufügen
          </Knopf>
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
