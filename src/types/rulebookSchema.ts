/**
 * Modulformat des Editors für Inhalte aus Grimoires. Die Claude-Edition erzeugt diese Module aus den hochgeladenen
 * Regelpaketen (regelwerk/bruecke.ts → grimoireModule()); der frühere JSON-Import über „Admin & Ressourcen“ ist entfernt.
 */

export interface RulebookSpell {
  id?: string;
  name: string;
  school: string;
  grade: number; // 0 to 5
  cost: string; // e.g. "K4V1", "12V3", "K8", "1"
  castTime?: string; // e.g. "3 Ticks", "10 Minuten"
  range?: string; // e.g. "Berührung", "15 m", "Zauberer"
  duration?: string; // e.g. "sofort", "kanalisiert", "1 Stunde"
  target?: string; // e.g. "1 Wesen", "Zone (5m)"
  description: string;
  damage?: string; // e.g. "2W6", "1W10+2"
  source?: string; // e.g. "GRW", "MSK", "Eigen"
  page?: number;
  tags?: string[];
}

export interface RulebookMastery {
  id?: string;
  name: string; // e.g. "Wirbelwind (S2)"
  skill: string; // e.g. "Klingenwaffen" or "Allgemein"
  level?: number | string; // 1, 2, 3, 4 or "S1", "S2", "S3", "S4"
  desc: string;
  page?: number;
  source?: string;
  tags?: string[];
}

export interface RulebookStrength {
  id?: string;
  name: string;
  cost: number; // point cost, usually 1 to 4
  max?: number; // max stacks, default 1
  multi?: boolean; // selectable multiple times?
  onlyCreation?: boolean; // only available during character creation
  desc: string;
  page?: number;
  source?: string;
}

export interface RulebookWeakness {
  id?: string;
  name: string;
  desc: string;
  page?: number;
  source?: string;
}

export interface RulebookResourceItem {
  id?: string;
  name: string;
  desc: string;
  mehrfach?: boolean;
  page?: number;
  source?: string;
}

export interface RulebookResourcesContainer {
  spells?: RulebookSpell[];
  masteries?: RulebookMastery[];
  strengths?: RulebookStrength[];
  weaknesses?: RulebookWeakness[];
  gameResources?: RulebookResourceItem[];
}

export interface RulebookModulePackage {
  format: 'splittermond-module-v1';
  id: string; // Unique alphanumeric slug (e.g. "mondstahlklingen-kampfstile")
  name: string; // Full human-readable name (e.g. "Mondstahlklingen – Erweiterung")
  shortName: string; // Short code (e.g. "MSK")
  version: string; // Semver format (e.g. "1.0.0")
  system: 'splittermond';
  systemVersion?: string; // Compatible system version (e.g. ">=1.0")
  description: string;
  author: string;
  website?: string;
  license?: string;
  isDefault?: boolean;
  isActive?: boolean;
  canRemove?: boolean;
  createdAt?: string;
  updatedAt?: string;
  itemCounts?: {
    spells: number;
    masteries: number;
    strengths: number;
    weaknesses: number;
    resources: number;
  };
  resources: RulebookResourcesContainer;
}
