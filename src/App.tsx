import { Knopf, Reiter } from './fundament';
import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Users, Settings, RotateCcw } from 'lucide-react';

import { useCharacterState } from './hooks/useCharacterState';
import { useCalculations } from './hooks/useCalculations';
import { useNamensAbgleich } from './regelwerk/useNamensAbgleich';
import { CharacterContext, useCharacter } from './context/CharacterContext';
import { ProfileModal } from './components/modals/ProfileModal';
import { SettingsModal } from './components/common/SettingsModal';
import { loadFromLocalStorage } from './hooks/useLocalStorage';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { CreationView } from './features/creation/CreationView';
import { PlayView } from './features/play/PlayView';
import { CombatMagicTab } from './components/combat/CombatMagicTab';
import { InventoryView } from './features/inventory/InventoryView';
import { BegleiterView } from './features/begleiter/BegleiterView';
import { PlaySessionProvider, usePlaySession } from './context/PlaySessionContext';
import { ReliktAbgleich } from './components/relikte/ReliktKarte';
import type { ConfirmDialogState } from './hooks/useModals';
import type { AppMode } from './types';

// ---------------------------------------------------------------
// Header Undo Button
// ---------------------------------------------------------------

const HeaderUndoButton: React.FC = () => {
  const { state, dispatch } = useCharacter();
  const session = usePlaySession();

  const isPlayOrCombat = state.mode === 'play' || state.mode === 'combat';
  const canUndoPlay = isPlayOrCombat && session.playHistory.length > 0;
  const canUndoAdvancement = (state.advancementHistory?.length ?? 0) > 0;
  const canUndo = canUndoPlay || canUndoAdvancement;

  const handleUndo = () => {
    if (canUndoPlay) {
      session.handleUndoPlay();
    } else if (canUndoAdvancement) {
      dispatch({ type: 'UNDO_LAST_ADVANCEMENT' });
      toast.success('Letzte Steigerung / Änderung rückgängig gemacht');
    }
  };

  return (
    <Knopf
      art="sekundaer"
      nurSymbol
      onClick={handleUndo}
      disabled={!canUndo}
      title={
        canUndoPlay
          ? 'Letzte Aktion rückgängig machen'
          : canUndoAdvancement
          ? 'Letzte Steigerung rückgängig machen'
          : 'Keine Aktion zum Rückgängigmachen'
      }
      aria-label="Rückgängig"
    >
      <RotateCcw size={19} />
    </Knopf>
  );
};

// ---------------------------------------------------------------

