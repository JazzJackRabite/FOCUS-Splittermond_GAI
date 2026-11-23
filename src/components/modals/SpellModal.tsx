import { calculateItemCost } from '../../utils/costCalculations';
import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, useEscape } from '../../fundament';
import { useHausregeln } from '../../fundament/hausregeln';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { getSpellDescription } from '../../utils/gameResourceManager';
import { parseSpellPermissibleModifications } from '../../utils/magicRules';
import type { Spell } from '../../types';

interface SpellModalProps {
  availableSpells: Spell[];
  onClose: () => void;
  onAdd: (spell: Spell, isFree: boolean, cost: number) => void;
  budget: number;
  freeSlots: Record<string, number[]>;
  schoolName: string | null;
  /** bei der Erschaffung: freier Zauber genau des Grades seiner Stufe (GRW S. 25); danach auch niedriger (S. 223) */
  exakterGrad?: boolean;
}

export const SpellModal: React.FC<SpellModalProps> = ({
  availableSpells = [],
  onClose,
  onAdd,
  budget,
  freeSlots,
  schoolName,
  exakterGrad = false,
}) => {
  const [search, setSearch] = useState('');
  const [selectedSpellName, setSelectedSpellName] = useState(
    availableSpells.length > 0 ? availableSpells[0].name : 'custom',
  );
  const [customName, setCustomName] = useState('');
  const [customGrade, setCustomGrade] = useState(0);
  const [customDesc, setCustomDesc] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [isFree, setIsFree] = useState(false);

  const resolvedSpells = React.useMemo(() => {
    return availableSpells.map((s) => ({
      ...s,
      description: getSpellDescription(s.name, s.school, s.description || ''),
    }));
  }, [availableSpells]);

  const filteredSpells = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resolvedSpells;
    return resolvedSpells.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.school && s.school.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)),
    );
  }, [resolvedSpells, search]);

  // Keep selectedSpellName synchronized with filteredSpells
  useEffect(() => {
    if (selectedSpellName === 'custom') return;
    const exists = filteredSpells.some((s) => s.name === selectedSpellName);
    if (!exists) {
      if (filteredSpells.length > 0) {
        setSelectedSpellName(filteredSpells[0].name);
      } else {
        setSelectedSpellName('custom');
      }
    }
  }, [filteredSpells, selectedSpellName]);

  const isCustom = selectedSpellName === 'custom';

  const selectedSpell: Spell | undefined = isCustom
    ? {
        name: customName,
        school: schoolName ?? '',
        grade: customGrade,
        cost: '-',
        description: customDesc,
        source: customSource || 'Eigen',
      }
    : availableSpells.find((s) => s.name === selectedSpellName);

  let xpCost = 0;
  let canBeFree = false;
  let usedSlotGrade: number | null = null;

  if (selectedSpell) {
    xpCost = calculateItemCost('spell', selectedSpell.grade);
    const school = selectedSpell.school || schoolName || ''; 
    const schoolSlots = freeSlots[school] ?? [];
    const validSlotIndex = schoolSlots.findIndex(
      (slotGrade) => (exakterGrad ? slotGrade === selectedSpell.grade : slotGrade >= selectedSpell.grade),
    );
    if (validSlotIndex !== -1) {
      canBeFree = true;
      usedSlotGrade = schoolSlots[validSlotIndex];
    }
  }

  useEffect(() => {
    if (canBeFree && !isFree) setIsFree(true);
    if (!canBeFree && isFree) setIsFree(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpellName, canBeFree, customGrade]);

  const finalCost = isFree ? 0 : xpCost;
  const hausregeln = useHausregeln();
  const isAffordable = isFree || finalCost <= budget;
  const isValid =
    selectedSpell && (isCustom ? customName.trim() !== '' : !!selectedSpell.name);

  const handleAdd = () => {
    if (isValid && selectedSpell) {
      onAdd(selectedSpell, isFree, finalCost);
      onClose();
    }
  };

  const titelId = useId();
  useEscape(onClose);
  return (
    <Dialoghintergrund>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId}
        id="spell-modal-dialog" breite="lg"
      >
        <Dialogkopf titelId={titelId} titel="Zauber hinzufügen" untertitel={`für ${schoolName || 'Zauber'}`} onSchliessen={onClose} />

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar modal-body-scroll">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs uppercase text-leise font-semibold tracking-wider">
                Auswahl &amp; Suche
              </label>
              <span className="text-[11px] text-leise font-medium">
                {filteredSpells.length} Treffer
              </span>
            </div>
            <div className="relative mb-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zauber filtern..."
                className="w-full p-2 pr-8 border border-rahmen rounded-knopf bg-flaeche text-xs text-schrift focus:ring-1 focus:ring-rahmen focus:border-rahmen outline-none"
              />
              {search && (
                <Knopf art="gefahr" nurSymbol onClick={() => setSearch('')} title="Suche leeren" className="absolute right-2 top-1/2 -translate-y-1/2" aria-label="Suche leeren">
                  ✕
                </Knopf>
              )}
            </div>
            <select
              value={selectedSpellName}
              onChange={(e) => setSelectedSpellName(e.target.value)}
              className="w-full p-2 border border-rahmen rounded-knopf bg-flaeche text-schrift text-sm focus:ring-1 focus:ring-rahmen focus:border-rahmen outline-none"
            >
              {filteredSpells.map((s, idx) => (
                <option key={`${s.school || ''}-${s.name}-${s.grade}-${idx}`} value={s.name}>
                  {s.name} (Grad {s.grade})
                </option>
              ))}
              <option value="custom">-- Eigener Zauber --</option>
            </select>
          </div>

          {isCustom && (
            <div className="space-y-2 bg-flaeche p-3 rounded-knopf border border-gold ">
              <div>
                <label className="block text-xs uppercase text-leise font-semibold mb-1">Name *</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full p-2 border border-rahmen rounded-knopf bg-flaeche text-schrift text-sm"
                  placeholder="Zaubername"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-leise font-semibold mb-1">Grad</label>
                <select
                  value={customGrade}
                  onChange={(e) => setCustomGrade(parseInt(e.target.value))}
                  className="w-full p-2 border border-rahmen rounded-knopf bg-flaeche text-schrift text-sm"
                >
                  {[0, 1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      Grad {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase text-leise font-semibold mb-1">
                  Beschreibung
                </label>
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  className="w-full p-2 border border-rahmen rounded-knopf bg-flaeche text-schrift text-sm"
                  placeholder="Kurzbeschreibung"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-leise font-semibold mb-1">Quelle</label>
                <input
                  type="text"
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  className="w-full p-2 border border-rahmen rounded-knopf bg-flaeche text-schrift text-sm"
                  placeholder="z.B. Eigen, Erweiterungsband..."
                />
              </div>
            </div>
          )}

          {!isCustom && selectedSpell && (() => {
            const mods = parseSpellPermissibleModifications(selectedSpell.description, selectedSpell.name);
            return (
              <div className="bg-flaeche p-2.5 rounded-knopf border border-rahmen text-xs space-y-1 dark-theme-slot-inactive">
                <div className="flex justify-between">
                  <span className="text-leise">Schule:</span>
                  <span className="font-bold text-schrift">{selectedSpell.school || schoolName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-leise">Grad:</span>
                  <span className="font-bold text-schrift">{selectedSpell.grade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-leise">Fokus-Kosten:</span>
                  <span className="font-medium text-schrift">{String(selectedSpell.cost)}</span>
                </div>
                {selectedSpell.page && (
                  <div className="flex justify-between">
                    <span className="text-leise">Seite:</span>
                    <span className="font-medium text-schrift">{selectedSpell.source || 'GRW'} S. {selectedSpell.page}</span>
                  </div>
                )}
                {mods.allowedNames.length > 0 && (
                  <div className="pt-1.5 border-t border-rahmen mt-1">
                    <span className="text-leise font-semibold block mb-1">Zulässige Modifikationen:</span>
                    <div className="flex flex-wrap gap-1">
                      {mods.allowedNames.map((modName) => (
                        <span
                          key={modName}
                          className="px-1.5 py-0.5 bg-erhoeht text-schrift border border-rahmen rounded-knopf text-[11px] font-semibold"
                        >
                          {modName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSpell.description && (
                  <div className="text-leise italic pt-1 border-t border-rahmen mt-1 whitespace-pre-line">
                    {selectedSpell.description}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Free spell slot */}
          <div
            id="spell-modal-free-slot"
            className={`p-3 rounded-knopf border transition-all ${
              canBeFree
                ? 'bg-erhoeht border-gold dark-theme-slot-active'
                : 'bg-seite border-rahmen dark-theme-slot-inactive'
            }`}
          >
            <label
              className={`flex items-center space-x-2 ${
                canBeFree ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                disabled={!canBeFree}
                className="w-4 h-4 text-schrift accent-gold rounded-knopf"
              />
              <span className="font-bold text-schrift">Gratis-Slot nutzen</span>
            </label>
            {!canBeFree && selectedSpell && (
              <div className="text-xs text-schaden font-medium mt-1 ml-6">
                Kein passender Gratis-Slot für {selectedSpell.school || schoolName} (Grad{' '}
                {selectedSpell.grade}) verfügbar.
              </div>
            )}
          </div>

          <div className="flex justify-between items-baseline border-t border-rahmen pt-3">
            <span className="text-xs uppercase text-leise font-semibold tracking-wider">Kosten:</span>
            <span
              className={`font-bold tabular-nums text-lg ${isAffordable ? 'text-gold' : 'text-schaden'}`}
            >
              {finalCost} EP
            </span>
          </div>
          {!isAffordable && selectedSpell && (
            <div className="text-xs text-schaden font-bold text-center border border-magie bg-erhoeht p-1.5 rounded-knopf">
              Nicht genügend EP verfügbar!
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-rahmen bg-black/5 flex justify-end space-x-2 shrink-0">
          <Knopf
            onClick={onClose}
            className="text-sm shrink-0"
          >
            Abbrechen
          </Knopf>
          <Knopf art="primaer"
            onClick={handleAdd}
            disabled={(!isAffordable && !hausregeln) || !isValid}
            className="text-sm disabled:cursor-not-allowed shrink-0"
          >
            Hinzufügen
          </Knopf>
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};