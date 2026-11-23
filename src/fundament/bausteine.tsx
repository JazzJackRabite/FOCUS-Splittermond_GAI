/**
 * FUNDAMENT – Bausteine. Aus diesen Teilen setzen sich die Ansichten zusammen (siehe FUNDAMENT.md, Abschnitt „Gestaltung“).
 * Hier stehen keine Farbwerte, nur die benannten Werte aus fundament.css.
 */
import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

const zusammen = (...teile: (string | false | null | undefined)[]) => teile.filter(Boolean).join(' ');

// ---------------------------------------------------------------- Knopf
export type KnopfArt = 'primaer' | 'sekundaer' | 'neutral' | 'gefahr' | 'erholung';

const KNOPF: Record<KnopfArt, string> = {
  /** die eine Hauptaktion einer Ansicht oder eines Dialogs */
  primaer: 'bg-gold border-gold text-seite font-bold hover:bg-gold-hell hover:border-gold-hell',
  /** weitere wichtige Aktionen */
  sekundaer: 'bg-transparent border-gold text-gold-hell font-bold hover:bg-erhoeht',
  /** alles Übrige */
  neutral: 'bg-erhoeht border-rahmen text-schrift hover:border-leise',
  /** Schaden, Löschen, Abbrechen mit Verlust */
  gefahr: 'bg-schaden-grund border-schaden text-schrift font-bold hover:bg-erhoeht',
  /** Heilen, Erholen */
  erholung: 'bg-unverletzt-grund border-unverletzt text-schrift font-bold hover:bg-unverletzt hover:text-seite',
};

export interface KnopfProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  art?: KnopfArt;
  /** quadratischer Knopf nur mit Symbol – braucht aria-label */
  nurSymbol?: boolean;
  /** schmaler Innenabstand, wenn mehrere Knöpfe auf dem Handy in eine Zeile passen sollen */
  eng?: boolean;
}

/**
 * Gibt die Ansicht selbst eine Ausrichtung vor (z. B. `justify-between` für „Name links, Wert rechts“), darf die
 * mittige Grundausrichtung nicht mehr greifen: Tailwind entscheidet bei zwei `justify-*`-Klassen nach der Reihenfolge
 * im Stylesheet, nicht im className – dort gewinnt sonst `justify-center`. Text steht in diesem Fall linksbündig.
 */
const eigeneAusrichtung = (className?: string) => /(^|\s)justify-(start|between|end|around|evenly)(\s|$)/.test(className ?? '');

/** Schaltfläche. Mindestens 44 px hoch, damit sie auch am Handy sicher zu treffen ist. */
export const Knopf = React.forwardRef<HTMLButtonElement, KnopfProps>(({ art = 'neutral', nurSymbol, eng, className, type = 'button', ...rest }, ref) => (
  <button
    ref={ref}
    type={type}
    className={zusammen(
      'inline-flex items-center gap-2 min-h-11 rounded-knopf border font-text text-[13px] cursor-pointer transition-colors',
      eigeneAusrichtung(className) ? 'text-left' : 'justify-center',
      'disabled:cursor-not-allowed disabled:bg-flaeche disabled:border-rahmen disabled:text-leise disabled:font-normal',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-hell',
      nurSymbol ? 'w-11 px-0' : eng ? 'px-2' : 'px-[18px]',
      KNOPF[art],
      className,
    )}
    {...rest}
  />
));
Knopf.displayName = 'Knopf';

// ---------------------------------------------------------------- Leistenknopf, Feldknopf
/**
 * Knopf innerhalb einer farbigen Leiste (Plus/Minus, mittige Beschriftung). Die Leiste ist mindestens 44 px hoch,
 * der Knopf füllt ihre Höhe; Farben gibt die Leiste über className mit (Werte aus fundament.css).
 */
export const Leistenknopf = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, type = 'button', ...rest }, ref) => (
  <button
    ref={ref}
    type={type}
    className={zusammen(
      'self-stretch min-w-7 flex items-center justify-center rounded-knopf cursor-pointer transition-colors active:scale-95',
      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hell disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...rest}
  />
));
Leistenknopf.displayName = 'Leistenknopf';

/**
 * Kästchen einer Punkteleiste (Lebenspunkte, Fokus, temporäre LP), das sich per Klick zurücknehmen lässt.
 * Bewusst klein, damit eine ganze Leiste in eine Zeile passt; braucht eine Beschriftung (title und aria-label).
 * Leere Kästchen sind deaktiviert.
 */
