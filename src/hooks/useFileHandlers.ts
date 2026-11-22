import { toast } from 'react-hot-toast';
import { clearLocalStorage } from './useLocalStorage';
import { validateCharacterImport } from '../utils/importValidation';
import { referenceCharacterResources } from '../utils/gameResourceManager';
import type React from 'react';
import type { CharacterAction, CharacterState, DerivedStats, Mastery, Spell } from '../types';
import type { ConfirmDialogState } from './useModals';

interface FileHandlersParams {
  state: CharacterState;
  calc: {
    derived: DerivedStats;
    heldengrad: { name: string; maxAttrMod: number; maxSkill: number };
    splinterPoints: number;
    xpSpent: number;
    currentAttributes: Record<string, number>;
    groupedMasteries: Array<{ skill: string; items: Mastery[] }>;
    groupedSpells: Array<{ skill: string; items: Spell[] }>;
    getAttrValue: (key: string) => number;
  };
  dispatch: React.Dispatch<CharacterAction>;
  setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState | null>>;
}

export function useFileHandlers({ state, calc, dispatch, setConfirmDialog }: FileHandlersParams) {
  const {
    derived, heldengrad, splinterPoints, xpSpent,
    currentAttributes, groupedMasteries, groupedSpells, getAttrValue,
  } = calc;
  const {
    mode, xpTotal, name, race, moonSign, homeRegion,
    attrBase, raceBonusAttrs, attrIncrements, skillsBase, skillsXp,
    strengthsList, resourcesList, masteries, weaknessesList, spellsList, languagesList,
  } = state;

  const handleExport = () => {
    const data: CharacterState = {
      mode: state.mode,
      xpTotal: state.xpTotal,
      name: state.name,
      race: state.race,
      moonSign: state.moonSign,
      homeRegion: state.homeRegion,
      attrBase: state.attrBase,
      raceBonusAttrs: state.raceBonusAttrs,
      attrIncrements: state.attrIncrements,
      skillsBase: state.skillsBase,
      skillsXp: state.skillsXp,
      strengthsList: state.strengthsList,
      resourcesList: state.resourcesList,
      masteries: state.masteries,
      weaknessesList: state.weaknessesList,
      spellsList: state.spellsList,
      languagesList: state.languagesList,
      inventory: state.inventory ?? [],
      money: state.money ?? { solare: 0, lunare: 5, telare: 0 },
      ignoreEncumbrance: state.ignoreEncumbrance ?? false,
      creationFinalized: state.creationFinalized ?? false,
      playState: state.playState,
      advancementLog: state.advancementLog ?? [],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.name || 'charakter').replace(/[^a-z0-9_-]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) { toast.error('Nur JSON-Dateien erlaubt!'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse((ev.target?.result as string) || '{}');
        const validated = validateCharacterImport(raw);
        const referenced = referenceCharacterResources(validated);
        dispatch({ type: 'LOAD_STATE', payload: referenced });
        toast.success('Charakter importiert!');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Fehler beim Lesen der Datei.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleGeneratePDF = async () => {
    try {
      const { generatePDF } = await import('../components/export/PdfExport');
      await generatePDF({
        state, derived, heldengrad, splinterPoints, xpSpent, currentAttributes,
        groupedMasteries, groupedSpells, getAttrValue,
      });
      toast.success('PDF erfolgreich erstellt!');
    } catch (err) {
      toast.error('Fehler beim Erstellen der PDF-Datei.');
    }
  };

  const handleReset = () => {
    setConfirmDialog({
      message: 'Charakter wirklich zurücksetzen?',
      onConfirm: () => {
        clearLocalStorage();
        window.location.reload();
      },
    });
  };

  return { handleExport, handleFileChange, handleGeneratePDF, handleReset };
}