const App: React.FC = () => {
  const { state, dispatch } = useCharacterState();
  const calc = useCalculations(state);
  useNamensAbgleich(state, dispatch);

  const { mode } = state;
  const { xpAvailable, isCreationComplete } = calc;

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  useEffect(() => {
    if (
      (mode === 'xp' || mode === 'play' || mode === 'combat' || mode === 'inventory' || mode === 'begleiter') &&
      !isCreationComplete &&
      !state.creationFinalized
    ) {
      dispatch({ type: 'SET_MODE', payload: 'creation' });
    }
  }, [isCreationComplete, state.creationFinalized, mode, dispatch]);

  // Auto-initialize playState when entering play or combat mode for the first time
  useEffect(() => {
    if ((mode === 'play' || mode === 'combat') && state.playState.healthSlots.length === 0) {
      dispatch({
        type: 'PLAY_RESET',
        payload: {
          maxLP: calc.maxLP,
          maxFocus: calc.maxFO,
          maxSplitter: calc.splinterPoints,
        },
      });
    }
  }, [mode, state.playState.healthSlots.length, calc.maxLP, calc.maxFO, calc.splinterPoints, dispatch]);

  const handleTabClick = (targetMode: AppMode) => {
    if (targetMode === mode) return;

    if (targetMode === 'creation') {
      if (state.creationFinalized) {
        setConfirmDialog({
          title: 'Erschaffung modifizieren?',
          message: 'Bist du sicher, dass du die Charaktererschaffung modifizieren möchtest?',
          onConfirm: () => {
            dispatch({ type: 'SET_CREATION_FINALIZED', payload: false });
            dispatch({ type: 'SET_MODE', payload: 'creation' });
            setConfirmDialog(null);
          },
        });
      } else {
        dispatch({ type: 'SET_MODE', payload: 'creation' });
      }
      return;
    }

    // targetMode is 'xp', 'play', 'combat', 'inventory' or 'begleiter'
    if (!state.creationFinalized) {
      if (!isCreationComplete) {
        toast.error('Die Charaktererschaffung ist noch nicht vollständig!');
        return;
      }
      setConfirmDialog({
        title: 'Charaktererschaffung abschließen?',
        message: 'Ist die Charaktererschaffung abgeschlossen? Sobald du dies bestätigst, darfst du deinen Charakter steigern und spielen.',
        onConfirm: () => {
          dispatch({ type: 'SET_CREATION_FINALIZED', payload: true });
          dispatch({ type: 'SET_MODE', payload: targetMode });
          setConfirmDialog(null);
          toast.success('Charaktererschaffung abgeschlossen! Steigerung und Spielen freigeschaltet.');
        },
      });
      return;
    }

    // Already finalized, switch directly
    dispatch({ type: 'SET_MODE', payload: targetMode });
  };

  const isAdvancementUnlocked = isCreationComplete || !!state.creationFinalized;

  return (
    <CharacterContext.Provider value={{ state, dispatch, calc }}>
      {/* Global Toast Notifications - always on top of modals & backdrops */}
      <Toaster
        position="top-right"
        containerStyle={{
          zIndex: 99999,
        }}
        toastOptions={{
          duration: 3500,
          style: {
            zIndex: 99999,
            background: 'var(--color-erhoeht)',
            color: 'var(--color-schrift)',
            border: '1px solid var(--color-gold)',
            fontWeight: '500',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-gold)',
              secondary: 'var(--color-seite)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--color-schaden)',
              secondary: 'var(--color-schrift)',
            },
          },
        }}
      />

      <ReliktAbgleich />
      <PlaySessionProvider>
        <div className="relative z-0 paper-bg rounded-knopf min-h-[90vh] flex flex-col shadow-2xl pb-20 w-full">
          {/* Confirm Dialog */}
          {confirmDialog && (
            <ConfirmDialog
              title={confirmDialog.title}
              message={confirmDialog.message}
              onConfirm={confirmDialog.onConfirm}
              onCancel={() => setConfirmDialog(null)}
            />
          )}

          {/* Floating XP Counter */}
          <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 bg-erhoeht text-schrift px-3.5 py-1.5 sm:px-6 sm:py-3 rounded-full shadow-2xl z-50 flex flex-col items-center no-print border border-rahmen select-none">
            <div className="text-[11px] sm:text-[11px] uppercase tracking-wider text-gold font-bold leading-tight">Verfügbar</div>
            <div className={`text-sm sm:text-xl font-bold leading-tight ${xpAvailable < 0 ? 'text-schaden' : 'text-schrift'}`}>
              {xpAvailable} EP
            </div>
          </div>

          {/* HEADER */}
          <div className="bg-flaeche text-schrift px-4 sm:px-6 pt-4 pb-3 relative z-10 no-print w-full">
            <div className="flex items-center justify-between gap-3 lg:gap-4">
              {/* 1. Branding */}
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-widest text-gold leading-none">
                  FOCUS
                </h1>
                <p className="text-[11px] sm:text-xs text-leise tracking-wide leading-tight mt-1 hidden min-[360px]:block">
                  Freier Online Charaktereditor:<br />
                  Universum Splittermond v.1.2
                </p>
              </div>

              {/* 2. Action Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Knopf art="sekundaer" onClick={() => setShowProfileModal(true)} title="Helden-Profile & Vorlagen" aria-label="Meine Charaktere" className="text-xs sm:text-sm font-bold max-[429px]:w-11 max-[429px]:px-0">
                  <Users size={17} aria-hidden />
                  <span className="hidden sm:inline">Meine Charaktere</span>
                  <span className="hidden min-[430px]:inline sm:hidden">Helden</span>
                </Knopf>

                <Knopf art="sekundaer" nurSymbol onClick={() => setShowThemeModal(true)} title="Menü & Einstellungen" aria-label="Menü & Einstellungen">
                  <Settings size={19} />
                </Knopf>

                <HeaderUndoButton />
              </div>
            </div>
          </div>

          {/* Profile Modal */}
          {showProfileModal && (
            <ProfileModal
              currentState={state}
              onClose={() => setShowProfileModal(false)}
              onSelectProfile={(profileId) => {
                const loaded = loadFromLocalStorage(profileId);
                if (loaded) {
                  dispatch({ type: 'LOAD_STATE', payload: loaded });
                }
              }}
            />
          )}

          {/* Settings Modal */}
          {showThemeModal && (
            <SettingsModal
              onClose={() => setShowThemeModal(false)}
            />
          )}

          {/* TABS */}
          <div role="tablist" aria-label="Bereiche" className="sticky top-0 z-30 flex bg-flaeche border-b border-rahmen no-print w-full overflow-x-auto px-2 sm:px-4">
            <Reiter gewaehlt={mode === 'creation' || mode === 'xp'} onClick={() => {
                if (mode === 'creation' || mode === 'xp') return;
                if (state.creationFinalized) {
                  dispatch({ type: 'SET_MODE', payload: 'xp' });
                } else {
                  dispatch({ type: 'SET_MODE', payload: 'creation' });
                }
              }} className="flex-1 min-w-[85px] py-2 sm:py-2.5 md:py-3 font-titel px-1.5 sm:px-3 uppercase tracking-normal sm:tracking-wider md:tracking-widest text-[11px] sm:text-xs md:text-sm">
              <span>Charakter</span>
            </Reiter>

            <Reiter gewaehlt={mode === 'play'} onClick={() => handleTabClick('play')} disabled={!isAdvancementUnlocked} title={!isAdvancementUnlocked ? 'Erst verfügbar wenn Erschaffung abgeschlossen' : ''} className="flex-1 min-w-[85px] py-2 sm:py-2.5 md:py-3 font-titel px-1.5 sm:px-3 uppercase tracking-normal sm:tracking-wider md:tracking-widest text-[11px] sm:text-xs md:text-sm">
              <span>Spielen</span>
            </Reiter>

            <Reiter gewaehlt={mode === 'combat'} onClick={() => handleTabClick('combat')} disabled={!isAdvancementUnlocked} title={!isAdvancementUnlocked ? 'Erst verfügbar wenn Erschaffung abgeschlossen' : ''} className="flex-1 min-w-[105px] py-2 sm:py-2.5 md:py-3 font-titel px-1.5 sm:px-3 uppercase tracking-normal sm:tracking-wider md:tracking-widest text-[11px] sm:text-xs md:text-sm">
              <span>Kampf &amp; Magie</span>
            </Reiter>

            <Reiter gewaehlt={mode === 'inventory'} onClick={() => handleTabClick('inventory')} disabled={!isAdvancementUnlocked} title={!isAdvancementUnlocked ? 'Erst verfügbar wenn Erschaffung abgeschlossen' : ''} className="flex-1 min-w-[85px] py-2 sm:py-2.5 md:py-3 font-titel px-1.5 sm:px-3 uppercase tracking-normal sm:tracking-wider md:tracking-widest text-[11px] sm:text-xs md:text-sm">
              <span>Inventar</span>
            </Reiter>

            <Reiter gewaehlt={mode === 'begleiter'} onClick={() => handleTabClick('begleiter')} disabled={!isAdvancementUnlocked} title={!isAdvancementUnlocked ? 'Erst verfügbar wenn Erschaffung abgeschlossen' : ''} className="flex-1 min-w-[85px] py-2 sm:py-2.5 md:py-3 font-titel px-1.5 sm:px-3 uppercase tracking-normal sm:tracking-wider md:tracking-widest text-[11px] sm:text-xs md:text-sm">
              <span>Begleiter</span>
            </Reiter>
          </div>

          {/* MAIN CONTENT */}
          {(mode === 'creation' || mode === 'xp') && <CreationView />}
          {mode === 'play' && <PlayView />}
          {mode === 'combat' && <CombatMagicTab />}
          {mode === 'inventory' && <InventoryView />}
          {mode === 'begleiter' && <BegleiterView />}
        </div>
      </PlaySessionProvider>
    </CharacterContext.Provider>
  );
};

export default App;
