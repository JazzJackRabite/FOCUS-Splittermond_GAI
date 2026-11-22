import React, { useMemo } from 'react';
import { Knopf } from '../../fundament';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useCharacter } from '../../context/CharacterContext';
import { useRegelwerk } from '../../regelwerk/RegelwerkContext';
import { freieErschaffungText, modulAuswahlListe, modulBeschreibungen, moduleDerArt, modulGruppen, modulWerte, pruefeErschaffungImEditor, type ModulGruppe } from '../../regelwerk/erschaffungEditor';
import type { Katalog } from '../../regelwerk/katalog';
import type { ErschaffungsModulWahl, ErschaffungsModulZustand } from '../../types';

type Art = 'kultur' | 'abstammung';
const TITEL: Record<Art, string> = { kultur: 'Kultur (Schritt 3)', abstammung: 'Abstammung (Schritt 4)' };
const ModulAuswahl: React.FC<{ art: Art; k: Katalog }> = ({ art, k }) => {
  const { state, dispatch } = useCharacter();
  const zustand = state.erschaffung?.[art] ?? null;
  const module = useMemo(() => moduleDerArt(k, art), [k, art]);
  const g = zustand?.modul ? modulGruppen(k, zustand.modul) : null;
  const ergebnis = zustand?.modul ? modulWerte(k, zustand.modul, zustand.wahl) : null;
  const eingetragen = !!zustand?.angewendet;
  const setze = (m: ErschaffungsModulZustand | null) => dispatch({ type: 'ERSCHAFFUNG_MODUL_SETZEN', payload: { art, modul: m } });
  const waehle = (teil: Partial<ErschaffungsModulWahl>) => zustand && setze({ ...zustand, wahl: { ...(zustand.wahl ?? {}), ...teil } });

  const eintragen = () => {
    if (!ergebnis || ergebnis.fehlend.length) return;
    const beschreibungen = modulBeschreibungen(k, ergebnis.werte.meisterschaft ?? undefined);
    dispatch({ type: 'ERSCHAFFUNG_MODUL_EINTRAGEN', payload: { art, werte: ergebnis.werte, beschreibungen } });
  };

  const gruppe = (feld: 'fertigkeiten' | 'ressourcen', gr: ModulGruppe) => {
    const opts = modulAuswahlListe(k, gr);
    if (opts.length <= 1 && gr.restVon === undefined) return <li key={`${feld}${gr.index}`}>{gr.text}</li>;
    const wert = zustand?.wahl?.[feld]?.[String(gr.index)] ?? '';
    return (
      <li key={`${feld}${gr.index}`} className="flex flex-wrap items-center gap-2">
        <span>{gr.text}:</span>
        <select value={wert} disabled={eingetragen} aria-label={gr.text}
          onChange={e => waehle({ [feld]: { ...(zustand?.wahl?.[feld] ?? {}), [String(gr.index)]: e.target.value } })}
          className="border border-rahmen rounded-knopf px-1 py-0.5 text-xs bg-flaeche text-schrift">
          <option value="">– wählen –</option>
          {(gr.restVon !== undefined ? (g?.[feld][gr.restVon].optionen.filter(o => o.id).map(o => ({ id: o.id!, text: o.text })) ?? []) : opts).map(o => <option key={o.id} value={o.id}>{o.text}</option>)}
        </select>
      </li>
    );
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs uppercase text-leise font-bold">{TITEL[art]}</label>
      <select value={zustand?.modul ?? ''} disabled={eingetragen} aria-label={TITEL[art]}
        onChange={e => setze(e.target.value ? { modul: e.target.value } : null)}
        className="w-full border border-rahmen rounded-knopf px-2 py-1 text-sm bg-flaeche text-schrift disabled:bg-erhoeht">
        <option value="">Frei verteilen</option>
        {module.map(m => <option key={m.id} value={m.id}>{m.name}{m.quelle.paket !== 'grw' ? ` (${k.pakete[m.quelle.paket]?.kuerzel ?? m.quelle.paket})` : ''}</option>)}
      </select>
      {!zustand?.modul && <p className="text-xs text-leise">{freieErschaffungText(k, art)}</p>}
      {g && (
        <div className="text-xs text-schrift bg-erhoeht border border-dashed border-rahmen rounded-knopf p-2 space-y-1">
          <ul className="list-disc list-inside space-y-0.5">
            {g.fertigkeiten.map(gr => gruppe('fertigkeiten', gr))}
            {g.ressourcen.map(gr => gruppe('ressourcen', gr))}
          </ul>
          {g.staerken.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span>Stärke:</span>
              {g.staerken.length === 1 ? <strong>{g.staerken[0].text}</strong> : (
                <select value={zustand?.wahl?.staerke ?? ''} disabled={eingetragen} aria-label="Stärke des Moduls" onChange={e => waehle({ staerke: e.target.value })}
                  className="border border-rahmen rounded-knopf px-1 py-0.5 text-xs bg-flaeche text-schrift">
                  <option value="">– wählen –</option>
                  {g.staerken.filter(o => o.id).map(o => <option key={o.id} value={o.id}>{o.text}</option>)}
                </select>
              )}
            </div>
          )}
          {g.meisterschaften.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span>Meisterschaft:</span>
              {g.meisterschaften.length === 1 ? <strong>{g.meisterschaften[0].text}</strong> : (
                <select value={zustand?.wahl?.meisterschaft ?? ''} disabled={eingetragen} aria-label="Meisterschaft des Moduls"
                  onChange={e => waehle({ meisterschaft: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="border border-rahmen rounded-knopf px-1 py-0.5 text-xs bg-flaeche text-schrift">
                  <option value="">– wählen –</option>
                  {g.meisterschaften.map((o, i) => <option key={i} value={i}>{o.text}</option>)}
                </select>
              )}
            </div>
          )}
          {g.kulturkunde && <div>Kulturkunde: <strong>{g.kulturkunde}</strong> (kostenlos)</div>}
          <div className="pt-1">
            {eingetragen ? (
              <Knopf onClick={() => dispatch({ type: 'ERSCHAFFUNG_MODUL_AUSTRAGEN', payload: { art } })}
                >Werte wieder austragen</Knopf>
            ) : (
              <Knopf art="sekundaer" disabled={!ergebnis || ergebnis.fehlend.length > 0 || state.mode !== 'creation'} onClick={eintragen}
                className="disabled:cursor-not-allowed"
                title={ergebnis?.fehlend.length ? `Noch wählen: ${ergebnis.fehlend.join(', ')}` : undefined}>
                Modulwerte eintragen
              </Knopf>
            )}
            {!eingetragen && ergebnis && ergebnis.fehlend.length > 0 && <span className="ml-2 text-erschoepft">Noch wählen: {ergebnis.fehlend.join(', ')}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

/** Kultur- und Abstammungsmodule wählen und die Erschaffung nach GRW S. 22–30 prüfen. Nur mit geladenen Regelpaketen. */
export const ErschaffungRegelwerk: React.FC = () => {
  const { katalog } = useRegelwerk();
  const { state } = useCharacter();
  const pruefung = useMemo(() => (katalog ? pruefeErschaffungImEditor(state, katalog) : null), [state, katalog]);
  if (!katalog || state.mode !== 'creation') return null;
  const fehler = pruefung?.befunde.filter(b => b[0] === 'fehler') ?? [];
  const sl = pruefung?.befunde.filter(b => b[0] === 'spielleiter') ?? [];
  return (
    <div className="bg-flaeche p-5 rounded-karte border border-rahmen relative" data-testid="erschaffung-regelwerk">
      <h3 className="font-bold text-[17px] mb-4 border-b border-gold pb-2 fantasy-font text-gold-hell">Kultur & Abstammung</h3>
      <div className="space-y-4">
        <ModulAuswahl art="kultur" k={katalog} />
        <ModulAuswahl art="abstammung" k={katalog} />
        <p className="text-xs text-leise">
          Ausbildung (Schritt 5) und Schritt 7 verteilst du wie bisher frei; die Prüfung ordnet die übrigen Punkte den Schritten zu.
        </p>
      </div>
      <div className="mt-4 border-t border-rahmen pt-3" aria-live="polite">
        <h4 className="font-bold text-sm text-gold-hell mb-2">Regelprüfung der Erschaffung (GRW S. 22–30)</h4>
        {pruefung && fehler.length === 0 && sl.length === 0 && (
          <p className="text-sm text-unverletzt flex items-center gap-2"><CheckCircle2 size={16} /> Alle Schritte stimmen.</p>
        )}
        <ul className="space-y-1 text-xs">
          {fehler.map(([, t]) => <li key={t} className="flex gap-1.5 text-schaden"><XCircle size={14} className="shrink-0 mt-0.5" />{t}</li>)}
          {sl.map(([, t]) => <li key={t} className="flex gap-1.5 text-erschoepft"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{t}</li>)}
          {(pruefung?.hinweise ?? []).map(t => <li key={t} className="flex gap-1.5 text-leise"><Info size={14} className="shrink-0 mt-0.5" />{t}</li>)}
        </ul>
      </div>
    </div>
  );
};
