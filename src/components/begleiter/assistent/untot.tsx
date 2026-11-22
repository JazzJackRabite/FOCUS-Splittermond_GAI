/** Assistent: erhobener Untoter (Die Magie S. 182–184): Zauber und Wertesatz, Verstärkungen, Abnormität, Steigerung */
import React, { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  ANGRIFF, abnormitaeten, attributKosten, erhebungen, fertigkeitKosten, meisterschaftenBis, steigerbareFertigkeiten, untoteRegelQuelle, untotWerte,
} from '../../../regelwerk/untote';
import { ATTRIBUT_KURZ } from '../../../regelwerk/modifikationen';
import type { Katalog } from '../../../regelwerk/katalog';
import { Auswahl, Eingabe, Knopf, Marke } from '../../../fundament';
import { MarkeMitEntfernen } from '../Wertekasten';
import { Erklaerung, Titel3, UEBERSICHT } from './teile';
import type { Schritt, SchrittProps } from './typen';

const Stufer: React.FC<{ label: string; wert: number; setzen: (n: number) => void; kosten: string }> = ({ label, wert, setzen, kosten }) => (
  <div className="flex items-center gap-2">
    <span className="min-w-[8rem] text-sm">{label}</span>
    <Knopf nurSymbol aria-label={`${label} senken`} disabled={wert <= 0} onClick={() => setzen(wert - 1)}><Minus size={16} aria-hidden /></Knopf>
    <span className="w-8 text-center font-titel text-base">+{wert}</span>
    <Knopf nurSymbol aria-label={`${label} steigern`} onClick={() => setzen(wert + 1)}><Plus size={16} aria-hidden /></Knopf>
    <span className="text-leise text-xs">{kosten}</span>
  </div>
);

const EP: React.FC<SchrittProps> = ({ k, b, besitzer }) => {
  const u = untotWerte(k, b, besitzer);
  return <Marke ton={u.epVerbraucht > u.epGesamt ? 'schaden' : 'neutral'}>EP {u.epVerbraucht}/{u.epGesamt}</Marke>;
};

const Erhebung: React.FC<SchrittProps> = ({ k, b, aendern, besitzer }) => {
  const liste = useMemo(() => erhebungen(k), [k]);
  const gew = liste.find(x => x.zauber.id === b.erhebung);
  return (
    <div className="space-y-4">
      <Erklaerung>
        Der Erhebungszauber bestimmt den Wertesatz; gesteigert wird mit den Erfahrungspunkten aus seiner Verstärkung (Die Magie S. 182–184).
        {!liste.some(x => x.zauber.quelle.paket === 'magie') && ' Weitere Zauber und Abnormitäten im Grimoire „Die Magie“.'}
      </Erklaerung>
      <div className="grid sm:grid-cols-2 gap-3">
        <Auswahl beschriftung="Erhebungszauber" value={b.erhebung ?? ''} onChange={e => aendern({ erhebung: e.target.value || undefined, id: '', name: '' })}>
          <option value="">Erhebungszauber wählen …</option>
          {liste.map(x => <option key={x.zauber.id} value={x.zauber.id}>{x.zauber.name} (Tod {x.grad}){besitzer.zauber.includes(x.zauber.name) ? ' – bekannt' : ''}</option>)}
        </Auswahl>
        <Auswahl beschriftung="Wertesatz" value={gew?.wertesaetze.find(w => (w.id ?? `untoter:${w.name}`) === b.id)?.name ?? ''} disabled={!gew}
          onChange={e => { const w = gew?.wertesaetze.find(x => x.name === e.target.value); aendern(w ? { id: w.id ?? `untoter:${w.name}`, name: w.name } : { id: '', name: '' }); }}>
          <option value="">Wertesatz wählen …</option>
          {(gew?.wertesaetze ?? []).map(w => <option key={w.name} value={w.name}>{w.name}{w.id ? '' : ` (Werte: ${w.quelle})`}</option>)}
        </Auswahl>
      </div>
    </div>
  );
};

