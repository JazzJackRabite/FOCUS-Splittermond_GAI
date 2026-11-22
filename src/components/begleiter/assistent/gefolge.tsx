/** Assistent: Gefolgsmann über die Ressource Gefolge (GRW S. 77–78) */
import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  ATTRIBUTE, anhebbareFertigkeiten, ersteSchwelle, freieAttribute, gefolgeWerte, gruppenOptionen, kulturModul, kulturen, meisterschaftsAngebot,
  rassen, rasseText, waffenAngebot, zauberAngebot,
} from '../../../regelwerk/gefolge';
import type { Katalog } from '../../../regelwerk/katalog';
import { Auswahl, Eingabe, Knopf, Marke } from '../../../fundament';
import { MarkeMitEntfernen } from '../Wertekasten';
import { gefolgeVerbraucht } from '../besitzer';
import { Erklaerung, Titel3, UEBERSICHT } from './teile';
import type { Schritt, SchrittProps } from './typen';

const AUFGABEN = ['Leibdiener', 'Leibdienerin', 'Knappe', 'Leibwächter', 'Zofe', 'Knecht', 'Koch', 'Vorkoster', 'Schildmaid'];

/** Punkte: Ressource, verbraucht (mit diesem Gefolgsmann) */
const Punkte: React.FC<SchrittProps> = ({ k, b, besitzer, alle, index }) => {
  const andere = gefolgeVerbraucht(k, alle, besitzer.maxFertigkeit, index);
  const diese = b.id ? gefolgeWerte(k, b, besitzer.maxFertigkeit).punkte : 0;
  const zuviel = andere + diese > besitzer.gefolgePunkte;
  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="gefolge-punkte">
      <Marke ton={zuviel ? 'schaden' : 'neutral'}>Gefolge-Punkte {andere + diese}/{besitzer.gefolgePunkte}</Marke>
      <span className="text-sm text-leise">dieser Gefolgsmann {diese}, die übrigen {andere}</span>
      {zuviel && <span className="text-sm">Mehr Punkte, als die Ressource Gefolge hergibt.</span>}
    </div>
  );
};

