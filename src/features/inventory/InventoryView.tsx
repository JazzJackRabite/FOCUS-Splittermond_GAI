import { Dialogfenster, Dialoghintergrund, Wahlknopf, Knopf, Reiter } from '../../fundament';
import React, { useState, useMemo } from 'react';
import {
  Package,
  Coins,
  Weight,
  Plus,
  Minus,
  Trash2,
  Edit2,
  Search,
  Shield,
  Swords,
  FlaskConical,
  Compass,
  AlertTriangle,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useCharacter } from '../../context/CharacterContext';
import { alleAusruestung } from '../../regelwerk/ausruestung';
import { traglast } from '../../regelwerk/spielwirkungen';
import { useRegelwerk } from '../../regelwerk/RegelwerkContext';
import { SourceBadge } from '../../components/ui/SourceBadge';
import { generateId } from '../../utils/id';
import type { InventoryItem } from '../../types';
import { toast } from 'react-hot-toast';
import { ReliktKarte } from '../../components/relikte/ReliktKarte';
import { erschaffungsVermoegen, startvermoegen } from '../../regelwerk/grwListen';
import { bezahlen, geldInTelare, preisInTelare, telareText } from '../../regelwerk/geld';

/** Münzen des Geldbeutels: je ein Feld mit − / Wert / + nebeneinander */
const MUENZEN = [
  { feld: 'solare', kurz: 'S', einzahl: 'Solar', titel: 'Solare (Goldmünzen, 1 S = 100 L)', punkt: 'bg-erschoepft border-erschoepft', farbe: 'text-gold' },
  { feld: 'lunare', kurz: 'L', einzahl: 'Lunar', titel: 'Lunare (Silbermünzen, 1 L = 100 T)', punkt: 'bg-erhoeht border-rahmen', farbe: 'text-schrift' },
  { feld: 'telare', kurz: 'T', einzahl: 'Telar', titel: 'Telare (Kupfermünzen)', punkt: 'bg-gold-hell border-erschoepft', farbe: 'text-erschoepft' },
] as const;