export const Feldknopf = React.forwardRef<HTMLButtonElement, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & { beschriftung: string }>(
  ({ beschriftung, className, type = 'button', disabled, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      title={beschriftung}
      aria-label={beschriftung}
      disabled={disabled}
      className={zusammen(
        'w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-knopf transition-all select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hell',
        disabled ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95',
        className,
      )}
      {...rest}
    />
  ));
Feldknopf.displayName = 'Feldknopf';

const WAHL_TON: Record<'gold' | 'erholung' | 'gefahr', string> = {
  gold: 'bg-erhoeht border-gold text-schrift',
  erholung: 'bg-unverletzt-grund border-unverletzt text-schrift',
  gefahr: 'bg-schaden-grund border-schaden text-schrift',
};

export interface WahlknopfProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** ausgewählt (aria-pressed) */
  gewaehlt: boolean;
  /** Farbe im ausgewählten Zustand */
  ton?: keyof typeof WAHL_TON;
  /** Inhalt mittig statt linksbündig (z. B. Reiter, kurze Filter) */
  mittig?: boolean;
}

/** Auswählbare Karte mit Titel und Erläuterung (z. B. Heilmethode, Schadensart). Mindestens 44 px hoch. */
export const Wahlknopf = React.forwardRef<HTMLButtonElement, WahlknopfProps>(({ gewaehlt, ton = 'gold', mittig, className, type = 'button', ...rest }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={gewaehlt}
    className={zusammen(
      'flex min-h-11 p-2 rounded-knopf border font-text cursor-pointer transition-colors',
      mittig ? 'flex-row flex-wrap items-center justify-center text-center gap-2' : 'flex-col text-left',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-hell',
      gewaehlt ? WAHL_TON[ton] : 'bg-seite border-rahmen text-schrift hover:border-leise',
      className,
    )}
    {...rest}
  />
));
Wahlknopf.displayName = 'Wahlknopf';

/** Reiter einer Leiste (Hauptnavigation, Reiter in Dialogen): goldene Unterstreichung, wenn gewählt. Mindestens 44 px hoch. */
export const Reiter = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { gewaehlt: boolean }>(
  ({ gewaehlt, className, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      role="tab"
      aria-selected={gewaehlt}
      className={zusammen(
        'inline-flex items-center justify-center gap-1.5 min-h-11 border-b-2 font-bold text-center cursor-pointer transition-colors select-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-hell',
        gewaehlt ? 'text-gold border-gold' : 'text-leise border-transparent hover:text-schrift',
        className,
      )}
      {...rest}
    />
  ));
Reiter.displayName = 'Reiter';

// ---------------------------------------------------------------- Karte und Titel
/** Fläche für einen zusammengehörigen Bereich */
export const Karte: React.FC<React.HTMLAttributes<HTMLElement> & { als?: 'section' | 'div' }> = ({ als: Tag = 'section', className, ...rest }) => (
  <Tag className={zusammen('bg-flaeche border border-rahmen rounded-karte p-5', className)} {...rest} />
);

/** Titel eines Bereichs (in einer Karte) */
export const Abschnittstitel: React.FC<React.HTMLAttributes<HTMLHeadingElement> & { als?: 'h2' | 'h3' }> = ({ als: Tag = 'h2', className, ...rest }) => (
  <Tag className={zusammen('m-0 font-titel font-bold text-[17px] tracking-[0.06em] text-gold-hell', className)} {...rest} />
);

// ---------------------------------------------------------------- Marke
export type Ton = 'neutral' | 'gold' | 'unverletzt' | 'erschoepft' | 'schaden' | 'kanalisiert' | 'magie' | 'temporaer';

/** Rahmen und Grund je Bedeutung – auch für Kästchen und Hinweisflächen außerhalb der Marke */
export const TON: Record<Ton, string> = {
  neutral: 'bg-erhoeht border-rahmen',
  gold: 'bg-transparent border-gold',
  unverletzt: 'bg-unverletzt-grund border-unverletzt',
  erschoepft: 'bg-erschoepft-grund border-erschoepft',
  schaden: 'bg-schaden-grund border-schaden',
  kanalisiert: 'bg-kanalisiert-grund border-kanalisiert',
  magie: 'bg-magie-grund border-magie',
  temporaer: 'bg-temporaer-grund border-temporaer',
};

/** Kleine Kennzeichnung (Zustand, Bonus, Kosten). Die Bedeutung trägt der Rahmen, der Text bleibt gut lesbar. */
export const Marke: React.FC<React.HTMLAttributes<HTMLSpanElement> & { ton?: Ton; klein?: boolean }> = ({ ton = 'neutral', klein, className, ...rest }) => (
  <span
    className={zusammen(
      'inline-flex items-center gap-1.5 border whitespace-nowrap',
      klein ? 'text-[11px] px-2 py-0.5 rounded-[10px]' : 'text-xs px-3 py-1.5 rounded-2xl',
      ton === 'neutral' ? 'text-leise' : ton === 'gold' ? 'text-gold-hell' : 'text-schrift',
      TON[ton],
      className,
    )}
    {...rest}
  />
);

// ---------------------------------------------------------------- Eingaben
const FELD = 'min-h-11 w-full box-border px-3.5 rounded-knopf border border-rahmen bg-erhoeht text-schrift font-text text-sm placeholder:text-leise focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hell disabled:text-leise';

/** Beschriftetes Eingabefeld. Die Beschriftung ist Pflicht (für Vorleseprogramme); mit `beschriftungVerborgen` unsichtbar. */
export const Eingabe = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { beschriftung: string; beschriftungVerborgen?: boolean }>(
  ({ beschriftung, beschriftungVerborgen, className, id, ...rest }, ref) => {
    const eigene = useId();
    const feldId = id ?? eigene;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={feldId} className={beschriftungVerborgen ? 'sr-only' : 'text-xs text-leise'}>{beschriftung}</label>
        <input ref={ref} id={feldId} className={zusammen(FELD, className)} {...rest} />
      </div>
    );
  },
);
Eingabe.displayName = 'Eingabe';