const Grundlage: React.FC<SchrittProps> = (p) => {
  const { k, b, aendern, besitzer } = p;
  const ku = useMemo(() => kulturen(k), [k]);
  const ra = useMemo(() => rassen(k), [k]);
  return (
    <div className="space-y-4">
      <Erklaerung>
        Jeder Punkt der Ressource Gefolge bringt einen Gefolgsmann (Attribute 2 + Rassenmodifikator, Werte des Kulturmoduls) oder hebt eine Fertigkeit
        auf die erste Schwelle oder kauft eine Meisterschaft bzw. einen Zauber. Keine Fertigkeit über {besitzer.maxFertigkeit} (Heldengrad).
        Den Einsatz entscheidet die Spielleitung (GRW S. 77–78).
      </Erklaerung>
      <Punkte {...p} />
      <div className="grid sm:grid-cols-2 gap-3">
        <Auswahl beschriftung="Rasse" value={b.rasse ?? ''} onChange={e => aendern({ rasse: e.target.value || undefined, attributFrei: undefined })}>
          <option value="">Rasse wählen …</option>
          {ra.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Auswahl>
        <Auswahl beschriftung="Kultur" value={b.id} onChange={e => { const c = k.get(e.target.value); aendern({ id: c?.id ?? '', name: c?.name ?? '', kulturWahl: undefined }); }}>
          <option value="">Kultur wählen …</option>
          {ku.map(c => <option key={c.id} value={c.id}>{c.name}{c.quelle.paket !== 'grw' ? ` (${k.pakete[c.quelle.paket]?.kuerzel ?? c.quelle.paket})` : ''}</option>)}
        </Auswahl>
      </div>
      {b.rasse && <Erklaerung>{rasseText(k, b.rasse)}; sonst alle Attribute 2 (GRW S. 78).</Erklaerung>}
    </div>
  );
};

const Grundangaben: React.FC<SchrittProps> = ({ k, b, aendern, index }) => {
  const plaetze = freieAttribute(k, b.rasse);
  const mw = kulturModul(k, b.id);
  const wahl = b.kulturWahl ?? {};
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Eingabe beschriftung="Rufname" value={b.rufname ?? ''} onChange={ev => aendern({ rufname: ev.target.value || undefined })} placeholder="Name" />
        <Eingabe beschriftung="Aufgabe" value={b.aufgabe ?? ''} onChange={ev => aendern({ aufgabe: ev.target.value || undefined })} placeholder="Leibdiener, Knappe …" list="gefolge-aufgaben" />
        <datalist id="gefolge-aufgaben">{AUFGABEN.map(a => <option key={a} value={a} />)}</datalist>
        {index !== undefined && (
          <Auswahl beschriftung="Rasse" value={b.rasse ?? ''} onChange={e => aendern({ rasse: e.target.value || undefined, attributFrei: undefined })}>
            <option value="">Rasse wählen …</option>
            {rassen(k).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Auswahl>
        )}
        {plaetze.map((p, i) => (
          <Auswahl key={i} beschriftung={`Freier Attributbonus ${i + 1} (+${p.bonus})`} value={b.attributFrei?.[i] ?? ''}
            onChange={ev => { const l = [...(b.attributFrei ?? [])]; l[i] = ev.target.value; aendern({ attributFrei: l }); }}>
            <option value="">Attribut …</option>
            {ATTRIBUTE.filter(([, n]) => !p.nicht.includes(n) && !(p.unterschiedlich && (b.attributFrei ?? []).some((x, j) => j !== i && x === n)))
              .map(([kurz, n]) => <option key={kurz} value={n}>{n}</option>)}
          </Auswahl>
        ))}
      </div>
      {mw && (
        <div className="space-y-2">
          <Titel3>Kulturmodul {b.name}</Titel3>
          <div className="grid sm:grid-cols-2 gap-3">
            {mw.fertigkeiten.map((gr, i) => {
              const liste = gruppenOptionen(k, mw.fertigkeiten, i, gr.rest_von != null ? wahl.fertigkeiten?.[String(gr.rest_von)] : undefined);
              if (liste.length <= 1) return null;
              return (
                <Auswahl key={i} beschriftung={`Kultur: ${gr.text}`} value={wahl.fertigkeiten?.[String(i)] ?? ''}
                  onChange={ev => aendern({ kulturWahl: { ...wahl, fertigkeiten: { ...(wahl.fertigkeiten ?? {}), [String(i)]: ev.target.value } } })}>
                  <option value="">wählen …</option>
                  {liste.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}
                </Auswahl>
              );
            })}
            {mw.staerke_optionen.length > 1 && (
              <Auswahl beschriftung="Kultur: Stärke" value={wahl.staerke ?? ''} onChange={ev => aendern({ kulturWahl: { ...wahl, staerke: ev.target.value || undefined } })}>
                <option value="">wählen …</option>
                {mw.staerke_optionen.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}
              </Auswahl>
            )}
            {mw.meisterschaft_optionen.length > 1 && (
              <Auswahl beschriftung="Kultur: Meisterschaft" value={wahl.meisterschaft ?? ''}
                onChange={ev => aendern({ kulturWahl: { ...wahl, meisterschaft: ev.target.value === '' ? undefined : Number(ev.target.value) } })}>
                <option value="">wählen …</option>
                {mw.meisterschaft_optionen.map((o, i) => <option key={i} value={i}>{o.text}</option>)}
              </Auswahl>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Fertigkeiten: React.FC<SchrittProps> = (p) => {
  const { k, b, aendern, besitzer } = p;
  const [fWahl, setFWahl] = useState('');
  const g = gefolgeWerte(k, b, besitzer.maxFertigkeit);
  const schwelle1 = ersteSchwelle(k);
  const schwellen = b.schwellen ?? [];
  const alleFertigkeiten = useMemo(() => anhebbareFertigkeiten(k), [k]);
  return (
    <div className="space-y-4">
      <Punkte {...p} />
      <Erklaerung>Eine Fertigkeit auf die erste Schwelle ({schwelle1}) anzuheben kostet 1 Punkt und bringt eine freie Meisterschaft.</Erklaerung>
      {g.fertigkeiten.length === 0 ? <Erklaerung>Keine Fertigkeiten.</Erklaerung> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-1 text-sm">
            <thead><tr className="text-xs text-leise"><th>Fertigkeit</th><th>Punkte</th><th>Wert</th><th></th></tr></thead>
            <tbody>
              {g.fertigkeiten.map(f => (
                <tr key={f.id}>
                  <td className="pr-2">{f.name}</td>
                  <td className="pr-2">{f.punkte}{f.zuHoch && <Marke klein ton="schaden" className="ml-2">über Heldengrad</Marke>}</td>
                  <td className="pr-2 font-titel">{f.wert ?? <span className="font-text text-leise" title="Kampffertigkeit: Punkte + Attribute der Waffe">+ Waffe</span>}</td>
                  <td className="text-right">
                    {f.angehoben ? (
                      <Knopf aria-label={`${f.name} nicht mehr anheben`} onClick={() => aendern({ schwellen: schwellen.filter(x => x !== f.id) })}>angehoben (1 P.) <X size={14} aria-hidden /></Knopf>
                    ) : f.punkte < schwelle1 ? (
                      <Knopf onClick={() => aendern({ schwellen: [...schwellen, f.id] })}>auf {schwelle1} anheben (1 P.)</Knopf>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-end">
        <Auswahl beschriftung="Weitere Fertigkeit anheben" value={fWahl} onChange={ev => setFWahl(ev.target.value)}>
          <option value="">weitere Fertigkeit auf {schwelle1} …</option>
          {alleFertigkeiten.filter(e => !g.fertigkeiten.some(f => f.id === e.id)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Auswahl>
        <Knopf disabled={!fWahl} onClick={() => { aendern({ schwellen: [...schwellen, fWahl] }); setFWahl(''); }}><Plus size={14} aria-hidden />Anheben (1 P.)</Knopf>
      </div>
    </div>
  );
};

const Waffen: React.FC<SchrittProps> = ({ k, b, aendern, besitzer }) => {
  const [wWahl, setWWahl] = useState('');
  const g = gefolgeWerte(k, b, besitzer.maxFertigkeit);
  const ws = b.waffen ?? [];
  const wAngebot = useMemo(() => waffenAngebot(k, g.fertigkeiten), [k, g.fertigkeiten]);
  return (
    <div className="space-y-4">
      <Erklaerung>Waffen der Kampffertigkeiten des Gefolgsmanns; der Angriffswert ergibt sich aus Fertigkeitspunkten und den Attributen der Waffe.</Erklaerung>
      <div className="flex flex-wrap gap-2">
        {g.waffen.map((x, i) => x.angeboren ? (
          <Marke key={`a-${i}`}>{x.name} <span className="text-leise">({x.fertigkeit}, immer)</span></Marke>
        ) : (
          <MarkeMitEntfernen key={`${x.id}-${i}`} label={`Waffe ${x.name} entfernen`} onEntfernen={() => { const j = ws.indexOf(x.id); aendern({ waffen: ws.filter((_, n) => n !== j) }); }}>
            {x.name} <span className="text-leise">({x.fertigkeit}, Angriff {x.wert}, {x.schaden})</span>
          </MarkeMitEntfernen>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <Auswahl beschriftung="Waffe für Gefolgsmann wählen" value={wWahl} onChange={ev => setWWahl(ev.target.value)}>
          <option value="">{wAngebot.length ? 'Waffe wählen …' : 'Waffen: erst eine Kampffertigkeit'}</option>
          {[...new Set(wAngebot.map(x => x.fertigkeit))].map(f => (
            <optgroup key={f} label={f}>{wAngebot.filter(x => x.fertigkeit === f).map(x => <option key={x.id} value={x.id}>{x.name} ({x.schaden}{x.modus && x.modus !== 'Nahkampf' ? `, ${x.modus}` : ''})</option>)}</optgroup>
          ))}
        </Auswahl>
        <Knopf disabled={!wWahl} onClick={() => { aendern({ waffen: [...ws, wWahl] }); setWWahl(''); }}><Plus size={14} aria-hidden />Waffe</Knopf>
      </div>
    </div>
  );
};

const MeisterschaftenZauber: React.FC<SchrittProps> = (p) => {
  const { k, b, aendern, besitzer } = p;
  const [msWahl, setMsWahl] = useState('');
  const [zWahl, setZWahl] = useState('');
  const g = gefolgeWerte(k, b, besitzer.maxFertigkeit);
  const ms = b.meisterschaften ?? [];
  const zs = b.zauber ?? [];
  const msAngebot = useMemo(() => meisterschaftsAngebot(k, g.fertigkeiten), [k, g.fertigkeiten]);
  const zAngebot = useMemo(() => zauberAngebot(k, g.fertigkeiten), [k, g.fertigkeiten]);
  return (
    <div className="space-y-5">
      <Punkte {...p} />
      <div className="space-y-2">
        <Titel3>Meisterschaften</Titel3>
        <div className="flex flex-wrap gap-2">
          {g.kulturMeisterschaft && <Marke>{g.kulturMeisterschaft.text} <span className="text-leise">(Kultur)</span></Marke>}
          {g.meisterschaften.map((m, i) => (
            <MarkeMitEntfernen key={`${m.id}-${i}`} ton={m.ok ? 'neutral' : 'erschoepft'} label={`Meisterschaft ${m.name} entfernen`} onEntfernen={() => aendern({ meisterschaften: ms.filter((_, j) => j !== i) })}>
              {m.name} <span className="text-leise">({m.fertigkeit}, S{m.schwelle}{i < g.freieMeisterschaften ? ', frei durch Schwelle' : ', 1 P.'}{m.ok ? '' : ', Voraussetzung fehlt'})</span>
            </MarkeMitEntfernen>
          ))}
        </div>
        <Erklaerung>Frei: {g.freieMeisterschaften} (eine je angehobener Fertigkeit); jede weitere kostet 1 Punkt.</Erklaerung>
        <div className="flex flex-wrap gap-2 items-end">
          <Auswahl beschriftung="Meisterschaft für Gefolgsmann wählen" value={msWahl} onChange={ev => setMsWahl(ev.target.value)}>
            <option value="">Meisterschaft wählen …</option>
            {[...new Set(msAngebot.map(m => m.fertigkeit))].map(f => (
              <optgroup key={f} label={f}>
                {msAngebot.filter(m => m.fertigkeit === f).map(m => <option key={m.id} value={m.id} disabled={ms.includes(m.id) || g.kulturMeisterschaft?.id === m.id}>{m.name} (S{m.schwelle})</option>)}
              </optgroup>
            ))}
          </Auswahl>
          <Knopf disabled={!msWahl} onClick={() => { aendern({ meisterschaften: [...ms, msWahl] }); setMsWahl(''); }}><Plus size={14} aria-hidden />Meisterschaft hinzufügen</Knopf>
        </div>
      </div>
      {(zAngebot.length > 0 || zs.length > 0) && (
        <div className="space-y-2">
          <Titel3>Zauber</Titel3>
          <div className="flex flex-wrap gap-2">
            {g.zauber.map((z, i) => (
              <MarkeMitEntfernen key={`${z.id}-${i}`} ton={z.ok ? 'magie' : 'erschoepft'} label={`Zauber ${z.name} entfernen`} onEntfernen={() => aendern({ zauber: zs.filter((_, j) => j !== i) })}>
                {z.name} <span className="text-leise">({z.schule} {z.grad}{i < g.freieZauber ? ', frei' : ', 1 P.'}{z.ok ? '' : ', Voraussetzung fehlt'})</span>
              </MarkeMitEntfernen>
            ))}
          </div>
          <Erklaerung>Frei: {g.freieZauber} (je Magieschule ab 1, 3 und 6 Punkten einer); jeder weitere kostet 1 Punkt.</Erklaerung>
          <div className="flex flex-wrap gap-2 items-end">
            <Auswahl beschriftung="Zauber für Gefolgsmann wählen" value={zWahl} onChange={ev => setZWahl(ev.target.value)}>
              <option value="">Zauber wählen …</option>
              {[...new Set(zAngebot.map(z => z.schule))].map(s => (
                <optgroup key={s} label={s}>
                  {zAngebot.filter(z => z.schule === s).map(z => <option key={z.id} value={z.id} disabled={zs.includes(z.id)}>{z.name} (Grad {z.grad})</option>)}
                </optgroup>
              ))}
            </Auswahl>
            <Knopf disabled={!zWahl} onClick={() => { aendern({ zauber: [...zs, zWahl] }); setZWahl(''); }}><Plus size={14} aria-hidden />Zauber hinzufügen</Knopf>
          </div>
        </div>
      )}
    </div>
  );
};

export function gefolgeSchritte(_k: Katalog): Schritt[] {
  return [
    { id: 'grundlage', titel: 'Rasse und Kultur', inhalt: Grundlage, nurNeu: true, bereit: x => !!x.id && !!x.rasse },
    { id: 'grund', titel: 'Grundangaben', inhalt: Grundangaben },
    { id: 'fertigkeiten', titel: 'Fertigkeiten', inhalt: Fertigkeiten },
    { id: 'waffen', titel: 'Waffen', inhalt: Waffen },
    { id: 'meisterschaften', titel: 'Meisterschaften und Zauber', inhalt: MeisterschaftenZauber },
    UEBERSICHT,
  ];
}
