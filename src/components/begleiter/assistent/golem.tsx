/** Assistent: Golem nach dem Baukasten aus „Die Magie“ (S. 197–207), Schritt für Schritt wie im Buch */
import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  immerInstruktionen, bausteinInfo, bausteine, golemWerte, hoechstens, korpusGK, korpusStufe, korpusse, materialInfo, materialien, sonderausstattungen, voraussetzung,
} from '../../../regelwerk/golem';
import type { Katalog } from '../../../regelwerk/katalog';
import type { Begleiter } from '../../../types';
import { Auswahl, Eingabe, Knopf, Marke } from '../../../fundament';
import { Feinschliff } from '../Feinschliff';
import { Erklaerung, Titel3, UEBERSICHT } from './teile';
import { golemRessourcenBelegung } from '../besitzer';
import type { Schritt, SchrittProps } from './typen';

const ART_TEXT: Record<string, string> = {
  'Zusätzliche Fähigkeit': 'Zusätzliche Fähigkeiten', Rolle: 'Rollen', Applikation: 'Applikationen',
  Schwachpunkt: 'Schwachpunkte', Instruktion: 'Instruktionen', 'Verfügung': 'Verfügungen',
};

/** Stufe des Golems und Kaufpreis, in jedem Schritt oben */
const Stand: React.FC<SchrittProps> = ({ k, b }) => {
  const g = golemWerte(k, b);
  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="golem-stand">
      <Marke ton="gold">Golem {g.stufe}</Marke>
      <span className="text-sm text-leise">= {g.stufePosten.map(p => `${p.text} ${p.wert}`).join(' + ')}</span>
      {!b.golemRessource && <Marke>{g.preis} L</Marke>}
    </div>
  );
};

