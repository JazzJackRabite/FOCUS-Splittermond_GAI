/**
 * Relikte im Inventar: Karte mit den Relikten des Charakters und die Relikt-Werkstatt.
 * Alle Regeln kommen aus den Paketen (regelwerk/relikte.ts); Verstöße sperren das Speichern, mit Hausregeln nur Warnung
 * (FUNDAMENT.md, Grundsatz 7). Aufgebaut aus den Bausteinen des Fundaments.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Gem, Plus, Minus, Trash2, Pencil, Info, AlertTriangle, TrendingUp } from 'lucide-react';
import { useCharacter } from '../../context/CharacterContext';
import { useRegelwerk } from '../../regelwerk/RegelwerkContext';
import { alleAusruestung, findeAusruestung, type AusruestungsItem } from '../../regelwerk/ausruestung';
import {
  AUSWAHL, GEGENSTANDSARTEN, artVon, auswahlAnzeige, kostenVon, passtZu, pruefeRelikt, reliktAlsInventar, reliktBaukasten, reliktBausteine,
  reliktWerte, reliktWiderstand, veralteteReliktEintraege, ressourcePunkte, wahlText, zauberMitGrad, type BausteinInfo,
  ANLASS_NAME, aktiveKraefte, beseelungQuelle, beseelungRegeln, domaenen, domaenenKraefte, pruefeChronik, wachsenQuelle, wachsenRegeln,
} from '../../regelwerk/relikte';
import type { Katalog } from '../../regelwerk/katalog';
import type { Relikt, ReliktBaustein, ReliktBeseelung } from '../../types';
import { generateId } from '../../utils/id';
import { Abschnittstitel, Auswahl, Dialog, Eingabe, Karte, Knopf, Marke, Rollbereich } from '../../fundament';
import { regelverstoss, useHausregeln } from '../../fundament/hausregeln';
import { ConfirmDialog } from '../ui/ConfirmDialog';

/** Heldengrad des Charakters (1–4) */
function useHeldengrad(): number {
  const { calc } = useCharacter();
  return calc?.heldengrad?.nr ?? 1;
}

const typName = (k: Katalog, typ: string) => (typ === 'material' ? 'Besondere Materialien' : k.manifest.typen?.[typ]?.bezeichnung ?? typ);

