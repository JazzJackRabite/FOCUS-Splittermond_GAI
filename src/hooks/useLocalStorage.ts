import { useState } from 'react';
import { toast } from 'react-hot-toast';

const STORAGE_VERSION = 'splittermond_char_v95';
const PROFILES_INDEX_KEY = 'splittermond_profiles_v1';
const ACTIVE_PROFILE_KEY = 'splittermond_active_profile_id';
const LEGACY_V94 = 'splittermond_char_v94';
const LEGACY_V93 = 'splittermond_char_v93';

export interface CharacterProfileMeta {
  id: string;
  name: string;
  race: string;
  updatedAt: number;
}

/**
 * Gets all stored character profiles metadata.
 */
export function getProfilesList(): CharacterProfileMeta[] {
  try {
    const raw = localStorage.getItem(PROFILES_INDEX_KEY);
    if (raw) {
      return JSON.parse(raw) as CharacterProfileMeta[];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Saves profiles list index to localStorage.
 */
export function saveProfilesList(list: CharacterProfileMeta[]): void {
  try {
    localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(list));
  } catch (err) {
    toast.error('Speicherfehler: Der lokale Browserspeicher ist nicht beschreibbar.', { id: 'storage_err' });
  }
}

/**
 * Gets currently active profile ID or 'default'.
 */
export function getActiveProfileId(): string {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

/**
 * Sets active profile ID.
 */
export function setActiveProfileId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  } catch {
    // ignore
  }
}

function getStorageKeyForProfile(profileId: string = getActiveProfileId()): string {
  return profileId === 'default' ? STORAGE_VERSION : `${STORAGE_VERSION}_${profileId}`;
}

/**
 * Saves the full character state object to localStorage for active or specified profile.
 */
export function saveToLocalStorage(state: Record<string, unknown>, profileId?: string): void {
  try {
    const activeId = profileId ?? getActiveProfileId();
    const key = getStorageKeyForProfile(activeId);
    localStorage.setItem(key, JSON.stringify(state));

    // Also update profile meta index
    const list = getProfilesList();
    const charName = (state.name as string) || 'Unbenannter Held';
    const charRace = (state.race as string) || 'Mensch';
    const existingIdx = list.findIndex((p) => p.id === activeId);
    
    if (existingIdx !== -1) {
      list[existingIdx] = {
        id: activeId,
        name: charName,
        race: charRace,
        updatedAt: Date.now(),
      };
    } else {
      list.push({
        id: activeId,
        name: charName,
        race: charRace,
        updatedAt: Date.now(),
      });
    }
    saveProfilesList(list);
  } catch (err) {
    toast.error('Speicherfehler: Der Charakter konnte nicht im Browserspeicher gesichert werden (Speicher voll oder blockiert).', { id: 'storage_save_err' });
  }
}

function fixV93AttrIncrements(data: Record<string, unknown>): Record<string, unknown> {
  const increments = data.attrIncrements as Record<string, number> | undefined;
  if (!increments || typeof increments !== 'object') return data;
  const fixed: Record<string, number> = {};
  for (const key of Object.keys(increments)) {
    fixed[key] = Math.max(0, (Number(increments[key]) || 0) - 1);
  }
  return { ...data, attrIncrements: fixed };
}

/**
 * Loads the full character state from localStorage for active or specified profile.
 */
export function loadFromLocalStorage(profileId?: string): Record<string, unknown> | null {
  try {
    const activeId = profileId ?? getActiveProfileId();
    const key = getStorageKeyForProfile(activeId);
    const current = localStorage.getItem(key);
    if (current) return JSON.parse(current) as Record<string, unknown>;

    if (activeId === 'default') {
      // Migrate from legacy keys
      const legacy =
        localStorage.getItem(LEGACY_V94) ?? localStorage.getItem(LEGACY_V93);
      if (legacy) {
        const parsed = JSON.parse(legacy) as Record<string, unknown>;
        const migrated = fixV93AttrIncrements(parsed);
        localStorage.setItem(STORAGE_VERSION, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_V94);
        localStorage.removeItem(LEGACY_V93);
        return migrated;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function deleteProfile(id: string): void {
  try {
    const key = getStorageKeyForProfile(id);
    localStorage.removeItem(key);
    const list = getProfilesList().filter((p) => p.id !== id);
    saveProfilesList(list);
    if (getActiveProfileId() === id) {
      setActiveProfileId('default');
    }
  } catch {
    // ignore
  }
}

export function clearLocalStorage(): void {
  const activeId = getActiveProfileId();
  deleteProfile(activeId);
}
