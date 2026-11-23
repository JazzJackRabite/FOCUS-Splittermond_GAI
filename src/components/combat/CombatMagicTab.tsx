import { mitZustaenden, zustandsErklaerung, zustandswerte } from '../../regelwerk/zustandswerte';
import { Dialog, Dialogfenster, Dialoghintergrund, Dialogkopf, Knopf, Wahlknopf } from '../../fundament';
import React, { useState, useMemo } from 'react';
import {
  Swords,
  Shield,
  Sparkles,
  Wand2,
  Plus,
  Trash2,
  Check,
  Search,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import DiceIcon from '../ui/DiceIcon';
import { useCharacter } from '../../context/CharacterContext';
import { usePlaySession } from '../../context/PlaySessionContext';
import { PlaySharedVitals } from '../play/PlaySharedVitals';
import { SourceBadge } from '../ui/SourceBadge';

import type { WeaponItem, ArmorItem, ShieldItem } from '../../types/regeldaten';
import { alleAusruestung, waffenAttribute, waffenlosImPaket } from '../../regelwerk/ausruestung';
import { useRegelwerk } from '../../regelwerk/RegelwerkContext';
import { bausteineAktiv, reliktZauber } from '../../regelwerk/relikte';
import { getMasteryDetails } from '../../utils/gameResourceManager';
import {
  getFullSpellInfo,
  parseFocusCost,
  getActiveSpellModifiers,
  zauberHoechstbonus,
  getWeaponEnchantments,
} from '../../utils/magicRules';
import { generateId } from '../../utils/id';
import type { InventoryItem, Spell } from '../../types';
import { toast } from 'react-hot-toast';
import { grwFertigkeitsKategorien } from '../../regelwerk/grwListen';

// Helper to resolve authentic source & page for any item
const getItemSource = (item: { name: string; source?: string; page?: number | string }) => {
  if (item.source) {
    return {
      source: item.source,
      page: typeof item.page === 'number' ? item.page : item.page ? parseInt(String(item.page), 10) : undefined,
    };
  }
  const match = alleAusruestung().find((e) => e.name.toLowerCase() === item.name.toLowerCase());
  return {
    source: match?.source || 'GRW',
    page: match?.page,
  };
};

interface QuickSpellCardProps {
  spell: Spell;
  session: ReturnType<typeof usePlaySession>;
}

const QuickSpellCard: React.FC<QuickSpellCardProps> = ({ spell, session }) => {
  const info = useMemo(() => getFullSpellInfo(spell), [spell]);

  const stats = useMemo(() => {
    return [
      { label: 'Schule', value: info.school },
      { label: 'Grad', value: info.grade },
      { label: 'Fokus', value: String(info.cost) },
      ...(info.castTime && info.castTime !== '—' ? [{ label: 'Dauer', value: info.castTime }] : []),
      ...(info.range && info.range !== '—' ? [{ label: 'Reichw.', value: info.range }] : []),
      ...(info.duration && info.duration !== '—' ? [{ label: 'Wirkung', value: info.duration, colSpan: true }] : []),
    ].filter((stat) => stat.value);
  }, [info]);

  // Ein Klick auf die Zeile öffnet das Zaubern – gleich groß wie die Knöpfe der Fertigkeiten und Magieschulen
  return (
    <Knopf
      onClick={() => session.handleOpenCastSpell(spell)}
      className="w-full justify-between text-sm group"
      title={`${spell.name} (Grad ${spell.grade}) zaubern`}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <Wand2 size={14} className="text-gold shrink-0" />
        <span className="truncate group-hover:text-gold-hell">{spell.name}</span>
        <span className="text-[11px] text-leise shrink-0">(Grad {spell.grade})</span>
      </span>
      <span className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
        <SourceBadge
          source={info.source || 'GRW'}
          page={info.page}
          tooltipData={{ title: info.name, description: info.description, stats }}
        />
      </span>
    </Knopf>
  );
};

export const CombatMagicTab: React.FC = () => {
  const { state, dispatch, calc } = useCharacter();
  const { katalog } = useRegelwerk();
  // Zauberverankerungen in Relikten im Besitz (GRW S. 255: Probe auf Arkane Kunde, Relikt in der Hand)
  const zauberAusRelikten = useMemo(
    () => reliktZauber(katalog, state.relikte ?? [], state.inventory ?? [], bausteineAktiv(katalog)),
    [katalog, state.relikte, state.inventory],
  );
  // Waffen, Rüstungen und Schilde aus GRW und hochgeladenen Regelpaketen
  const ausruestung = useMemo(() => alleAusruestung(katalog), [katalog]);
  const WEAPONS_DATA = useMemo(() => ausruestung.filter((i): i is WeaponItem => i.type === 'weapon'), [ausruestung]);
  const ARMORS_DATA = useMemo(() => ausruestung.filter((i): i is ArmorItem => i.type === 'armor'), [ausruestung]);
  const SHIELDS_DATA = useMemo(() => ausruestung.filter((i): i is ShieldItem => i.type === 'shield'), [ausruestung]);
  const session = usePlaySession();
  // Waffenloser Angriff aus dem GRW-Paket (Schaden, WGS, Merkmale, Attribute; GRW S. 183)
  const waffenlos = useMemo(() => waffenlosImPaket(katalog), [katalog]);
  const waffenlosSchaden = waffenlos?.damage || '';

  const { spellsList, masteries, inventory = [] } = state;
  const {
    getSkillTotal,
    getSkillValue,
    getAttackValue,
    currentAttributes,
    derived,
    armorSR,
    gearVtdBonus,
    currentWoundPenalty,
  } = calc;

  const waffenlosAT = getAttackValue('Handgemenge', waffenlos?.kampfAttribute ?? []);
  const channeledSpells = state.playState?.channeledSpells ?? [];
  const hoechstbonusZauber = zauberHoechstbonus(calc);
  const zw = useMemo(() => zustandswerte(state.playState?.conditions ?? []), [state.playState?.conditions]);
  const activeSpellMods = useMemo(() => getActiveSpellModifiers(channeledSpells, hoechstbonusZauber), [channeledSpells, hoechstbonusZauber]);

  // Modals for adding weapon and armor
  const [showAddWeaponModal, setShowAddWeaponModal] = useState(false);
  const [showAddArmorModal, setShowAddArmorModal] = useState(false);

  // Weapon catalog search & custom form state
  const [weaponSearch, setWeaponSearch] = useState('');
  const [weaponCategoryFilter, setWeaponCategoryFilter] = useState('Alle');
  const [customWeapon, setCustomWeapon] = useState({
    name: '',
    weaponSkill: 'Klingenwaffen',
    damage: '1W6+2',
    wgs: '7',
    range: '',
    attributes: '',
    weight: 1,
    source: 'Eigen',
    page: '',
  });

  // Armor catalog search & custom form state
  const [armorSearch, setArmorSearch] = useState('');
  const [armorTypeFilter, setArmorTypeFilter] = useState<'all' | 'armor' | 'shield'>('all');
  const [customArmor, setCustomArmor] = useState({
    name: '',
    type: 'armor' as 'armor' | 'shield',
    sr: 2,
    vtdBonus: 0,
    handicap: 1,
    tickModifier: 1,
    minStrength: 2,
    weight: 2,
    attributes: '',
    source: 'Eigen',
    page: '',
  });

  // Split inventory into weapons and armors
  const weapons = useMemo(() => {
    return inventory.filter((item) => item.type === 'weapon');
  }, [inventory]);

  const armorsAndShields = useMemo(() => {
    return inventory.filter((item) => item.type === 'armor' || item.type === 'shield');
  }, [inventory]);

  // Catalog filtered lists
  const filteredCatalogWeapons = useMemo(() => {
    return WEAPONS_DATA.filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(weaponSearch.toLowerCase()) ||
        w.skill.toLowerCase().includes(weaponSearch.toLowerCase()) ||
        w.attributes.toLowerCase().includes(weaponSearch.toLowerCase());
      const matchesCat =
        weaponCategoryFilter === 'Alle' ||
        w.category === weaponCategoryFilter ||
        w.skill === weaponCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [WEAPONS_DATA, weaponSearch, weaponCategoryFilter]);

  const filteredCatalogArmors = useMemo(() => {
    const list: Array<ArmorItem | ShieldItem> = [
      ...(armorTypeFilter !== 'shield' ? ARMORS_DATA : []),
      ...(armorTypeFilter !== 'armor' ? SHIELDS_DATA : []),
    ];
    return list.filter((a) => {
      return (
        a.name.toLowerCase().includes(armorSearch.toLowerCase()) ||
        a.attributes.toLowerCase().includes(armorSearch.toLowerCase())
      );
    });
  }, [ARMORS_DATA, SHIELDS_DATA, armorSearch, armorTypeFilter]);

  // Handle adding catalog weapon
  const handleAddCatalogWeapon = (w: WeaponItem, equipImmediately = true) => {
    const newItem: InventoryItem = {
      id: generateId(),
      name: w.name,
      type: 'weapon',
      category: w.category,
      quantity: 1,
      weight: typeof w.load === 'number' ? w.load : parseInt(String(w.load), 10) || 1,
      price: w.price,
      desc: w.desc,
      equipped: equipImmediately,
      source: w.source || 'GRW',
      page: w.page,
      weaponSkill: w.skill,
      damage: w.damage,
      wgs: w.wgs,
      range: w.range || undefined,
      attributes: w.attributes,
      hardness: w.hardness,
    };
    dispatch({ type: 'ADD_INVENTORY_ITEM', payload: newItem });
    toast.success(`Waffe '${w.name}' hinzugefügt!`);
    setShowAddWeaponModal(false);
  };

  // Handle adding custom weapon
  const handleAddCustomWeapon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customWeapon.name.trim()) {
      toast.error('Bitte einen Namen für die Waffe angeben.');
      return;
    }
    const newItem: InventoryItem = {
      id: generateId(),
      name: customWeapon.name.trim(),
      type: 'weapon',
      category: customWeapon.range ? 'Fernkampf' : 'Nahkampf',
      quantity: 1,
      weight: customWeapon.weight,
      equipped: true,
      source: customWeapon.source.trim() || 'Eigen',
      page: customWeapon.page ? parseInt(customWeapon.page, 10) || undefined : undefined,
      weaponSkill: customWeapon.weaponSkill,
      damage: customWeapon.damage.trim() || '1W6',
      wgs: customWeapon.wgs.trim() || '6',
      range: customWeapon.range.trim() || undefined,
      attributes: customWeapon.attributes.trim() || undefined,
    };
    dispatch({ type: 'ADD_INVENTORY_ITEM', payload: newItem });
    toast.success(`Eigene Waffe '${newItem.name}' hinzugefügt!`);
    setShowAddWeaponModal(false);
  };

  // Handle adding catalog armor
  const handleAddCatalogArmor = (a: ArmorItem | ShieldItem, equipImmediately = true) => {
    const isArmor = a.type === 'armor';
    const armorItem = a as ArmorItem;
    const newItem: InventoryItem = {
      id: generateId(),
      name: a.name,
      type: a.type,
      category: a.category,
      quantity: 1,
      weight: typeof a.load === 'number' ? a.load : parseInt(String(a.load), 10) || 1,
      price: a.price,
      desc: a.desc,
      equipped: equipImmediately,
      source: a.source || 'GRW',
      page: a.page,
      vtdBonus: a.vtdBonus,
      sr: isArmor ? armorItem.sr : undefined,
      handicap: a.handicap,
      tickModifier: a.tickModifier,
      minStrength: isArmor ? armorItem.minStrength : undefined,
      hardness: a.hardness,
      attributes: a.attributes,
    };
    dispatch({ type: 'ADD_INVENTORY_ITEM', payload: newItem });
    toast.success(`${a.type === 'shield' ? 'Schild' : 'Rüstung'} '${a.name}' angelegt!`);
    setShowAddArmorModal(false);
  };

  // Handle adding custom armor
  const handleAddCustomArmor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customArmor.name.trim()) {
      toast.error('Bitte einen Namen für die Rüstung angeben.');
      return;
    }
    const newItem: InventoryItem = {
      id: generateId(),
      name: customArmor.name.trim(),
      type: customArmor.type,
      quantity: 1,
      weight: customArmor.weight,
      equipped: true,
      source: customArmor.source.trim() || 'Eigen',
      page: customArmor.page ? parseInt(customArmor.page, 10) || undefined : undefined,
      sr: customArmor.type === 'armor' ? customArmor.sr : 0,
      vtdBonus: customArmor.vtdBonus,
      handicap: customArmor.handicap,
      tickModifier: customArmor.tickModifier,
      minStrength: customArmor.type === 'armor' ? customArmor.minStrength : undefined,
      attributes: customArmor.attributes.trim() || undefined,
    };
    dispatch({ type: 'ADD_INVENTORY_ITEM', payload: newItem });
    toast.success(`Eigene ${newItem.type === 'shield' ? 'Schild' : 'Rüstung'} '${newItem.name}' angelegt!`);
    setShowAddArmorModal(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full">
      {/* ── SHARED VITALS: Live-Status, LP, Fokus, Abgeleitete Werte, Splitterpunkte ── */}
      <PlaySharedVitals />

      {/* ── KAMPF & MAGIE GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── LINKE SPALTE: NEU Waffen & Angriffe, NEU Rüstungen, Kampf ── */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="space-y-6">
          {/* ── NEU: WAFFEN UND ANGRIFFE ── */}
          <div className="bg-flaeche rounded-karte border border-rahmen p-5">
            <div className="flex items-center justify-between gap-3 border-b border-gold pb-3 mb-4">
              <h3 className="font-bold text-[17px] fantasy-font text-gold-hell flex items-center gap-2">
                <Swords size={20} className="text-gold shrink-0" />
                <span>Waffen &amp; Angriffe</span>
              </h3>
              <Knopf art="sekundaer"
                onClick={() => setShowAddWeaponModal(true)}
                className="text-xs gap-1.5 shrink-0 whitespace-nowrap active:scale-95"
              >
                <Plus size={14} className="text-gold" />
                <span>Waffe</span>
              </Knopf>
            </div>

            {/* List of Weapons */}
            <div className="space-y-3">
              {/* Natural / Unarmed Attack (Always available in Splittermond) */}
              <div className="bg-erhoeht rounded-karte border border-rahmen p-4 hover:border-gold transition-all space-y-3">
                {/* Header Row: Title & Badges */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-schrift">Waffenlos</span>
                    <span className="text-xs bg-erhoeht text-schrift font-semibold px-2 py-0.5 rounded-knopf border border-rahmen">
                      Handgemenge (FW {getSkillValue('Handgemenge')})
                    </span>
                    <span className="text-[11px] text-leise font-medium bg-seite px-1.5 py-0.5 rounded-knopf border border-rahmen">
                      Nahkampf
                    </span>
                  </div>
                  <span className="text-[11px] text-leise italic">
                    Stets verfügbar
                  </span>
                </div>

                {/* Combat Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-flaeche rounded-knopf border border-rahmen p-2 text-center">
                    <span className="text-[11px] uppercase font-bold text-leise block leading-tight">AT</span>
                    <span className="text-base font-bold tabular-nums text-schrift mt-0.5 block">
                      {waffenlosAT}
                      {currentWoundPenalty !== 0 && (
                        <span className="text-schaden text-xs font-normal"> ({currentWoundPenalty})</span>
                      )}
                    </span>
                  </div>
                  <div className="bg-flaeche rounded-knopf border border-rahmen p-2 text-center">
                    <span className="text-[11px] uppercase font-bold text-leise block leading-tight">Schaden</span>
                    <span className="text-base font-bold tabular-nums text-schaden mt-0.5 block">
                      {waffenlosSchaden} <span className="text-xs text-leise font-normal">({waffenlos?.attributes ?? ''})</span>
                    </span>
                  </div>
                  <div className="bg-flaeche rounded-knopf border border-rahmen p-2 text-center">
                    <span className="text-[11px] uppercase font-bold text-leise block leading-tight">WGS</span>
                    <span className="text-base font-bold tabular-nums text-schrift mt-0.5 block">
                      {waffenlos?.wgs ?? ''} <span className="text-xs text-leise font-normal">Ticks</span>
                    </span>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-rahmen">
                  <Knopf art="sekundaer"
                    onClick={() => session.openRollForWeapon('Waffenlos', 'Handgemenge', 0, 15, { id: 'waffenlos', damage: waffenlosSchaden, wgs: Number(waffenlos?.wgs) || undefined, attributes: waffenlos?.attributes ?? '' })}
                    className="w-full text-xs gap-1.5 active:scale-95"
                    title="Angriffsprobe & Manöver öffnen (2W10 + AT vs. VTD)"
                  >
                    <DiceIcon size={15} />
                    <span>Angriff (Handgemenge)</span>
                  </Knopf>
                  <Knopf
                    onClick={() => session.handleRollDiceFormula(getWeaponEnchantments({ id: 'waffenlos', name: 'Waffenlos', damage: waffenlosSchaden }, channeledSpells).damageRollFormula, 'Waffenloser Schaden')}
                    className="damage-roll-btn w-full text-xs gap-1.5 active:scale-95"
                    title={`Schaden würfeln (${waffenlosSchaden})`}
                  >
                    <span className="text-xs"></span>
                    <span className="tracking-wide text-schrift font-extrabold">{waffenlosSchaden} Schaden</span>
                  </Knopf>
                </div>
              </div>

              {/* Character Weapons from Inventory */}
              {weapons.map((w) => {
                const skillName = w.weaponSkill || 'Klingenwaffen';
                // Angriffswert: Fertigkeitspunkte + Attribute der Waffe (GRW S. 181)
                const skillVal = getAttackValue(skillName, waffenAttribute(w, katalog));
                const itemSrc = getItemSource(w);
                const enchantments = getWeaponEnchantments(w, channeledSpells);
                const effectiveAT = skillVal + enchantments.atBonus;
                return (
                  <div
                    key={w.id}
                    className={`rounded-karte border p-4 transition-all space-y-3 ${
                      w.equipped
                        ? enchantments.hasEnchantment
                          ? 'bg-erhoeht border-gold ring-2 ring-gold '
                          : 'bg-erhoeht border-gold ring-1 ring-rahmen'
                        : 'bg-flaeche border-rahmen opacity-85 hover:opacity-100'
                    }`}
                  >
                    {/* Header Row: Title, Badges & Secondary Controls */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="font-bold text-base text-schrift truncate">{w.name}</span>
                          <span className="text-xs bg-erhoeht text-schrift font-semibold px-2 py-0.5 rounded-knopf border border-rahmen">
                            {skillName} (FW {getSkillValue(skillName)})
                          </span>
                          {w.equipped ? (
                            <span className="text-[11px] bg-unverletzt-grund text-unverletzt font-bold px-1.5 py-0.5 rounded-knopf border border-unverletzt">
                              Ausgerüstet
                            </span>
                          ) : (
                            <span className="text-[11px] bg-seite text-leise font-medium px-1.5 py-0.5 rounded-knopf border border-rahmen">
                              Im Rucksack
                            </span>
                          )}
                          {w.category && (
                            <span className="text-[11px] text-leise font-medium bg-seite px-1.5 py-0.5 rounded-knopf">
                              {w.category}
                            </span>
                          )}
                          {enchantments.hasEnchantment && (
                            <span className="text-[11px] bg-erschoepft-grund text-erschoepft border border-erschoepft font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles size={11} className="text-erschoepft" />
                              <span>{enchantments.spells.map((s) => s.name).join(', ')}</span>
                            </span>
                          )}
                          <SourceBadge
                            source={itemSrc.source}
                            page={itemSrc.page}
                            tooltipData={{
                              title: w.name,
                              description: w.desc || w.attributes,
                              stats: [
                                { label: 'Fertigkeit', value: skillName },
                                { label: 'Schaden', value: enchantments.damageFormulaDisplay },
                                { label: 'WGS', value: String(w.wgs || '—') },
                                ...(w.range ? [{ label: 'Reichweite', value: w.range }] : []),
                                ...(w.attributes ? [{ label: 'Merkmale', value: w.attributes, colSpan: true }] : []),
                                ...(enchantments.hasEnchantment
                                  ? [
                                      {
                                        label: 'Verzauberung',
                                        value: enchantments.spells
                                          .map((s) => `${s.name}: ${s.description}`)
                                          .join('; '),
                                        colSpan: true,
                                      },
                                    ]
                                  : []),
                              ],
                            }}
                          />
                        </div>
                      </div>

                      {/* Secondary Management Controls (Ziehen/Ablegen & Löschen) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Wahlknopf gewaehlt={!!w.equipped} mittig onClick={() => dispatch({ type: 'TOGGLE_EQUIP_ITEM', payload: { id: w.id } })} title={w.equipped ? 'Waffe wegstecken (in Rucksack)' : 'Waffe ziehen / ausrüsten'} className="text-xs whitespace-nowrap font-medium">
                          {w.equipped ? 'Wegstecken' : 'Ziehen'}
                        </Wahlknopf>
                        <Knopf nurSymbol
                          onClick={() => {
                            dispatch({ type: 'REMOVE_INVENTORY_ITEM', payload: { id: w.id } });
                            toast.success(`'${w.name}' entfernt`);
                          }}
                          title="Waffe löschen"
                        >
                          <Trash2 size={15} />
                        </Knopf>
                      </div>
                    </div>

                    {/* Combat Stats Grid (AT, Schaden, WGS, Reichweite) */}
                    <div className={`grid gap-2 ${w.range ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                      <div className="bg-flaeche rounded-knopf border border-rahmen p-2 text-center">
                        <span className="text-[11px] uppercase font-bold text-leise block leading-tight">AT</span>
                        <span className="text-base font-bold tabular-nums text-schrift mt-0.5 block">
                          {effectiveAT}
                          {enchantments.atBonus > 0 && (
                            <span
                              className="text-unverletzt text-xs font-bold tabular-nums ml-1"
                              title="Bonus durch Zauber"
                            >
                              (+{enchantments.atBonus})
                            </span>
                          )}
                          {currentWoundPenalty !== 0 && (
                            <span className="text-schaden text-xs font-normal"> ({currentWoundPenalty})</span>
                          )}
                        </span>
                      </div>
                      <div className="bg-flaeche rounded-knopf border border-rahmen p-2 text-center">
                        <span className="text-[11px] uppercase font-bold text-leise block leading-tight">Schaden</span>
                        <span className="text-base font-bold tabular-nums text-schaden mt-0.5 block">
                          {w.damage || '1W6'}
                          {enchantments.extraDamageText && (
                            <span className="text-erschoepft text-xs font-bold tabular-nums ml-1 block sm:inline">
                              ({enchantments.extraDamageText})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="bg-flaeche rounded-knopf border border-rahmen p-2 text-center">
                        <span className="text-[11px] uppercase font-bold text-leise block leading-tight">WGS</span>
                        <span className="text-base font-bold tabular-nums text-schrift mt-0.5 block">
                          {w.wgs || 7} <span className="text-xs text-leise font-normal">Ticks</span>
                        </span>
                      </div>
                      {w.range && (
                        <div className="bg-flaeche rounded-knopf border border-rahmen p-2 text-center">
                          <span className="text-[11px] uppercase font-bold text-leise block leading-tight">Reichweite</span>
                          <span className="text-base font-bold tabular-nums text-schrift mt-0.5 block">
                            {w.range}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Merkmale / Traits */}
                    {w.attributes && (
                      <div className="bg-erhoeht border border-rahmen rounded-knopf px-2.5 py-1 text-xs text-schrift flex items-start gap-1.5">
                        <span className="font-semibold text-schrift shrink-0">Merkmale:</span>
                        <span className="italic">{w.attributes}</span>
                      </div>
                    )}

                    {/* Primary Combat Action Buttons (Roll Attack & Roll Damage) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-rahmen">
                      <Knopf art="sekundaer"
                        onClick={() => session.openRollForWeapon(w.name, skillName, 0, 15, w)}
                        className="w-full text-xs gap-1.5 active:scale-95"
                        title={`Angriff & Manöver mit ${w.name} öffnen (2W10 + AT vs. VTD)`}
                      >
                        <DiceIcon size={15} />
                        <span>
                          Angriff ({skillName})
                          {enchantments.atBonus > 0 && ` +${enchantments.atBonus}`}
                        </span>
                      </Knopf>
                      <Knopf
                        onClick={() =>
                          session.handleRollDiceFormula(
                            enchantments.damageRollFormula,
                            `${w.name} Schaden${enchantments.extraDamageText ? ` (${enchantments.extraDamageText})` : ''}`
                          )
                        }
                        className="damage-roll-btn w-full text-xs gap-1.5 active:scale-95"
                        title={`Schaden würfeln (${enchantments.damageRollFormula})`}
                      >
                        <DiceIcon size={15} />
                        <span className="tracking-wide text-schrift font-extrabold">{enchantments.buttonDamageLabel}</span>
                      </Knopf>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── NEU: RÜSTUNGEN UND SCHILDE ── */}
          <div className="bg-flaeche rounded-karte border border-rahmen p-5">
            <div className="flex items-center justify-between gap-3 border-b border-gold pb-3 mb-4">
              <h3 className="font-bold text-[17px] fantasy-font text-gold-hell flex items-center gap-2">
                <Shield size={20} className="text-gold shrink-0" />
                <span>Rüstungen &amp; Schilde</span>
              </h3>
              <Knopf art="sekundaer"
                onClick={() => setShowAddArmorModal(true)}
                className="text-xs gap-1.5 shrink-0 whitespace-nowrap active:scale-95"
              >
                <Plus size={14} className="text-gold" />
                <span>Rüstung / Schild</span>
              </Knopf>
            </div>

            {/* Defense Summary Strip - Responsive Grid that scales gracefully on all viewport sizes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="bg-erhoeht rounded-knopf border border-rahmen p-2.5 text-center flex flex-col justify-center min-w-0">
                <span className="text-[11px] sm:text-[11px] uppercase font-bold text-leise block leading-tight text-center break-words" title="Rüstungsschutz (SR)">
                  Rüstung (SR)
                </span>
                <span className="text-lg sm:text-xl font-bold text-schrift tabular-nums mt-0.5">
                  {derived.SR + activeSpellMods.srBonus}
                  {armorSR > 0 && <span className="text-xs text-erschoepft ml-1 font-semibold">({armorSR})</span>}
                  {activeSpellMods.srBonus > 0 && (
                    <span
                      className="text-xs text-unverletzt ml-1 font-semibold"
                      title={`+${activeSpellMods.srBonus} SR durch Zauber (${activeSpellMods.breakdown.filter((b) => b.sr).map((b) => b.spellName).join(', ')})`}
                    >
                      +{activeSpellMods.srBonus} Zauber
                    </span>
                  )}
                </span>
              </div>

              <div className="bg-erhoeht rounded-knopf border border-rahmen p-2.5 text-center flex flex-col justify-center min-w-0">
                <span className="text-[11px] sm:text-[11px] uppercase font-bold text-leise block leading-tight text-center break-words" title="Verteidigung (VTD)">
                  Verteidigung
                </span>
                <span className="text-lg sm:text-xl font-bold text-schrift tabular-nums mt-0.5">
                  {mitZustaenden('VTD', derived.VTD + activeSpellMods.vtdBonus, zw)}
                  {zw.plus.VTD !== 0 && <span className="text-xs text-schaden ml-1 font-semibold" title={zustandsErklaerung('VTD', zw)}>{zw.plus.VTD} Zustand</span>}
                  {gearVtdBonus > 0 && <span className="text-xs text-unverletzt ml-1 font-semibold">+{gearVtdBonus}</span>}
                  {activeSpellMods.vtdBonus > 0 && (
                    <span
                      className="text-xs text-unverletzt ml-1 font-semibold"
                      title={`+${activeSpellMods.vtdBonus} VTD durch Zauber (${activeSpellMods.breakdown.filter((b) => b.vtd).map((b) => b.spellName).join(', ')})`}
                    >
                      +{activeSpellMods.vtdBonus} Zauber
                    </span>
                  )}
                </span>
              </div>

              <div
                className="bg-erhoeht rounded-knopf border border-rahmen p-2.5 text-center flex flex-col justify-center min-w-0 cursor-help"
                title={`Gesamt-Behinderung: ${calc.totalHandicap ?? calc.gearHandicap} (Rüstung: ${calc.armorHandicap ?? 0}, Schild: ${calc.shieldHandicap ?? 0}${calc.overweightHandicap ? `, Überlast: +${calc.overweightHandicap}` : ''})`}
              >
                <span className="text-[11px] sm:text-[11px] uppercase font-bold text-leise block leading-tight text-center break-words">
                  Behinderung
                </span>
                <span className={`text-lg sm:text-xl font-bold tabular-nums mt-0.5 ${(calc.totalHandicap ?? calc.gearHandicap) > 0 ? 'text-schaden' : 'text-schrift'}`}>
                  {calc.totalHandicap ?? calc.gearHandicap}
                  {calc.overweightHandicap > 0 && (
                    <span className="text-[11px] text-schaden ml-1 font-bold">+{calc.overweightHandicap}</span>
                  )}
                </span>
              </div>

              <div className="bg-erhoeht rounded-knopf border border-rahmen p-2.5 text-center flex flex-col justify-center min-w-0">
                <span className="text-[11px] sm:text-[11px] uppercase font-bold text-leise block leading-tight text-center break-words" title="Tick-Zuschlag">
                  Tick-Zuschlag
                </span>
                <span className="text-lg sm:text-xl font-bold text-schrift tabular-nums mt-0.5">
                  {calc.gearTickModifier}
                </span>
              </div>
            </div>

            {/* List of Armor / Shields */}
            <div className="space-y-3">
              {armorsAndShields.length === 0 ? (
                <p className="text-xs text-leise italic p-3 text-center bg-erhoeht rounded-knopf border border-rahmen">
                  Keine Rüstung oder Schild ausgerüstet. Klicke auf &quot;Rüstung / Schild&quot; um aus dem Katalog zu wählen.
                </p>
              ) : (
                armorsAndShields.map((a) => {
                  const itemSrc = getItemSource(a);
                  return (
                    <div
                      key={a.id}
                      className={`rounded-karte border p-3.5 transition-all ${
                        a.equipped
                          ? 'bg-erhoeht border-gold ring-1 ring-rahmen'
                          : 'bg-flaeche border-rahmen opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-schrift truncate">{a.name}</span>
                            <span className="text-xs bg-erhoeht text-schrift font-semibold px-2 py-0.5 rounded-knopf border border-rahmen">
                              {a.type === 'shield' ? 'Schild' : 'Rüstung'}
                            </span>
                            {a.equipped ? (
                              <span className="text-[11px] bg-unverletzt-grund text-unverletzt font-bold px-1.5 py-0.5 rounded-knopf border border-unverletzt">
                                Angelegt
                              </span>
                            ) : (
                              <span className="text-[11px] bg-seite text-leise font-medium px-1.5 py-0.5 rounded-knopf">
                                Abgelegt
                              </span>
                            )}
                            <SourceBadge
                              source={itemSrc.source}
                              page={itemSrc.page}
                              tooltipData={{
                                title: a.name,
                                description: a.desc || a.attributes,
                                stats: [
                                  ...(a.type === 'armor' && a.sr !== undefined ? [{ label: 'SR', value: a.sr }] : []),
                                  ...(a.vtdBonus !== undefined ? [{ label: 'VTD', value: `+${a.vtdBonus}` }] : []),
                                  ...(a.handicap !== undefined ? [{ label: 'Behinderung', value: a.handicap }] : []),
                                  ...(a.tickModifier !== undefined ? [{ label: 'Tick-Zuschlag', value: `+${a.tickModifier}` }] : []),
                                  ...(a.minStrength ? [{ label: 'Mindest-STA', value: a.minStrength }] : []),
                                ],
                              }}
                            />
                          </div>

                        {/* Armor stats bar */}
                        <div className="flex items-center gap-x-3 gap-y-1.5 text-xs text-schrift mt-2 flex-wrap tabular-nums">
                          {a.type === 'armor' && (
                            <span>
                              <strong className="text-schrift ">SR:</strong>{' '}
                              <span className="font-bold text-erschoepft">{a.sr ?? 0}</span>
                            </span>
                          )}
                          <span>
                            <strong className="text-schrift ">VTD:</strong>{' '}
                            <span className="font-bold text-unverletzt">+{a.vtdBonus ?? 0}</span>
                          </span>
                          <span>
                            <strong className="text-schrift ">Behinderung:</strong> {a.handicap ?? 0}
                          </span>
                          <span>
                            <strong className="text-schrift ">Tick-Mod:</strong> +{a.tickModifier ?? 0}
                          </span>
                          {a.minStrength !== undefined && a.minStrength > 0 && (
                            <span>
                              <strong className="text-schrift ">Min-STA:</strong> {a.minStrength}
                            </span>
                          )}
                        </div>

                        {a.attributes && (
                          <div className="mt-1.5 text-xs text-leise italic">
                            <span className="font-semibold text-schrift not-italic">Merkmale:</span> {a.attributes}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-rahmen justify-start sm:justify-end">
                        <Wahlknopf gewaehlt={!!a.equipped} mittig onClick={() => dispatch({ type: 'TOGGLE_EQUIP_ITEM', payload: { id: a.id } })} className="text-xs font-bold whitespace-nowrap">
                          {a.equipped ? 'Ablegen' : 'Anlegen'}
                        </Wahlknopf>
                        <Knopf nurSymbol
                          onClick={() => {
                            dispatch({ type: 'REMOVE_INVENTORY_ITEM', payload: { id: a.id } });
                            toast.success(`'${a.name}' entfernt`);
                          }}
                          title="Löschen"
                        >
                          <Trash2 size={15} />
                        </Knopf>
                      </div>
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </div>

          {/* ── KAMPFFERTIGKEITEN (Combat Skills) ── */}
          <div className="bg-flaeche rounded-karte border border-rahmen p-5">
            <h3 className="font-bold text-[17px] fantasy-font text-gold-hell mb-3.5 flex items-center gap-2">
              <Swords size={20} className="text-gold" />
              Kampffertigkeiten
            </h3>
            <div className="space-y-2">
              {grwFertigkeitsKategorien().COMBAT.map((skill) => {
                const val = getSkillValue(skill);
                const skillMasteries = masteries[skill] ?? [];
                return (
                  <div key={skill}>
                    <Knopf
                      onClick={() => session.openRollForCombat(skill)}
                      className="w-full justify-between text-sm"
                    >
                      <span className="flex items-center gap-1.5">
                        <DiceIcon size={14} />
                        <span>{skill}</span>
                      </span>
                      <span className="text-lg tabular-nums">{val}</span>
                    </Knopf>
                    {skillMasteries.length > 0 && (
                      <ul className="ml-2 mt-1 space-y-1">
                        {skillMasteries.map((m) => {
                          const details = getMasteryDetails(skill, m.name, m.desc);
                          const desc = m.userNote
                            ? `${details.desc}\n\n${m.userNote}`
                            : details.desc;
                          return (
                            <li
                              key={m.id}
                              className="text-xs text-schrift flex items-center justify-between gap-1 py-0.5 border-b border-gold last:border-0"
                            >
                              <span className="truncate" title={m.name}>
                                · {m.name}
                                {m.tier > 1 && !/\(S\d\)/.test(m.name) ? ` (T${m.tier})` : ''}
                              </span>
                              <SourceBadge
                                source={m.source || details.source || 'GRW'}
                                page={m.page || details.page}
                                tooltipData={{ title: m.name, description: desc }}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── RECHTE SPALTE: Zauber-Schnellzugriff & Magieschulen ── */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="space-y-6">
          {/* ── ZAUBER-SCHNELLZUGRIFF ── */}
          <div className="bg-flaeche rounded-karte border border-rahmen p-5">
            <div className="flex justify-between items-center border-b border-gold pb-2 mb-3">
              <h3 className="font-bold text-[17px] fantasy-font text-gold-hell flex items-center gap-2">
                <Sparkles size={20} className="text-gold" />
                Zauber-Schnellzugriff
              </h3>
            </div>

            {spellsList.length === 0 && zauberAusRelikten.length === 0 ? (
              <p className="text-xs text-leise italic p-3 text-center bg-erhoeht rounded-knopf border border-rahmen">
                Noch keine Zauber erlernt. Erlerne Zauber in der Steigerung.
              </p>
            ) : spellsList.length === 0 ? null : (
              <div className="space-y-2">
                {spellsList.map((spell, idx) => (
                  <QuickSpellCard
                    key={`${spell.name}-${spell.school}-${idx}`}
                    spell={spell}
                    session={session}
                  />
                ))}
              </div>
            )}

            {zauberAusRelikten.length > 0 && (
              <div className="mt-4" data-testid="zauber-aus-relikten">
                <div className="text-xs text-leise mb-1.5">
                  Aus Relikten: Probe auf {zauberAusRelikten[0].spell.probeFertigkeit} gegen die Schwierigkeit des Zaubers, Fokus trägst du selbst; das Relikt muss in der Hand sein (GRW S. 255).
                </div>
                <div className="space-y-2">
                  {zauberAusRelikten.map((z, idx) => (
                    <div key={`${z.relikt.id}-${z.spell.name}-${idx}`}>
                      <div className="text-[11px] text-leise mb-0.5">{z.relikt.name}</div>
                      <QuickSpellCard spell={z.spell} session={session} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── MAGIESCHULEN ── */}
          <div className="bg-flaeche rounded-karte border border-rahmen p-5">
            <h3 className="font-bold text-[17px] fantasy-font text-gold-hell mb-3.5 flex items-center gap-2">
              <Sparkles size={20} className="text-gold" />
              Magieschulen
            </h3>
            <div className="space-y-2">
              {grwFertigkeitsKategorien().MAGIC.map((skill) => {
                const total = getSkillTotal(skill);
                const skillMasteries = masteries[skill] ?? [];
                const schoolSpells = spellsList.filter((s) => s.school === skill);
                return (
                  <div key={skill}>
                    <Knopf
                      onClick={() => session.openRollForSkill(skill)}
                      className="min-h-11 w-full flex justify-between items-center bg-erhoeht hover:bg-rahmen rounded-knopf px-3 py-2 text-sm font-bold text-schrift transition-all border border-rahmen hover:border-gold cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <DiceIcon size={14} />
                        <Sparkles size={14} className="text-magie" />
                        <span>{skill}</span>
                      </span>
                      <span className="text-sm tabular-nums font-bold">{total}</span>
                    </Knopf>
                    {skillMasteries.length > 0 && (
                      <ul className="ml-2 mt-1 space-y-1">
                        {skillMasteries.map((m) => {
                          const details = getMasteryDetails(skill, m.name, m.desc);
                          const desc = m.userNote
                            ? `${details.desc}\n\n${m.userNote}`
                            : details.desc;
                          return (
                            <li
                              key={m.id}
                              className="text-xs text-schrift flex items-center justify-between gap-1 py-0.5 border-b border-gold last:border-0"
                            >
                              <span className="truncate" title={m.name}>
                                · {m.name}
                                {m.tier > 1 && !/\(S\d\)/.test(m.name) ? ` (T${m.tier})` : ''}
                              </span>
                              <SourceBadge
                                source={m.source || details.source || 'GRW'}
                                page={m.page || details.page}
                                tooltipData={{ title: m.name, description: desc }}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {schoolSpells.length > 0 && (
                      <ul className="ml-4 mt-1.5 space-y-1">
                        {schoolSpells.map((s) => {
                          const info = getFullSpellInfo(s);
                          const stats = [
                            { label: 'Schule', value: info.school },
                            { label: 'Grad', value: info.grade },
                            { label: 'Fokus', value: String(info.cost) },
                            ...(info.castTime && info.castTime !== '—' ? [{ label: 'Dauer', value: info.castTime }] : []),
                            ...(info.range && info.range !== '—' ? [{ label: 'Reichw.', value: info.range }] : []),
                            ...(info.duration && info.duration !== '—' ? [{ label: 'Wirkung', value: info.duration, colSpan: true }] : []),
                          ].filter((stat) => stat.value);
                          return (
                            <li key={`${s.name}-${s.grade}`}>
                              <Knopf
                                onClick={() => session.handleOpenCastSpell(s)}
                                className="w-full flex items-center justify-between text-xs bg-erhoeht hover:bg-rahmen active:bg-erhoeht border border-rahmen hover:border-gold rounded-knopf px-2.5 py-1.5 transition-all cursor-pointer group gap-2 text-left"
                                title="Zauber wirken"
                              >
                                <div className="text-schrift group-hover:text-gold-hell font-bold truncate flex items-center gap-1.5 min-w-0 flex-1">
                                  <Sparkles size={11} className="text-magie shrink-0" />
                                  <span className="truncate">
                                    {s.name} <span className="text-leise font-medium text-[11px]">(G{s.grade})</span>
                                  </span>
                                </div>
                                <div className="shrink-0 ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
                                  <SourceBadge
                                    source={info.source || 'GRW'}
                                    page={info.page}
                                    tooltipData={{ title: info.name, description: info.description, stats }}
                                  />
                                </div>
                              </Knopf>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: Waffe hinzufügen ── */}
      {showAddWeaponModal && (
        <Dialoghintergrund>
          <Dialogfenster breite="2xl" className="p-5 space-y-4">
            <Dialogkopf symbol={<Swords size={20} />} titel="Waffe auswählen oder erstellen" onSchliessen={() => setShowAddWeaponModal(false)} />

            {/* Search & Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-2.5 top-2.5 text-leise" />
                <input
                  type="text"
                  placeholder="Splittermond-Waffen suchen..."
                  value={weaponSearch}
                  onChange={(e) => setWeaponSearch(e.target.value)}
                  className="w-full bg-erhoeht border border-rahmen rounded-knopf pl-8 pr-3 py-1.5 text-xs text-schrift placeholder:text-leise focus:outline-none focus:border-gold"
                />
              </div>
              <select
                value={weaponCategoryFilter}
                onChange={(e) => setWeaponCategoryFilter(e.target.value)}
                className="bg-erhoeht border border-rahmen rounded-knopf px-2 py-1.5 text-xs text-schrift focus:outline-none focus:border-gold"
              >
                <option value="Alle">Alle Fertigkeiten</option>
                {grwFertigkeitsKategorien().COMBAT.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Catalog list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[300px]">
              {filteredCatalogWeapons.slice(0, 40).map((w) => (
                <div
                  key={w.id || w.name}
                  className="bg-erhoeht rounded-knopf p-2.5 border border-rahmen hover:border-gold flex justify-between items-center gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-schrift">{w.name}</span>
                      <span className="bg-erhoeht text-schrift px-1.5 py-0.5 rounded-knopf text-[11px] font-semibold">
                        {w.skill}
                      </span>
                      <span className="text-leise">{w.category}</span>
                      <SourceBadge
                        source={w.source || 'GRW'}
                        page={w.page}
                        tooltipData={{
                          title: w.name,
                          description: w.desc || w.attributes,
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-leise mt-1 flex gap-3 tabular-nums">
                      <span>Schaden: <strong className="text-schaden">{w.damage}</strong></span>
                      <span>WGS: {w.wgs}</span>
                      {w.range && <span>Reichweite: {w.range}</span>}
                      <span>Preis: {w.price}</span>
                    </div>
                    {w.attributes && (
                      <div className="text-[11px] text-leise italic mt-0.5">{w.attributes}</div>
                    )}
                  </div>
                  <Knopf
                    onClick={() => handleAddCatalogWeapon(w)}
                    className="text-xs shrink-0"
                  >
                    + Hinzufügen
                  </Knopf>
                </div>
              ))}
            </div>

            {/* Custom Weapon Accordion / Form */}
            <form onSubmit={handleAddCustomWeapon} className="pt-3 border-t border-rahmen space-y-2">
              <span className="font-bold text-xs text-schrift">Oder eigene Waffe erstellen:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Waffenname"
                  value={customWeapon.name}
                  onChange={(e) => setCustomWeapon({ ...customWeapon, name: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 col-span-2 text-xs"
                  required
                />
                <select
                  value={customWeapon.weaponSkill}
                  onChange={(e) => setCustomWeapon({ ...customWeapon, weaponSkill: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                >
                  {grwFertigkeitsKategorien().COMBAT.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Schaden (z.B. 1W6+3)"
                  value={customWeapon.damage}
                  onChange={(e) => setCustomWeapon({ ...customWeapon, damage: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  placeholder="WGS (Ticks, z.B. 7)"
                  value={customWeapon.wgs}
                  onChange={(e) => setCustomWeapon({ ...customWeapon, wgs: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  placeholder="Reichweite (z.B. 20m)"
                  value={customWeapon.range}
                  onChange={(e) => setCustomWeapon({ ...customWeapon, range: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  placeholder="Merkmale (z.B. Scharf 2)"
                  value={customWeapon.attributes}
                  onChange={(e) => setCustomWeapon({ ...customWeapon, attributes: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 col-span-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Quelle (z.B. GRW, MSK, Eigen)"
                  value={customWeapon.source}
                  onChange={(e) => setCustomWeapon({ ...customWeapon, source: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  placeholder="Seite (z.B. 183)"
                  value={customWeapon.page}
                  onChange={(e) => setCustomWeapon({ ...customWeapon, page: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                />
              </div>
              <div className="flex justify-end pt-1">
                <Knopf art="primaer"
                  type="submit"
                  className="text-xs"
                >
                  Eigene Waffe erstellen
                </Knopf>
              </div>
            </form>
          </Dialogfenster>
        </Dialoghintergrund>
      )}

      {/* ── MODAL: Rüstung oder Schild hinzufügen ── */}
      {showAddArmorModal && (
        <Dialoghintergrund>
          <Dialogfenster breite="2xl" className="p-5 space-y-4">
            <Dialogkopf symbol={<Shield size={20} />} titel="Rüstung oder Schild auswählen" onSchliessen={() => setShowAddArmorModal(false)} />

            {/* Filter buttons */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-2.5 top-2.5 text-leise" />
                <input
                  type="text"
                  placeholder="Rüstung oder Schild suchen..."
                  value={armorSearch}
                  onChange={(e) => setArmorSearch(e.target.value)}
                  className="w-full bg-erhoeht border border-rahmen rounded-knopf pl-8 pr-3 py-1.5 text-xs text-schrift placeholder:text-leise focus:outline-none focus:border-gold"
                />
              </div>
              <div className="flex rounded-knopf border border-rahmen overflow-hidden text-xs">
                <Wahlknopf gewaehlt={armorTypeFilter === 'all'} mittig onClick={() => setArmorTypeFilter('all')}>
                  Alle
                </Wahlknopf>
                <Wahlknopf gewaehlt={armorTypeFilter === 'armor'} mittig onClick={() => setArmorTypeFilter('armor')}>
                  Rüstungen
                </Wahlknopf>
                <Wahlknopf gewaehlt={armorTypeFilter === 'shield'} mittig onClick={() => setArmorTypeFilter('shield')}>
                  Schilde
                </Wahlknopf>
              </div>
            </div>

            {/* Catalog list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[300px]">
              {filteredCatalogArmors.slice(0, 30).map((a) => {
                const isArmor = a.type === 'armor';
                const armorItem = a as ArmorItem;
                return (
                  <div
                    key={a.id || a.name}
                    className="bg-erhoeht rounded-knopf p-2.5 border border-rahmen hover:border-gold flex justify-between items-center gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-schrift">{a.name}</span>
                        <span className="bg-erhoeht text-schrift px-1.5 py-0.5 rounded-knopf text-[11px] font-semibold">
                          {isArmor ? 'Rüstung' : 'Schild'}
                        </span>
                        <span className="text-leise">{a.category}</span>
                        <SourceBadge
                          source={a.source || 'GRW'}
                          page={a.page}
                          tooltipData={{
                            title: a.name,
                            description: a.desc || a.attributes,
                          }}
                        />
                      </div>
                      <div className="text-[11px] text-leise mt-1 flex gap-3 tabular-nums flex-wrap">
                        {isArmor && <span>SR: <strong className="text-erschoepft">{armorItem.sr}</strong></span>}
                        <span>VTD: <strong className="text-unverletzt">+{a.vtdBonus}</strong></span>
                        <span>Behinderung: {a.handicap}</span>
                        <span>Tick: +{a.tickModifier}</span>
                        <span>Preis: {a.price}</span>
                      </div>
                      {a.attributes && (
                        <div className="text-[11px] text-leise italic mt-0.5">{a.attributes}</div>
                      )}
                    </div>
                    <Knopf
                      onClick={() => handleAddCatalogArmor(a)}
                      className="text-xs shrink-0"
                    >
                      + Anlegen
                    </Knopf>
                  </div>
                );
              })}
            </div>

            {/* Custom Armor / Shield Form */}
            <form onSubmit={handleAddCustomArmor} className="pt-3 border-t border-rahmen space-y-2">
              <span className="font-bold text-xs text-schrift">Oder eigene Rüstung / Schild erstellen:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Name"
                  value={customArmor.name}
                  onChange={(e) => setCustomArmor({ ...customArmor, name: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 col-span-2 text-xs"
                  required
                />
                <select
                  value={customArmor.type}
                  onChange={(e) => setCustomArmor({ ...customArmor, type: e.target.value as 'armor' | 'shield' })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                >
                  <option value="armor">Rüstung</option>
                  <option value="shield">Schild</option>
                </select>
                {customArmor.type === 'armor' ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px]">SR:</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={customArmor.sr}
                      onChange={(e) => setCustomArmor({ ...customArmor, sr: parseInt(e.target.value, 10) || 0 })}
                      className="w-12 bg-flaeche border border-rahmen rounded-knopf px-1.5 py-1 text-center text-xs"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px]">VTD:</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={customArmor.vtdBonus}
                      onChange={(e) => setCustomArmor({ ...customArmor, vtdBonus: parseInt(e.target.value, 10) || 0 })}
                      className="w-12 bg-flaeche border border-rahmen rounded-knopf px-1.5 py-1 text-center text-xs"
                    />
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-[11px]">Behinderung:</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={customArmor.handicap}
                    onChange={(e) => setCustomArmor({ ...customArmor, handicap: parseInt(e.target.value, 10) || 0 })}
                    className="w-12 bg-flaeche border border-rahmen rounded-knopf px-1.5 py-1 text-center text-xs"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px]">Tick:</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={customArmor.tickModifier}
                    onChange={(e) => setCustomArmor({ ...customArmor, tickModifier: parseInt(e.target.value, 10) || 0 })}
                    className="w-12 bg-flaeche border border-rahmen rounded-knopf px-1.5 py-1 text-center text-xs"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Merkmale (optional)"
                  value={customArmor.attributes}
                  onChange={(e) => setCustomArmor({ ...customArmor, attributes: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 col-span-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Quelle (z.B. GRW, MSK, Eigen)"
                  value={customArmor.source}
                  onChange={(e) => setCustomArmor({ ...customArmor, source: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  placeholder="Seite (z.B. 183)"
                  value={customArmor.page}
                  onChange={(e) => setCustomArmor({ ...customArmor, page: e.target.value })}
                  className="bg-flaeche border border-rahmen rounded-knopf px-2 py-1 text-xs"
                />
              </div>
              <div className="flex justify-end pt-1">
                <Knopf art="primaer"
                  type="submit"
                  className="text-xs"
                >
                  Erstellen &amp; Anlegen
                </Knopf>
              </div>
            </form>
          </Dialogfenster>
        </Dialoghintergrund>
      )}
    </div>
  );
};
