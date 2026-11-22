/** Assistent: Tier (Tiergefährte, Reittier, Vertrauter, eigene Kreatur); Abrichtungen und Potenzial aus „Bestienmeister“ */
import React, { useMemo, useState } from 'react';
import { BookOpen, Hammer, Plus, X } from 'lucide-react';
import { regelverstoss } from '../../../fundament/hausregeln';
import {
  abrichtungen as alleAbrichtungen, alleTiere, kreaturStufe, potenzial, potenzialVerbraucht, pruefeAbrichtung, tierTraeger, tierQualitaeten,
} from '../../../regelwerk/begleiter';
import { baukastenArt, basen, wesenBaukastenWerte } from '../../../regelwerk/wesenBaukasten';
import { abrichtungWerteText, allgemeineFertigkeitenListe, istMagieschule, tierGrundwerte, tierWerte, type OffeneWahl } from '../../../regelwerk/abrichtungsWerte';
import { golemMeisterschaften } from '../../../regelwerk/golem';
import type { Begleiter } from '../../../types';
import type { Katalog } from '../../../regelwerk/katalog';
import type { Ergebnis } from '../../../regelwerk/typen';
import { Auswahl, Eingabe, Knopf, Marke } from '../../../fundament';
import { Hinweise, MarkeMitEntfernen } from '../Wertekasten';
import { WesenBaukasten } from '../WesenBaukasten';
import { freieKreatur } from '../besitzer';
import { Erklaerung, UEBERSICHT, Wahlkarte } from './teile';
import type { Schritt, SchrittProps } from './typen';

