import React from 'react';
import { Dialog, Knopf } from '../../fundament';

interface ConfirmDialogProps {
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title = 'Bestätigung',
  message,
  onConfirm,
  onCancel,
}) => (
  <Dialog
    titel={title}
    onSchliessen={onCancel}
    breite="schmal"
    fuss={<>
      <Knopf onClick={onCancel}>Abbrechen</Knopf>
      <Knopf art="primaer" onClick={onConfirm}>OK</Knopf>
    </>}
  >
    <p id="confirm-dialog-card" className="text-sm text-schrift leading-relaxed m-0">{message}</p>
  </Dialog>
);