const Grundangaben: React.FC<SchrittProps> = (p) => {
  const { k, b, aendern, besitzer } = p;
  const u = untotWerte(k, b, besitzer);
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Eingabe beschriftung="Rufname" value={b.rufname ?? ''} onChange={ev => aendern({ rufname: ev.target.value || undefined })} placeholder={b.name} />
        <Eingabe beschriftung="Anzahl Verstärkungen" type="number" min={0} max={besitzer.nekromant ? 20 : 1} value={b.verstaerkungen ?? 0}
          onChange={ev => aendern({ verstaerkungen: Math.max(0, Number(ev.target.value) || 0) || undefined })} />
        <Auswahl beschriftung="Abnormität" value={b.abnormitaet ?? ''} onChange={ev => aendern({ abnormitaet: ev.target.value || undefined })}>
          <option value="">keine</option>
          {abnormitaeten(k).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Auswahl>
      </div>
      <div className="flex items-center gap-2 flex-wrap"><EP {...p} /></div>
      <Erklaerung>
        {u.erhebung ? <>{u.erhebung.zauber.name} (Grad {u.erhebung.grad}): je Verstärkung {u.erhebung.epJeVerstaerkung} EP{besitzer.nekromant ? `, beliebig oft (${besitzer.mehrfachMit})` : `, einmal (mehrfach mit ${besitzer.mehrfachMit})`}. </> : null}
        Neue Punkte je Fertigkeit höchstens {u.grenze}{untoteRegelQuelle(k) ? ` (${untoteRegelQuelle(k)})` : ''}.
      </Erklaerung>
      {u.abnormitaet && <p className="text-sm m-0"><span className="text-leise">{u.abnormitaet.name}:</span> {u.abnormitaetText}</p>}
    </div>
  );
};

