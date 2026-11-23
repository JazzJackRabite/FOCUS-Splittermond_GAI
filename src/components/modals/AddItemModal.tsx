import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, useEscape } from '../../fundament';
import { useHausregeln } from '../../fundament/hausregeln';
import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  getStrengthDescription,
  getWeaknessDescription,
  getResourceDescription,
} from '../../utils/gameResourceManager';
import type { ItemEntry, AppMode } from '../../types';
import { getInitialSelection } from '../../utils/modalHelpers';
import { grwRessourcenTexte, grwSchwaechenSeiten, grwSchwaechenTexte } from '../../regelwerk/grwListen';
import { listenSperre, type ListenDaten } from '../../regelwerk/listenAuswahl';

interface StrengthData {
  name: string;
  cost: number;
  max: number;
  multi?: boolean;
  desc?: string;
  source?: string;
  page?: number;
  onlyCreation?: boolean;
}

interface ResourceData {
  name: string;
  maxStufe?: number;
  desc?: string;
  source?: string;
  page?: number;
}

interface WeaknessData {
  name: string;
  desc?: string;
  source?: string;
  page?: number;
}

interface LanguageData {
  name: string;
}

type ItemData = StrengthData | ResourceData | WeaknessData | LanguageData | { name: string } | string;

interface AddItemModalProps {
  title: string;
  items: ItemData[];
  onClose: () => void;
  onAdd: (
    name: string,
    level: number,
    desc: string,
    pointCost: number,
    source: string,
    page: number | undefined,
    isFree: boolean,
  ) => void;
  mode: AppMode;
  type: 'strength' | 'resource' | 'weakness' | 'language';
  budget: number;
  existingItems: ItemEntry[];
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  title,
  items,
  onClose,
  onAdd,
  mode,
  type,
  budget,
  existingItems,
}) => {
  const isStrength = type === 'strength';
  const isResource = type === 'resource';
  const isLanguage = type === 'language';
  const sperreFuer = (i: { name: string } | null, name: string) =>
    listenSperre(type, (i as ListenDaten | null), name, mode, existingItems);

  const normalizedItems = useMemo(() => {
    return (items || []).map((item) => {
      if (typeof item === 'string') {
        const d = type === 'weakness'
          ? getWeaknessDescription(item, grwSchwaechenTexte()[item] || '')
          : '';
        const page = type === 'weakness' ? (grwSchwaechenSeiten()[item] ?? 84) : undefined;
        return {
          name: item,
          cost: 1,
          max: 1,
          multi: false,
          desc: d,
          source: 'GRW',
          page,
        };
      }
      if (isStrength && item.name) {
        return {
          ...item,
          desc: getStrengthDescription(item.name, (item as StrengthData).desc || ''),
        };
      }
      if (isResource && item.name) {
        return {
          ...item,
          desc: getResourceDescription(item.name, (item as ResourceData).desc || ''),
        };
      }
      return item;
    });
  }, [items, isStrength, isResource, type]);

  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState(() =>
    normalizedItems.find((i) => !sperreFuer(i, i.name).grund)?.name ??
    getInitialSelection(
      (items || []) as Array<{ name: string; multi?: boolean } | string>,
      existingItems,
      type,
    ),
  );
  const [custom, setCustom] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [desc, setDesc] = useState('');
  const [level, setLevel] = useState(1);
  const [isMotherTongue, setIsMotherTongue] = useState(false);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normalizedItems;
    return normalizedItems.filter((i) => (i?.name || '').toLowerCase().includes(q));
  }, [normalizedItems, search]);

  // Keep selectedName synchronized with filtered items
  useEffect(() => {
    if (selectedName === 'custom') return;
    const exists = filteredItems.some((i) => i.name === selectedName);
    if (!exists) {
      // Pick first non-disabled item or first matching item
      const available = filteredItems.find((i) => !sperreFuer(i, i.name).grund);

      if (available) {
        setSelectedName(available.name);
      } else {
        setSelectedName('custom');
      }
      setLevel(1);
      setDesc('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems, selectedName, isStrength, isLanguage, existingItems, mode]);

  const hausregeln = useHausregeln();
  const hasFreeMotherTongue =
    isLanguage && existingItems.some((i) => i.isFree && i.name !== 'Basargnomisch');
  const isLanguageLimitReached =
    isLanguage && mode === 'creation' && existingItems.length >= 2 && !hausregeln;

  const currentItemData = useMemo(() => {
    return normalizedItems.find((i) => i.name === selectedName) || null;
  }, [normalizedItems, selectedName]);

  const sperre = selectedName === 'custom' ? null : sperreFuer(currentItemData, selectedName);
  const maxLevel = sperre ? Math.max(1, sperre.restStufen) : (isStrength ? 1 : 6);
  useEffect(() => { if (level > maxLevel) setLevel(maxLevel); }, [level, maxLevel]);
  const pointCost = isStrength ? ((currentItemData as StrengthData)?.cost ?? 1) : 1;

  useEffect(() => {
    setDesc('');
  }, [selectedName, type]);

  useEffect(() => {
    if (isLanguage && mode === 'creation' && existingItems.length === 1 && !hasFreeMotherTongue) {
      setIsMotherTongue(true);
    }
  }, [isLanguage, mode, existingItems, hasFreeMotherTongue]);

  const xpMultiplier = isStrength || isResource ? 7 : 5;

  let currentCost = 0;
  if (mode === 'creation') {
    currentCost = isMotherTongue ? 0 : level * pointCost;
  } else {
    if (isLanguage) currentCost = 5;
    else currentCost = level * pointCost * xpMultiplier;
  }

  const isAffordable =
    type === 'weakness' || isMotherTongue ? true : currentCost <= budget;
  const isSelectionValid =
    selectedName === 'custom' ? custom.trim() !== '' : selectedName !== '';

  const handleAdd = () => {
    const isCustom = selectedName === 'custom';
    const name = isCustom ? custom.trim() : selectedName;
    if (!name) return;
    if (sperre?.grund && !hausregeln) return;
    let finalDesc = desc;
    if (!finalDesc && isStrength && currentItemData) {
      finalDesc = getStrengthDescription(name, (currentItemData as StrengthData).desc ?? '');
    }
    if (!finalDesc && isResource) {
      const rd = currentItemData as ResourceData | null;
      finalDesc = getResourceDescription(name, rd?.desc || grwRessourcenTexte()[selectedName] || '');
    }
    if (!finalDesc && type === 'weakness') {
      finalDesc = getWeaknessDescription(name, grwSchwaechenTexte()[selectedName] || '');
    }

    let source = 'Eigene';
    let page: number | undefined;
    let isFree = false;

    if (isCustom) {
      source = customSource || 'Eigen';
    } else if (currentItemData) {
      source = (currentItemData as any).source ?? 'GRW';
      page = (currentItemData as any).page;
    }

    if (isLanguage) {
      source = isCustom ? (customSource || 'Eigen') : ((currentItemData as any)?.source ?? 'GRW');
      page = isCustom ? undefined : ((currentItemData as any)?.page ?? 314);
      if (isMotherTongue) {
        finalDesc = 'Muttersprache';
        isFree = true;
      }
    } else if (type === 'weakness') {
      source = isCustom ? (customSource || 'Eigen') : ((currentItemData as any)?.source ?? 'GRW');
      page = isCustom ? undefined : ((currentItemData as any)?.page ?? grwSchwaechenSeiten()[name] ?? 84);
    }

    onAdd(name, level, finalDesc, pointCost, source, page, isFree);
    onClose();
  };

  const titelId = useId();
  useEscape(onClose);
  return (
    <Dialoghintergrund>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId}
        id="add-item-modal-dialog" breite="md"
      >
        <Dialogkopf titelId={titelId} titel={`${title} hinzufügen`} onSchliessen={onClose} />

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar modal-body-scroll">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs uppercase text-leise font-semibold">Auswahl &amp; Suche</label>
              <span className="text-[11px] text-leise font-medium">
                {filteredItems.length} {filteredItems.length === 1 ? 'Eintrag' : 'Einträge'}
              </span>
            </div>
            <div className="relative mb-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtern / Suchen..."
                className="w-full p-2 pr-8 border border-rahmen rounded-knopf bg-flaeche text-xs text-schrift focus:ring-1 focus:ring-rahmen focus:border-rahmen outline-none"
              />
              {search && (
                <Knopf art="gefahr" nurSymbol onClick={() => setSearch('')} title="Suche leeren" className="absolute right-2 top-1/2 -translate-y-1/2" aria-label="Suche leeren">
                  ✕
                </Knopf>
              )}
            </div>
            <select
              value={selectedName}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedName(val);
                if (val !== 'custom') {
                  setCustom('');
                  setCustomSource('');
                }
                setLevel(1);
                setDesc('');
              }}
              className="w-full p-2 border border-rahmen rounded-knopf bg-flaeche text-schrift text-sm focus:ring-1 focus:ring-rahmen focus:border-rahmen outline-none"
            >
              {filteredItems.map((i) => {
                const name = i.name;
                let disabled = false;
                let extraText = '';

                const sp = sperreFuer(i, name);
                if (sp.grund) {
                  disabled = !hausregeln;
                  extraText = ` - ${sp.grund}`;
                } else if (isResource && sp.vorhanden > 0) {
                  extraText = ` - vorhanden: Stufe ${sp.vorhanden}`;
                }

                return (
                  <option key={name} value={name} disabled={disabled}>
                    {isStrength ? `${name} (${(i as StrengthData).cost ?? 1} Pkt)${extraText}` : `${name}${extraText}`}
                  </option>
                );
              })}
              <option value="custom">-- Eigene Eingabe / Andere --</option>
            </select>
          </div>

          {selectedName === 'custom' && (
            <div className="space-y-2 bg-flaeche p-3 rounded-knopf border border-gold ">
              <div>
                <label className="block text-xs uppercase text-leise font-semibold mb-1">
                  Eigene Bezeichnung *
                </label>
                <input
                  type="text"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="w-full p-2 border border-rahmen rounded-knopf bg-flaeche text-schrift text-sm"
                  placeholder="Name"
                  autoFocus
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

          {isLanguage && mode === 'creation' && !isLanguageLimitReached && (
            <div
              className={`p-2.5 rounded-knopf border border-rahmen transition-all ${
                hasFreeMotherTongue ? 'bg-seite opacity-70 dark-theme-slot-inactive' : 'bg-flaeche dark-theme-slot-active'
              }`}
            >
              <label
                className={`flex items-center space-x-2 ${
                  hasFreeMotherTongue ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isMotherTongue}
                  onChange={(e) => setIsMotherTongue(e.target.checked)}
                  disabled={hasFreeMotherTongue}
                  className="w-4 h-4 text-schrift"
                />
                <span
                  className={`font-bold text-sm ${
                    hasFreeMotherTongue ? 'text-leise' : 'text-schrift'
                  }`}
                >
                  Ist Muttersprache (Gratis){' '}
                  {hasFreeMotherTongue ? '- Bereits vergeben' : ''}
                </span>
              </label>
              <div className="text-xs text-leise mt-1 ml-6">
                Jeder Held erhält Basargnomisch und eine Muttersprache gratis.
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs uppercase text-leise mb-1">
              Beschreibung / Notiz
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full p-2 border border-rahmen rounded-knopf bg-flaeche text-schrift"
              placeholder={
                (currentItemData as StrengthData | ResourceData)?.desc ||
                (type === 'weakness' && grwSchwaechenTexte()[selectedName]) ||
                (type === 'resource' && grwRessourcenTexte()[selectedName]) ||
                'Beschreibung'
              }
            />
            {Boolean(
              (currentItemData as StrengthData | ResourceData)?.desc ||
                (type === 'weakness' && grwSchwaechenTexte()[selectedName])
            ) && (
              <div className="text-[11px] text-leise mt-1">
                {(isStrength ? 'Regel: ' : '') +
                  ((currentItemData as StrengthData | ResourceData)?.desc ||
                    grwSchwaechenTexte()[selectedName] ||
                    '')}
              </div>
            )}
          </div>

          {type !== 'weakness' && type !== 'language' && (
            <div className="flex justify-between items-center bg-flaeche p-2 rounded-knopf border border-rahmen">
              <div>
                <label className="block text-xs uppercase text-leise mb-1">Stufe / Wert</label>
                <div className="flex items-center space-x-3">
                  <Knopf nurSymbol
                    onClick={() => setLevel(Math.max(1, level - 1))}
                    className="shrink-0"
                  >
                    -
                  </Knopf>
                  <input
                    type="number"
                    value={level}
                    readOnly
                    className="w-12 text-center font-bold p-1 border-none bg-transparent text-schrift"
                  />
                  <Knopf nurSymbol
                    onClick={() => setLevel(Math.min(maxLevel, level + 1))}
                    className="shrink-0"
                  >
                    +
                  </Knopf>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase text-leise">Kosten</div>
                <div className={`font-bold ${isAffordable ? 'text-gold' : 'text-schaden'}`}>
                  {mode === 'creation'
                    ? `${level * pointCost} Pkt`
                    : `${currentCost} EP`}
                </div>
              </div>
            </div>
          )}

          {isLanguage && !isMotherTongue && mode !== 'creation' && (
            <div className="text-right">
              <div className="text-xs uppercase text-leise font-semibold">Kosten</div>
              <div
                className={`font-bold tabular-nums ${isAffordable ? 'text-gold' : 'text-schaden'}`}
              >
                5 EP
              </div>
            </div>
          )}

          {type !== 'weakness' && type !== 'language' && (
            <div className="text-xs text-leise font-medium text-center">
              {sperre && sperre.vorhanden > 0 && !sperre.grund
                ? `Vorhanden: Stufe ${sperre.vorhanden} · noch höchstens ${maxLevel} dazu`
                : `Max. Stufe: ${maxLevel}`}
            </div>
          )}

          {!isAffordable && type !== 'weakness' && (
            <div className="text-xs text-schaden font-bold text-center border border-magie bg-erhoeht p-1.5 rounded-knopf">
              Nicht genügend {mode === 'creation' ? 'Punkte' : 'EP'} verfügbar! (Rest:{' '}
              {budget})
            </div>
          )}

          {sperre?.grund && (
            <div data-testid="auswahl-sperre" className="text-xs text-schaden font-bold text-center border border-magie bg-erhoeht p-2 rounded-knopf">
              {selectedName}: {sperre.grund}{hausregeln ? ' (Hausregeln erlauben es)' : ''}
            </div>
          )}

          {isLanguageLimitReached && (
            <div className="text-xs text-schaden font-bold text-center border border-magie bg-erhoeht p-2 rounded-knopf">
              Bei der Erschaffung sind nur Basargnomisch und eine Muttersprache erlaubt.
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
            disabled={(!isAffordable && !hausregeln) || !isSelectionValid || isLanguageLimitReached || (!!sperre?.grund && !hausregeln)}
            className="text-sm disabled:cursor-not-allowed shrink-0"
          >
            Hinzufügen
          </Knopf>
        </div>
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
