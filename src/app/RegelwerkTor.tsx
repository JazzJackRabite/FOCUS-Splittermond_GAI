/**
 * Der Editor startet erst, wenn das Grundregelwerk-Paket geladen ist: alle Regeln kommen aus den Paketen,
 * eingebaute Rückfall-Listen gibt es nicht mehr (FUNDAMENT.md, Grundsatz 2).
 */
import React from 'react';
import { useRegelwerk } from '../regelwerk/RegelwerkContext';
import { Knopf } from '../fundament';

export const RegelwerkTor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, fehler, meldungen } = useRegelwerk();
  const [hinweisZu, setHinweisZu] = React.useState(false);
  if (status === 'bereit') {
    const ohneNetz = meldungen.find(m => m.startsWith('Grundregelwerk ohne Netz'));
    return (
      <>
        {children}
        {ohneNetz && !hinweisZu && (
          <div role="status" className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm z-50 bg-flaeche border border-rahmen rounded-karte p-3 text-sm text-schrift flex items-start gap-3 shadow-lg">
            <p className="flex-1">{ohneNetz}</p>
            <Knopf art="neutral" onClick={() => setHinweisZu(true)}>OK</Knopf>
          </div>
        )}
      </>
    );
  }
  return (
    <main className="min-h-screen bg-seite text-schrift font-text flex items-center justify-center p-4">
      <div className="bg-flaeche border border-rahmen rounded-karte p-6 max-w-md w-full text-center space-y-3" role="status" aria-live="polite">
        <h1 className="font-titel text-gold-hell text-xl">FOKUS</h1>
        {status === 'fehler' ? (
          <>
            <p>Das Grundregelwerk konnte nicht geladen werden.</p>
            {fehler && <p className="text-xs text-leise break-words">{fehler}</p>}
            <Knopf art="primaer" onClick={() => window.location.reload()}>Neu laden</Knopf>
          </>
        ) : (
          <p className="text-leise">Regelwerk wird geladen …</p>
        )}
      </div>
    </main>
  );
};
