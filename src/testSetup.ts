/**
 * Testumgebung: wie im Editor ist das Grundregelwerk-Paket immer geladen (RegelwerkTor). Tests, die einen eigenen
 * Katalog brauchen, setzen ihn selbst; danach gilt wieder das Grundregelwerk.
 */
import { afterEach, beforeEach } from 'vitest';
import { Katalog } from './regelwerk/katalog';
import { aktiverKatalog, setzeAktivenKatalog } from './regelwerk/bruecke';
import { basisAusDateien } from './regelwerk/__tests__/hilfen';

const b = basisAusDateien();
const GRW = new Katalog(b.manifest, [b.basis]);
setzeAktivenKatalog(GRW, false);
beforeEach(() => { if (!aktiverKatalog()) setzeAktivenKatalog(GRW, false); });
afterEach(() => { if (!aktiverKatalog()) setzeAktivenKatalog(GRW, false); });