/** Beschriftete Auswahlliste */
export const Auswahl = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { beschriftung: string; beschriftungVerborgen?: boolean }>(
  ({ beschriftung, beschriftungVerborgen, className, id, children, ...rest }, ref) => {
    const eigene = useId();
    const feldId = id ?? eigene;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={feldId} className={beschriftungVerborgen ? 'sr-only' : 'text-xs text-leise'}>{beschriftung}</label>
        <select ref={ref} id={feldId} className={zusammen(FELD, className)} {...rest}>{children}</select>
      </div>
    );
  },
);
Auswahl.displayName = 'Auswahl';

// ---------------------------------------------------------------- Rollbereich
/** Bereich mit eigenem Scrollbalken (Gestaltung des Balkens: fundament.css). Mit Tastatur erreichbar. */
export const Rollbereich: React.FC<React.HTMLAttributes<HTMLDivElement> & { beschriftung: string }> = ({ beschriftung, className, ...rest }) => (
  <div role="region" aria-label={beschriftung} tabIndex={0} className={zusammen('overflow-y-auto pr-3', className)} {...rest} />
);

// ---------------------------------------------------------------- Rauten
/** Zählbare Punkte als Rauten (z. B. Splitterpunkte): gefüllt = vorhanden, nur Rand = verbraucht. */
export const Rauten: React.FC<{ wert: number; von: number; beschriftung: string; className?: string }> = ({ wert, von, beschriftung, className }) => (
  <div role="img" aria-label={beschriftung} className={zusammen('flex flex-wrap gap-2.5 px-1 py-1', className)}>
    {Array.from({ length: Math.max(von, wert) }).map((_, i) => (
      <span key={i} aria-hidden="true" className={zusammen('w-5 h-5 rotate-45 rounded-[3px] box-border', i < wert ? 'bg-gold' : 'border-2 border-gold')} />
    ))}
  </div>
);

// ---------------------------------------------------------------- Dialog
export interface DialogProps {
  titel: string;
  untertitel?: React.ReactNode;
  onSchliessen: () => void;
  /** Knöpfe unten rechts; die Hauptaktion steht zuletzt */
  fuss?: React.ReactNode;
  breite?: 'schmal' | 'mittel' | 'breit';
  children: React.ReactNode;
}


/** Abgedunkelter Hintergrund hinter einem Dialog. Alle Dialoge des Editors liegen auf diesem Baustein. */
export const Dialoghintergrund = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...rest }, ref) => (
  <div ref={ref} className={zusammen('fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-seite/80 overflow-y-auto no-print', className)} {...rest} />
));
Dialoghintergrund.displayName = 'Dialoghintergrund';

