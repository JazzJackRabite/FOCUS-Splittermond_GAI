import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Wahlknopf } from '../../fundament';
import React, { useState, useMemo } from 'react';
import {
  History,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  Search,
  Copy,
  Check,
  Plus,
  Zap,
  Award,
  Shield,
  Layers,
  FileText,
  RotateCcw,
  Edit3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { AdvancementLogEntry } from '../../types';
import { XpAddModal } from '../modals/XpAddModal';
import { EditTotalXpModal } from '../modals/EditTotalXpModal';

interface AdvancementLogProps {
  entries: AdvancementLogEntry[];
  xpTotal: number;
  xpSpent: number;
  xpAvailable: number;
  onAddXpWithNote: (amount: number, note?: string) => void;
  onEditTotalXp?: (newTotal: number, note?: string) => void;
  onAddCustomLog: (entry: AdvancementLogEntry) => void;
  onDeleteLogEntry: (id: string) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onClearLog?: () => void;
}

type FilterCategory = 'all' | 'xp' | 'attr' | 'skill' | 'mastery' | 'spell' | 'strength_resource' | 'other';

export const AdvancementLog: React.FC<AdvancementLogProps> = ({
  entries,
  xpTotal,
  xpSpent,
  xpAvailable,
  onAddXpWithNote,
  onEditTotalXp,
  onAddCustomLog,
  onDeleteLogEntry,
  onUndo,
  canUndo = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [showXpModal, setShowXpModal] = useState(false);
  const [showEditTotalXpModal, setShowEditTotalXpModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDetail, setNoteDetail] = useState('');
  const [copied, setCopied] = useState(false);

  // Filtered log entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Category filter
      if (filterCategory === 'xp' && entry.category !== 'xp') return false;
      if (filterCategory === 'attr' && entry.category !== 'attr') return false;
      if (filterCategory === 'skill' && entry.category !== 'skill') return false;
      if (filterCategory === 'mastery' && entry.category !== 'mastery') return false;
      if (filterCategory === 'spell' && entry.category !== 'spell') return false;
      if (
        filterCategory === 'strength_resource' &&
        entry.category !== 'strength' &&
        entry.category !== 'resource'
      )
        return false;
      if (
        filterCategory === 'other' &&
        !['weakness', 'language', 'note'].includes(entry.category)
      )
        return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = entry.title.toLowerCase().includes(q);
        const detailMatch = entry.detail?.toLowerCase().includes(q) ?? false;
        const timeMatch = entry.timestamp.toLowerCase().includes(q);
        return titleMatch || detailMatch || timeMatch;
      }

      return true;
    });
  }, [entries, filterCategory, searchQuery]);

  const handleCopyLog = () => {
    if (entries.length === 0) return;
    const text = entries
      .map((e) => {
        const deltaStr =
          e.xpDelta !== undefined
            ? ` (${e.xpDelta > 0 ? `+${e.xpDelta}` : e.xpDelta} EP)`
            : '';
        const detailStr = e.detail ? ` - ${e.detail}` : '';
        return `[${e.timestamp}] ${e.title}${detailStr}${deltaStr}`;
      })
      .join('\n');

    navigator.clipboard.writeText(
      `--- SPLITTERMOND STEIGERUNGSPROTOKOLL ---\nGesamt: ${xpTotal} EP | Ausgegeben: ${xpSpent} EP | Verfügbar: ${xpAvailable} EP\n\n` +
        text,
    );
    setCopied(true);
    toast.success('Steigerungsprotokoll in die Zwischenablage kopiert!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddCustomNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    onAddCustomLog({
      id: 'adv-note-' + Date.now(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      category: 'note',
      title: noteTitle.trim(),
      detail: noteDetail.trim() || undefined,
    });

    setNoteTitle('');
    setNoteDetail('');
    setShowAddNoteModal(false);
    toast.success('Notiz zum Protokoll hinzugefügt.');
  };

  const getCategoryIcon = (category: AdvancementLogEntry['category']) => {
    switch (category) {
      case 'xp':
        return <Sparkles size={14} className="text-unverletzt" />;
      case 'attr':
        return <TrendingUp size={14} className="text-erschoepft" />;
      case 'skill':
        return <Award size={14} className="text-kanalisiert" />;
      case 'mastery':
        return <Shield size={14} className="text-kanalisiert" />;
      case 'spell':
        return <Zap size={14} className="text-gold" />;
      case 'strength':
      case 'resource':
        return <Layers size={14} className="text-temporaer" />;
      default:
        return <FileText size={14} className="text-leise" />;
    }
  };

  const getCategoryBadgeClass = (category: AdvancementLogEntry['category']) => {
    switch (category) {
      case 'xp':
        return 'bg-unverletzt-grund text-unverletzt border-unverletzt';
      case 'attr':
        return 'bg-erschoepft-grund text-erschoepft border-erschoepft';
      case 'skill':
        return 'bg-kanalisiert-grund text-schrift border-kanalisiert';
      case 'mastery':
        return 'bg-kanalisiert-grund text-schrift border-kanalisiert';
      case 'spell':
        return 'bg-erhoeht text-schrift border-rahmen';
      case 'strength':
      case 'resource':
        return 'bg-temporaer-grund text-temporaer border-temporaer';
      default:
        return 'bg-erhoeht text-schrift border-rahmen';
    }
  };

  const getCategoryLabel = (category: AdvancementLogEntry['category']) => {
    switch (category) {
      case 'xp':
        return 'EP-Buchung';
      case 'attr':
        return 'Attribut';
      case 'skill':
        return 'Fertigkeit';
      case 'mastery':
        return 'Meisterschaft';
      case 'spell':
        return 'Zauber';
      case 'strength':
        return 'Stärke';
      case 'resource':
        return 'Ressource';
      case 'language':
        return 'Sprache';
      case 'weakness':
        return 'Schwäche';
      case 'note':
        return 'Notiz';
      default:
        return 'Aktivität';
    }
  };

  return (
    <div
      id="advancement-protocol-section"
      className="bg-flaeche rounded-karte border border-rahmen p-5 text-schrift mt-6 no-print"
    >
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center border-b border-gold pb-3 mb-4 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-erhoeht rounded-knopf border border-rahmen text-schrift">
            <History size={20} className="text-schrift" />
          </div>
          <div>
            <h3 className="font-bold text-[17px] fantasy-font leading-tight text-gold-hell flex items-center gap-2">
              Protokoll: Steigerungen &amp; Erfahrungspunkte
              <span className="text-xs font-medium text-schrift bg-erhoeht px-2 py-0.5 rounded-full border border-rahmen">
                {entries.length} Einträge
              </span>
            </h3>
            <p className="text-xs text-leise">
              Lückenlose Aufzeichnung aller EP-Gutschriften, Attributs-, Fertigkeits- und Meisterschaftssteigerungen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onUndo && (
            <Knopf art="sekundaer" onClick={onUndo} disabled={!canUndo} className="text-xs font-bold"
              title={
                canUndo
                  ? 'Letztes Ereignis rückgängig machen (Berechnungen zurücksetzen & Protokolleintrag löschen)'
                  : 'Kein Ereignis zum Rückgängigmachen vorhanden'
              }><RotateCcw size={14} /> Rückgängig
            </Knopf>
          )}
          <Knopf art="sekundaer"
            onClick={() => setShowXpModal(true)}
            className="gap-1 text-xs"
            title="Erfahrungspunkte gutschreiben"
          >
            <Plus size={14} /> EP hinzufügen
          </Knopf>
          <Knopf art="sekundaer"
            onClick={() => setShowAddNoteModal(true)}
            className="gap-1 text-xs"
            title="Notiz ins Protokoll eintragen"
          >
            <FileText size={14} /> Notiz
          </Knopf>
          {entries.length > 0 && (
            <Knopf
              onClick={handleCopyLog}
              title="Protokoll in Zwischenablage kopieren"
            >
              {copied ? <Check size={16} className="text-unverletzt" /> : <Copy size={16} />}
            </Knopf>
          )}
          <Knopf
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Einklappen' : 'Ausklappen'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </Knopf>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-erhoeht p-3 rounded-knopf border border-rahmen text-xs">
            <div className="flex flex-col">
              <span className="text-leise font-medium">Gesamt-EP:</span>
              <span className="font-bold text-sm text-schrift">{xpTotal} EP</span>
            </div>
            <div className="flex flex-col">
              <span className="text-leise font-medium">Ausgegeben:</span>
              <span className="font-bold text-sm text-erschoepft">{xpSpent} EP</span>
            </div>
            <div className="flex flex-col">
              <span className="text-leise font-medium">Verfügbar:</span>
              <span
                className={`font-bold text-sm ${
                  xpAvailable < 0 ? 'text-schaden' : 'text-unverletzt'
                }`}
              >
                {xpAvailable} EP
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-leise font-medium">Aktivitäten:</span>
              <span className="font-bold text-sm text-schrift">{entries.length} Einträge</span>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col md:flex-row gap-2 justify-between items-stretch md:items-center">
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1 items-center">
              {(
                [
                  { id: 'all', label: 'Alle' },
                  { id: 'xp', label: 'EP' },
                  { id: 'skill', label: 'Fertigkeiten' },
                  { id: 'attr', label: 'Attribute' },
                  { id: 'mastery', label: 'Meisterschaften' },
                  { id: 'spell', label: 'Zauber' },
                  { id: 'strength_resource', label: 'Stärken/Ressourcen' },
                  { id: 'other', label: 'Sonstiges' },
                ] as const
              ).map((cat) => (
                <Wahlknopf gewaehlt={filterCategory === cat.id} mittig key={cat.id} onClick={() => setFilterCategory(cat.id)} className="text-xs rounded-full font-medium">
                  {cat.label}
                </Wahlknopf>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-leise"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Protokoll durchsuchen..."
                className="w-full pl-8 pr-3 py-1 bg-flaeche border border-rahmen rounded-knopf text-xs text-schrift placeholder-leise focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
          </div>

          {/* Entries list */}
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 px-4 bg-erhoeht rounded-knopf border border-dashed border-rahmen">
              <History size={32} className="mx-auto text-leise mb-2 opacity-60" />
              <p className="text-sm font-semibold text-leise">
                {entries.length === 0
                  ? 'Noch keine Steigerungen oder EP-Buchungen protokolliert.'
                  : 'Keine Einträge für die aktuelle Filterung gefunden.'}
              </p>
              <p className="text-xs text-leise max-w-md mx-auto mt-1">
                {entries.length === 0
                  ? 'Alle künftigen Steigerungen von Fertigkeiten, Attributen, Meisterschaften, Zaubern oder EP-Änderungen erscheinen automatisch hier.'
                  : 'Passe die Filter an oder setze den Suchbegriff zurück.'}
              </p>
              {entries.length === 0 && (
                <Knopf
                  onClick={() => setShowXpModal(true)}
                  className="mt-3 gap-1.5 text-xs"
                >
                  <Sparkles size={14} /> Erste EP gutschreiben
                </Knopf>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1.5 custom-scrollbar modal-body-scroll">
              {filteredEntries.map((entry) => {
                const isPositiveXp = (entry.xpDelta ?? 0) > 0;
                const isNegativeXp = (entry.xpDelta ?? 0) < 0;

                return (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-knopf bg-erhoeht border border-rahmen hover:bg-rahmen transition-colors"
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="mt-0.5 shrink-0">{getCategoryIcon(entry.category)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[11px] uppercase font-bold px-1.5 py-0.5 rounded-knopf border leading-none ${getCategoryBadgeClass(
                              entry.category,
                            )}`}
                          >
                            {getCategoryLabel(entry.category)}
                          </span>
                          <span className="text-xs font-bold text-schrift truncate">
                            {entry.title}
                          </span>
                          <span className="text-[11px] text-leise ml-auto shrink-0">
                            {entry.timestamp}
                          </span>
                        </div>
                        {entry.detail && (
                          <p className="text-xs text-leise mt-0.5 line-clamp-2">
                            {entry.detail}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {entry.xpDelta !== undefined && entry.xpDelta !== 0 && (
                        <div
                          className={`text-xs font-bold px-2 py-0.5 rounded-knopf border ${
                            isPositiveXp
                              ? 'bg-unverletzt-grund text-unverletzt border-unverletzt'
                              : isNegativeXp
                              ? 'bg-erschoepft-grund text-erschoepft border-erschoepft'
                              : 'bg-erhoeht text-schrift border-rahmen'
                          }`}
                        >
                          {isPositiveXp ? `+${entry.xpDelta}` : entry.xpDelta} EP
                        </div>
                      )}
                      <Knopf
                        onClick={() => {
                          onDeleteLogEntry(entry.id);
                          toast.success('Eintrag gelöscht');
                        }}
                        className="text-lg no-print shrink-0"
                        title="Löschen"
                      >
                        ×
                      </Knopf>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Protocol Action Bar */}
          <div className="pt-3 border-t border-rahmen flex flex-wrap items-center justify-between gap-3 bg-erhoeht p-2.5 rounded-knopf border border-rahmen no-print">
            <div className="text-xs text-leise flex items-center gap-2 sm:gap-3 flex-wrap">
              <span>
                Gesamt-EP: <strong className="text-schrift font-bold">{xpTotal} EP</strong>
              </span>
              <span className="text-schrift">•</span>
              <span>
                Ausgegeben: <strong className="text-erschoepft font-bold">{xpSpent} EP</strong>
              </span>
              <span className="text-schrift">•</span>
              <span>
                Verfügbar:{' '}
                <strong
                  className={`font-bold ${
                    xpAvailable < 0 ? 'text-schaden' : 'text-unverletzt'
                  }`}
                >
                  {xpAvailable} EP
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Knopf art="sekundaer"
                onClick={() => setShowEditTotalXpModal(true)}
                className="gap-1.5 text-xs"
                title="Gesamt-EP mit Kommentar und Protokolleintrag korrigieren"
              >
                <Edit3 size={14} className="text-gold" />
                <span>Gesamt EP editieren</span>
              </Knopf>
            </div>
          </div>
        </div>
      )}

      {/* Edit Total XP Modal */}
      {showEditTotalXpModal && (
        <EditTotalXpModal
          currentXpTotal={xpTotal}
          xpSpent={xpSpent}
          onClose={() => setShowEditTotalXpModal(false)}
          onSave={(newTotal, note) => {
            onEditTotalXp?.(newTotal, note);
            toast.success('Gesamt-EP erfolgreich korrigiert!');
          }}
        />
      )}

      {/* Quick XP Modal */}
      {showXpModal && (
        <XpAddModal
          onClose={() => setShowXpModal(false)}
          onAdd={(val, note) => {
            onAddXpWithNote(val, note);
            toast.success(`+${val} EP erfolgreich gutgeschrieben!`);
          }}
        />
      )}

      {/* Add Custom Note Modal */}
      {showAddNoteModal && (
        <Dialoghintergrund>
          <Dialogfenster id="advancement-log-note-dialog" breite="md" className="p-5 sm:p-6">
            <Dialogkopf symbol={<FileText className="w-5 h-5" />} titel="Notiz zum Protokoll hinzufügen" onSchliessen={() => setShowAddNoteModal(false)} />
            <form onSubmit={handleAddCustomNote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-leise mb-1 uppercase tracking-wide">
                  Titel / Ereignis
                </label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="z. B. Spielrunde vom 12.05., Lehrmeister besucht"
                  className="w-full bg-flaeche border border-rahmen rounded-knopf p-2.5 text-sm text-schrift focus:outline-none focus:ring-2 focus:ring-gold"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-leise mb-1 uppercase tracking-wide">
                  Details / Beschreibung (optional)
                </label>
                <textarea
                  value={noteDetail}
                  onChange={(e) => setNoteDetail(e.target.value)}
                  placeholder="Weitere Details zum Geschehen oder zu Absprachen mit der Spielleitung..."
                  rows={3}
                  className="w-full bg-flaeche border border-rahmen rounded-knopf p-2.5 text-sm text-schrift focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t border-rahmen">
                <Knopf
                  onClick={() => setShowAddNoteModal(false)}
                  className="text-sm"
                >
                  Abbrechen
                </Knopf>
                <Knopf art="primaer"
                  type="submit"
                  disabled={!noteTitle.trim()}
                  className="text-sm"
                >
                  Eintragen
                </Knopf>
              </div>
            </form>
          </Dialogfenster>
        </Dialoghintergrund>
      )}
    </div>
  );
};