const Steigerung: React.FC<SchrittProps> = (p) => {
  const { k, b, aendern, besitzer } = p;
  const [fWahl, setFWahl] = useState('');
  const u = untotWerte(k, b, besitzer);
  const st = b.steigerung ?? {};
  const setzeA = (a: string, v: number) => aendern({ steigerung: { ...st, attribute: { ...(st.attribute ?? {}), [a]: Math.max(0, v) } } });
  const setzeF = (f: string, v: number) => aendern({ steigerung: { ...st, fertigkeiten: { ...(st.fertigkeiten ?? {}), [f]: Math.max(0, v) } } });
  const vorhanden = new Set([...(u.werte?.fertigkeiten ?? []).map(f => f.id), ...Object.keys(st.fertigkeiten ?? {})]);
  const steigerbar = useMemo(() => steigerbareFertigkeiten(k), [k]);
  const fertigkeitsListe = [ANGRIFF, ...[...vorhanden].filter((x): x is string => !!x && x !== ANGRIFF)];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap"><EP {...p} /><span className="text-sm text-leise">Gesteigert wird „von 0 an“.</span></div>
      <Titel3>Attribute</Titel3>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {ATTRIBUT_KURZ.map(a => <Stufer key={a} label={a} wert={st.attribute?.[a] ?? 0} setzen={v => setzeA(a, v)} kosten={`${attributKosten(k, st.attribute?.[a] ?? 0)} EP`} />)}
      </div>
      <Titel3>Fertigkeiten</Titel3>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {fertigkeitsListe.map(f => (
          <Stufer key={f} label={f === ANGRIFF ? 'Angriff (Waffen)' : k.get(f)?.name ?? f} wert={st.fertigkeiten?.[f] ?? 0} setzen={v => setzeF(f, v)}
            kosten={`${fertigkeitKosten(k, st.fertigkeiten?.[f] ?? 0)} EP`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <Auswahl beschriftung="Neue Fertigkeit für Untoten" value={fWahl} onChange={ev => setFWahl(ev.target.value)}>
          <option value="">weitere Fertigkeit …</option>
          {steigerbar.filter(e => !vorhanden.has(e.id)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Auswahl>
        <Knopf disabled={!fWahl} onClick={() => { setzeF(fWahl, 1); setFWahl(''); }}><Plus size={14} aria-hidden />Steigern</Knopf>
      </div>
      <Erklaerung>Kosten nach den Steigerungsregeln für Abenteurer. Keine Magieschulen; Wissensfertigkeiten können nicht gesteigert werden.</Erklaerung>
    </div>
  );
};

const Meisterschaften: React.FC<SchrittProps> = ({ k, b, aendern, besitzer }) => {
  const [mWahl, setMWahl] = useState('');
  const u = untotWerte(k, b, besitzer);
  const ms = b.meisterschaften ?? [];
  const plaetzeFrei = u.freieMeisterschaften.length - u.meisterschaften.filter(m => m.ok).length;
  const angebot = useMemo(() => {
    const hoechste = new Map<string, { name: string; schwelle: number }>();
    for (const p of u.freieMeisterschaften) if ((hoechste.get(p.fertigkeitId)?.schwelle ?? 0) < p.schwelle) hoechste.set(p.fertigkeitId, { name: p.fertigkeit, schwelle: p.schwelle });
    return [...hoechste.entries()].map(([id, x]) => ({ fertigkeit: x.name, liste: meisterschaftenBis(k, id, x.schwelle) }));
  }, [k, u.freieMeisterschaften]);
  return (
    <div className="space-y-4">
      <Erklaerung>
        Freie Meisterschaften ab genug gesteigerten Fertigkeitspunkten. Plätze: {u.freieMeisterschaften.map(p => `${p.fertigkeit} (Schwelle ${p.schwelle})`).join(', ') || 'noch keine'}; frei {Math.max(0, plaetzeFrei)}.
      </Erklaerung>
      {u.meisterschaften.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {u.meisterschaften.map((m, i) => (
            <MarkeMitEntfernen key={`${m.id}-${i}`} ton={m.ok ? 'neutral' : 'erschoepft'} label={`Meisterschaft ${m.name} entfernen`} onEntfernen={() => aendern({ meisterschaften: ms.filter((_, j) => j !== i) })}>
              {m.name} ({m.fertigkeit}, S{m.schwelle}){m.ok ? '' : ' – ohne Platz'}
            </MarkeMitEntfernen>
          ))}
        </div>
      )}
      {plaetzeFrei > 0 && (
        <div className="flex flex-wrap gap-2 items-end">
          <Auswahl beschriftung="Freie Meisterschaft wählen" value={mWahl} onChange={ev => setMWahl(ev.target.value)}>
            <option value="">Meisterschaft wählen …</option>
            {angebot.map(g => (
              <optgroup key={g.fertigkeit} label={g.fertigkeit}>
                {g.liste.map(m => <option key={m.id} value={m.id} disabled={ms.includes(m.id)}>{m.name} (S{m.schwelle})</option>)}
              </optgroup>
            ))}
          </Auswahl>
          <Knopf art="sekundaer" disabled={!mWahl} onClick={() => { aendern({ meisterschaften: [...ms, mWahl] }); setMWahl(''); }}><Plus size={14} aria-hidden />Meisterschaft</Knopf>
        </div>
      )}
    </div>
  );
};

export function untotSchritte(_k: Katalog): Schritt[] {
  return [
    { id: 'erhebung', titel: 'Zauber und Wertesatz', inhalt: Erhebung, nurNeu: true, bereit: x => !!x.id && !!x.erhebung },
    { id: 'grund', titel: 'Verstärkung und Abnormität', inhalt: Grundangaben },
    { id: 'steigerung', titel: 'Steigerung', inhalt: Steigerung },
    { id: 'meisterschaften', titel: 'Freie Meisterschaften', inhalt: Meisterschaften },
    UEBERSICHT,
  ];
}
