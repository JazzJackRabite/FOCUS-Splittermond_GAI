/**
 * Blatt eines Begleiters, aufgebaut wie „Kampf & Magie“: oben Lebenspunkte, Fokus und Zustände neben den abgeleiteten
 * Werten, darunter links Angriffe und Fertigkeiten, rechts Zauber, Fähigkeiten und die Angaben der Art. Nur Spielen –
 * Erstellen und Ändern geschehen im Assistenten (Knopf „Bearbeiten“).
 */
import React, { useState } from 'react';
import { Activity, Heart, Pencil, ScrollText, Sparkles, Swords, Trash2, Dices, ChevronDown, ChevronRight } from 'lucide-react';
import { useCharacter } from '../../context/CharacterContext';
import type { Katalog } from '../../regelwerk/katalog';
import type { Begleiter } from '../../types';
import { zustandswerte } from '../../regelwerk/zustandswerte';
import { Abschnittstitel, Karte, Knopf, Marke } from '../../fundament';
import DiceIcon from '../ui/DiceIcon';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { BegleiterVitals, spielDaten, useBegleiterSpiel, type Waffe } from './BegleiterSpiel';
import { Hinweise, Notiz, ZWert } from './Wertekasten';
import { artInfo, begleiterAnsicht, type Angabe } from './ansicht';
import type { Besitzer } from './besitzer';

const ATTRIBUTE = ['AUS', 'BEW', 'INT', 'KON', 'MYS', 'STÄ', 'VER', 'WIL'];
const ABGELEITET = ['GK', 'GSW', 'LP', 'FO', 'VTD', 'SR', 'KW', 'GW'];

/** Karte mit Titelzeile (Symbol, Titel, goldene Linie) wie in „Kampf & Magie“ */
export const Kasten: React.FC<{ titel: string; symbol: React.ReactNode; aktion?: React.ReactNode; children: React.ReactNode; testid?: string }> = ({ titel, symbol, aktion, children, testid }) => (
  <Karte data-testid={testid}>
    <div className="flex items-center justify-between gap-3 border-b border-gold pb-3 mb-4">
      <Abschnittstitel als="h3" className="flex items-center gap-2"><span className="text-gold shrink-0" aria-hidden>{symbol}</span>{titel}</Abschnittstitel>
      {aktion}
    </div>
    {children}
  </Karte>
);

/** Wertkachel: Kürzel klein darüber, Wert groß */
const Kachel: React.FC<{ kurz: string; children: React.ReactNode; title?: string }> = ({ kurz, children, title }) => (
  <div className="bg-erhoeht rounded-knopf border border-rahmen p-2 text-center min-w-0" title={title}>
    <span className="text-[11px] uppercase font-bold text-leise block leading-tight">{kurz}</span>
    <span className="text-base font-bold tabular-nums text-schrift mt-0.5 block">{children}</span>
  </div>
);

/** Waffenkarte: Werte als Kacheln, darunter Angriff und Schaden als Würfelknöpfe */
const WaffenKarte: React.FC<{ x: Waffe; zw: ReturnType<typeof zustandswerte> | null; wundabzug: number; angriff: () => void; schaden: () => void }> = ({ x, zw, wundabzug, angriff, schaden }) => (
  <div className="bg-erhoeht rounded-karte border border-rahmen p-4 space-y-3" data-testid="begleiter-waffe">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-bold text-base text-schrift">{x.name}</span>
      {x.merkmale && <span className="text-[11px] text-leise bg-seite px-1.5 py-0.5 rounded-knopf border border-rahmen">{x.merkmale}</span>}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Kachel kurz="Angriff">{x.wert}{wundabzug !== 0 && <span className="text-schaden text-xs font-normal"> ({wundabzug})</span>}</Kachel>
      <Kachel kurz="Schaden">{x.schaden}</Kachel>
      <Kachel kurz="WGS">{x.wgs}</Kachel>
      <Kachel kurz="INI"><ZWert name="INI" text={x.ini} zw={zw} /></Kachel>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-rahmen">
      <Knopf art="sekundaer" className="w-full" onClick={angriff} aria-label={`Angriff ${x.name} würfeln`}><DiceIcon size={15} />Angriff</Knopf>
      <Knopf className="w-full" onClick={schaden} aria-label={`Schaden ${x.name} würfeln`}><Dices size={15} aria-hidden />{x.schaden} Schaden</Knopf>
    </div>
  </div>
);

