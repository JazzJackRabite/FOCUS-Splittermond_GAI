import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { aenderungGesperrt } from '../../fundament/hausregeln';
import {
  bausteinText, bausteinVorab, bausteineFuer, beitrag, gruppe, hoechstzahl, kostenText, vaRegel, vaWaffen, voraussetzungText, wesenBaukastenWerte, type WesenBaukastenWerte,
} from '../../regelwerk/wesenBaukasten';
import type { Katalog } from '../../regelwerk/katalog';
import type { Begleiter } from '../../types';
import { Abschnittstitel, Auswahl, Knopf, Marke } from '../../fundament';
import { Feinschliff } from './Feinschliff';
import { Hinweise, MarkeMitEntfernen } from './Wertekasten';

const Titel3: React.FC<{ children: React.ReactNode }> = ({ children }) => <Abschnittstitel als="h3" className="text-[15px]">{children}</Abschnittstitel>;

/** Verbesserte Angriffe (Die Magie S. 196–197): Punkte und Angebote aus `strukturiert.verbesserte_angriffe` */
const VerbesserteAngriffe: React.FC<{ k: Katalog; b: Begleiter; va: NonNullable<WesenBaukastenWerte['verbesserteAngriffe']>; aendern: (a: Partial<Begleiter>) => void }> = ({ k, b, va, aendern }) => {
  const [wahl, setWahl] = useState('');
  const R = vaRegel(k);
  const waffen = useMemo(() => (R ? vaWaffen(k, R) : []), [k, R]);
  if (!R) return null;
  const liste = b.verbesserteAngriffe ?? [];
  const frei = va.punkte - va.verbraucht;
  const angebot = [
    ...R.wertesets.map(s2 => ({ schluessel: `set:${s2.punkte}`, text: `Werteset ${s2.schaden}, WGS ${s2.wgs}, ${s2.merkmale}`, punkte: s2.punkte })),
    ...R.sonstiges.filter(s2 => s2.art === 'stumpf_entfaellt').map(s2 => ({ schluessel: 'stumpf', text: 'Merkmal Stumpf entfällt', punkte: s2.punkte })),
    ...waffen.map(x => ({ schluessel: `waffe:${x.e.id}`, text: `Angriff wie ${x.e.name}`, punkte: x.punkte })),
  ];
  return (
    <div className="space-y-2" data-testid="verbesserte-angriffe">
      <Titel3>Verbesserte Angriffe</Titel3>
      <div className="flex items-center gap-2 flex-wrap">
        <Marke ton={frei < 0 ? 'schaden' : 'neutral'}>Punkte {va.verbraucht}/{va.punkte}</Marke>
        <span className="text-sm text-leise">aus Rolle und Korpus; neue Angriffe zählen zusätzlich, Änderungen der Module gelten für alle.</span>
      </div>
      {va.kaeufe.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {va.kaeufe.map((x, i) => (
            <MarkeMitEntfernen key={`${x.schluessel}-${i}`} label={`${x.text} entfernen`} onEntfernen={() => aendern({ verbesserteAngriffe: liste.filter((_, j) => j !== i) })}>{x.text} <span className="text-leise">({x.punkte} P.)</span></MarkeMitEntfernen>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-end">
        <Auswahl beschriftung="Verbesserter Angriff" value={wahl} onChange={ev => setWahl(ev.target.value)}>
          <option value="">wählen …</option>
          {angebot.map(x => <option key={x.schluessel} value={x.schluessel} disabled={x.punkte > frei || (x.schluessel === 'stumpf' && liste.includes('stumpf'))}>{x.text} ({x.punkte} P.)</option>)}
        </Auswahl>
        <Knopf disabled={!wahl} onClick={() => { aendern({ verbesserteAngriffe: [...liste, wahl] }); setWahl(''); }}><Plus size={14} aria-hidden />Kaufen</Knopf>
      </div>
    </div>
  );
};

/** Editor eines im Baukasten gebauten Wesens: Module und Rollen je Gruppe, Dienste, Feinschliff */
export const WesenBaukasten: React.FC<{ k: Katalog; b: Begleiter; w: WesenBaukastenWerte; aendern: (a: Partial<Begleiter>) => void }> = ({ k, b, w, aendern }) => {
  const [wahl, setWahl] = useState<Record<string, string>>({});
  const [offen, setOffen] = useState<Record<number, boolean>>({});
  const basis = w.basis!;
  const art = w.art!;
  const liste = useMemo(() => bausteineFuer(k, basis), [k, basis]);
  const gruppen = useMemo(() => [...new Set(liste.map(gruppe))].sort((a, b) => a.localeCompare(b, 'de')), [liste]);
  const alle = b.bausteine ?? [];
  const einheit = art === 'beschwoerbar' ? 'Stufe' : 'P.';
  const beitragText = (v: number | null, kostenText?: string) => (v === null ? (kostenText ?? 'speziell') : v === 0 ? '' : `${v > 0 ? '+' : ''}${v} ${einheit}`);

  /** Baustein hinzufügen: Mehrfachwahl und Voraussetzung sperren (mit Hausregeln nur Warnung) */
  const hinzu = (id: string) => {
    const nachher = wesenBaukastenWerte(k, { ...b, bausteine: [...alle, id] }).hinweise;
    if (aenderungGesperrt(w.hinweise, nachher)) return;
    aendern({ bausteine: [...alle, id] });
  };
  const dienste = b.dienste ?? [];

  return (
    <div className="space-y-4">
      <p className="text-leise">
        {art === 'beschwoerbar' ? 'Stufe des Merkmals Beschwörbares Wesen' : 'Ressource Kreatur'} {w.stufe} = {w.posten.map(p => `${p.text} ${p.wert}`).join(' + ')}
        {w.ohneZahl.length > 0 && <> (ohne Zahl im Paket, nicht eingerechnet: {w.ohneZahl.map(e => e.name).join(', ')})</>}
      </p>

      {gruppen.map(g => {
        const meine = alle.map((id, i) => ({ id, i })).filter(x => { const e = k.get(x.id); return e && gruppe(e) === g; });
        const angebot = liste.filter(e => gruppe(e) === g);
        return (
          <div key={g} className="space-y-2">
            <Titel3>{g}</Titel3>
            {meine.length > 0 && (
              <ul className="space-y-1">
                {meine.map(({ id, i }) => {
                  const e = k.get(id)!; const v = beitrag(e, art);
                  return (
                    <li key={`${id}-${i}`} className="border-l-2 border-rahmen pl-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Knopf className="border-transparent bg-transparent px-1 font-bold" aria-expanded={!!offen[i]} onClick={() => setOffen(o => ({ ...o, [i]: !o[i] }))}>{e.name}</Knopf>
                        {beitragText(v, kostenText(e)) && <Marke klein>{beitragText(v, kostenText(e))}</Marke>}
                        <Knopf nurSymbol className="ml-auto" aria-label={`${e.name} entfernen`} onClick={() => aendern({ bausteine: alle.filter((_, j) => j !== i) })}><X size={16} aria-hidden /></Knopf>
                      </div>
                      {offen[i] && <p className="mt-1">{bausteinText(e)}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 items-end">
              <Auswahl beschriftung={`${g}: Baustein wählen`} beschriftungVerborgen value={wahl[g] ?? ''} onChange={ev => setWahl(x => ({ ...x, [g]: ev.target.value }))}>
                <option value="">Wählen …</option>
                {angebot.map(e => {
                  const n = alle.filter(x => x === e.id).length; const voll = n >= hoechstzahl(e);
                  const vor = bausteinVorab(k, b, e); const vt = voraussetzungText(e);
                  const zusatz = voll ? ' – bereits gewählt' : vor === false && vt ? ` – Voraussetzung: ${vt}` : '';
                  return <option key={e.id} value={e.id}>{e.name}{beitragText(beitrag(e, art), kostenText(e)) ? ` (${beitragText(beitrag(e, art), kostenText(e))})` : ''}{zusatz}</option>;
                })}
              </Auswahl>
              <Knopf disabled={!wahl[g]} onClick={() => { hinzu(wahl[g]); setWahl(x => ({ ...x, [g]: '' })); }}><Plus size={14} aria-hidden />Hinzufügen</Knopf>
            </div>
            {wahl[g] && k.get(wahl[g]) && <p>{bausteinText(k.get(wahl[g])!)}</p>}
          </div>
        );
      })}

      {art === 'beschwoerbar' && (
        <div className="space-y-2">
          <Titel3>Dienste</Titel3>
          <p className="text-leise">
            Anzahl: {w.schritt5?.dienste ?? 'siehe Buch'} (derzeit Stufe {w.stufe}); nur Dienste aus den gewählten Modulen. Einer ist der Basisdienst.
          </p>
          {w.dienste.length === 0 ? <p className="text-leise">Noch keine Module mit Diensten gewählt.</p> : (
            <div className="flex flex-wrap gap-2">
              {w.dienste.map(d => {
                const an = dienste.includes(d.id);
                return (
                  <Knopf key={d.id} art={an ? 'sekundaer' : 'neutral'} aria-pressed={an}
                    onClick={() => aendern({ dienste: an ? dienste.filter(x => x !== d.id) : [...dienste, d.id], ...(an && b.basisdienst === d.id ? { basisdienst: undefined } : {}) })}>
                    {d.name}{b.basisdienst === d.id ? ' (Basisdienst)' : ''}
                  </Knopf>
                );
              })}
            </div>
          )}
          {dienste.length > 0 && (
            <Auswahl beschriftung="Basisdienst" value={b.basisdienst ?? ''} onChange={ev => aendern({ basisdienst: ev.target.value || undefined })}>
              <option value="">wählen …</option>
              {dienste.map(id => <option key={id} value={id}>{k.get(id)?.name ?? id}</option>)}
            </Auswahl>
          )}
        </div>
      )}

      {w.verbesserteAngriffe && <VerbesserteAngriffe k={k} b={b} va={w.verbesserteAngriffe} aendern={aendern} />}

      {(w.wahlen.length > 0 || w.feinschliff.length > 0) && (
        <div className="space-y-2">
          <Titel3>Feinschliff</Titel3>
          {w.schritt5 && <p className="text-leise">Höchste Schwelle {w.schritt5.schwelle ?? '–'}, höchster Zaubergrad {w.schritt5.grad ?? '–'} bei Stufe {w.stufe}.</p>}
          {w.wahlen.length > 0 && <Feinschliff k={k} b={b} wahlen={w.wahlen} fertigkeiten={w.werte?.fertigkeiten ?? []} aendern={aendern} />}
          {w.feinschliff.length > 0 && (
            <>
              <p className="text-leise">Weitere Angaben der Module (Spielleitung):</p>
              <ul className="list-disc pl-6">{w.feinschliff.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </>
          )}
        </div>
      )}

      <Hinweise liste={w.hinweise.map(h => h.text)} />
    </div>
  );
};