const BausteinGruppe: React.FC<{ k: Katalog; art: string; b: Begleiter; aendern: (a: Partial<Begleiter>) => void; info?: React.ReactNode }> = ({ k, art, b, aendern, info }) => {
  const [wahl, setWahl] = useState('');
  const [offen, setOffen] = useState<Record<number, boolean>>({});
  const liste = useMemo(() => bausteine(k, art), [k, art]);
  const alle = b.bausteine ?? [];
  const meine = alle.map((id, i) => ({ id, i })).filter(x => bausteinInfo(k.get(x.id)).art === art);
  const namen = new Set(alle.map(i => k.get(i)?.name));
  return (
    <div className="space-y-2">
      <Titel3>{ART_TEXT[art] ?? art}</Titel3>
      {info && <Erklaerung>{info}</Erklaerung>}
      {art === 'Instruktion' && <Erklaerung>Immer: {immerInstruktionen(k).join(', ')}.</Erklaerung>}
      {meine.length > 0 && (
        <ul className="space-y-1">
          {meine.map(({ id, i }) => {
            const e = k.get(id)!; const bi = bausteinInfo(e);
            return (
              <li key={`${id}-${i}`} className="border-l-2 border-rahmen pl-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Knopf className="border-transparent! bg-transparent! hover:bg-erhoeht! px-1 font-bold" aria-expanded={!!offen[i]} onClick={() => setOffen(o => ({ ...o, [i]: !o[i] }))}>{e.name}</Knopf>
                  {bi.zuschlag && <Marke klein>Golem {bi.zuschlag}</Marke>}
                  <Knopf nurSymbol className="ml-auto" aria-label={`${e.name} entfernen`} onClick={() => aendern({ bausteine: alle.filter((_, j) => j !== i) })}><X size={16} aria-hidden /></Knopf>
                </div>
                {offen[i] && <p className="mt-1 text-sm">{bi.beschreibung}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 items-end">
        <Auswahl beschriftung={`${art} wählen`} value={wahl} onChange={ev => setWahl(ev.target.value)}>
          <option value="">{art} wählen …</option>
          {liste.filter(e => !(art === 'Instruktion' && immerInstruktionen(k).includes(e.name))).map(e => {
            const n = alle.filter(x => x === e.id).length; const voll = n >= hoechstens(k, e);
            const v = voraussetzung(e); const fehlt = v && !namen.has(v); const z = bausteinInfo(e).zuschlag;
            return <option key={e.id} value={e.id} disabled={voll}>{e.name}{z ? ` (Golem ${z})` : ''}{voll ? ' – bereits gewählt' : fehlt ? ` – setzt ${v} voraus` : ''}</option>;
          })}
        </Auswahl>
        <Knopf disabled={!wahl} onClick={() => { aendern({ bausteine: [...alle, wahl] }); setWahl(''); }}><Plus size={14} aria-hidden />{ART_TEXT[art] ? `${art} hinzufügen` : 'Hinzufügen'}</Knopf>
      </div>
      {wahl && <p className="text-sm m-0">{bausteinInfo(k.get(wahl)).beschreibung}</p>}
    </div>
  );
};

const Korpus: React.FC<SchrittProps> = ({ k, b, aendern, besitzer }) => {
  const liste = useMemo(() => korpusse(k), [k]);
  return (
    <div className="space-y-4">
      <Erklaerung>
        Baukasten aus dem Grimoire „Die Magie“ (S. 205–207): Korpus, Material, Zusätzliche Fähigkeiten, Rollen, Feinschliff.
        {besitzer.golemPunkte.length > 0 && <> Ressource Golem: {besitzer.golemPunkte.join(', ')}.</>}
      </Erklaerung>
      <Auswahl beschriftung="Korpus (Schritt 1)" value={b.id} onChange={e => { const x = k.get(e.target.value); aendern({ id: x?.id ?? '', name: x?.name ?? '', bausteine: undefined, sonderausstattung: undefined, feinschliff: undefined }); }}>
        <option value="">Korpus wählen …</option>
        {liste.map(e => <option key={e.id} value={e.id}>{e.name} (Golem {korpusStufe(e)}, GK {korpusGK(e)})</option>)}
      </Auswahl>
    </div>
  );
};

const Grundangaben: React.FC<SchrittProps> = (p) => {
  const { k, b, aendern, besitzer, alle, index } = p;
  const g = golemWerte(k, b);
  // Belegung, wenn dieser Golem über die Ressource läuft (so wie er jetzt ist)
  const belegung = golemRessourcenBelegung(k, besitzer, alle, { ...b, golemRessource: true }, index).find(x => x.eigener);
  const kennt = g.animierung ? besitzer.zauber.includes(g.animierung.name) : false;
  return (
    <div className="space-y-4">
      <Stand {...p} />
      <div className="grid sm:grid-cols-2 gap-3">
        <Eingabe beschriftung="Rufname" value={b.rufname ?? ''} onChange={ev => aendern({ rufname: ev.target.value || undefined })} placeholder="Name" />
        <Auswahl beschriftung="Golemmaterial (Schritt 2)" value={b.material ?? ''} onChange={ev => aendern({ material: ev.target.value || undefined })}>
          <option value="">Material wählen …</option>
          {materialien(k).map(m => <option key={m.id} value={m.id}>{m.name} ({materialInfo(m)})</option>)}
        </Auswahl>
      </div>
      <label className="flex items-center gap-2 min-h-11" title="Ressource Golem">
        <input type="checkbox" className="w-5 h-5 accent-gold" checked={!!b.golemRessource} onChange={ev => aendern({ golemRessource: ev.target.checked || undefined })} />
        über Ressource Golem
      </label>
      <p className="text-xs text-leise m-0" data-testid="golem-ressource">
        {!besitzer.golemPunkte.length ? 'Der Charakter hat keine Ressource Golem.'
          : belegung?.ressource != null && belegung.ressource >= g.stufe
            ? `${b.golemRessource ? 'Belegt' : 'Frei wäre'}: Ressource Golem ${belegung.ressource} für diesen Golem der Stufe ${g.stufe}.`
            : `Keine freie Ressource Golem für Stufe ${g.stufe} (vorhanden: ${besitzer.golemPunkte.join(', ')}; jeder Golem belegt eine eigene).`}
        {' '}Auslegung: Stufe des Golems höchstens so hoch wie die Ressource (Die Magie S. 203).
      </p>
      <Erklaerung>
        {g.animierung ? <>Animierungszauber: <strong className="text-schrift">{g.animierung.name}</strong>{kennt ? ' (bekannt)' : ''}. </> : 'Kein Animierungszauber für diese Stufe. '}
        Konstruktion: Schwierigkeit {g.konstruktion.schwierigkeit}, {g.konstruktion.fortschritt} Fortschrittspunkte
        {besitzer.konstrukteur ? '' : ' (die nötige Meisterschaft fehlt)'}.
        {g.materialSchwachpunkt && <> Schwachpunkt des Materials: {g.materialSchwachpunkt}.</>}
      </Erklaerung>
    </div>
  );
};

const FaehigkeitenRollen: React.FC<SchrittProps> = (p) => (
  <div className="space-y-5">
    <Stand {...p} />
    <BausteinGruppe k={p.k} art="Zusätzliche Fähigkeit" b={p.b} aendern={p.aendern} info="Schritt 3: Jede Fähigkeit erhöht die Stufe des Golems." />
    <BausteinGruppe k={p.k} art="Rolle" b={p.b} aendern={p.aendern} info="Schritt 4: Voraussetzungen der Rollen prüft der Editor." />
  </div>
);

const Applikationen: React.FC<SchrittProps> = (p) => {
  const g = golemWerte(p.k, p.b);
  return (
    <div className="space-y-5">
      <Stand {...p} />
      <BausteinGruppe k={p.k} art="Applikation" b={p.b} aendern={p.aendern}
        info={<>Gewählt {g.gewaehlt.Applikation.length}, frei {g.applikationenFrei}{g.applikationenExtra ? `; zusätzlich ${g.applikationenExtra}, dafür ${g.schwachpunkteNoetig} Schwachpunkt(e) und eine schwerere Konstruktion` : ''}.</>} />
      <BausteinGruppe k={p.k} art="Schwachpunkt" b={p.b} aendern={p.aendern} info={<>Nötig: {g.schwachpunkteNoetig} zusätzlich zum Material.</>} />
    </div>
  );
};

const Unterweisung: React.FC<SchrittProps> = (p) => {
  const g = golemWerte(p.k, p.b);
  return (
    <div className="space-y-5">
      <BausteinGruppe k={p.k} art="Instruktion" b={p.b} aendern={p.aendern} info={<>Implementierbar: {g.instruktionenErlaubt}.</>} />
      <BausteinGruppe k={p.k} art="Verfügung" b={p.b} aendern={p.aendern}
        info={g.verfuegungenAktiv !== null ? <>Aktiv höchstens {g.verfuegungenAktiv}.</> : 'Ohne Ressource Golem: Regel im Grimoire.'} />
    </div>
  );
};

const FeinschliffSchritt: React.FC<SchrittProps> = (p) => {
  const { k, b, aendern } = p;
  const g = golemWerte(k, b);
  const sa = sonderausstattungen(k);
  return (
    <div className="space-y-5">
      <Stand {...p} />
      {g.sonderausstattungPlaetze > 0 && (
        <div className="space-y-2">
          <Titel3>Sonderausstattung (eine je zwei Stufen)</Titel3>
          <div className="grid sm:grid-cols-2 gap-3">
            {Array.from({ length: g.sonderausstattungPlaetze }, (_, i) => (
              <Auswahl key={i} beschriftung={`Sonderausstattung ${i + 1}`} value={b.sonderausstattung?.[i] ?? ''}
                onChange={ev => { const l = [...(b.sonderausstattung ?? [])]; l[i] = ev.target.value; aendern({ sonderausstattung: l }); }}>
                <option value="">wählen …</option>
                {sa.map(z => <optgroup key={z.material} label={z.material}>{z.optionen.map(o => <option key={o} value={o}>{o}</option>)}</optgroup>)}
              </Auswahl>
            ))}
          </div>
        </div>
      )}
      {g.wahlen.length > 0 && (
        <div className="space-y-2"><Titel3>Feinschliff (Schritt 5)</Titel3><Feinschliff k={k} b={b} wahlen={g.wahlen} fertigkeiten={g.werte?.fertigkeiten ?? []} aendern={aendern} /></div>
      )}
      {g.feinschliff.length > 0 && (
        <div className="text-sm"><span className="text-leise">Für die Spielleitung:</span><ul className="list-disc pl-6">{g.feinschliff.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      )}
      {g.sonderausstattungPlaetze === 0 && g.wahlen.length === 0 && g.feinschliff.length === 0 && (
        <Erklaerung>Für diese Stufe gibt es keine Sonderausstattung und nichts zu wählen.</Erklaerung>
      )}
    </div>
  );
};

export function golemSchritte(_k: Katalog): Schritt[] {
  return [
    { id: 'korpus', titel: 'Korpus', inhalt: Korpus, nurNeu: true, bereit: x => !!x.id },
    { id: 'grund', titel: 'Material und Animierung', inhalt: Grundangaben },
    { id: 'faehigkeiten', titel: 'Fähigkeiten und Rollen', inhalt: FaehigkeitenRollen },
    { id: 'applikationen', titel: 'Applikationen und Schwachpunkte', inhalt: Applikationen },
    { id: 'unterweisung', titel: 'Instruktionen und Verfügungen', inhalt: Unterweisung },
    { id: 'feinschliff', titel: 'Sonderausstattung und Feinschliff', inhalt: FeinschliffSchritt },
    UEBERSICHT,
  ];
}
