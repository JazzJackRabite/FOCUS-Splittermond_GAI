import React, { useRef, useState } from 'react';
import { Knopf } from '../../fundament';
import { BookOpen, CheckCircle2, Lock, Trash2, Upload, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRegelwerk } from '../../regelwerk/RegelwerkContext';

/** Einstellungen → Regelpakete: Grundregelwerk (eingebaut) und hochgeladene Grimoires (.grim) verwalten. */
export const RegelpaketeTab: React.FC = () => {
  const rw = useRegelwerk();
  const eingabe = useRef<HTMLInputElement>(null);
  const [laeuft, setLaeuft] = useState(false);

  const beiDateien = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateien = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!dateien.length) return;
    setLaeuft(true);
    const r = await rw.hochladen(dateien);
    setLaeuft(false);
    if (r.geladen.length) toast.success(`Geladen: ${r.geladen.join(', ')}`);
    for (const f of r.fehler) toast.error(f, { duration: 7000 });
  };

  if (rw.status === 'laedt') return <p className="text-sm text-leise p-4">Regelpakete werden geladen …</p>;
  if (rw.status === 'fehler' || rw.status === 'nicht_verfuegbar') {
    return <p className="text-sm text-schaden p-4">Regelpakete konnten nicht geladen werden{rw.fehler ? `: ${rw.fehler}` : '.'}</p>;
  }
  const basisInfo = rw.basis!.basis.info;
  const geladen = new Set([basisInfo.id, ...rw.grimoires.map(b => b.info.id)]);
  const bekannt = (rw.basis!.manifest.bekannte_pakete ?? []).filter(p => !geladen.has(p.id));
  const anzahl = rw.katalog ? Object.keys(rw.katalog.eintraege).length : 0;

  return (
    <div className="overflow-y-auto space-y-4 pr-1.5 flex-1 custom-scrollbar modal-body-scroll">
      <input ref={eingabe} type="file" accept=".grim" multiple className="hidden" onChange={beiDateien} data-testid="regelpakete-upload" />
      <div className="bg-flaeche p-4 rounded-karte border border-rahmen">
        <h3 className="font-bold text-sm text-gold-hell mb-1 flex items-center gap-2"><BookOpen size={18} className="text-gold" /><span>Geladene Regelwerke</span></h3>
        <p className="text-xs text-leise mb-3">{anzahl} Regeleinträge im Katalog.</p>
        <ul className="space-y-2">
          <li className="flex items-center justify-between gap-2 p-2 rounded-knopf border border-rahmen bg-flaeche">
            <span className="flex items-center gap-2 text-sm"><Lock size={14} className="text-gold" /><strong>{basisInfo.titel}</strong></span>
            <span className="text-xs text-leise">eingebaut · {rw.basis!.basis.paket.eintraege.length} Einträge</span>
          </li>
          {rw.grimoires.map(b => {
            const aus = rw.ausgelassen.find(a => a.id === b.info.id);
            return (
              <li key={b.info.id} className="flex items-center justify-between gap-2 p-2 rounded-knopf border border-rahmen bg-flaeche">
                <span className="flex items-center gap-2 text-sm">
                  {aus ? <AlertTriangle size={14} className="text-erschoepft" /> : <CheckCircle2 size={14} className="text-unverletzt" />}
                  <span><strong>{b.info.titel}</strong>{aus && <span className="block text-xs text-erschoepft">nicht aktiv: {aus.grund}</span>}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-leise">
                  {b.paket.eintraege.length} Einträge
                  <Knopf nurSymbol onClick={() => rw.entfernen(b.info.id)}  aria-label={`${b.info.titel} entfernen`} title="Entfernen">
                    <Trash2 size={15} />
                  </Knopf>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="bg-flaeche p-4 rounded-karte border border-rahmen">
        <h3 className="font-bold text-sm text-gold-hell mb-1 flex items-center gap-2"><Upload size={18} className="text-gold" /><span>Grimoires laden</span></h3>
        <p className="text-xs text-leise leading-relaxed mb-3">
          Wähle Grimoires aus (Dateien mit der Endung <code>.grim</code>, z. B. <code>magie.grim</code>, aus dem Ordner <code>Regelpakete/editor/grimoires</code>). Sie werden nur in diesem Browser gespeichert, nicht hochgeladen und nicht mit anderen geteilt.
          {!rw.dauerhaft && <strong className="block text-erschoepft mt-1">Dieser Browser erlaubt keine dauerhafte Speicherung; die Grimoires bleiben nur bis zum Neuladen.</strong>}
        </p>
        <Knopf art="sekundaer" disabled={laeuft} onClick={() => eingabe.current?.click()} className="text-sm font-bold">
          <Upload size={16} />{laeuft ? 'Lade …' : 'Grimoires auswählen'}
        </Knopf>
        {bekannt.length > 0 && (
          <p className="text-xs text-leise mt-3">Noch nicht geladen: {bekannt.map(p => p.kuerzel).join(', ')}</p>
        )}
        {rw.meldungen.map(m => <p key={m} className="text-xs text-erschoepft mt-2">{m}</p>)}
      </div>
    </div>
  );
};