/** Auswahl zu einem Baustein: Zauber des gewählten Grades, Wahl einer Variante oder Freitext */
const AuswahlFeld: React.FC<{ k: Katalog; b: BausteinInfo; w: ReliktBaustein; setze: (w: Partial<ReliktBaustein>) => void }> = ({ k, b, w, setze }) => {
  const zauber = useMemo(() => {
    if (b.auswahl !== 'zauber') return [];
    return zauberMitGrad(k, w.grad ?? 0);
  }, [k, b.auswahl, w.grad]);
  if (b.aenderungenWahl) {
    return (
      <Auswahl beschriftung={`${b.name}: Wahl`} beschriftungVerborgen value={w.auswahl ?? ''} onChange={e => setze({ auswahl: e.target.value })} className="max-w-[14rem]">
        <option value="">Wahl …</option>
        {b.aenderungenWahl.map((l, i) => <option key={i} value={String(i)}>{wahlText(l)}</option>)}
      </Auswahl>
    );
  }
  if (!b.auswahl) return null;
  if (b.auswahl === 'zauber') {
    // Gespeichert wird die Regel-ID des Zaubers; ältere Relikte mit Namen werden beim Bearbeiten umgestellt
    const wert = w.auswahl && !k.get(w.auswahl) ? (zauber.find(z => z.name === w.auswahl)?.id ?? '') : (w.auswahl ?? '');
    return (
      <Auswahl beschriftung="Zauber wählen" beschriftungVerborgen value={wert} onChange={e => setze({ auswahl: e.target.value })} className="max-w-[14rem]">
        <option value="">Zauber (Grad {w.grad ?? 0}) …</option>
        {zauber.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
      </Auswahl>
    );
  }
  const name = AUSWAHL[b.auswahl] ?? b.auswahl;
  return <Eingabe beschriftung={name} beschriftungVerborgen value={w.auswahl ?? ''} onChange={e => setze({ auswahl: e.target.value })} placeholder={name} className="w-44" />;
};

/** Beseelter Gegenstand: Domäne, Heiliger, Gebote, Kräfte mit Questen (Regeln aus dem Paket) */
const BeseelungFeld: React.FC<{ k: Katalog; b: ReliktBeseelung | undefined; setze: (b: ReliktBeseelung | undefined) => void }> = ({ k, b, setze }) => {
  const R = beseelungRegeln(k);
  const [wahl, setWahl] = useState('');
  if (!R) return null;
  const angebot = b ? domaenenKraefte(k, b.domaene) : [];
  const aktiv = b ? aktiveKraefte(b) : [];
  const setzeKraft = (i: number, u: Partial<ReliktBeseelung['kraefte'][number]>) => b && setze({ ...b, kraefte: b.kraefte.map((x, j) => (j === i ? { ...x, ...u } : x)) });
  return (
    <div className="border border-rahmen rounded-knopf p-3 flex flex-col gap-2" data-testid="relikt-beseelung">
      <label className="flex items-center gap-2 text-sm min-h-11">
        <input type="checkbox" checked={!!b} onChange={e => setze(e.target.checked ? { domaene: '', kraefte: [] } : undefined)} />
        Beseelter Gegenstand ({R.punkte_beseelung} Punkte, darin die erste Kraft; je weitere Kraft {R.punkte_je_weitere_kraft} Punkt)
      </label>
      {b && <>
        <Auswahl beschriftung="Domäne des Heiligen" value={b.domaene} onChange={e => setze({ ...b, domaene: e.target.value, kraefte: [] })}>
          <option value="">Domäne wählen …</option>
          {domaenen(k).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Auswahl>
        <div className="grid grid-cols-2 gap-3">
          <Eingabe beschriftung="Heiliger" value={b.heiliger ?? ''} onChange={e => setze({ ...b, heiliger: e.target.value })} />
          <Eingabe beschriftung="Gebote und Verbote" value={b.gebote ?? ''} onChange={e => setze({ ...b, gebote: e.target.value })} />
        </div>
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {b.kraefte.map((x, i) => {
            const kr = angebot.find(a => a.id === x.id);
            return (
              <li key={`${x.id}-${i}`} className="border border-rahmen rounded-knopf p-2 bg-erhoeht flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm">{i + 1}. {kr?.name ?? k.get(x.id)?.name ?? x.id}</span>
                {kr?.stufe && <Marke klein>{kr.stufe}</Marke>}
                {x.erfuellt && !aktiv.includes(x.id) && <Marke klein ton="erschoepft">ruht</Marke>}
                <Eingabe beschriftung={`Queste für ${kr?.name ?? x.id}`} beschriftungVerborgen placeholder="Queste" value={x.queste ?? ''} onChange={e => setzeKraft(i, { queste: e.target.value })} className="w-56" />
                <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={!!x.erfuellt} onChange={e => setzeKraft(i, { erfuellt: e.target.checked })} />Queste erfüllt</label>
                <Knopf nurSymbol art="gefahr" className="ml-auto" aria-label={`${kr?.name ?? x.id} entfernen`} onClick={() => setze({ ...b, kraefte: b.kraefte.filter((_, j) => j !== i) })}><Trash2 size={14} /></Knopf>
              </li>
            );
          })}
        </ul>
        {b.domaene && (
          <div className="flex items-end gap-2">
            <Auswahl beschriftung="Kraft hinzufügen" value={wahl} onChange={e => setWahl(e.target.value)} className="flex-1">
              <option value="">Kraft wählen …</option>
              {angebot.filter(a => !b.kraefte.some(x => x.id === a.id)).map(a => <option key={a.id} value={a.id}>{a.name} ({a.stufe})</option>)}
            </Auswahl>
            <Knopf art="sekundaer" disabled={!wahl} onClick={() => { setze({ ...b, kraefte: [...b.kraefte, { id: wahl }] }); setWahl(''); }}>Hinzufügen</Knopf>
          </div>
        )}
        <Eingabe beschriftung="Ruhende Kräfte nach Verstoß gegen die Gebote (bis zur Buße)" type="number" min={0} value={b.ruht ?? 0}
          onChange={e => setze({ ...b, ruht: Math.max(0, parseInt(e.target.value, 10) || 0) || undefined })} className="w-24" />
        <p className="text-xs text-leise m-0">Regeln: {beseelungQuelle(k)}</p>
      </>}
    </div>
  );
};

const Werkstatt: React.FC<{ k: Katalog; start: Relikt; frei: number; schliessen: () => void }> = ({ k, start, frei, schliessen }) => {
  const { state, dispatch } = useCharacter();
  const hausregeln = useHausregeln();
  const bk = useMemo(() => reliktBaukasten(k), [k]);
  const bausteine = useMemo(() => reliktBausteine(k, bk), [k, bk]);
  const ausruestung = useMemo(() => alleAusruestung(k).filter(i => i.type !== 'alchemika'), [k]);
  const [r, setR] = useState<Relikt>(start);
  const [suche, setSuche] = useState('');
  const [basisSuche, setBasisSuche] = useState(start.basisName ?? '');
  const [alleZeigen, setAlleZeigen] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const basis: AusruestungsItem | null = useMemo(() => findeAusruestung(ausruestung, r.basisId), [ausruestung, r.basisId]);
  const heldengrad = useHeldengrad();
  const pruefung = pruefeRelikt(r, bausteine, bk, basis, { k, heldengrad });
  const warnungen = [...pruefung.warnungen, ...(r.punkte > frei ? [`Das Relikt hat ${r.punkte} Punkte, aus der Ressource Relikt sind noch ${frei} frei.`] : [])];
  const werte = reliktWerte(r, bausteine, basis);
  const widerstand = reliktWiderstand([r], [{ id: r.inventarId }], bausteine);
  const nachId = useMemo(() => new Map(bausteine.map(b => [b.id, b])), [bausteine]);

  const basisTreffer = useMemo(() => {
    const q = basisSuche.trim().toLowerCase();
    if (!q || q === (basis?.name ?? '').toLowerCase()) return [];
    return ausruestung.filter(i => i.name.toLowerCase().includes(q)).slice(0, 12);
  }, [basisSuche, ausruestung, basis]);

  const sichtbar = bausteine.filter(b => (alleZeigen || passtZu(b, r.art)) && (!suche.trim() || b.name.toLowerCase().includes(suche.trim().toLowerCase())));
  const gruppen = (bk?.typen ?? []).map(t => ({ typ: t, liste: sichtbar.filter(b => b.typ === t) })).filter(g => g.liste.length);

  const hinzu = (b: BausteinInfo) => setR(x => {
    const vorhanden = x.bausteine.findIndex(w => w.id === b.id);
    if (vorhanden >= 0 && !b.auswahl && !b.aenderungenWahl && !b.kostenNachGrad && !b.kostenJe)
      return { ...x, bausteine: x.bausteine.map((w, i) => (i === vorhanden ? { ...w, anzahl: (w.anzahl || 1) + 1 } : w)) };
    return { ...x, bausteine: [...x.bausteine, { id: b.id, name: b.name, anzahl: 1, ...(b.kostenNachGrad ? { grad: b.kostenNachGrad[0].grad } : {}), ...(b.kostenJe ? { stufe: 1 } : {}) }] };
  });
  const setzeW = (i: number, u: Partial<ReliktBaustein>) => setR(x => ({ ...x, bausteine: x.bausteine.map((w, j) => (j === i ? { ...w, ...u } : w)) }));
  const entferneW = (i: number) => setR(x => ({ ...x, bausteine: x.bausteine.filter((_, j) => j !== i) }));

  const speichern = () => {
    if (warnungen.length && regelverstoss(`Das Relikt verstößt gegen die Regeln: ${warnungen[0]}`)) return;
    const relikt: Relikt = { ...r, name: r.name.trim() || basis?.name || 'Relikt', basisName: basis?.name ?? (basisSuche.trim() || undefined) };
    const alt = (state.inventory ?? []).find(it => it.id === relikt.inventarId);
    dispatch({ type: 'RELIKT_SPEICHERN', payload: { relikt, inventar: reliktAlsInventar(relikt, bausteine, basis, alt, k) } });
    schliessen();
  };

  return (
    <Dialog titel="Relikt-Werkstatt" untertitel="Ressource Relikt (GRW S. 79)" onSchliessen={schliessen} breite="breit"
      fuss={<>
        <Knopf onClick={schliessen}>Abbrechen</Knopf>
        <Knopf art="primaer" onClick={speichern}>Relikt speichern</Knopf>
      </>}>
      <div className="grid md:grid-cols-2 gap-5">
        {/* links: das Relikt */}
        <div className="flex flex-col gap-3 min-w-0">
          <Eingabe beschriftung="Name" value={r.name} onChange={e => setR({ ...r, name: e.target.value })} placeholder="z. B. Großvaters Klinge" />
          <div className="relative">
            <Eingabe beschriftung="Grundgegenstand" value={basisSuche} onChange={e => setBasisSuche(e.target.value)} placeholder="Ausrüstung suchen (oder frei benennen)" />
            {basisTreffer.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 bg-flaeche border border-rahmen rounded-knopf max-h-56 overflow-y-auto m-0 p-0 list-none">
                {basisTreffer.map(i => (
                  <li key={i.id}>
                    <Knopf className="w-full text-left text-sm"
                      onClick={() => { setR({ ...r, basisId: i.id, art: artVon(i), name: r.name || i.name }); setBasisSuche(i.name); }}>
                      {i.name} <span className="text-leise">({i.category}, {i.source})</span>
                    </Knopf>
                  </li>
                ))}
              </ul>
            )}
            {basis && <p className="text-xs text-leise mt-1 mb-0">{basis.category} · {basis.source}{basis.page ? ` S. ${basis.page}` : ''}{(basis as { attributes?: string }).attributes ? ` · ${(basis as { attributes?: string }).attributes}` : ''}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Auswahl beschriftung="Art des Gegenstands" value={r.art} onChange={e => setR({ ...r, art: e.target.value })}>
              {Object.entries(GEGENSTANDSARTEN).map(([a, n]) => <option key={a} value={a}>{n}</option>)}
            </Auswahl>
            <Eingabe beschriftung="Punkte des Relikts" type="number" min={1} value={r.punkte} onChange={e => setR({ ...r, punkte: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
          </div>
          <p className="text-xs text-leise m-0">Noch frei aus der Ressource Relikt: {frei}</p>

          <div>
            <div className="text-xs text-leise mb-1.5">Bausteine</div>
            {r.bausteine.length === 0 && <p className="italic text-leise text-sm m-0">Noch keine Bausteine – rechts auswählen.</p>}
            <ul className="flex flex-col gap-2 m-0 p-0 list-none">
              {r.bausteine.map((w, i) => {
                const b = nachId.get(w.id);
                return (
                  <li key={`${w.id}-${i}`} className="border border-rahmen rounded-knopf p-2 bg-erhoeht flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm">{b?.name ?? w.name ?? w.id}</span>
                    {b?.kostenNachGrad && (
                      <Auswahl beschriftung="Zaubergrad" beschriftungVerborgen value={w.grad ?? 0} onChange={e => setzeW(i, { grad: Number(e.target.value), auswahl: '' })} className="w-28">
                        {b.kostenNachGrad.map(g => <option key={g.grad} value={g.grad}>Grad {g.grad}</option>)}
                      </Auswahl>
                    )}
                    {b?.kostenJe === 'stufe' && (
                      <Eingabe beschriftung="Stufe" beschriftungVerborgen type="number" min={1} value={w.stufe ?? 1} onChange={e => setzeW(i, { stufe: Math.max(1, parseInt(e.target.value, 10) || 1) })} className="w-20" />
                    )}
                    {b && <AuswahlFeld k={k} b={b} w={w} setze={u => setzeW(i, u)} />}
                    {b && b.maxAnzahl !== 1 && !b.auswahl && !b.aenderungenWahl && !b.kostenNachGrad && (
                      <span className="flex items-center gap-1">
                        <Knopf nurSymbol aria-label="weniger" onClick={() => (w.anzahl > 1 ? setzeW(i, { anzahl: w.anzahl - 1 }) : entferneW(i))}><Minus size={14} /></Knopf>
                        <span className="w-6 text-center tabular-nums">{w.anzahl}</span>
                        <Knopf nurSymbol aria-label="mehr" onClick={() => setzeW(i, { anzahl: w.anzahl + 1 })}><Plus size={14} /></Knopf>
                      </span>
                    )}
                    <Marke klein className="ml-auto">{b ? `${kostenVon(b, w)} P.` : '?'}</Marke>
                    <Knopf nurSymbol art="gefahr" aria-label={`${b?.name ?? w.id} entfernen`} onClick={() => entferneW(i)}><Trash2 size={14} /></Knopf>
                  </li>
                );
              })}
            </ul>
          </div>

          {(werte.zeilen.length > 0 || Object.keys(widerstand).length > 0) && (
            <div className="border border-rahmen rounded-knopf p-3 text-sm" data-testid="relikt-werte">
              <div className="text-xs text-leise mb-1">Werte des Relikts</div>
              {werte.zeilen.map((z, i) => <div key={i}>{z}</div>)}
              {Object.entries(widerstand).map(([w, b]) => <div key={w}>{w} +{b.summe}, solange im Besitz (aus mehreren Relikten zählt nur der höchste Bonus)</div>)}
            </div>
          )}

          <BeseelungFeld k={k} b={r.beseelung} setze={b => setR({ ...r, beseelung: b })} />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-leise">Notiz (Herkunft, legendäre Taten …)</span>
            <textarea value={r.notiz ?? ''} onChange={e => setR({ ...r, notiz: e.target.value })} rows={2}
              className="w-full box-border px-3.5 py-2 rounded-knopf border border-rahmen bg-erhoeht text-schrift font-text text-sm" />
          </label>

          <div className={`rounded-knopf p-3 border text-sm ${warnungen.length ? 'bg-schaden-grund border-schaden' : 'bg-unverletzt-grund border-unverletzt'}`} data-testid="relikt-pruefung">
            <div className="font-bold">{pruefung.verwendet} von {r.punkte} Punkten verwendet</div>
            {warnungen.map((t, i) => <div key={i} className="flex gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />{t}</div>)}
            {warnungen.length > 0 && <div className="text-xs text-leise mt-1">{hausregeln ? 'Hausregeln sind erlaubt: Speichern geht mit Warnung.' : 'So lässt sich das Relikt nicht speichern (Hausregeln: Einstellungen → Allgemein).'}</div>}
          </div>
        </div>

        {/* rechts: Bausteine aus den Regelpaketen */}
        <div className="flex flex-col gap-3 min-w-0">
          <Eingabe beschriftung="Bausteine suchen" value={suche} onChange={e => setSuche(e.target.value)} />
          <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={alleZeigen} onChange={e => setAlleZeigen(e.target.checked)} />auch unpassende zeigen</label>
          <Rollbereich beschriftung="Bausteine" className="max-h-[55vh] flex flex-col gap-3">
            {gruppen.map(g => (
              <div key={g.typ}>
                <Abschnittstitel als="h3" className="text-sm mb-1.5">{typName(k, g.typ)}</Abschnittstitel>
                <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
                  {g.liste.map(b => (
                    <li key={b.id} className="bg-erhoeht border border-rahmen rounded-knopf p-2">
                      <div className="flex items-center gap-2">
                        <Knopf nurSymbol art="sekundaer" onClick={() => hinzu(b)} aria-label={`${b.name} hinzufügen`}><Plus size={14} /></Knopf>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm">{b.name}</div>
                          <div className="text-xs text-leise">
                            {b.kostenNachGrad ? `${b.kostenNachGrad.map(g2 => g2.kosten).join('/')} P. je Grad` : `${b.kosten} P.${b.kostenJe ? ' je Stufe' : ''}`}
                            {b.maxAnzahl !== null ? `, max. ${b.maxAnzahl}×` : ''}{b.mindestPunkte ? `, ab ${b.mindestPunkte} P.` : ''} · {b.quelle}
                          </div>
                        </div>
                        <Knopf nurSymbol onClick={() => setInfo(info === b.id ? null : b.id)} aria-label={`${b.name}: Beschreibung`}><Info size={14} /></Knopf>
                      </div>
                      {info === b.id && <p className="mt-2 mb-0 whitespace-pre-line text-sm">{b.beschreibung || '—'}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!gruppen.length && <p className="italic text-leise text-sm m-0">Keine passenden Bausteine.</p>}
          </Rollbereich>
          <p className="text-xs text-leise m-0">Regeln: {(bk?.quellen ?? []).map(e => quelleKurz(k, e.quelle.paket, e.quelle.buch_seiten)).join(' · ')}</p>
        </div>
      </div>
    </Dialog>
  );
};

function quelleKurz(k: Katalog, paket: string, seiten?: number[]) {
  const kz = k.pakete[paket]?.kuerzel ?? paket.toUpperCase();
  return seiten?.length ? `${kz} S. ${seiten[0]}` : kz;
}

/** Relikt wachsen lassen: Anlass, Punkte, Beschreibung; neue Bausteine danach in der Werkstatt */
const WachsenDialog: React.FC<{ k: Katalog; r: Relikt; frei: number; schliessen: () => void; weiter: (r: Relikt) => void }> = ({ k, r, frei, schliessen, weiter }) => {
  const { state, dispatch } = useCharacter();
  const heldengrad = useHeldengrad();
  const R = wachsenRegeln(k)!;
  const [art, setArt] = useState(R.anlaesse[0]?.art ?? '');
  const [punkte, setPunkte] = useState(1);
  const [text, setText] = useState('');
  const eintrag = { id: generateId(), art, punkte, text, ...(art === 'heldengrad' ? { heldengrad } : {}), datum: new Date().toISOString().slice(0, 10) };
  const chronik = [...(r.chronik ?? []), eintrag];
  const anlass = R.anlaesse.find(a => a.art === art);
  const warnungen = [
    ...pruefeChronik(k, chronik, heldengrad),
    ...(r.punkte + punkte > frei ? [`Die Ressource Relikt hat nur ${frei} Punkte für dieses Relikt frei – erst die Ressource steigern.`] : []),
  ];
  const speichern = () => {
    if (warnungen.length && regelverstoss(`Das Wachsen verstößt gegen die Regeln: ${warnungen[0]}`)) return;
    const neu: Relikt = { ...r, punkte: r.punkte + punkte, chronik };
    const alt = (state.inventory ?? []).find(it => it.id === r.inventarId);
    const basis = findeAusruestung(alleAusruestung(k), neu.basisId);
    dispatch({ type: 'RELIKT_SPEICHERN', payload: { relikt: neu, inventar: reliktAlsInventar(neu, reliktBausteine(k, reliktBaukasten(k)), basis, alt, k) } });
    weiter(neu);
  };
  return (
    <Dialog titel={`${r.name} wächst`} untertitel={wachsenQuelle(k)} onSchliessen={schliessen} breite="mittel"
      fuss={<><Knopf onClick={schliessen}>Abbrechen</Knopf><Knopf art="primaer" onClick={speichern}>Wachsen und Bausteine wählen</Knopf></>}>
      <div className="flex flex-col gap-3">
        <Auswahl beschriftung="Anlass" value={art} onChange={e => setArt(e.target.value)}>
          {R.anlaesse.map(a => <option key={a.art} value={a.art}>{ANLASS_NAME[a.art] ?? a.art}</option>)}
        </Auswahl>
        <Eingabe beschriftung="Punkte" type="number" min={1} value={punkte} onChange={e => setPunkte(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-24" />
        <Eingabe beschriftung={art === 'legendaere_tat' ? 'Die legendäre Tat' : 'Beschreibung'} value={text} onChange={e => setText(e.target.value)} />
        {anlass?.bausteine === 'bezug_zur_tat' && <p className="text-sm text-leise m-0">Neue Bausteine nur mit Bezug zur Tat.</p>}
        <p className="text-sm text-leise m-0">Kosten: wie jede Steigerung der Ressource Relikt in Erfahrungspunkten (Ressourcen auf dem Charakterbogen).</p>
        {warnungen.length > 0 && (
          <div className="rounded-knopf p-3 border text-sm bg-schaden-grund border-schaden" data-testid="relikt-wachsen-pruefung">
            {warnungen.map((t, i) => <div key={i} className="flex gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />{t}</div>)}
          </div>
        )}
      </div>
    </Dialog>
  );
};

/** Relikte des Charakters im Inventar. Nur mit Regelpaketen, die einen Relikt-Baukasten festlegen (GRW). */
export const ReliktKarte: React.FC = () => {
  const { katalog: k } = useRegelwerk();
  const { state, dispatch } = useCharacter();
  const [bearbeiten, setBearbeiten] = useState<Relikt | null>(null);
  const [loeschen, setLoeschen] = useState<Relikt | null>(null);
  const [wachsen, setWachsen] = useState<Relikt | null>(null);
  const heldengrad = useHeldengrad();
  const bk = useMemo(() => reliktBaukasten(k), [k]);
  const bausteine = useMemo(() => reliktBausteine(k, bk), [k, bk]);
  if (!k || !bk) return null;

  const relikte = state.relikte ?? [];
  const ressource = ressourcePunkte(state.resourcesList);
  const vergeben = relikte.reduce((s, r) => s + (r.punkte || 0), 0);
  const nachId = new Map(bausteine.map(b => [b.id, b]));
  const neu = (): Relikt => ({ id: generateId(), name: '', punkte: Math.max(1, ressource - vergeben), art: 'nahkampfwaffe', bausteine: [], inventarId: generateId() });

  return (
    <Karte data-testid="relikte">
      <div className="flex items-center justify-between gap-3 mb-2">
        <Abschnittstitel als="h3" className="flex items-center gap-2"><Gem size={18} aria-hidden="true" />Relikte</Abschnittstitel>
        <Knopf art="sekundaer" onClick={() => setBearbeiten(neu())}><Plus size={14} aria-hidden="true" />Relikt bauen</Knopf>
      </div>
      <p className="text-sm text-leise m-0 mb-2">
        Ressource Relikt: {ressource} Punkte, davon in Relikten {vergeben}.
        {vergeben > ressource && <span className="block text-schrift">Mehr Punkte in Relikten als in der Ressource Relikt.</span>}
        {ressource === 0 && <span className="block">Ohne die Ressource Relikt kann ein Relikt nur mit Zustimmung der Spielleitung entstehen.</span>}
      </p>
      {relikte.length > 0 && (
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {relikte.map(r => {
            const p = pruefeRelikt(r, bausteine, bk, findeAusruestung(alleAusruestung(k), r.basisId), { k, heldengrad });
            const kraefte = r.beseelung ? aktiveKraefte(r.beseelung) : [];
            const imInventar = (state.inventory ?? []).some(it => it.id === r.inventarId);
            return (
              <li key={r.id} className="border border-rahmen rounded-knopf p-3 bg-erhoeht">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-schrift">{r.name}</span>
                  <span className="text-sm text-leise">{r.basisName ? `${r.basisName}, ` : ''}{p.verwendet}/{r.punkte} Punkte</span>
                  {p.warnungen.length > 0 && <Marke ton="schaden" klein title={p.warnungen.join('\n')}><AlertTriangle size={12} aria-hidden="true" />{p.warnungen.length} Regelverstöße</Marke>}
                  {!imInventar && <Marke ton="erschoepft" klein>nicht im Inventar – „Bearbeiten“ und speichern legt ihn neu an</Marke>}
                  <span className="ml-auto flex gap-1.5">
                    {wachsenRegeln(k) && <Knopf nurSymbol aria-label={`${r.name} wachsen lassen`} title="Relikt wachsen lassen" onClick={() => setWachsen(r)}><TrendingUp size={14} /></Knopf>}
                    <Knopf nurSymbol aria-label={`${r.name} bearbeiten`} onClick={() => setBearbeiten(r)}><Pencil size={14} /></Knopf>
                    <Knopf nurSymbol art="gefahr" aria-label={`${r.name} löschen`} onClick={() => setLoeschen(r)}><Trash2 size={14} /></Knopf>
                  </span>
                </div>
                {r.bausteine.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.bausteine.map((w, i) => {
                      const b = nachId.get(w.id);
                      const extra = auswahlAnzeige(b, w, k);
                      return <Marke key={i} klein>{b?.name ?? w.name ?? w.id}{w.anzahl > 1 ? ` ×${w.anzahl}` : ''}{extra ? ` (${extra})` : ''}</Marke>;
                    })}
                  </div>
                )}
                {r.beseelung && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-sm" data-testid="relikt-kraefte">
                    <span className="text-leise">Beseelt{r.beseelung.heiliger ? ` (${r.beseelung.heiliger})` : ''}:</span>
                    {kraefte.map(id => <Marke key={id} klein ton="magie">{k.get(id)?.name ?? id}</Marke>)}
                    {!kraefte.length && <span className="text-leise">noch keine Kraft freigeschaltet</span>}
                    {(r.beseelung.ruht ?? 0) > 0 && <Marke klein ton="erschoepft">{r.beseelung.ruht} ruhend</Marke>}
                  </div>
                )}
                {(r.chronik?.length ?? 0) > 0 && (
                  <ol className="mt-2 mb-0 pl-5 text-sm text-leise" data-testid="relikt-chronik">
                    {r.chronik!.map(c => <li key={c.id}>{c.datum ? `${c.datum}: ` : ''}{ANLASS_NAME[c.art] ?? c.art}{c.heldengrad ? ` ${c.heldengrad}` : ''}, +{c.punkte} {c.punkte === 1 ? 'Punkt' : 'Punkte'}{c.text ? ` – ${c.text}` : ''}</li>)}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {bearbeiten && <Werkstatt k={k} start={bearbeiten} frei={ressource - vergeben + ((state.relikte ?? []).find(x => x.id === bearbeiten.id)?.punkte ?? 0)} schliessen={() => setBearbeiten(null)} />}
      {wachsen && <WachsenDialog k={k} r={wachsen} frei={ressource - vergeben + wachsen.punkte} schliessen={() => setWachsen(null)} weiter={neu => { setWachsen(null); setBearbeiten(neu); }} />}
      {loeschen && <ConfirmDialog title="Relikt löschen" message={`Relikt „${loeschen.name}“ und seinen Inventareintrag löschen?`}
        onCancel={() => setLoeschen(null)} onConfirm={() => { dispatch({ type: 'RELIKT_LOESCHEN', payload: { id: loeschen.id } }); setLoeschen(null); }} />}
    </Karte>
  );
};

/**
 * Hält die Inventareinträge der Relikte bei den Regeln: Relikte, die vor einer Regeländerung gebaut wurden, bekommen
 * die Spielwerte aus ihren Bausteinen nachgetragen. Ohne Ansicht; einmal in der App eingehängt.
 */
export const ReliktAbgleich: React.FC = () => {
  const { katalog: k } = useRegelwerk();
  const { state, dispatch } = useCharacter();
  const bausteine = useMemo(() => reliktBausteine(k, reliktBaukasten(k)), [k]);
  useEffect(() => {
    if (!state.relikte?.length) return;
    const neu = veralteteReliktEintraege(state.relikte, state.inventory ?? [], bausteine, k);
    for (const inventar of neu) {
      const relikt = state.relikte.find(r => r.inventarId === inventar.id);
      if (relikt) dispatch({ type: 'RELIKT_SPEICHERN', payload: { relikt, inventar } });
    }
  }, [state.relikte, state.inventory, bausteine, k, dispatch]);
  return null;
};
