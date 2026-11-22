import type { CharacterState } from '../types';
import { DEFAULT_STATE } from '../hooks/useCharacterState';
import { referenceCharacterResources } from '../utils/gameResourceManager';
import { grwRessourcenTexte, grwSchwaechenTexte, grwStaerken } from '../regelwerk/grwListen';

export interface ArchetypePreset {
  id: string;
  name: string;
  title: string;
  description: string;
  race: string;
  moonSign: string;
  homeRegion: string;
  fullState: CharacterState;
}

const getStrengthDesc = (name: string): string => {
  const s = grwStaerken().find((item) => item.name === name);
  return s ? s.desc : '';
};

const RAW_CHARACTER_PRESETS: ArchetypePreset[] = [
  // 1. Arrou - Sandläufer der Tarr (Varg)
  {
    id: 'arrou_sandlaeufer',
    name: 'Arrou',
    title: 'Sandläufer der Tarr',
    description: 'Ein besonnener, ausdauernder Vargen-Kundschafter aus den Wüsten der Surmakar. Meister des Sandschneiders und des Schemenstreu-Langbogens.',
    race: 'Varg',
    moonSign: 'Freundschaft der Trabanten',
    homeRegion: 'Tarr',
    fullState: {
      ...DEFAULT_STATE,
      mode: 'play',
      creationFinalized: true,
      xpTotal: 15,
      name: 'Arrou',
      race: 'Varg',
      moonSign: 'Freundschaft der Trabanten',
      homeRegion: 'Tarr',
      attrBase: {
        AUS: 2,
        BEW: 3,
        INT: 3,
        KON: 2,
        MYS: 1,
        STA: 3,
        VER: 2,
        WIL: 2,
      }, // Sum = 18
      raceBonusAttrs: ['KON'], // Free racial bonus (+1 KON)
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
      skillsBase: {
        Überleben: 6,
        Jagdkunst: 6,
        Naturkunde: 6,
        Schusswaffen: 6,
        Stangenwaffen: 5,
        Wahrnehmung: 5,
        Heimlichkeit: 5,
        Handgemenge: 4,
        Athletik: 4,
        Zähigkeit: 4,
        Akrobatik: 4,
      }, // Sum = 55
      skillsXp: {},
      strengthsList: [
        // Rassenmerkmale Varg (kostenlos)
        { name: 'Natürlicher Rüstungsschutz', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Natürlicher Rüstungsschutz') },
        { name: 'Ausdauernd', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Ausdauernd') },
        { name: 'Natürliche Waffe', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Natürliche Waffe') },
        // Gekaufte Stärken (6 Punkte Budget)
        { name: 'Orientierungssinn', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Orientierungssinn') },
        { name: 'Feine Nase', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Feine Nase') },
        { name: 'Scharfe Sicht', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Scharfe Sicht') },
        { name: 'Entfernungssinn', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Entfernungssinn') },
        { name: 'Zäh', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Zäh') },
      ],
      weaknessesList: [
        { name: 'Kodex', level: 1, source: 'creation', isFree: false, pointCost: 0, desc: grwSchwaechenTexte()['Kodex'] },
      ],
      resourcesList: [
        { name: 'Kreatur', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Kreatur'] },
        { name: 'Kontakte', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Kontakte'] },
        { name: 'Relikt', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Relikt'] },
        { name: 'Stand', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Stand'] },
      ],
      masteries: {
        Überleben: [
          { id: 'arrou_m1', name: 'Geländekunde (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Bonus in Terrain.' },
          { id: 'arrou_m2', name: 'Wildnisläufer (S1)', tier: 1, cost: 5, isCreationBonus: false, isFree: false, source: 'Erschaffung', desc: 'Schnell reisen.' },
        ],
        Schusswaffen: [
          { id: 'arrou_m3', name: 'Scharfschütze (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Reichweitenkategorien erhöht.' },
        ],
      },
      languagesList: [
        { name: 'Tarrgro', level: 3, source: 'creation', isFree: true, pointCost: 0, desc: 'Muttersprache' },
        { name: 'Farukanisch', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: 'Handelssprache' },
      ],
      spellsList: [],
      playState: {
        healthSlots: [],
        focus: { exhausted: 0, channeled: 0, consumed: 0 },
        splitterPoints: 3,
        channeledSpells: [],
        dyingLevel: 0,
        conditions: [],
        tempHP: 0,
        tempHPUsed: 0,
        lpModifier: 0,
      },
    },
  },

  // 2. Cederion von Falkenberg - Selenischer Schwertrichter (Mensch)
  {
    id: 'cederion_falkenberg',
    name: 'Cederion von Falkenberg',
    title: 'Selenischer Schwertrichter',
    description: 'Ein prinzipientreuer Ritter und selenischer Schwertrichter. Herausragend im ritterlichen Schwertkampf, zu Pferde und im höfischen Benehmen.',
    race: 'Mensch',
    moonSign: 'Der Blitz',
    homeRegion: 'Selenia',
    fullState: {
      ...DEFAULT_STATE,
      mode: 'play',
      creationFinalized: true,
      xpTotal: 15,
      name: 'Cederion von Falkenberg',
      race: 'Mensch',
      moonSign: 'Der Blitz',
      homeRegion: 'Selenia',
      attrBase: {
        AUS: 2,
        BEW: 3,
        INT: 2,
        KON: 2,
        MYS: 1,
        STA: 3,
        VER: 2,
        WIL: 3,
      }, // Sum = 18
      raceBonusAttrs: ['AUS', 'STA'], // 2 menschliche Freiboni
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
      skillsBase: {
        Klingenwaffen: 6,
        Athletik: 6,
        Anführen: 6,
        Zähigkeit: 5,
        Entschlossenheit: 5,
        Diplomatie: 5,
        Tierführung: 5,
        Wahrnehmung: 4,
        'Geschichte & Mythen': 4,
        Akrobatik: 3,
        Handgemenge: 3,
        Heilkunde: 3,
      }, // Sum = 55
      skillsXp: {},
      strengthsList: [
        // Rassenmerkmal Mensch (kostenlos)
        { name: 'Zusätzliche Splitterpunkte', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Zusätzliche Splitterpunkte') },
        // Gekaufte Stärken (8 Punkte Budget für Menschen)
        { name: 'Literat', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Literat') },
        { name: 'Attraktivität', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Attraktivität') },
        { name: 'Gleichgewichtssinn', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Gleichgewichtssinn') },
        { name: 'Schmerzresistenz', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Schmerzresistenz') },
        { name: 'Weltgewandt', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Weltgewandt') },
        { name: 'Einen Schritt voraus', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Einen Schritt voraus') },
      ],
      weaknessesList: [
        { name: 'Kodex', level: 1, source: 'creation', isFree: false, pointCost: 0, desc: grwSchwaechenTexte()['Kodex'] },
      ],
      resourcesList: [
        { name: 'Stand', level: 3, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Stand'] },
        { name: 'Ansehen', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Ansehen'] },
        { name: 'Relikt', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Relikt'] },
        { name: 'Vermögen', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Vermögen'] },
      ],
      masteries: {
        Klingenwaffen: [
          { id: 'cederion_m1', name: 'Ausfall (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Gegner zurückdrängen mit Angriffsserie.' },
          { id: 'cederion_m2', name: 'Verteidigungswirbel (S1)', tier: 1, cost: 5, isCreationBonus: false, isFree: false, source: 'Erschaffung', desc: '+2 VTD.' },
        ],
        Anführen: [
          { id: 'cederion_m3', name: 'Herausforderung (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Gegner zum Duell fordern.' },
        ],
      },
      languagesList: [
        { name: 'Gemein-Dragoreisch', level: 3, source: 'creation', isFree: true, pointCost: 0, desc: 'Muttersprache' },
        { name: 'Lingua Dracis', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: 'Bildungssprache' },
      ],
      spellsList: [],
      playState: {
        healthSlots: [],
        focus: { exhausted: 0, channeled: 0, consumed: 0 },
        splitterPoints: 5,
        channeledSpells: [],
        dyingLevel: 0,
        conditions: [],
        tempHP: 0,
        tempHPUsed: 0,
        lpModifier: 0,
      },
    },
  },

  // 3. Eshi bid-Herar - Farukanische Heilerin & Alchemistin (Mensch)
  {
    id: 'eshi_bid_herar',
    name: 'Eshi bid-Herar',
    title: 'Farukanische Heilerin & Alchemistin',
    description: 'Eine einfühlsame Heilerin und geschickte Tränkemischerin aus Farukan. Meisterin der Heilungs- und Stärkungsmagie sowie der alchemistischen Künste.',
    race: 'Mensch',
    moonSign: 'Segen der Mondkraft',
    homeRegion: 'Farukan',
    fullState: {
      ...DEFAULT_STATE,
      mode: 'play',
      creationFinalized: true,
      xpTotal: 15,
      name: 'Eshi bid-Herar',
      race: 'Mensch',
      moonSign: 'Segen der Mondkraft',
      homeRegion: 'Farukan',
      attrBase: {
        AUS: 3,
        BEW: 1,
        INT: 3,
        KON: 2,
        MYS: 3,
        STA: 1,
        VER: 3,
        WIL: 2,
      }, // Sum = 18
      raceBonusAttrs: ['INT', 'MYS'], // Mensch Freiboni
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
      skillsBase: {
        Heilkunde: 6,
        Alchemie: 6,
        Heilungsmagie: 6,
        Stärkungsmagie: 6,
        Empathie: 5,
        Naturkunde: 5,
        'Arkane Kunde': 5,
        Diplomatie: 4,
        Redegewandtheit: 4,
        Wahrnehmung: 4,
        Fingerfertigkeit: 4,
      }, // Sum = 55
      skillsXp: {},
      strengthsList: [
        // Rassenmerkmal Mensch (kostenlos)
        { name: 'Zusätzliche Splitterpunkte', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Zusätzliche Splitterpunkte') },
        // Gekaufte Stärken (8 Punkte Budget für Menschen)
        { name: 'Literat', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Literat') },
        { name: 'Soziales Gespür', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Soziales Gespür') },
        { name: 'Gutes Gedächtnis', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Gutes Gedächtnis') },
        { name: 'Erhöhter Fokuspool', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Erhöhter Fokuspool') },
        { name: 'Erhöhte Fokusregeneration', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Erhöhte Fokusregeneration') },
        { name: 'Krankheitsresistenz', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Krankheitsresistenz') },
      ],
      weaknessesList: [
        { name: 'Weichherzig', level: 1, source: 'creation', isFree: false, pointCost: 0, desc: grwSchwaechenTexte()['Weichherzig'] },
      ],
      resourcesList: [
        { name: 'Kontakte', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Kontakte'] },
        { name: 'Ansehen', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Ansehen'] },
        { name: 'Zuflucht', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Zuflucht'] },
        { name: 'Vermögen', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Vermögen'] },
      ],
      masteries: {
        Heilkunde: [
          { id: 'eshi_m1', name: 'Heilungsgeschick (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Regeneration verbessern.' },
          { id: 'eshi_m2', name: 'Lebensretter (S1)', tier: 1, cost: 5, isCreationBonus: false, isFree: false, source: 'Erschaffung', desc: 'Sterbenden stabilisieren.' },
        ],
        Alchemie: [
          { id: 'eshi_m3', name: 'Geselle (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Qualität von Tränken erhöht.' },
        ],
      },
      languagesList: [
        { name: 'Farukanisch', level: 3, source: 'creation', isFree: true, pointCost: 0, desc: 'Muttersprache' },
        { name: 'Gemein-Dragoreisch', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: 'Handelssprache' },
      ],
      spellsList: [
        { name: 'Ausdauer stärken', school: 'Heilungsmagie', grade: 0, cost: 'K1', castTime: '1 Tick', range: 'Zauberer', duration: 'kanalisiert', description: 'Vermindert Überanstrengung um 1 Stufe.', source: 'GRW', isFree: true },
        { name: 'Erfrischung', school: 'Heilungsmagie', grade: 0, cost: 'K1', castTime: '1 Tick', range: 'Berührung', duration: 'kanalisiert', description: 'Unterdrückt Erschöpfung.', source: 'GRW', isFree: true },
        { name: 'Selbstheilung', school: 'Heilungsmagie', grade: 1, cost: '4V1', castTime: '1 Tick', range: 'Zauberer', description: 'Heilt beim Zauberer sofort 3 Lebenspunkte.', source: 'GRW', isFree: true },
        { name: 'Lebenskraft stärken', school: 'Heilungsmagie', grade: 1, cost: 'K8V2', castTime: '4 Ticks', range: 'Zauberer', duration: 'kanalisiert', description: 'Gewährt 5 temporäre Lebenspunkte.', source: 'GRW', isFree: true },
        { name: 'Härte', school: 'Stärkungsmagie', grade: 0, cost: 'K1', castTime: '1 Tick', range: 'Berührung', duration: 'kanalisiert', description: 'Erhöht Härte eines Objekts um 2.', source: 'GRW', isFree: true },
        { name: 'Aura der Entschlossenheit', school: 'Stärkungsmagie', grade: 1, cost: 'K4V1', castTime: '7 Ticks', range: 'Zauberer', duration: 'kanalisiert', description: '+2 auf GW und Entschlossenheit für alle in 5m.', source: 'GRW', isFree: true },
      ],
      playState: {
        healthSlots: [],
        focus: { exhausted: 0, channeled: 0, consumed: 0 },
        splitterPoints: 5,
        channeledSpells: [],
        dyingLevel: 0,
        conditions: [],
        tempHP: 0,
        tempHPUsed: 0,
        lpModifier: 0,
      },
    },
  },

  // 4. Keira Alvios - Gnomische Schattenweberin & Schurkin (Gnom)
  {
    id: 'keira_alvios',
    name: 'Keira Alvios',
    title: 'Gnomische Schattenweberin & Schurkin',
    description: 'Eine wieselflinke Gnomenschurkin aus Midstad. Meisterin der Heimlichkeit, des Schlossknackens und der Schattenmagie.',
    race: 'Gnom',
    moonSign: 'Der Spieler',
    homeRegion: 'Midstad',
    fullState: {
      ...DEFAULT_STATE,
      mode: 'play',
      creationFinalized: true,
      xpTotal: 15,
      name: 'Keira Alvios',
      race: 'Gnom',
      moonSign: 'Der Spieler',
      homeRegion: 'Midstad',
      attrBase: {
        AUS: 3,
        BEW: 3,
        INT: 3,
        KON: 2,
        MYS: 2,
        STA: 1,
        VER: 2,
        WIL: 2,
      }, // Sum = 18
      raceBonusAttrs: ['BEW'], // Gnom Freibonus (+1 BEW)
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
      skillsBase: {
        Heimlichkeit: 6,
        'Schlösser & Fallen': 6,
        Fingerfertigkeit: 6,
        Straßenkunde: 6,
        Schattenmagie: 5,
        Redegewandtheit: 5,
        Wahrnehmung: 5,
        Akrobatik: 5,
        Handgemenge: 4,
        Klingenwaffen: 4,
        Empathie: 3,
      }, // Sum = 55
      skillsXp: {},
      strengthsList: [
        // Rassenmerkmale Gnom (kostenlos)
        { name: 'Feensinn', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Feensinn') },
        { name: 'Hoher Geistiger Widerstand', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Hoher Geistiger Widerstand') },
        { name: 'Flink', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Flink') },
        // Gekaufte Stärken (6 Punkte Budget)
        { name: 'Dämmersicht', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Dämmersicht') },
        { name: 'Gleichgewichtssinn', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Gleichgewichtssinn') },
        { name: 'Feine Nase', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Feine Nase') },
        { name: 'Einen Schritt voraus', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Einen Schritt voraus') },
      ],
      weaknessesList: [
        { name: 'Gier', level: 1, source: 'creation', isFree: false, pointCost: 0, desc: grwSchwaechenTexte()['Gier'] },
      ],
      resourcesList: [
        { name: 'Kontakte', level: 3, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Kontakte'] },
        { name: 'Zuflucht', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Zuflucht'] },
        { name: 'Vermögen', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Vermögen'] },
        { name: 'Relikt', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Relikt'] },
      ],
      masteries: {
        Heimlichkeit: [
          { id: 'keira_m1', name: 'Leisetreter (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Geräuschlos bewegen.' },
          { id: 'keira_m2', name: 'Unauffällig (S1)', tier: 1, cost: 5, isCreationBonus: false, isFree: false, source: 'Erschaffung', desc: 'In der Menge untertauchen.' },
        ],
        'Schlösser & Fallen': [
          { id: 'keira_m3', name: 'Aufmerksam (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Fallen bemerken.' },
        ],
      },
      languagesList: [
        { name: 'Basargnomisch', level: 3, source: 'creation', isFree: true, pointCost: 0, desc: 'Muttersprache' },
        { name: 'Gemein-Dragoreisch', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: 'Handelssprache' },
      ],
      spellsList: [
        { name: 'Schattenschleier', school: 'Schattenmagie', grade: 0, cost: 'K1', castTime: '1 Tick', range: 'Zauberer', duration: 'kanalisiert', description: 'Schützt Zauberer vor direktem Sonnenlicht.', source: 'GRW', isFree: true },
        { name: 'Schattenspiel', school: 'Schattenmagie', grade: 0, cost: 'K1', castTime: '2 Ticks', range: '5 m', duration: 'kanalisiert', description: 'Verformt Schatten von Objekten.', source: 'GRW', isFree: true },
        { name: 'Dunkelheit', school: 'Schattenmagie', grade: 1, cost: 'K4V1', castTime: '1 Tick', range: 'Zauberer', duration: 'kanalisiert', description: 'Erhöht Lichtstufe in 10m Radius um 2.', source: 'GRW', isFree: true },
        { name: 'Schattenmantel', school: 'Schattenmagie', grade: 1, cost: 'K4V1', castTime: '1 Tick', range: 'Zauberer', duration: 'kanalisiert', description: 'Wahrnehmung gegen Zauberer um 3 erschwert.', source: 'GRW', isFree: true },
      ],
      playState: {
        healthSlots: [],
        focus: { exhausted: 0, channeled: 0, consumed: 0 },
        splitterPoints: 3,
        channeledSpells: [],
        dyingLevel: 0,
        conditions: [],
        tempHP: 0,
        tempHPUsed: 0,
        lpModifier: 0,
      },
    },
  },

  // 5. Selesha Maradoh - Feuermagierin aus Farukan (Mensch)
  {
    id: 'selesha_maradoh',
    name: 'Selesha Maradoh',
    title: 'Feuermagierin aus Farukan',
    description: 'Eine stolze und feurige Zauberin aus den Palastakademien von Farukan. Gewaltige Zerstörungskraft in der Feuermagie gepaart mit meisterhafter Beredsamkeit.',
    race: 'Mensch',
    moonSign: 'Geist der Gedanken',
    homeRegion: 'Farukan',
    fullState: {
      ...DEFAULT_STATE,
      mode: 'play',
      creationFinalized: true,
      xpTotal: 15,
      name: 'Selesha Maradoh',
      race: 'Mensch',
      moonSign: 'Geist der Gedanken',
      homeRegion: 'Farukan',
      attrBase: {
        AUS: 3,
        BEW: 2,
        INT: 2,
        KON: 2,
        MYS: 3,
        STA: 1,
        VER: 3,
        WIL: 2,
      }, // Sum = 18
      raceBonusAttrs: ['MYS', 'VER'], // Mensch Freiboni
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
      skillsBase: {
        Feuermagie: 6,
        Erkenntnismagie: 6,
        'Arkane Kunde': 6,
        'Geschichte & Mythen': 5,
        Redegewandtheit: 5,
        Diplomatie: 5,
        Wahrnehmung: 5,
        Entschlossenheit: 5,
        Alchemie: 4,
        Länderkunde: 4,
        Klingenwaffen: 4,
      }, // Sum = 55
      skillsXp: {},
      strengthsList: [
        // Rassenmerkmal Mensch (kostenlos)
        { name: 'Zusätzliche Splitterpunkte', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Zusätzliche Splitterpunkte') },
        // Gekaufte Stärken (8 Punkte Budget für Menschen)
        { name: 'Literat', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Literat') },
        { name: 'Stabile Magie', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Stabile Magie') },
        { name: 'Hitzeresistenz', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Hitzeresistenz') },
        { name: 'Erhöhter Fokuspool', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Erhöhter Fokuspool') },
        { name: 'Erhöhte Fokusregeneration', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Erhöhte Fokusregeneration') },
        { name: 'Konzentrationsstärke', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Konzentrationsstärke') },
      ],
      weaknessesList: [
        { name: 'Hochmut', level: 1, source: 'creation', isFree: false, pointCost: 0, desc: grwSchwaechenTexte()['Hochmut'] },
      ],
      resourcesList: [
        { name: 'Mentor', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Mentor'] },
        { name: 'Relikt', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Relikt'] },
        { name: 'Stand', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Stand'] },
        { name: 'Vermögen', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Vermögen'] },
      ],
      masteries: {
        'Arkane Kunde': [
          { id: 'selesha_m1', name: 'Artefaktkunde (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Artefakte identifizieren.' },
          { id: 'selesha_m2', name: 'Arkane Verteidigung I (S1)', tier: 1, cost: 5, isCreationBonus: false, isFree: false, source: 'Erschaffung', desc: '+1 GW gegen Zauber.' },
        ],
        Redegewandtheit: [
          { id: 'selesha_m3', name: 'Ablenken (S1)', tier: 1, cost: 5, isCreationBonus: false, isFree: false, source: 'Erschaffung', desc: 'Gegner ablenken.' },
        ],
      },
      languagesList: [
        { name: 'Farukanisch', level: 3, source: 'creation', isFree: true, pointCost: 0, desc: 'Muttersprache' },
        { name: 'Gemein-Dragoreisch', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: 'Handelssprache' },
      ],
      spellsList: [
        { name: 'Flamme', school: 'Feuermagie', grade: 0, cost: '1', castTime: '1 Tick', range: 'Berührung', duration: '30 Sekunden', description: 'Erschafft kleine Flamme (1W6 Feuerschaden bei Berührung).', source: 'GRW', isFree: true },
        { name: 'Wärme', school: 'Feuermagie', grade: 0, cost: 'K1', castTime: '1 Tick', range: 'Zauberer', duration: 'kanalisiert', description: 'Senkt Kältestufe um 1 / erhöht Hitzestufe um 1.', source: 'GRW', isFree: true },
        { name: 'Feuerstrahl', school: 'Feuermagie', grade: 1, cost: '5V2', castTime: '8 Ticks', range: '10 m', description: 'Verursacht 2W6 Feuerschaden.', source: 'GRW', isFree: true },
        { name: 'Entzünden', school: 'Feuermagie', grade: 1, cost: '4V1', castTime: '6 Ticks', range: 'Berührung', description: 'Setzt brennbare Objekte sofort in Brand.', source: 'GRW', isFree: true },
        { name: 'Magie erkennen', school: 'Erkenntnismagie', grade: 0, cost: '1', castTime: '2 Ticks', range: '5 m', duration: '5 Sekunden', description: 'Lässt magische Aura und Stärke erkennen.', source: 'GRW', isFree: true },
        { name: 'Alarm', school: 'Erkenntnismagie', grade: 1, cost: '4V1', castTime: '2 Ticks', range: 'Zauberer', duration: '6 Stunden', description: 'Alarmiert mental, wenn sich Wesen 5m nähern.', source: 'GRW', isFree: true },
      ],
      playState: {
        healthSlots: [],
        focus: { exhausted: 0, channeled: 0, consumed: 0 },
        splitterPoints: 5,
        channeledSpells: [],
        dyingLevel: 0,
        conditions: [],
        tempHP: 0,
        tempHPUsed: 0,
        lpModifier: 0,
      },
    },
  },

  // 6. Telkin Feuerfaust - Zwergischer Hammerpriester (Zwerg)
  {
    id: 'telkin_feuerfaust',
    name: 'Telkin Feuerfaust',
    title: 'Zwergischer Hammerpriester',
    description: 'Ein unerschütterlicher Vulkanzwerg aus Midstad. Priester des Schmiedegottes Kahsrok, Meister sakraler Felsmagie sowie schwerer Schmiedehämmer.',
    race: 'Zwerg',
    moonSign: 'Der Fels',
    homeRegion: 'Midstad',
    fullState: {
      ...DEFAULT_STATE,
      mode: 'play',
      creationFinalized: true,
      xpTotal: 15,
      name: 'Telkin Feuerfaust',
      race: 'Zwerg',
      moonSign: 'Der Fels',
      homeRegion: 'Midstad',
      attrBase: {
        AUS: 2,
        BEW: 1,
        INT: 3,
        KON: 3,
        MYS: 3,
        STA: 2,
        VER: 2,
        WIL: 2,
      }, // Sum = 18
      raceBonusAttrs: ['MYS'], // Freier Bonus Zwerg (+1 MYS)
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
      skillsBase: {
        Hiebwaffen: 6,
        Felsmagie: 6,
        Zähigkeit: 6,
        Entschlossenheit: 5,
        Handwerk: 5,
        Heilkunde: 5,
        'Arkane Kunde': 5,
        'Geschichte & Mythen': 5,
        Wahrnehmung: 4,
        Anführen: 4,
        Handgemenge: 4,
      }, // Sum = 55
      skillsXp: {},
      strengthsList: [
        // Rassenmerkmale Zwerg (kostenlos)
        { name: 'Giftresistenz', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Giftresistenz') },
        { name: 'Robust', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Robust') },
        { name: 'Orientierungssinn', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Orientierungssinn') },
        // Gekaufte Stärken (6 Punkte Budget)
        { name: 'Priester', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 0, desc: getStrengthDesc('Priester') },
        { name: 'Literat', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Literat') },
        { name: 'Erhöhter Fokuspool', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Erhöhter Fokuspool') },
        { name: 'Kälteresistenz', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Kälteresistenz') },
        { name: 'Hitzeresistenz', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Hitzeresistenz') },
        { name: 'Konzentrationsstärke', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Konzentrationsstärke') },
      ],
      weaknessesList: [
        { name: 'Kodex', level: 1, source: 'creation', isFree: false, pointCost: 0, desc: grwSchwaechenTexte()['Kodex'] },
      ],
      resourcesList: [
        { name: 'Rang', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Rang'] },
        { name: 'Ansehen', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Ansehen'] },
        { name: 'Relikt', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Relikt'] },
        { name: 'Zuflucht', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Zuflucht'] },
      ],
      masteries: {
        Hiebwaffen: [
          { id: 'telkin_m1', name: 'Todesschlag (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: '+5 Schaden bei Risikowurf.' },
          { id: 'telkin_m2', name: 'Schildbrecher (S1)', tier: 1, cost: 5, isCreationBonus: false, isFree: false, source: 'Erschaffung', desc: 'Schaden gegen Schilde erhöht.' },
        ],
        Zähigkeit: [
          { id: 'telkin_m3', name: 'Rüstungsträger I (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Behinderung -1.' },
        ],
      },
      languagesList: [
        { name: 'Boromto', level: 3, source: 'creation', isFree: true, pointCost: 0, desc: 'Muttersprache' },
        { name: 'Gemein-Dragoreisch', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: 'Handelssprache' },
      ],
      spellsList: [
        { name: 'Härte', school: 'Felsmagie', grade: 0, cost: 'K1', castTime: '1 Tick', range: 'Berührung', duration: 'kanalisiert', description: 'Erhöht Härte eines Objekts um 2.', source: 'GRW', isFree: true },
        { name: 'Stein', school: 'Felsmagie', grade: 0, cost: '1', castTime: '1 Tick', range: 'Zauberer', duration: '5 Minuten', description: 'Erschafft einen faustgroßen Stein.', source: 'GRW', isFree: true },
        { name: 'Felsgeschoss', school: 'Felsmagie', grade: 1, cost: '3V1', castTime: '4 Ticks', range: '10 m', description: 'Verursacht 1W10 Felsschaden.', source: 'GRW', isFree: true },
        { name: 'Standfest', school: 'Felsmagie', grade: 1, cost: 'K4V1', castTime: '1 Tick', range: 'Zauberer', duration: 'kanalisiert', description: '+3 Widerstand gegen Umwerfen/Zurückdrängen.', source: 'GRW', isFree: true },
      ],
      playState: {
        healthSlots: [],
        focus: { exhausted: 0, channeled: 0, consumed: 0 },
        splitterPoints: 3,
        channeledSpells: [],
        dyingLevel: 0,
        conditions: [],
        tempHP: 0,
        tempHPUsed: 0,
        lpModifier: 0,
      },
    },
  },

  // 7. Tiai Schimmersee - Seealbische Klingentänzerin (Alb)
  {
    id: 'tiai_schimmersee',
    name: 'Tiai Schimmersee',
    title: 'Seealbische Klingentänzerin',
    description: 'Eine blitzschnelle und anmutige Fechterin vom Albischen Seebund. Sie verbindet akrobatischen Schwerttanz mit der Beherrschung von Bewegungsmagie.',
    race: 'Alb',
    moonSign: 'Das zweite Gesicht',
    homeRegion: 'Albische Inseln',
    fullState: {
      ...DEFAULT_STATE,
      mode: 'play',
      creationFinalized: true,
      xpTotal: 15,
      name: 'Tiai Schimmersee',
      race: 'Alb',
      moonSign: 'Das zweite Gesicht',
      homeRegion: 'Albische Inseln',
      attrBase: {
        AUS: 2,
        BEW: 3,
        INT: 3,
        KON: 2,
        MYS: 2,
        STA: 2,
        VER: 2,
        WIL: 2,
      }, // Sum = 18
      raceBonusAttrs: ['INT'], // Freier Bonus Alb (+1 INT)
      attrIncrements: { AUS: 0, BEW: 0, INT: 0, KON: 0, MYS: 0, STA: 0, VER: 0, WIL: 0 },
      skillsBase: {
        Klingenwaffen: 6,
        Akrobatik: 6,
        Bewegungsmagie: 6,
        Seefahrt: 5,
        Schwimmen: 5,
        Darbietung: 5,
        Athletik: 5,
        Heimlichkeit: 5,
        Wahrnehmung: 5,
        Empathie: 4,
        Fingerfertigkeit: 3,
      }, // Sum = 55
      skillsXp: {},
      strengthsList: [
        // Rassenmerkmale Alb (kostenlos)
        { name: 'Attraktivität', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Attraktivität') },
        { name: 'Scharfes Gehör', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Scharfes Gehör') },
        { name: 'Dämmersicht', level: 1, source: 'creation', isFree: true, isRacial: true, pointCost: 0, desc: getStrengthDesc('Dämmersicht') },
        // Gekaufte Stärken (6 Punkte Budget)
        { name: 'Gleichgewichtssinn', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Gleichgewichtssinn') },
        { name: 'Flink', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 1, desc: getStrengthDesc('Flink') },
        { name: 'Verbesserte Initiative', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Verbesserte Initiative') },
        { name: 'Einen Schritt voraus', level: 1, source: 'creation', isFree: false, isRacial: false, pointCost: 2, desc: getStrengthDesc('Einen Schritt voraus') },
      ],
      weaknessesList: [
        { name: 'Eitelkeit', level: 1, source: 'creation', isFree: false, pointCost: 0, desc: grwSchwaechenTexte()['Eitelkeit'] },
      ],
      resourcesList: [
        { name: 'Relikt', level: 3, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Relikt'] },
        { name: 'Kontakte', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Kontakte'] },
        { name: 'Ansehen', level: 2, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Ansehen'] },
        { name: 'Vermögen', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: grwRessourcenTexte()['Vermögen'] },
      ],
      masteries: {
        Klingenwaffen: [
          { id: 'tiai_m1', name: 'Ausfall (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: 'Gegner zurückdrängen mit Angriffsserie.' },
          { id: 'tiai_m2', name: 'Verteidigungswirbel (S1)', tier: 1, cost: 5, isCreationBonus: false, isFree: false, source: 'Erschaffung', desc: '+2 VTD.' },
        ],
        Akrobatik: [
          { id: 'tiai_m3', name: 'Blitzreflexe (S1)', tier: 1, cost: 0, isCreationBonus: false, isFree: true, source: 'Erschaffung', desc: '+3 INI.' },
        ],
      },
      languagesList: [
        { name: 'Tial', level: 3, source: 'creation', isFree: true, pointCost: 0, desc: 'Muttersprache' },
        { name: 'Gemein-Dragoreisch', level: 1, source: 'creation', isFree: false, pointCost: 1, desc: 'Handelssprache' },
      ],
      spellsList: [
        { name: 'Stoß', school: 'Bewegungsmagie', grade: 0, cost: '1', castTime: '2 Ticks', range: '5 m', description: 'Stößt Ziel 1m zurück (Kräftevergleich).', source: 'GRW', isFree: true },
        { name: 'Zauberfeder', school: 'Bewegungsmagie', grade: 0, cost: 'K1', castTime: '1 Tick', range: 'Berührung', duration: 'kanalisiert', description: 'Lässt Feder selbstständig Diktat mitschreiben.', source: 'GRW', isFree: true },
        { name: 'Beschleunigen', school: 'Bewegungsmagie', grade: 1, cost: 'K4V1', castTime: '1 Tick', range: 'Zauberer', duration: 'kanalisiert', description: 'Erhöht GSW um 2.', source: 'GRW', isFree: true },
        { name: 'Sanfter Fall', school: 'Bewegungsmagie', grade: 1, cost: 'K1', castTime: '1 Tick', range: 'Zauberer', duration: 'kanalisiert', description: 'Reduziert Fallschaden (Fallhöhe zählt als halbiert).', source: 'GRW', isFree: true },
      ],
      playState: {
        healthSlots: [],
        focus: { exhausted: 0, channeled: 0, consumed: 0 },
        splitterPoints: 3,
        channeledSpells: [],
        dyingLevel: 0,
        conditions: [],
        tempHP: 0,
        tempHPUsed: 0,
        lpModifier: 0,
      },
    },
  },
];

// Erst beim Zugriff auflösen: beim Laden des Moduls ist das Grundregelwerk noch nicht da, das Protokoll bekäme sonst
// „Quelle: unbekannt“ für alle Einträge der Vorlage
export const CHARACTER_PRESETS: ArchetypePreset[] = RAW_CHARACTER_PRESETS.map((preset) => ({
  ...preset,
  get fullState() { return referenceCharacterResources(preset.fullState); },
}));