export const InventoryView: React.FC = () => {
  const { state, dispatch, calc } = useCharacter();
  const { inventory = [], money = { solare: 0, lunare: 5, telare: 0 } } = state;
  const { loadCapacity, totalLoad } = calc;
  const { katalog } = useRegelwerk();
  // GRW-Liste plus Ausrüstung der hochgeladenen Regelpakete
  const ALL_EQUIPMENT = useMemo(() => alleAusruestung(katalog), [katalog]);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<'catalog' | 'custom'>('catalog');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all');
  const [catalogSourceFilter, setCatalogSourceFilter] = useState('all');
  // „Gegenstand kaufen“: Preis vom Geldbeutel abziehen (Standard: aus)
  const [kaufen, setKaufen] = useState(false);

  const catalogSources = useMemo(() => {
    const set = new Set<string>();
    ALL_EQUIPMENT.forEach((item: any) => {
      if (item.source) set.add(item.source);
    });
    if (set.size === 0) set.add('GRW');
    return Array.from(set);
  }, [ALL_EQUIPMENT]);

  // Helper to resolve source & page for any item
  const getItemSource = (item: { name: string; source?: string; page?: number | string }) => {
    if (item.source) {
      return {
        source: item.source,
        page: typeof item.page === 'number' ? item.page : item.page ? parseInt(String(item.page), 10) : undefined,
      };
    }
    const match = ALL_EQUIPMENT.find((e) => e.name.toLowerCase() === item.name.toLowerCase());
    return {
      source: match?.source || 'GRW',
      page: match?.page,
    };
  };

  // Custom item form
  const [customItem, setCustomItem] = useState({
    name: '',
    type: 'gear' as InventoryItem['type'],
    category: 'Ausrüstung',
    quantity: 1,
    weight: 1,
    price: '1 L',
    desc: '',
    attributes: '',
    source: 'Eigen',
    page: '',
  });

  // Edit item state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Filtered inventory items
  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.desc && item.desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.attributes && item.attributes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeCategory === 'all') return true;
      if (activeCategory === 'weapon') return item.type === 'weapon';
      if (activeCategory === 'armor') return item.type === 'armor' || item.type === 'shield';
      if (activeCategory === 'gear') return item.type === 'gear';
      if (activeCategory === 'alchemika') return item.type === 'alchemika';
      if (activeCategory === 'other') return item.type === 'other' || !item.type;
      return true;
    });
  }, [inventory, searchQuery, activeCategory]);

  // Catalog filtered items
  const filteredCatalog = useMemo(() => {
    // Treffer im Namen zuerst (Namensanfang vor Namensteil), Treffer nur in der Beschreibung danach
    const q = catalogSearch.trim().toLowerCase();
    const rang = (item: any) => {
      const n = String(item.name ?? '').toLowerCase();
      return !q ? 0 : n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2;
    };
    return ALL_EQUIPMENT.filter((item: any) => {
      const matchesSearch =
        item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(catalogSearch.toLowerCase())) ||
        (item.attributes && item.attributes.toLowerCase().includes(catalogSearch.toLowerCase())) ||
        (item.desc && item.desc.toLowerCase().includes(catalogSearch.toLowerCase()));

      if (!matchesSearch) return false;

      if (catalogCategoryFilter === 'weapon' && item.type !== 'weapon') return false;
      if (catalogCategoryFilter === 'armor' && item.type !== 'armor' && item.type !== 'shield') return false;
      if (catalogCategoryFilter === 'gear' && item.type !== 'gear') return false;
      if (catalogCategoryFilter === 'alchemika' && item.type !== 'alchemika') return false;

      if (catalogSourceFilter !== 'all' && (item.source || 'GRW') !== catalogSourceFilter) {
        return false;
      }

      return true;
    }).map((item: any, i: number) => ({ item, i, r: rang(item) }))
      .sort((a: any, b: any) => a.r - b.r || a.i - b.i)
      .map((x: any) => x.item);
  }, [ALL_EQUIPMENT, catalogSearch, catalogCategoryFilter, catalogSourceFilter]);

  // Handle Money change
  const handleModifyMoney = (field: 'solare' | 'lunare' | 'telare', delta: number) => {
    const current = money[field] ?? 0;
    const nextVal = Math.max(0, current + delta);
    dispatch({ type: 'SET_MONEY', payload: { [field]: nextVal } });
  };

  const handleSetMoney = (field: 'solare' | 'lunare' | 'telare', value: number) => {
    dispatch({ type: 'SET_MONEY', payload: { [field]: Math.max(0, value) } });
  };

  /**
   * Bezahlt den Preis, wenn „Gegenstand kaufen“ an ist. false: Geld reicht nicht, der Gegenstand wird nicht hinzugefügt.
   * Gibt den Zusatz für die Meldung zurück.
   */
  const kaufBezahlen = (name: string, preisText: string | undefined, menge: number): string | false => {
    if (!kaufen) return '';
    const einzel = preisInTelare(preisText);
    if (einzel === null) {
      toast(`'${name}' hat keinen lesbaren Preis – kein Geld abgezogen.`);
      return '';
    }
    const kosten = einzel * menge;
    const neu = bezahlen(money, kosten);
    if (!neu) {
      toast.error(`Nicht genug Geld für '${name}': ${telareText(kosten)} nötig, ${telareText(geldInTelare(money))} vorhanden.`);
      return false;
    }
    dispatch({ type: 'SET_MONEY', payload: neu });
    return ` (gekauft für ${telareText(kosten)})`;
  };

  // Handle Add Catalog item
  const handleAddCatalogItem = (item: any) => {
    const kauf = kaufBezahlen(item.name, item.price, 1);
    if (kauf === false) return;
    const rawLoad = typeof item.load === 'number' ? item.load : parseInt(String(item.load), 10) || 0;
    const newItem: InventoryItem = {
      id: generateId(),
      name: item.name,
      type: item.type || 'gear',
      category: item.category,
      quantity: 1,
      weight: rawLoad,
      price: item.price || '',
      desc: item.desc || '',
      equipped: false,
      source: item.source || 'GRW',
      page: typeof item.page === 'number' ? item.page : item.page ? parseInt(String(item.page), 10) : undefined,
      weaponSkill: item.skill,
      damage: item.damage,
      wgs: item.wgs,
      range: item.range,
      vtdBonus: item.vtdBonus,
      sr: item.sr,
      handicap: item.handicap,
      tickModifier: item.tickModifier,
      minStrength: item.minStrength,
      hardness: item.hardness,
      attributes: item.attributes,
    };
    dispatch({ type: 'ADD_INVENTORY_ITEM', payload: newItem });
    toast.success(`'${item.name}' zum Inventar hinzugefügt${kauf}!`);
  };

  // Handle Add Custom Item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItem.name.trim()) {
      toast.error('Bitte Namen eingeben.');
      return;
    }
    const newItem: InventoryItem = {
      id: generateId(),
      name: customItem.name.trim(),
      type: customItem.type,
      category: customItem.category.trim() || undefined,
      quantity: Math.max(1, customItem.quantity),
      weight: customItem.weight,
      price: customItem.price.trim() || undefined,
      desc: customItem.desc.trim() || undefined,
      attributes: customItem.attributes.trim() || undefined,
      source: customItem.source.trim() || 'Eigen',
      page: customItem.page.trim() ? parseInt(customItem.page, 10) || undefined : undefined,
      equipped: false,
    };
    const kauf = kaufBezahlen(newItem.name, newItem.price, newItem.quantity || 1);
    if (kauf === false) return;
    dispatch({ type: 'ADD_INVENTORY_ITEM', payload: newItem });
    toast.success(`'${newItem.name}' zum Inventar hinzugefügt${kauf}!`);
    setCustomItem({
      name: '',
      type: 'gear',
      category: 'Ausrüstung',
      quantity: 1,
      weight: 1,
      price: '1 L',
      desc: '',
      attributes: '',
      source: 'Eigen',
      page: '',
    });
    setShowAddModal(false);
  };

  // Handle Quantity adjustment
  const handleAdjustQuantity = (item: InventoryItem, delta: number) => {
    const newQty = (item.quantity || 1) + delta;
    if (newQty <= 0) {
      dispatch({ type: 'REMOVE_INVENTORY_ITEM', payload: { id: item.id } });
      toast.success(`'${item.name}' entfernt`);
    } else {
      dispatch({ type: 'UPDATE_INVENTORY_ITEM', payload: { id: item.id, updates: { quantity: newQty } } });
    }
  };

  // Overweight calculation
  const isOverweight = totalLoad > loadCapacity;
  const overweightAmount = Math.max(0, totalLoad - loadCapacity);

  return (
    <div className="p-4 md:p-6 space-y-6 w-full">
      {/* ── HEADER & VERMÖGEN ── */}
      <div className="bg-erhoeht text-schrift rounded-karte border border-gold p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-bold text-[17px] fantasy-font text-gold-hell tracking-wide flex items-center gap-2">
            <Package size={24} className="text-gold" />
            Inventar &amp; Ausrüstung
          </h2>
          <p className="text-xs text-schrift mt-1">
            Gegenstände, Reisegepäck, Vorräte und Splittermond-Geldbeutel
          </p>
        </div>

        {/* ── GELDBEUTEL (Solare, Lunare, Telare) ── */}
        <div className="bg-erhoeht border border-gold rounded-karte p-2.5 sm:p-3 flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-1.5 text-xs shrink-0 mr-0.5">
            <Coins size={16} className="text-gold" />
            <span className="font-bold uppercase tracking-wider text-schrift">Geld:</span>
          </div>

          {MUENZEN.map((m) => {
            const wert = money[m.feld] ?? 0;
            return (
              <div
                key={m.feld}
                className="flex items-center gap-1.5 bg-flaeche border border-gold rounded-knopf p-1"
                title={`${m.titel} · Shift+Klick auf − / +: 10er-Schritte`}
              >
                <Knopf nurSymbol onClick={(e) => handleModifyMoney(m.feld, e.shiftKey ? -10 : -1)}
                  disabled={wert <= 0} title={`−1 ${m.einzahl} (Shift+Klick: −10)`} aria-label={`1 ${m.einzahl} weniger`}>
                  <Minus size={14} aria-hidden="true" />
                </Knopf>
                <span className="flex items-center gap-1 select-none shrink-0 text-xs font-bold">
                  <span className={`w-3 h-3 rounded-full border inline-block shrink-0 ${m.punkt}`} />
                  <span className={m.farbe}>{m.kurz}</span>
                </span>
                <input
                  type="number"
                  min={0}
                  value={wert}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleSetMoney(m.feld, parseInt(e.target.value, 10) || 0)}
                  className="w-9 text-center tabular-nums font-bold text-sm bg-transparent text-schrift focus:outline-none p-0"
                  aria-label={m.titel}
                />
                <Knopf nurSymbol onClick={(e) => handleModifyMoney(m.feld, e.shiftKey ? 10 : 1)}
                  title={`+1 ${m.einzahl} (Shift+Klick: +10)`} aria-label={`1 ${m.einzahl} mehr`}>
                  <Plus size={14} aria-hidden="true" />
                </Knopf>
              </div>
            );
          })}
        </div>
      </div>

      {(() => {
        const stufe = erschaffungsVermoegen(state.resourcesList ?? []);
        const start = startvermoegen(stufe);
        if (!start) return null;
        const gleich = (['solare', 'lunare', 'telare'] as const).every((f) => (money[f] ?? 0) === start.geld[f]);
        return (
          <div data-testid="startvermoegen" className="text-xs text-leise flex flex-wrap items-center gap-2 -mt-2">
            <span>Startvermögen bei Vermögen {stufe}: <strong className="text-schrift">{start.text}</strong>{start.seite ? ` (GRW S. ${start.seite})` : ''}</span>
            {/* nur solange der Geldbeutel noch auf dem Grundwert (5 Lunare) oder leer ist: kein Überschreiben von Spielgeld */}
            {!gleich && ((money.solare ?? 0) === 0 && (money.telare ?? 0) === 0 && [0, 5].includes(money.lunare ?? 0)) && (
              <Knopf onClick={() => { dispatch({ type: 'SET_MONEY', payload: start.geld }); toast.success(`Geld auf Startvermögen gesetzt: ${start.text}`); }}
                className="text-xs" title="Setzt den Geldbeutel auf das Startvermögen laut Vermögenstabelle">
                Als Geld übernehmen
              </Knopf>
            )}
          </div>
        );
      })()}

      {/* ── TRAGKRAFT & LAST (BELASTUNG) ── */}
      <div className="bg-flaeche rounded-karte border border-rahmen p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Weight size={18} className="text-schrift" />
            <h3 className="font-bold text-base text-gold-hell">Tragkraft &amp; Last</h3>
            <span className="text-xs text-leise font-medium">
              (Tragkraft = {traglast()?.attribut ?? ''} × {traglast()?.lastJePunkt ?? ''} = {loadCapacity})
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Checkbox: Tragelast ignorieren */}
            <label
              className="flex items-center gap-1.5 cursor-pointer text-xs select-none bg-erhoeht hover:bg-rahmen text-schrift border border-gold px-2.5 py-1 rounded-knopf transition-colors"
              title="Aktivieren, um ohne die optionale Traglast-Regel zu spielen (Überlastung erzeugt keine Behinderung)"
            >
              <input
                type="checkbox"
                checked={!!state.ignoreEncumbrance}
                onChange={(e) => dispatch({ type: 'SET_IGNORE_ENCUMBRANCE', payload: e.target.checked })}
                className="w-3.5 h-3.5 rounded-knopf border-gold text-schrift focus:ring-gold cursor-pointer accent-schrift"
              />
              <span className="font-bold">Tragelast ignorieren</span>
            </label>

            <span
              className={`tabular-nums font-bold text-sm ${
                isOverweight && !state.ignoreEncumbrance ? 'text-schaden' : 'text-schrift'
              }`}
            >
              Gesamtlast: {totalLoad} / {loadCapacity} Last
            </span>
            {isOverweight && !state.ignoreEncumbrance && (
              <span className="bg-schaden-grund text-schaden border border-schaden text-xs px-2 py-0.5 rounded-knopf font-bold flex items-center gap-1">
                <AlertTriangle size={12} />
                +{overweightAmount} Behinderung
              </span>
            )}
            {isOverweight && state.ignoreEncumbrance && (
              <span
                className="bg-seite text-leise border border-rahmen text-xs px-2 py-0.5 rounded-knopf font-medium flex items-center gap-1"
                title="Tragelast ist ignoriert (Optionalregel inaktiv) – kein Behinderungs-Malus"
              >
                Last ignoriert
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-erhoeht h-2.5 rounded-full overflow-hidden border border-rahmen">
          <div
            className={`h-full transition-all duration-300 ${
              state.ignoreEncumbrance
                ? 'bg-erhoeht'
                : isOverweight
                  ? 'bg-schaden-grund'
                  : totalLoad > loadCapacity * 0.8
                    ? 'bg-erschoepft'
                    : 'bg-unverletzt-grund'
            }`}
            style={{ width: `${Math.min(100, (totalLoad / Math.max(1, loadCapacity)) * 100)}%` }}
          />
        </div>
      </div>

      {/* ── CONTROLS: CATEGORIES & SEARCH & ADD BUTTON ── */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1 bg-seite p-1 rounded-karte border border-rahmen">
          {[
            { id: 'all', label: `Alle (${inventory.length})` },
            { id: 'weapon', label: 'Waffen' },
            { id: 'armor', label: 'Rüstungen & Schilde' },
            { id: 'gear', label: 'Ausrüstung' },
            { id: 'alchemika', label: 'Alchemika' },
            { id: 'other', label: 'Sonstiges' },
          ].map((cat) => (
            <Wahlknopf gewaehlt={activeCategory === cat.id} mittig key={cat.id} onClick={() => setActiveCategory(cat.id)} className="text-xs font-bold">
              {cat.label}
            </Wahlknopf>
          ))}
        </div>

        {/* Search & Add button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search size={14} className="absolute left-2.5 top-2.5 text-leise" />
            <input
              type="text"
              placeholder="Inventar durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-flaeche border border-rahmen rounded-knopf pl-8 pr-3 py-1.5 text-xs text-schrift"
            />
          </div>

          <Knopf art="sekundaer" onClick={() => { setKaufen(false); setShowAddModal(true); }} className="text-xs font-bold shrink-0 whitespace-nowrap">
            <Plus size={14} className="text-gold" />
            <span>Gegenstand</span>
          </Knopf>
        </div>
      </div>

      {/* ── ITEMS LIST ── */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="bg-flaeche rounded-karte border border-rahmen p-8 text-center text-leise italic">
            <Package size={32} className="mx-auto text-leise mb-2 opacity-60" />
            {inventory.length === 0
              ? 'Das Inventar ist noch leer. Klicke oben auf "Gegenstand", um Ausrüstung aus dem offiziellen Splittermond-Katalog hinzuzufügen.'
              : 'Keine Gegenstände gefunden, die den Filtern entsprechen.'}
          </div>
        ) : (
          filteredItems.map((item) => {
            const itemSource = getItemSource(item);
            return (
              <div
                key={item.id}
                className={`rounded-karte border p-3.5 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                  item.equipped
                    ? 'bg-erhoeht border-gold ring-1 ring-rahmen'
                    : 'bg-flaeche border-rahmen'
                }`}
              >
                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-schrift truncate">{item.name}</span>
                    {item.equipped && (
                      <span className="text-[11px] bg-unverletzt-grund text-unverletzt font-bold px-2 py-0.5 rounded-knopf border border-unverletzt">
                        Ausgerüstet
                      </span>
                    )}
                    {item.category && (
                      <span className="text-[11px] bg-erhoeht text-schrift font-medium px-2 py-0.5 rounded-knopf border border-rahmen">
                        {item.category}
                      </span>
                    )}
                    {item.price && (
                      <span className="text-[11px] text-leise font-medium">
                        Preis: {item.price}
                      </span>
                    )}
                    <SourceBadge
                      source={itemSource.source}
                      page={itemSource.page}
                      tooltipData={{
                        title: item.name,
                        description: item.desc || item.attributes,
                        stats: [
                          ...(item.type === 'weapon'
                            ? [
                                { label: 'Fertigkeit', value: item.weaponSkill || '—' },
                                { label: 'Schaden', value: item.damage || '—' },
                                { label: 'WGS', value: String(item.wgs || '—') },
                                ...(item.range ? [{ label: 'Reichweite', value: item.range }] : []),
                              ]
                            : []),
                          ...(item.type === 'armor' || item.type === 'shield'
                            ? [
                                ...(item.sr !== undefined && item.sr > 0 ? [{ label: 'SR', value: item.sr }] : []),
                                ...(item.vtdBonus !== undefined && item.vtdBonus > 0 ? [{ label: 'VTD', value: `+${item.vtdBonus}` }] : []),
                                ...(item.handicap !== undefined && item.handicap > 0 ? [{ label: 'Behinderung', value: item.handicap }] : []),
                                ...(item.tickModifier !== undefined && item.tickModifier > 0 ? [{ label: 'Tick-Zuschlag', value: `+${item.tickModifier}` }] : []),
                              ]
                            : []),
                          ...(item.weight !== undefined ? [{ label: 'Last', value: item.weight }] : []),
                          ...(item.hardness !== undefined ? [{ label: 'Härte', value: item.hardness }] : []),
                          ...(item.price ? [{ label: 'Preis', value: item.price }] : []),
                        ],
                      }}
                    />
                  </div>

                  {/* Sub details: load, damage, armor */}
                  <div className="flex items-center gap-2.5 text-xs text-leise mt-1.5 flex-wrap">
                    <span className="tabular-nums text-leise bg-seite border border-rahmen px-2 py-0.5 rounded-knopf text-[11px]">
                      Last: <strong className="text-schrift">{(item.weight ?? 0) * (item.quantity ?? 1)}</strong>{' '}
                      {(item.quantity ?? 1) > 1 && `(${item.weight} je Stk.)`}
                    </span>
                    {item.hardness !== undefined && (
                      <span className="tabular-nums text-leise bg-seite border border-rahmen px-2 py-0.5 rounded-knopf text-[11px]">
                        Härte: <strong className="text-schrift">{item.hardness}</strong>
                      </span>
                    )}
                    {item.type === 'weapon' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.weaponSkill && (
                          <span className="bg-erhoeht text-schrift border border-rahmen px-2 py-0.5 rounded-knopf text-[11px] font-semibold">
                            {item.weaponSkill}
                          </span>
                        )}
                        {item.damage && (
                          <span className="bg-schaden-grund text-schrift border border-schaden px-2 py-0.5 rounded-knopf text-[11px] font-semibold">
                            Schaden: <strong className="text-schaden">{item.damage}</strong>
                          </span>
                        )}
                        {item.wgs && (
                          <span className="bg-seite text-schrift border border-rahmen px-2 py-0.5 rounded-knopf text-[11px]">
                            WGS: <strong>{item.wgs} Ticks</strong>
                          </span>
                        )}
                        {item.range && (
                          <span className="bg-seite text-schrift border border-rahmen px-2 py-0.5 rounded-knopf text-[11px]">
                            Reichweite: <strong>{item.range}</strong>
                          </span>
                        )}
                      </div>
                    )}
                    {(item.type === 'armor' || item.type === 'shield') && (
                      <div className="flex items-center gap-1.5 flex-wrap tabular-nums">
                        {item.sr !== undefined && item.sr > 0 && (
                          <span className="bg-erschoepft-grund text-erschoepft border border-gold-hell px-2 py-0.5 rounded-knopf text-[11px]">
                            SR: <strong className="text-erschoepft">{item.sr}</strong>
                          </span>
                        )}
                        {item.vtdBonus !== undefined && item.vtdBonus > 0 && (
                          <span className="bg-unverletzt-grund text-unverletzt border border-unverletzt px-2 py-0.5 rounded-knopf text-[11px]">
                            VTD: <strong className="text-unverletzt">+{item.vtdBonus}</strong>
                          </span>
                        )}
                        {item.handicap !== undefined && item.handicap > 0 && (
                          <span className="bg-seite text-schrift border border-rahmen px-2 py-0.5 rounded-knopf text-[11px]">
                            Behinderung: <strong>{item.handicap}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Attributes & Description */}
                  {(item.attributes || item.desc) && (
                    <p className="text-xs text-leise mt-1 italic line-clamp-2">
                      {item.attributes && <span className="font-semibold text-schrift not-italic mr-1">{item.attributes} · </span>}
                      {item.desc}
                    </p>
                  )}
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Quantity Controls */}
                  <div className="flex items-center bg-seite rounded-knopf border border-rahmen px-1 py-0.5">
                    <Knopf nurSymbol onClick={() => handleAdjustQuantity(item, -1)} title="Menge -1" aria-label="Menge -1">
                      -
                    </Knopf>
                    <span className="w-8 text-center tabular-nums font-bold text-xs text-schrift">
                      {item.quantity ?? 1}x
                    </span>
                    <Knopf nurSymbol onClick={() => handleAdjustQuantity(item, 1)} title="Menge +1" aria-label="Menge +1">
                      +
                    </Knopf>
                  </div>

                  {/* Equip toggle if weapon or armor */}
                  {(item.type === 'weapon' || item.type === 'armor' || item.type === 'shield') && (
                    <Wahlknopf gewaehlt={!!item.equipped} mittig onClick={() => dispatch({ type: 'TOGGLE_EQUIP_ITEM', payload: { id: item.id } })} className="text-xs font-bold">
                      {item.equipped ? 'Ablegen' : 'Ausrüsten'}
                    </Wahlknopf>
                  )}

                  {/* Edit button */}
                  <Knopf nurSymbol onClick={() => setEditingItem({ ...item })} title="Gegenstand bearbeiten (inkl. Quelle & Seite)" aria-label="Gegenstand bearbeiten (inkl. Quelle & Seite)">
                    <Edit2 size={16} />
                  </Knopf>

                  {/* Delete button */}
                  <Knopf art="gefahr" nurSymbol onClick={() => {
                      dispatch({ type: 'REMOVE_INVENTORY_ITEM', payload: { id: item.id } });
                      toast.success(`'${item.name}' entfernt`);
                    }} title="Gegenstand löschen" aria-label="Gegenstand löschen">
                    <Trash2 size={16} />
                  </Knopf>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── RELIKTE (Ressource Relikt; Baukasten aus den Regelpaketen) ── */}
      <ReliktKarte />

      {/* ── MODAL: GEGENSTAND HINZUFÜGEN ── */}
      {showAddModal && (
        <Dialoghintergrund>
          <Dialogfenster breite="2xl" className="p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-gold pb-2">
              <h3 className="font-bold text-[17px] text-gold-hell fantasy-font flex items-center gap-2">
                <Package size={20} className="text-gold" />
                Gegenstand hinzufügen
              </h3>
              <Knopf nurSymbol onClick={() => setShowAddModal(false)}>
                ✕
              </Knopf>
            </div>

            {/* Modal Tabs */}
            <div role="tablist" className="flex gap-2 border-b border-rahmen">
              <Reiter gewaehlt={modalTab === 'catalog'} className="px-4 text-xs" onClick={() => setModalTab('catalog')}>
                Splittermond Katalog ({ALL_EQUIPMENT.length} Gegenstände)
              </Reiter>
              <Reiter gewaehlt={modalTab === 'custom'} className="px-4 text-xs" onClick={() => setModalTab('custom')}>
                Eigener Gegenstand
              </Reiter>
            </div>

            {/* Kaufen: Preis vom Geldbeutel abziehen */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="flex items-center gap-2 min-h-11 cursor-pointer select-none font-semibold text-schrift">
                <input
                  type="checkbox"
                  checked={kaufen}
                  onChange={(e) => setKaufen(e.target.checked)}
                  className="w-4 h-4 rounded-knopf border-rahmen focus:ring-0 cursor-pointer"
                  data-testid="gegenstand-kaufen"
                />
                <span>Gegenstand kaufen (Preis vom Geld abziehen)</span>
              </label>
              <span className="flex items-center gap-1.5 text-leise tabular-nums" data-testid="geld-im-dialog">
                <Coins size={14} className="text-gold" aria-hidden />
                Geld: <strong className="text-schrift">{telareText(geldInTelare(money))}</strong>
              </span>
            </div>

            {/* Tab 1: Catalog */}
            {modalTab === 'catalog' && (
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                {/* Search & Category Filter */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-2.5 top-2.5 text-leise" />
                    <input
                      type="text"
                      placeholder="Im Katalog suchen..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full bg-erhoeht border border-rahmen rounded-knopf pl-8 pr-3 py-1.5 text-xs text-schrift placeholder:text-leise focus:outline-none focus:border-gold"
                    />
                  </div>
                  <select
                    value={catalogCategoryFilter}
                    onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                    className="bg-erhoeht border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift focus:outline-none focus:border-gold"
                  >
                    <option value="all">Alle Kategorien</option>
                    <option value="weapon">Waffen</option>
                    <option value="armor">Rüstungen &amp; Schilde</option>
                    <option value="gear">Ausrüstung &amp; Reisebedarf</option>
                    <option value="alchemika">Alchemika &amp; Tränke</option>
                  </select>
                  <select
                    value={catalogSourceFilter}
                    onChange={(e) => setCatalogSourceFilter(e.target.value)}
                    className="bg-erhoeht border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift focus:outline-none focus:border-gold"
                    title="Nach Quelle / Regelwerk filtern"
                  >
                    <option value="all">Alle Quellen ({catalogSources.length})</option>
                    {catalogSources.map((s) => (
                      <option key={s} value={s}>
                        Quelle: {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Catalog items list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
                  {filteredCatalog.slice(0, 50).map((catItem: any, idx: number) => (
                    <div
                      key={catItem.id || `${catItem.name}-${idx}`}
                      className="bg-erhoeht rounded-knopf p-2.5 border border-rahmen hover:border-gold flex justify-between items-center gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-schrift">{catItem.name}</span>
                          <span className="bg-erhoeht text-schrift px-1.5 py-0.5 rounded-knopf text-[11px] font-semibold">
                            {catItem.category || catItem.type}
                          </span>
                          {catItem.price && (
                            <span className="text-leise font-medium">Preis: {catItem.price}</span>
                          )}
                          {catItem.load !== undefined && (
                            <span className="text-leise">Last: {catItem.load}</span>
                          )}
                          <SourceBadge
                            source={catItem.source || 'GRW'}
                            page={catItem.page}
                            tooltipData={{
                              title: catItem.name,
                              description: catItem.desc || catItem.attributes,
                              stats: [
                                ...(catItem.type === 'weapon'
                                  ? [
                                      { label: 'Fertigkeit', value: catItem.skill || '—' },
                                      { label: 'Schaden', value: catItem.damage || '—' },
                                      { label: 'WGS', value: String(catItem.wgs || '—') },
                                      ...(catItem.range ? [{ label: 'Reichweite', value: catItem.range }] : []),
                                    ]
                                  : []),
                                ...(catItem.type === 'armor' || catItem.type === 'shield'
                                  ? [
                                      ...(catItem.sr !== undefined && catItem.sr > 0 ? [{ label: 'SR', value: catItem.sr }] : []),
                                      ...(catItem.vtdBonus !== undefined && catItem.vtdBonus > 0 ? [{ label: 'VTD', value: `+${catItem.vtdBonus}` }] : []),
                                      ...(catItem.handicap !== undefined && catItem.handicap > 0 ? [{ label: 'Behinderung', value: catItem.handicap }] : []),
                                      ...(catItem.tickModifier !== undefined && catItem.tickModifier > 0 ? [{ label: 'Tick-Zuschlag', value: `+${catItem.tickModifier}` }] : []),
                                    ]
                                  : []),
                                ...(catItem.load !== undefined ? [{ label: 'Last', value: catItem.load }] : []),
                                ...(catItem.price ? [{ label: 'Preis', value: catItem.price }] : []),
                              ],
                            }}
                          />
                        </div>
                        {catItem.desc && (
                          <p className="text-[11px] text-leise mt-1 line-clamp-1 italic">{catItem.desc}</p>
                        )}
                      </div>
                      <Knopf onClick={() => handleAddCatalogItem(catItem)} className="font-bold text-xs shrink-0">
                        {kaufen ? '+ Kaufen' : '+ Hinzufügen'}
                      </Knopf>
                    </div>
                  ))}
                  {filteredCatalog.length > 50 && (
                    <p className="text-[11px] text-leise italic text-center py-1">
                      {filteredCatalog.length - 50} weitere Treffer – Suche oder Filter verfeinern.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Custom Item Form */}
            {modalTab === 'custom' && (
              <form onSubmit={handleAddCustomItem} className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2">
                    <label className="font-bold text-schrift block mb-1">Gegenstandsname *</label>
                    <input
                      type="text"
                      placeholder="z.B. Kletterseil, Seidengewand, Heiltrank"
                      value={customItem.name}
                      onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-3 py-1.5 text-xs text-schrift"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-schrift block mb-1">Typ</label>
                    <select
                      value={customItem.type}
                      onChange={(e) =>
                        setCustomItem({ ...customItem, type: e.target.value as InventoryItem['type'] })
                      }
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                    >
                      <option value="gear">Ausrüstung</option>
                      <option value="weapon">Waffe</option>
                      <option value="armor">Rüstung</option>
                      <option value="shield">Schild</option>
                      <option value="alchemika">Alchemika / Trank</option>
                      <option value="other">Sonstiges</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-schrift block mb-1">Kategorie / Notiz</label>
                    <input
                      type="text"
                      placeholder="z.B. Kleidung, Werkzeug"
                      value={customItem.category}
                      onChange={(e) => setCustomItem({ ...customItem, category: e.target.value })}
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-schrift block mb-1">Anzahl</label>
                    <input
                      type="number"
                      min={1}
                      value={customItem.quantity}
                      onChange={(e) =>
                        setCustomItem({ ...customItem, quantity: parseInt(e.target.value, 10) || 1 })
                      }
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-schrift block mb-1">Last (pro Stück)</label>
                    <input
                      type="number"
                      min={0}
                      value={customItem.weight}
                      onChange={(e) =>
                        setCustomItem({ ...customItem, weight: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-schrift block mb-1">Preis</label>
                    <input
                      type="text"
                      placeholder="z.B. 2 L 50 T"
                      value={customItem.price}
                      onChange={(e) => setCustomItem({ ...customItem, price: e.target.value })}
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-schrift block mb-1">Merkmale (optional)</label>
                    <input
                      type="text"
                      placeholder="z.B. Wasserdicht, Haltbar"
                      value={customItem.attributes}
                      onChange={(e) => setCustomItem({ ...customItem, attributes: e.target.value })}
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-schrift block mb-1">Quelle (Quellenvermerk)</label>
                    <input
                      type="text"
                      placeholder="z.B. GRW, Mondstahlklingen, Eigen"
                      list="custom-item-sources"
                      value={customItem.source}
                      onChange={(e) => setCustomItem({ ...customItem, source: e.target.value })}
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                    />
                    <datalist id="custom-item-sources">
                      <option value="GRW" />
                      <option value="Mondstahlklingen" />
                      <option value="Bestien & Ungeheuer" />
                      <option value="Götter & Dämonen" />
                      <option value="Eigen" />
                    </datalist>
                  </div>

                  <div>
                    <label className="font-bold text-schrift block mb-1">Seite (optional)</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="z.B. 183"
                      value={customItem.page}
                      onChange={(e) => setCustomItem({ ...customItem, page: e.target.value })}
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="font-bold text-schrift block mb-1">Beschreibung</label>
                    <textarea
                      placeholder="Details oder besondere Wirkung..."
                      value={customItem.desc}
                      onChange={(e) => setCustomItem({ ...customItem, desc: e.target.value })}
                      rows={2}
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-3 py-1.5 text-xs text-schrift"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-rahmen">
                  <Knopf onClick={() => setShowAddModal(false)} className="text-xs font-bold">
                    Abbrechen
                  </Knopf>
                  <Knopf art="primaer" type="submit" className="font-bold text-xs">
                    {kaufen ? 'Gegenstand kaufen' : 'Gegenstand erstellen'}
                  </Knopf>
                </div>
              </form>
            )}
          </Dialogfenster>
        </Dialoghintergrund>
      )}

      {/* ── MODAL: GEGENSTAND BEARBEITEN (INKL. QUELLENVERMERK) ── */}
      {editingItem && (
        <Dialoghintergrund>
          <Dialogfenster breite="xl" className="p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-gold pb-2">
              <h3 className="font-bold text-[17px] text-gold-hell fantasy-font flex items-center gap-2">
                <Edit2 size={18} className="text-gold" />
                Gegenstand bearbeiten: {editingItem.name}
              </h3>
              <Knopf nurSymbol onClick={() => setEditingItem(null)}>
                ✕
              </Knopf>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingItem) return;
                const pageNum = editingItem.page !== undefined && editingItem.page !== null && String(editingItem.page).trim() !== ''
                  ? parseInt(String(editingItem.page), 10) || undefined
                  : undefined;
                dispatch({
                  type: 'UPDATE_INVENTORY_ITEM',
                  payload: {
                    id: editingItem.id,
                    updates: {
                      name: editingItem.name.trim(),
                      type: editingItem.type,
                      category: editingItem.category?.trim() || undefined,
                      quantity: Math.max(1, editingItem.quantity || 1),
                      weight: typeof editingItem.weight === 'number' ? editingItem.weight : parseInt(String(editingItem.weight), 10) || 0,
                      price: editingItem.price?.trim() || undefined,
                      attributes: editingItem.attributes?.trim() || undefined,
                      desc: editingItem.desc?.trim() || undefined,
                      source: editingItem.source?.trim() || 'Eigen',
                      page: pageNum,
                      weaponSkill: editingItem.weaponSkill?.trim() || undefined,
                      damage: editingItem.damage?.trim() || undefined,
                      wgs: editingItem.wgs !== undefined && editingItem.wgs !== null && String(editingItem.wgs).trim() !== ''
                        ? (isNaN(Number(editingItem.wgs)) ? editingItem.wgs : Number(editingItem.wgs))
                        : undefined,
                      range: editingItem.range?.trim() || undefined,
                      sr: editingItem.sr !== undefined && editingItem.sr !== null && String(editingItem.sr).trim() !== ''
                        ? parseInt(String(editingItem.sr), 10) || 0
                        : undefined,
                      vtdBonus: editingItem.vtdBonus !== undefined && editingItem.vtdBonus !== null && String(editingItem.vtdBonus).trim() !== ''
                        ? parseInt(String(editingItem.vtdBonus), 10) || 0
                        : undefined,
                      handicap: editingItem.handicap !== undefined && editingItem.handicap !== null && String(editingItem.handicap).trim() !== ''
                        ? parseInt(String(editingItem.handicap), 10) || 0
                        : undefined,
                      tickModifier: editingItem.tickModifier !== undefined && editingItem.tickModifier !== null && String(editingItem.tickModifier).trim() !== ''
                        ? parseInt(String(editingItem.tickModifier), 10) || 0
                        : undefined,
                      hardness: editingItem.hardness,
                    },
                  },
                });
                toast.success(`'${editingItem.name}' aktualisiert!`);
                setEditingItem(null);
              }}
              className="space-y-3 overflow-y-auto pr-1 flex-1"
            >
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="font-bold text-schrift block mb-1">Gegenstandsname *</label>
                  <input
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full bg-flaeche border border-rahmen rounded-knopf px-3 py-1.5 text-xs text-schrift"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-schrift block mb-1">Typ</label>
                  <select
                    value={editingItem.type || 'gear'}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, type: e.target.value as InventoryItem['type'] })
                    }
                    className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                  >
                    <option value="gear">Ausrüstung</option>
                    <option value="weapon">Waffe</option>
                    <option value="armor">Rüstung</option>
                    <option value="shield">Schild</option>
                    <option value="alchemika">Alchemika / Trank</option>
                    <option value="other">Sonstiges</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-schrift block mb-1">Kategorie</label>
                  <input
                    type="text"
                    value={editingItem.category || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                  />
                </div>

                <div>
                  <label className="font-bold text-schrift block mb-1">Anzahl</label>
                  <input
                    type="number"
                    min={1}
                    value={editingItem.quantity || 1}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, quantity: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                  />
                </div>

                <div>
                  <label className="font-bold text-schrift block mb-1">Last (pro Stück)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingItem.weight ?? 0}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, weight: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                  />
                </div>

                <div>
                  <label className="font-bold text-schrift block mb-1" htmlFor="bearbeiten-haerte">Härte</label>
                  <input
                    id="bearbeiten-haerte"
                    type="number"
                    min={0}
                    value={editingItem.hardness ?? ''}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, hardness: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0) })
                    }
                    className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                  />
                </div>

                <div>
                  <label className="font-bold text-schrift block mb-1">Preis</label>
                  <input
                    type="text"
                    value={editingItem.price || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                    className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                  />
                </div>

                <div>
                  <label className="font-bold text-schrift block mb-1">Merkmale</label>
                  <input
                    type="text"
                    value={editingItem.attributes || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, attributes: e.target.value })}
                    className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift"
                  />
                </div>

                {/* Quellenvermerk */}
                <div className="bg-erhoeht p-2.5 rounded-knopf border border-rahmen col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-schrift block mb-1">
                      Quelle (Quellenvermerk) *
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. GRW, Mondstahlklingen, Eigen"
                      list="edit-sources-datalist"
                      value={editingItem.source || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, source: e.target.value })}
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift font-medium"
                    />
                    <datalist id="edit-sources-datalist">
                      <option value="GRW" />
                      <option value="Mondstahlklingen" />
                      <option value="Bestien & Ungeheuer" />
                      <option value="Götter & Dämonen" />
                      <option value="Eigen" />
                    </datalist>
                  </div>

                  <div>
                    <label className="font-bold text-schrift block mb-1">
                      Seite (optional)
                    </label>
                    <input
                      type="number"
                      min={1}
                      placeholder="z.B. 183"
                      value={editingItem.page ?? ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          page: e.target.value ? parseInt(e.target.value, 10) || undefined : undefined,
                        })
                      }
                      className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift font-medium"
                    />
                  </div>
                </div>

                {editingItem.type === 'weapon' && (
                  <div className="col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-rahmen p-2 rounded-knopf border border-rahmen">
                    <div>
                      <label className="font-bold text-schrift block mb-1">Fertigkeit</label>
                      <input
                        type="text"
                        value={editingItem.weaponSkill || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, weaponSkill: e.target.value })}
                        className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-schrift block mb-1">Schaden</label>
                      <input
                        type="text"
                        value={editingItem.damage || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, damage: e.target.value })}
                        className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-schrift block mb-1">WGS</label>
                      <input
                        type="text"
                        value={editingItem.wgs ?? ''}
                        onChange={(e) => setEditingItem({ ...editingItem, wgs: e.target.value })}
                        className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-schrift block mb-1">Reichweite</label>
                      <input
                        type="text"
                        value={editingItem.range || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, range: e.target.value })}
                        className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                )}

                {(editingItem.type === 'armor' || editingItem.type === 'shield') && (
                  <div className="col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-rahmen p-2 rounded-knopf border border-rahmen">
                    <div>
                      <label className="font-bold text-schrift block mb-1">SR</label>
                      <input
                        type="number"
                        value={editingItem.sr ?? 0}
                        onChange={(e) => setEditingItem({ ...editingItem, sr: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-schrift block mb-1">VTD</label>
                      <input
                        type="number"
                        value={editingItem.vtdBonus ?? 0}
                        onChange={(e) => setEditingItem({ ...editingItem, vtdBonus: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-schrift block mb-1">Behinderung</label>
                      <input
                        type="number"
                        value={editingItem.handicap ?? 0}
                        onChange={(e) => setEditingItem({ ...editingItem, handicap: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-schrift block mb-1">Tick-Zuschlag</label>
                      <input
                        type="number"
                        value={editingItem.tickModifier ?? 0}
                        onChange={(e) => setEditingItem({ ...editingItem, tickModifier: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="font-bold text-schrift block mb-1">Beschreibung</label>
                  <textarea
                    rows={2}
                    value={editingItem.desc || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, desc: e.target.value })}
                    className="w-full bg-flaeche border border-rahmen rounded-knopf px-3 py-1.5 text-xs text-schrift"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-rahmen">
                <Knopf onClick={() => setEditingItem(null)} className="text-xs font-bold">
                  Abbrechen
                </Knopf>
                <Knopf art="primaer" type="submit" className="font-bold text-xs">
                  Änderungen speichern
                </Knopf>
              </div>
            </form>
          </Dialogfenster>
        </Dialoghintergrund>
      )}
    </div>
  );
};