const FENSTERBREITE = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', '3xl': 'max-w-3xl', '4xl': 'max-w-4xl', '5xl': 'max-w-5xl' };
export type Fensterbreite = keyof typeof FENSTERBREITE;

/** Das Fenster eines Dialogs: Fläche, Rahmen, Rundung, Höhe und Schatten sind hier festgelegt, nicht im einzelnen Dialog. */
export const Dialogfenster = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { breite?: Fensterbreite }>(({ breite = 'lg', className, ...rest }, ref) => (
  <div ref={ref} className={zusammen('w-full max-h-[92vh] my-auto flex flex-col overflow-hidden bg-flaeche text-schrift border border-rahmen rounded-karte shadow-2xl', FENSTERBREITE[breite], className)} {...rest} />
));
Dialogfenster.displayName = 'Dialogfenster';

/** Escape schließt den Dialog */
export function useEscape(onSchliessen: () => void) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') onSchliessen(); };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, [onSchliessen]);
}

export interface DialogkopfProps {
  titel: React.ReactNode;
  titelId?: string;
  untertitel?: React.ReactNode;
  /** Symbol links vom Titel (lucide-react) */
  symbol?: React.ReactNode;
  /** Bedeutung des Symbolrahmens */
  ton?: Exclude<Ton, 'gold'>;
  /** weitere Knöpfe rechts vor „Schließen“ */
  aktionen?: React.ReactNode;
  onSchliessen: () => void;
}

/** Titelzeile eines Dialogs: Symbol, Titel, Untertitel, Aktionen, Schließen-Knopf; goldene Linie darunter */
export const Dialogkopf: React.FC<DialogkopfProps> = ({ titel, titelId, untertitel, symbol, ton = 'neutral', aktionen, onSchliessen }) => (
  <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-gold shrink-0">
    <div className="flex items-center gap-3 min-w-0">
      {symbol && <div className={zusammen('hidden sm:flex w-10 h-10 rounded-karte border items-center justify-center shrink-0', SYMBOLTON[ton])} aria-hidden="true">{symbol}</div>}
      <div className="min-w-0">
        <h2 id={titelId} className="m-0 font-titel font-bold text-[17px] tracking-[0.06em] text-schrift leading-tight">{titel}</h2>
        {untertitel && <div className="text-xs text-leise mt-0.5">{untertitel}</div>}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {aktionen}
      <Knopf nurSymbol aria-label="Schließen" title="Schließen (Esc)" onClick={onSchliessen}><X size={16} aria-hidden="true" /></Knopf>
    </div>
  </div>
);

const SYMBOLTON: Record<Exclude<Ton, 'gold'>, string> = {
  neutral: 'bg-erhoeht border-rahmen text-schrift', unverletzt: 'bg-unverletzt-grund border-unverletzt text-schrift',
  erschoepft: 'bg-erschoepft-grund border-erschoepft text-schrift', schaden: 'bg-schaden-grund border-schaden text-schrift',
  kanalisiert: 'bg-kanalisiert-grund border-kanalisiert text-schrift', magie: 'bg-magie-grund border-magie text-schrift',
  temporaer: 'bg-temporaer-grund border-temporaer text-schrift',
};

/** Dialog über der Ansicht: Titelzeile mit goldener Linie, rollender Inhalt, Fußzeile mit Aktionen. Schließt mit Escape. */
export const Dialog: React.FC<DialogProps> = ({ titel, untertitel, onSchliessen, fuss, breite = 'mittel', children }) => {
  const titelId = useId();
  useEscape(onSchliessen);
  return (
    <Dialoghintergrund onMouseDown={(e) => { if (e.target === e.currentTarget) onSchliessen(); }}>
      <Dialogfenster role="dialog" aria-modal="true" aria-labelledby={titelId} breite={({ schmal: 'md', mittel: 'xl', breit: '3xl' } as const)[breite]} className="font-text text-sm">
        <Dialogkopf titel={titel} titelId={titelId} untertitel={untertitel} onSchliessen={onSchliessen} />
        <div className="p-5 overflow-y-auto flex flex-col gap-3.5">{children}</div>
        {fuss && <div className="flex flex-wrap justify-end gap-2.5 px-5 py-4 border-t border-rahmen">{fuss}</div>}
      </Dialogfenster>
    </Dialoghintergrund>
  );
};