const Herkunft: React.FC<SchrittProps> = ({ k, b, aendern, besitzer, alle, index }) => {
  const tiere = useMemo(() => alleTiere(k), [k]);
  const basisListe = useMemo(() => basen(k, 'kreatur'), [k]);
  const [weg, setWeg] = useState<'katalog' | 'bauen'>(b.bausteine ? 'bauen' : 'katalog');
  const waehle = (id: string, bauen: boolean) => {
    const e = k.get(id);
    if (!e) { aendern({ id: '', name: '', kreatur: undefined, bausteine: undefined }); return; }
    const frei = freieKreatur(besitzer, alle, kreaturStufe(e), index);
    aendern({ id: e.id, name: bauen ? `Eigene Kreatur (${e.name})` : e.name, kreatur: frei, bausteine: bauen ? [] : undefined, abrichtungen: undefined });
  };
  return (
    <div className="space-y-4">
      <Erklaerung>
        Ressource Kreatur: {besitzer.kreatur.length ? besitzer.kreatur.join(', ') : 'keine'} – ein Tiergefährte je Ressource, höchstens mit „Kreatur N“ (GRW S. 78).
        Reittiere und gekaufte Tiere brauchen keine Ressource.
      </Erklaerung>
      <div className="grid sm:grid-cols-2 gap-3">
        <Wahlkarte gewaehlt={weg === 'katalog'} onClick={() => { setWeg('katalog'); if (b.bausteine) waehle('', false); }} symbol={<BookOpen size={20} />}
          titel="Tier aus dem Katalog" text="Ein Tier mit seinen Werten aus dem Grundregelwerk oder einem Grimoire." />
        <Wahlkarte gewaehlt={weg === 'bauen'} onClick={() => { setWeg('bauen'); if (!b.bausteine) waehle('', true); }} symbol={<Hammer size={20} />}
          disabled={!basisListe.length} hinweis={basisListe.length ? undefined : 'Der Kreatur-Baukasten steht im Grimoire „Bestienmeister“.'}
          titel="Eigene Kreatur bauen" text="Aus einer Basis und Modulen (Bestienmeister)." />
      </div>
      {weg === 'katalog' ? (
        <Auswahl beschriftung="Tier wählen" value={b.bausteine ? '' : b.id} onChange={e => waehle(e.target.value, false)}>
          <option value="">Tier wählen …</option>
          {tiere.map(t => (
            <option key={t.id} value={t.id}>
              {t.name} ({[t.stufe ? `Kreatur ${t.stufe}` : null, t.typus.includes('Reittier') ? 'Reittier' : null, t.quelle !== 'GRW' ? t.quelle : null].filter(Boolean).join(', ') || 'Tier'})
            </option>
          ))}
        </Auswahl>
      ) : (
        <Auswahl beschriftung="Basis der Kreatur" value={b.bausteine ? b.id : ''} onChange={e => waehle(e.target.value, true)}>
          <option value="">Basis wählen …</option>
          {basisListe.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Auswahl>
      )}
    </div>
  );
};

const Grundangaben: React.FC<SchrittProps> = ({ k, b, aendern, besitzer }) => (
  <div className="space-y-4">
    {!alleAbrichtungen(k).length && <Erklaerung>Abrichtungen und Potenzial stehen im Grimoire „Bestienmeister“ (Einstellungen → Regelpakete).</Erklaerung>}
    <div className="grid sm:grid-cols-2 gap-3">
      <Eingabe beschriftung="Rufname" value={b.rufname ?? ''} onChange={ev => aendern({ rufname: ev.target.value || undefined })} placeholder={b.name} />
      <Auswahl beschriftung="Ressource Kreatur" value={b.kreatur ?? 0} onChange={ev => aendern({ kreatur: Number(ev.target.value) || undefined })}>
        <option value={0}>keine (gekauft, gezähmt …)</option>
        {[...new Set([...besitzer.kreatur, b.kreatur ?? 0])].filter(x => x > 0).sort((x, y) => x - y).map(x => <option key={x} value={x}>Kreatur {x}</option>)}
      </Auswahl>
      {tierQualitaeten(k).length > 0 && (
        <Auswahl beschriftung="Qualität" value={b.qualitaet ?? tierQualitaeten(k)[0].potenzial} onChange={ev => aendern({ qualitaet: Number(ev.target.value) > tierQualitaeten(k)[0].potenzial ? Number(ev.target.value) : undefined })}>
          {tierQualitaeten(k).map(q => <option key={q.potenzial} value={q.potenzial}>{q.name} (Potenzial {q.potenzial})</option>)}
        </Auswahl>
      )}
    </div>
    <label className={`flex items-center gap-2 min-h-11 ${besitzer.tiervertrauter || b.vertrauter ? '' : 'text-leise'}`} title={besitzer.tiervertrauter ? undefined : 'Erfordert die Stärke Tiervertrauter'}>
      <input type="checkbox" className="w-5 h-5 accent-gold" checked={!!b.vertrauter} disabled={!besitzer.tiervertrauter && !b.vertrauter} onChange={ev => aendern({ vertrauter: ev.target.checked || undefined })} />
      Vertrauter (Stärke Tiervertrauter)
    </label>
  </div>
);

const Baukasten: React.FC<SchrittProps> = ({ k, b, aendern }) => <WesenBaukasten k={k} b={b} w={wesenBaukastenWerte(k, b)} aendern={aendern} />;

/** Ergebnis einer Voraussetzung als Marke: Wort und Rahmen, nicht nur Farbe */
const Status: React.FC<{ e: Ergebnis; text?: string }> = ({ e, text }) => (
  e === true ? <Marke ton="unverletzt" klein>erfüllt</Marke>
    : e === false ? <Marke ton="erschoepft" klein title={text ? `Voraussetzung: ${text}` : undefined}>nicht erfüllt</Marke>
      : <Marke klein title={text ? `Spielleitung: ${text}` : undefined}>Spielleitung</Marke>
);
const ergebnisWort = (e: Ergebnis) => (e === true ? '' : e === false ? ' – Voraussetzung fehlt' : ' – Spielleitung');

/** Wahlen nach dem Entfernen der Abrichtung an Stelle `weg` neu zuordnen (Schlüssel „<Stelle>:<Nr>“) */
function wahlenOhne(w: Begleiter['abrichtungWahlen'], weg: number): Begleiter['abrichtungWahlen'] {
  const neu: NonNullable<Begleiter['abrichtungWahlen']> = {};
  for (const [s, v] of Object.entries(w ?? {})) {
    const [i, n] = s.split(':').map(Number);
    if (i === weg) continue;
    neu[`${i > weg ? i - 1 : i}:${n}`] = v;
  }
  return Object.keys(neu).length ? neu : undefined;
}

/** Bedienung einer Wahl einer Abrichtung (Merkmal, Meisterschaft, Meisterschaften, Fertigkeit) */
const WahlFeld: React.FC<{ k: Katalog; o: OffeneWahl; wert: string | string[] | undefined; setze: (v: string | string[] | undefined) => void; fertigkeiten: { id?: string; name: string }[] }> = ({ k, o, wert, setze, fertigkeiten }) => {
  const [neu, setNeu] = useState('');
  const { w } = o;
  const label = `${o.abrichtung}: ${w.text}`;
  if (w.art === 'option') {
    return (
      <Auswahl beschriftung={label} value={typeof wert === 'string' ? wert : ''} onChange={e => setze(e.target.value || undefined)}>
        <option value="">wählen …</option>
        {(w.optionen ?? []).map((x, i) => <option key={i} value={String(i)}>{x.text}</option>)}
      </Auswahl>
    );
  }
  if (w.art === 'fertigkeit') {
    const liste = w.nur === 'magieschule_vorhanden'
      ? fertigkeiten.filter(f => istMagieschule(k, f.id)).map(f => ({ id: f.id!, name: f.name }))
      : allgemeineFertigkeitenListe(k);
    return (
      <Auswahl beschriftung={label} value={typeof wert === 'string' ? wert : ''} onChange={e => setze(e.target.value || undefined)}>
        <option value="">{liste.length ? 'Fertigkeit wählen …' : 'keine passende Fertigkeit'}</option>
        {liste.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </Auswahl>
    );
  }
  const schwelle = w.art === 'meisterschaft' ? (o.schwelle ?? 4) : Math.max(...(w.varianten ?? []).map(x => x.schwelle), 1);
  const angebot = golemMeisterschaften(k, w.fertigkeit ? [{ id: w.fertigkeit, name: '' }] : fertigkeiten, Math.max(schwelle, 1));
  if (w.art === 'meisterschaft') {
    return (
      <div className="space-y-1">
        <Auswahl beschriftung={label} value={typeof wert === 'string' ? wert : ''} onChange={e => setze(e.target.value || undefined)} disabled={o.schwelle === 0}>
          <option value="">{o.schwelle === 0 ? 'Abrichter ohne passende Meisterschaft' : 'Meisterschaft wählen …'}</option>
          {angebot.map(m => <option key={m.id} value={m.id}>{m.name} ({m.fertigkeit}, S{m.schwelle})</option>)}
        </Auswahl>
        {o.schwelle !== null && o.schwelle > 0 && w.schwelle_nach && <p className="text-xs text-leise m-0">Bis Schwelle {o.schwelle} (Meisterschaft des Abrichters).</p>}
      </div>
    );
  }
  const liste = Array.isArray(wert) ? wert : [];
  return (
    <div className="space-y-2">
      <div className="text-sm">{label} <span className="text-leise">({(w.varianten ?? []).map(x => `${x.anzahl === 1 ? 'eine' : x.anzahl} der Schwelle ${x.schwelle}`).join(' oder ')})</span></div>
      <div className="flex flex-wrap gap-2">
        {liste.map((id, i) => <MarkeMitEntfernen key={`${id}-${i}`} label={`${k.get(id)?.name ?? id} entfernen`} onEntfernen={() => setze(liste.filter((_, j) => j !== i))}>{k.get(id)?.name ?? id}</MarkeMitEntfernen>)}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <Auswahl beschriftung={`${o.abrichtung}: Meisterschaft hinzufügen`} value={neu} onChange={e => setNeu(e.target.value)}>
          <option value="">Meisterschaft wählen …</option>
          {angebot.map(m => <option key={m.id} value={m.id} disabled={liste.includes(m.id)}>{m.name} ({m.fertigkeit}, S{m.schwelle})</option>)}
        </Auswahl>
        <Knopf disabled={!neu} onClick={() => { setze([...liste, neu]); setNeu(''); }}><Plus size={14} aria-hidden />Hinzufügen</Knopf>
      </div>
    </div>
  );
};

const Abrichtungen: React.FC<SchrittProps> = ({ k, b, aendern, besitzer }) => {
  const liste = useMemo(() => alleAbrichtungen(k), [k]);
  const [wahl, setWahl] = useState('');
  const [text, setText] = useState<Record<number, boolean>>({});
  const gewaehlt = b.abrichtungen ?? [];
  const pot = potenzial(k, b, besitzer.msIds);
  const verbraucht = potenzialVerbraucht(liste, gewaehlt);
  const info = new Map(liste.map(a => [a.id, a]));
  const pruefung = gewaehlt.map((id, i) => {
    const a = info.get(id); if (!a) return 'offen' as Ergebnis;
    const n = gewaehlt.slice(0, i).filter(x => x === id).length;
    return pruefeAbrichtung(k, a, besitzer.char, tierTraeger(k, b, i), n);
  });
  const angebot = liste.map(a => {
    const n = gewaehlt.filter(x => x === a.id).length;
    const grenze = a.jeHeldengrad ? besitzer.heldengrad : a.hoechstens;
    return { a, voll: n >= grenze, ergebnis: pruefeAbrichtung(k, a, besitzer.char, tierTraeger(k, b), n) };
  });
  const gruppen = [...new Set(liste.map(a => a.gruppe))];
  const e0 = k.get(b.id);
  const tw = tierWerte(k, b, e0 && baukastenArt(e0) ? wesenBaukastenWerte(k, b).werte : tierGrundwerte(k, e0), besitzer.msIds);
  const wahlWerte = b.abrichtungWahlen ?? {};
  const setzeWahl = (s2: string, v: string | string[] | undefined) => {
    const neu = { ...wahlWerte }; if (v === undefined) delete neu[s2]; else neu[s2] = v;
    aendern({ abrichtungWahlen: Object.keys(neu).length ? neu : undefined });
  };
  const x = angebot.find(y => y.a.id === wahl);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Marke ton={verbraucht > pot.gesamt ? 'schaden' : 'neutral'}>Potenzial {verbraucht}/{pot.gesamt}</Marke>
        <span className="text-sm text-leise">{pot.posten.map(p => `${p.text}: ${p.wert}`).join(' + ')} (Bestienmeister S. 15)</span>
      </div>
      {verbraucht > pot.gesamt && <Hinweise liste={['Mehr Abrichtungen, als das Potenzial erlaubt.']} />}
      {tw.hinweise.length > 0 && <Hinweise liste={tw.hinweise} />}
      {gewaehlt.length > 0 ? (
        <ul className="space-y-2">
          {gewaehlt.map((id, i) => {
            const a = info.get(id);
            return (
              <li key={`${id}-${i}`} className="border-l-2 border-rahmen pl-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Knopf className="border-transparent! bg-transparent! hover:bg-erhoeht! px-1 font-bold" aria-expanded={!!text[i]} onClick={() => setText(t => ({ ...t, [i]: !t[i] }))}>
                    {a?.name ?? k.get(id)?.name ?? id}
                  </Knopf>
                  <Status e={pruefung[i]} text={a?.voraussetzung?.text} />
                  <span className="text-leise text-sm">{a ? `${a.grundausbildung ? 'Grundausbildung, ' : ''}${a.kosten} P.` : 'nicht im Katalog'}</span>
                  <Knopf nurSymbol className="ml-auto" aria-label={`Abrichtung ${a?.name ?? id} entfernen`} onClick={() => aendern({ abrichtungen: gewaehlt.filter((_, j) => j !== i), abrichtungWahlen: wahlenOhne(b.abrichtungWahlen, i) })}><X size={16} aria-hidden /></Knopf>
                </div>
                {abrichtungWerteText(k, id) && <p className="text-xs text-leise m-0 pl-1">Werte: {abrichtungWerteText(k, id)}</p>}
                {tw.wahlen.filter(o => o.stelle === i).map(o => (
                  <div key={o.schluessel} className="mt-2 max-w-xl">
                    <WahlFeld k={k} o={o} wert={wahlWerte[o.schluessel]} setze={v => setzeWahl(o.schluessel, v)} fertigkeiten={tw.werte?.fertigkeiten ?? []} />
                  </div>
                ))}
                {text[i] && a && <p className="mt-1 text-sm">{a.beschreibung}{a.voraussetzung ? <span className="block text-leise">Voraussetzung: {a.voraussetzung.text}</span> : null}</p>}
              </li>
            );
          })}
        </ul>
      ) : <Erklaerung>Noch keine Abrichtungen. Abrichtungen lassen sich auch später über „Bearbeiten“ ergänzen.</Erklaerung>}
      <div className="flex flex-wrap gap-2 items-end">
        <Auswahl beschriftung="Abrichtung wählen" value={wahl} onChange={ev => setWahl(ev.target.value)}>
          <option value="">Abrichtung wählen …</option>
          {gruppen.map(g => (
            <optgroup key={g} label={g}>
              {angebot.filter(y => y.a.gruppe === g).map(({ a, voll, ergebnis }) => (
                <option key={a.id} value={a.id} disabled={voll}>
                  {a.name} ({a.kosten} P.{a.quelle !== 'Bestienmeister' ? `, ${a.quelle}` : ''}){voll ? ' – bereits gewählt' : ergebnisWort(ergebnis)}
                </option>
              ))}
            </optgroup>
          ))}
        </Auswahl>
        <Knopf art="sekundaer" disabled={!wahl} onClick={() => {
          if (x?.ergebnis === false && regelverstoss('Die Voraussetzung dieser Abrichtung ist nicht erfüllt.')) return;
          aendern({ abrichtungen: [...gewaehlt, wahl] }); setWahl('');
        }}><Plus size={14} aria-hidden />Abrichtung hinzufügen</Knopf>
      </div>
      {x && (
        <p className="text-sm m-0">
          {x.a.beschreibung}
          {x.a.voraussetzung && <span className="block text-leise">
            Voraussetzung: {x.a.voraussetzung.text}{x.ergebnis === false ? ' – nicht erfüllt' : x.ergebnis === 'offen' ? ' – Entscheidung der Spielleitung' : ''}
          </span>}
        </p>
      )}
      <p className="text-xs text-leise m-0">Abrichtungen mit Zahlenwerten (Angriff, VTD, GSW, Fertigkeiten, Merkmale) sind in den Werten des Tiers eingerechnet; die übrigen gelten für den Tierführer oder sind Aktionen.</p>
    </div>
  );
};

export function tierSchritte(k: Katalog, b: { id: string; bausteine?: string[] }): Schritt[] {
  const e = b.id ? k.get(b.id) : undefined;
  const gebaut = !!b.bausteine || !!(e && baukastenArt(e));
  return [
    { id: 'herkunft', titel: 'Tier wählen', inhalt: Herkunft, nurNeu: true, bereit: x => !!x.id },
    { id: 'grund', titel: 'Grundangaben', inhalt: Grundangaben },
    ...(gebaut ? [{ id: 'baukasten', titel: 'Module', inhalt: Baukasten }] : []),
    ...(alleAbrichtungen(k).length ? [{ id: 'abrichtungen', titel: 'Abrichtungen', inhalt: Abrichtungen }] : []),
    UEBERSICHT,
  ];
}
