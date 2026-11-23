/** Assistent: beschworenes Wesen (Die Magie S. 186–191) oder eigenes Wesen aus dem Baukasten */
import React, { useMemo, useState } from 'react';
import { BookOpen, Hammer } from 'lucide-react';
import { useCharacter } from '../../../context/CharacterContext';
import { beschwoerbareWesen, diensteFuer, gesperrteDiensteFuer } from '../../../regelwerk/begleiter';
import { baukastenArt, basen, wesenBaukastenWerte } from '../../../regelwerk/wesenBaukasten';
import type { Katalog } from '../../../regelwerk/katalog';
import { Auswahl, Eingabe } from '../../../fundament';
import { WesenBaukasten } from '../WesenBaukasten';
import { Erklaerung, Titel3, UEBERSICHT, Wahlkarte } from './teile';
import type { Schritt, SchrittProps } from './typen';

const Herkunft: React.FC<SchrittProps> = ({ k, b, aendern }) => {
  const wesen = useMemo(() => beschwoerbareWesen(k), [k]);
  const korpusse = useMemo(() => basen(k, 'beschwoerbar'), [k]);
  const [weg, setWeg] = useState<'katalog' | 'bauen'>(b.bausteine ? 'bauen' : 'katalog');
  const waehle = (id: string, bauen: boolean) => {
    const e = k.get(id);
    aendern(e ? { id: e.id, name: bauen ? `Eigenes Wesen (${e.name})` : e.name, bausteine: bauen ? [] : undefined, dienste: undefined, basisdienst: undefined }
      : { id: '', name: '', bausteine: undefined });
  };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Wahlkarte gewaehlt={weg === 'katalog'} onClick={() => { setWeg('katalog'); if (b.bausteine) waehle('', false); }} symbol={<BookOpen size={20} />}
          disabled={!wesen.length} titel="Wesen aus dem Katalog" text="Ein beschwörbares Wesen mit Stufe und Diensten." />
        <Wahlkarte gewaehlt={weg === 'bauen'} onClick={() => { setWeg('bauen'); if (!b.bausteine) waehle('', true); }} symbol={<Hammer size={20} />}
          disabled={!korpusse.length} titel="Eigenes Wesen bauen" text="Aus einem Korpus, Modulen und Rollen (Die Magie)." />
      </div>
      {weg === 'katalog' ? (
        <Auswahl beschriftung="Beschworenes Wesen wählen" value={b.bausteine ? '' : b.id} onChange={e => waehle(e.target.value, false)}>
          <option value="">Beschworenes Wesen wählen …</option>
          {wesen.map(x => <option key={x.id} value={x.id}>{x.name} (Stufe {x.stufe}, {x.quelle})</option>)}
        </Auswahl>
      ) : (
        <Auswahl beschriftung="Korpus des Wesens" value={b.bausteine ? b.id : ''} onChange={e => waehle(e.target.value, true)}>
          <option value="">Korpus wählen …</option>
          {korpusse.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Auswahl>
      )}
    </div>
  );
};

const Dienste: React.FC<{ k: Katalog; wesen: string }> = ({ k, wesen }) => {
  const { state } = useCharacter();
  const liste = useMemo(() => diensteFuer(k, wesen, state.masteries), [k, wesen, state.masteries]);
  const gesperrt = useMemo(() => gesperrteDiensteFuer(k, wesen, state.masteries), [k, wesen, state.masteries]);
  if (!liste.length) return <Erklaerung>Keine Dienste verfügbar (Grimoire „Die Magie“ geladen?).</Erklaerung>;
  const art = { basis: 'Basisdienst', immer: 'immer verfügbar', erweitert: 'Erweiterter Dienst' } as const;
  const name = (id: string) => k.get(id)?.name ?? id;
  const oder = (ids: string[]) => ids.map(name).join(' oder ');
  return (
    <div className="space-y-2">
      <ul className="space-y-1 text-sm">
        {liste.map(d => <li key={d.id}><strong>{name(d.id)}</strong> <span className="text-leise">– {art[d.art]}, {d.kosten}</span></li>)}
      </ul>
      {gesperrt.length > 0 && (
        <div data-testid="dienste-gesperrt">
          <p className="text-xs text-leise m-0">Erweiterte Dienste, noch nicht verfügbar:</p>
          <ul className="space-y-1 text-sm">
            {gesperrt.map(d => (
              <li key={d.id}><strong>{name(d.id)}</strong> <span className="text-leise">– {[
                d.fehlt.length ? `braucht ${oder(d.fehlt)}` : '',
                d.stufe ? `Wesen Stufe ${d.stufe.wesen}, erlaubt bis ${d.stufe.grenze}${d.stufe.anheben.length ? `; höher mit ${d.stufe.anheben.map(a => `${name(a.id)} (bis ${a.bis})`).join(' oder ')}` : ''}` : '',
              ].filter(Boolean).join('; ')}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Grundangaben: React.FC<SchrittProps> = ({ k, b, aendern }) => {
  const e = k.get(b.id);
  return (
    <div className="space-y-4">
      <Eingabe beschriftung="Rufname" value={b.rufname ?? ''} onChange={ev => aendern({ rufname: ev.target.value || undefined })} placeholder={b.name} />
      {e && !baukastenArt(e) && <div className="space-y-2"><Titel3>Dienste</Titel3><Dienste k={k} wesen={b.id} /></div>}
    </div>
  );
};

const Baukasten: React.FC<SchrittProps> = ({ k, b, aendern }) => <WesenBaukasten k={k} b={b} w={wesenBaukastenWerte(k, b)} aendern={aendern} />;

export function wesenSchritte(k: Katalog, b: { id: string; bausteine?: string[] }): Schritt[] {
  const e = b.id ? k.get(b.id) : undefined;
  const gebaut = !!b.bausteine || !!(e && baukastenArt(e));
  return [
    { id: 'herkunft', titel: 'Wesen wählen', inhalt: Herkunft, nurNeu: true, bereit: x => !!x.id },
    { id: 'grund', titel: gebaut ? 'Name' : 'Name und Dienste', inhalt: Grundangaben },
    ...(gebaut ? [{ id: 'baukasten', titel: 'Module, Rollen und Dienste', inhalt: Baukasten }] : []),
    UEBERSICHT,
  ];
}
