import { useState } from 'react';

export interface ConfirmDialogState {
  title?: string;
  message: string;
  onConfirm: () => void;
}

export function useModals() {
  const [showXpModal, setShowXpModal] = useState(false);
  const [showStrengthModal, setShowStrengthModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showWeaknessModal, setShowWeaknessModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showSpellModal, setShowSpellModal] = useState(false);
  const [masteryModalOpen, setMasteryModalOpen] = useState(false);
  const [activeSkillForMastery, setActiveSkillForMastery] = useState<{ name: string; val: number } | null>(null);
  const [activeSkillForSpell, setActiveSkillForSpell] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  return {
    showXpModal, setShowXpModal,
    showStrengthModal, setShowStrengthModal,
    showResourceModal, setShowResourceModal,
    showWeaknessModal, setShowWeaknessModal,
    showLanguageModal, setShowLanguageModal,
    showSpellModal, setShowSpellModal,
    masteryModalOpen, setMasteryModalOpen,
    activeSkillForMastery, setActiveSkillForMastery,
    activeSkillForSpell, setActiveSkillForSpell,
    confirmDialog, setConfirmDialog,
  };
}