/** Angaben einer Gruppe (Abrichtungen, Instruktionen …): Name aufklappbar, wenn ein Text dazu da ist */
const AngabeListe: React.FC<{ a: Angabe }> = ({ a }) => {
  const [offen, setOffen] = useState<Record<number, boolean>>({});
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold uppercase tracking-wide text-leise">{a.titel}</div>
      {a.eintraege.length === 0 ? <p className="text-leise text-sm m-0">{a.leer ?? 'Keine.'}</p> : (
        <ul className="space-y-1">
          {a.eintraege.map((x, i) => (
            <li key={i} className="text-sm">
              {x.text ? (
                <Knopf className="border-transparent! bg-transparent! hover:bg-erhoeht! px-1 font-bold justify-start" aria-expanded={!!offen[i]} onClick={() => setOffen(o => ({ ...o, [i]: !o[i] }))}>
                  {offen[i] ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}{x.name}
                </Knopf>
              ) : <span className="font-bold px-1">{x.name}</span>}
              {x.zusatz && <span className="text-leise"> ({x.zusatz})</span>}
              {offen[i] && x.text && <p className="mt-1 ml-6 mb-0 text-schrift">{x.text}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const BegleiterBlatt: React.FC<{ k: Katalog; b: Begleiter; index: number; besitzer: Besitzer; bearbeiten: () => void }> = ({ k, b, index, besitzer, bearbeiten }) => {
  const { dispatch } = useCharacter();
  const [loeschen, setLoeschen] = useState(false);
  const a = begleiterAnsicht(k, b, besitzer);
  const werteSpiel = spielDaten(b, a.w);
  const spiel = useBegleiterSpiel(b, index, werteSpiel);
  const info = artInfo(b.art);
  const Symbol = info.symbol;
  const w = a.w;
  const zw = spiel.zustand.zustaende?.length ? zustandswerte(spiel.zustand.zustaende) : null;
  const aendern = (aenderung: Partial<Begleiter>) => dispatch({ type: 'BEGLEITER_AENDERN', payload: { index, aenderung } });
  const merkmale = [
    w?.felder?.typus && { titel: 'Typus', text: w.felder.typus },
    w?.felder?.merkmale && { titel: 'Merkmale', text: w.felder.merkmale },
    b.art !== 'gefolge' && w?.felder?.meisterschaften && { titel: 'Meisterschaften', text: w.felder.meisterschaften },
  ].filter(Boolean) as { titel: string; text: string }[];

  return (
    <div className="space-y-6" data-testid="begleiter-blatt">
      {spiel.modale}

      {/* Kopf: Name, Art, Kurzangaben; Bearbeiten und Entfernen */}
      <Karte className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 space-y-1.5">
            <h2 className="m-0 font-titel font-bold text-xl tracking-[0.04em] text-schrift flex items-center gap-2">
              <Symbol size={22} className="text-gold shrink-0" aria-hidden />{a.titel}
            </h2>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Marke klein ton="gold">{info.name}</Marke>
              {a.kurz.map((x, i) => <Marke key={i} klein ton={x.ton} title={x.titel}>{x.text}</Marke>)}
              {a.fehlt && <Marke klein ton="erschoepft">nicht im Katalog (Grimoire nicht geladen?)</Marke>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Knopf art="sekundaer" onClick={bearbeiten}><Pencil size={14} aria-hidden />Bearbeiten</Knopf>
            <Knopf nurSymbol aria-label={`${a.titel} entfernen`} title="Begleiter entfernen" onClick={() => setLoeschen(true)}><Trash2 size={16} aria-hidden /></Knopf>
          </div>
        </div>
        <Hinweise liste={a.hinweise} />
      </Karte>

      {/* Lebenspunkte, Fokus, Zustände | Abgeleitete Werte und Attribute */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Kasten titel="Lebenspunkte & Fokus" symbol={<Heart size={20} />}>
          {w && (werteSpiel.lp > 0 || werteSpiel.fo > 0) ? <BegleiterVitals spiel={spiel} daten={werteSpiel} rahmenlos /> : <p className="text-sm text-leise m-0">Ohne Werte keine Lebenspunkte.</p>}
        </Kasten>
        <Kasten titel="Werte" symbol={<Activity size={20} />} testid="begleiter-werte">
          {w ? (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {ABGELEITET.map(x => <Kachel key={x} kurz={x}><ZWert name={x} text={w.abgeleitete_werte?.[x]} zw={zw} testid={`zustand-wert-${x}`} /></Kachel>)}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ATTRIBUTE.map(x => <Kachel key={x} kurz={x}>{w.attribute?.[x] ?? '–'}</Kachel>)}
              </div>
              {w.berechnet && <p className="text-xs text-leise italic m-0">Werte berechnet aus „Werte wie … mit folgenden Änderungen“.</p>}
            </div>
          ) : <p className="text-sm text-leise m-0">Keine Werte in den Paketen.</p>}
        </Kasten>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* links: Angriffe, Fertigkeiten */}
        <div className="space-y-6">
          <Kasten titel="Angriffe" symbol={<Swords size={20} />}>
            {(w?.waffen ?? []).length === 0 ? <p className="text-sm text-leise m-0">Keine Angriffe.</p> : (
              <div className="space-y-3">
                {w!.waffen!.map((x, i) => (
                  <WaffenKarte key={i} x={x} zw={zw} wundabzug={spiel.lage.wundabzug} angriff={() => spiel.aktionen.angriff(x)} schaden={() => spiel.aktionen.schaden(x)} />
                ))}
              </div>
            )}
          </Kasten>
          <Kasten titel="Fertigkeiten" symbol={<Dices size={20} />}>
            {a.fertigkeiten.length === 0 ? <p className="text-sm text-leise m-0">Keine Fertigkeiten.</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {a.fertigkeiten.map((f, i) => f.wert !== null ? (
                  <Knopf key={i} className="w-full justify-between text-sm" onClick={() => spiel.aktionen.probe(f.name, f.wert!)} aria-label={`Probe ${f.name} würfeln`}>
                    <span className="flex items-center gap-1.5"><DiceIcon size={14} />{f.name}</span>
                    <span className="text-lg tabular-nums">{f.wert}</span>
                  </Knopf>
                ) : <span key={i} className="text-sm text-leise px-3 py-2">{f.name}</span>)}
              </div>
            )}
          </Kasten>
        </div>

        {/* rechts: Zauber, Fähigkeiten und Angaben der Art, Notiz */}
        <div className="space-y-6">
          {a.zauber.length > 0 && (
            <Kasten titel="Zauber" symbol={<Sparkles size={20} />}>
              <div className="space-y-2">
                {a.zauber.map((z, i) => (
                  <div key={i} className="bg-erhoeht rounded-karte p-3 border border-rahmen flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-bold text-schrift">{z.name}</div>
                      <div className="text-xs text-leise">{z.info}{z.ok ? '' : ' · Voraussetzung fehlt'}</div>
                    </div>
                    {z.spell && z.wert !== null && (
                      <Knopf art="sekundaer" onClick={() => spiel.aktionen.zaubern?.(z.spell!, z.wert!)} aria-label={`Zauber ${z.name} wirken`}>
                        <Sparkles size={14} className="text-magie" aria-hidden />Wirken ({z.wert})
                      </Knopf>
                    )}
                  </div>
                ))}
              </div>
            </Kasten>
          )}
          <Kasten titel="Fähigkeiten" symbol={<ScrollText size={20} />}>
            <div className="space-y-4">
              {merkmale.map(m => (
                <div key={m.titel} className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wide text-leise">{m.titel}</div>
                  <p className="text-sm m-0">{m.text}</p>
                </div>
              ))}
              {a.angaben.map(x => <AngabeListe key={x.titel} a={x} />)}
              {a.text.map((t, i) => <p key={i} className="text-xs text-leise m-0">{t}</p>)}
              {merkmale.length === 0 && a.angaben.length === 0 && a.text.length === 0 && <p className="text-sm text-leise m-0">Keine besonderen Fähigkeiten.</p>}
            </div>
          </Kasten>
          <Karte><Notiz b={b} aendern={aendern} /></Karte>
        </div>
      </div>

      {loeschen && (
        <ConfirmDialog title="Begleiter entfernen" message={`${a.titel} wirklich entfernen? Werte, Lebenspunkte und Notiz gehen verloren.`}
          onCancel={() => setLoeschen(false)}
          onConfirm={() => { setLoeschen(false); dispatch({ type: 'BEGLEITER_ENTFERNEN', payload: { index } }); }} />
      )}
    </div>
  );
};
