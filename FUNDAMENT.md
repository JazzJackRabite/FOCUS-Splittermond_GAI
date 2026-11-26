# FUNDAMENT

Verbindliche Grundlage für FOKUS, das Charakterwerkzeug für Splittermond. Wer am Editor arbeitet – Mensch, Claude oder
Gemini in Google AI Studio – liest diese Datei zuerst und hält sich daran.

- Hier steht nur, **was gilt**. Was wann gemacht wurde, steht in `CLAUDE_EDITION.md`.
- Die Prüfungen in `src/fundament/__tests__/` setzen diese Datei durch. Schlägt eine fehl, ist der Code zu ändern, nicht die Prüfung.
- Änderungen an dieser Datei entscheidet der Projektinhaber.

> **Stand 22.11.2026 (Stand 45).** Teil 2 (Regelquellen) ist gegen den Code geprüft; eine Prüfung hält Tabelle und Code seitdem
> zusammen (`src/fundament/__tests__`).

---

## 1. Grundsätze

1. **Nur das Grundregelwerk ist eingebaut.** Die Erweiterungsbände heißen im Editor **Grimoires** (Einzahl: das Grimoire,
   Dateiendung `.grim`). Jeder Nutzer lädt sie selbst hoch; sie bleiben
   in seinem Browser. Buchinhalte kommen nicht ins Repository und nicht auf den Server.
2. **Regeln kommen aus den Regelpaketen.** Was im Grundregelwerk steht, steht im GRW-Paket, alles andere in den
   Grimoires. Der Editor legt keine Regel selbst fest: keine Tabellen nach Zauber-, Meisterschafts- oder Stärkennamen,
   keine Zahlen aus dem Gedächtnis. Fehlt ein Wert, kommt er zuerst ins Paket (Datenseite, Ordner `Werkzeuge`), dann liest
   ihn der Editor.
3. **Kein Regeltext aus Erweiterungen im Code.** Werkzeuge, Tests und Editor enthalten zu Erweiterungen nur IDs, Zahlen,
   Fingerabdrücke und kurze Kennwörter. Hinweistexte der Oberfläche formulieren keine Regeln aus Erweiterungen aus, sondern
   setzen Werte aus den Paketen ein. Tests mit Fällen aus einzelnen Büchern (Namen, Sollwerte) lesen diese aus der lokalen
   Falldatei `FOKUS_BUCHFAELLE` (`Pruefsuite/editor_buchfaelle.json`, nie im Repository); Beispiele ohne Buch sind erfunden.
   Eine lokale Prüfung sucht im Quelltext nach Eintragsnamen aus den Grimoires.
4. **Jede Regel hat eine Fundstelle.** Seitenangaben werden gegen das Paket geprüft, nicht geschätzt. Eine Auslegung ohne
   Regelstelle wird als Auslegung gekennzeichnet.
5. **Die App bleibt in Google AI Studio lauffähig:** Vite und React, `metadata.json` im Wurzelordner, Daten unter
   `public/`, keine neuen Abhängigkeiten ohne Rücksprache.
6. **Ein Erscheinungsbild.** Es gibt genau ein Design: das dunkle CI aus Teil 3. Kein helles Design, kein Farbschema-Menü.
7. **Sperren als Standard, Hausregeln auf Wunsch** (Entscheidung 11.11.2026). Verstößt eine Eingabe gegen eine Regel,
   sperrt der Editor sie und sagt, warum. Mit dem Schalter „Hausregeln erlauben“ (Einstellungen → Allgemein, Standard:
   aus) wird aus jeder Sperre eine Warnung. Keine Ansicht entscheidet das selbst: Regelprüfungen laufen über
   `regelverstoss()`, `aenderungGesperrt()` und `useHausregeln()` aus `src/fundament/hausregeln.ts`. Bei zusammengesetzten
   Einträgen (Gefolge, Untote, Golems) ist gesperrt, was einen Verstoß neu schafft oder vergrößert; Änderungen, die nichts
   verschlimmern, gehen immer.

## 2. Regelquellen

Welche Regel der Editor woher liest. „Paket“ meint das GRW-Paket und die hochgeladenen Grimoires gleichermaßen;
Felder stehen unter `daten` des jeweiligen Eintrags. **Was hier nicht steht, darf der Editor nicht selbst festlegen.**

| Bereich | Quelle im Paket | Liest im Editor |
|---|---|---|
| Kosten in Erfahrungspunkten, Heldengrade (Schwellen, Grenzen, Widerstandsbonus), Fertigkeitspunkte je Zaubergrad | Kernregeln: `strukturiert` mit `steigerungskosten`, `heldengrade` | `regelwerk/steigerungsregeln.ts` |
| Zustände: welche es gibt, Stufe, Abzüge auf Proben und Werte, Beschreibung, Quelle (Anzeige beim Überfahren mit der Maus), Ende durch Verschnaufpause oder Ruhephase; Verschiebung der Gesundheitsstufe (Verwundet, genau einmal im Wundabzug) | Einträge vom Typ `zustand`: `hat_stufe`/`parameter`, `zustandswirkung` (`probe.art` „wundstufe“), `beschreibung`, `quelle`, `pause_ende` – Grundregelwerk aus dem GRW-Paket, alle anderen aus den Grimoires | `regelwerk/zustaende.ts`, `regelwerk/zustandswerte.ts`, `regelwerk/vitals.ts`, `utils/characterCalculations.ts`, `utils/conditionModifiers.ts` |
| Listen des Grundregelwerks: Zauber, Meisterschaften (mit Schwellenwerten), Stärken (wie oft wählbar), Schwächen, Ressourcen (mit Stufenübersicht), Sprachen, Mondzeichen, Fertigkeiten mit Attributen, Rassen, Stärkenpunkte der Erschaffung, Attribute, Gesundheitsstufen | Einträge des GRW-Pakets: `schulen`, `kosten`, `zauberdauer`, `reichweite`, `wirkungsdauer`, `typus`, `wirkung`, `erfolgsgrade`, `schwierigkeit_strukturiert`, `schwelle`, `manoever`, `beschreibung`, `stufe`, `nur_bei_generierung`, `mehrfach_waehlbar`, `tabelle`, `familie`, `untergruppe`, `kategorie`, `attribute`, `attributsmodifikatoren`, `groessenklasse`, `staerken_refs`, `zusaetzliche_staerkepunkte`, `mehrfach_waehlbar`; Kernregeln: `strukturiert` mit `schwellen`, `staerke_punkte` | `regelwerk/grwListen.ts` |
| Pausen (Ruhephase, Verschnaufpause), Ruhewirkungen von Stärken und Meisterschaften, Minderung von Wundabzügen, Behinderung und Tick-Zuschlag für Rüstung bzw. Schild | Kernregel „Heilung“: `ruheregeln`; Stärken/Meisterschaften: `ruhewirkung` (`lp_faktor`, `fo_faktor`, `lp_zusatz`, `erschoepft_minuten`, `fo_erschoepft_minuten`, `regeneration_faktor`, `bedingung`, `beleg`); Wirkungen mit `bezug` `wundabzug`, `behinderung`, `tick_zuschlag` und `gilt_fuer`; Traglast (Optionalregel): `strukturiert.traglast` | `regelwerk/spielwirkungen.ts` |
| Heimatregionen für die kostenlose Kulturkunde | Kultur-Module: `felder.kulturkunde` | `regelwerk/grwListen.ts` |
| Kampfmanöver: freie Manöver (Wuchtangriff, Betäubungsschlag, Störender Angriff), Kosten in Erfolgsgraden, Streiftreffer, Kombination mehrerer Manöver (`kombination`), Wirkung der Meisterschafts-Manöver (Widerstand, halber/kein Schaden, Zusatzschaden, Zustand, Tickverlust, Voraussetzung), Merkmal Wuchtig; Spielwerte der Merkmale (Schadenswurf, Bedingungen, Verteidigung durch geführte Waffen) | Kernregel „Nahkampfhandlungen“: `manoever_regeln`; Meisterschaften mit `manoever`: `manoeverwirkung`, sonst `wirkungen_strukturiert` mit `gilt` „beim Manöver“; Merkmale: `wuchtangriff_je_eg`, `merkmal_wirkung` | `utils/combatRules.ts`, `regelwerk/merkmale.ts` |
| Proben: Patzer und Triumph beim Würfeln, Erfolgsgrade je Punkte über/unter der Schwierigkeit, Einstufung (knapp, gut, herausragend …) – für Fertigkeitsproben, Angriffe und Zauber | Kernregeln „Erfolgsgrade (EG)“: `strukturiert` mit `punkte_je_eg`, `stufen`; „Patzer“: `summe_hoechstens`, `eg_aenderung`, `eg_hoechstens`; „Triumph“: `summe_mindestens`, `eg_aenderung` | `regelwerk/proben.ts` |
| Lage beim Angriff: Kampfpositionen (eigene und gegnerische), Taktischer Vorteil, Überzahl, Lücke suchen, Zielen, Deckung, Kampfgetümmel; Meisterschaften, die eine Situation aufheben (Scharfschütze) | Kernregeln „Kampfpositionen“: `kampfpositionen`; „Taktischer Vorteil“, „Überzahl“, „Fernkampfhandlungen“, „Nahkampfhandlungen“: `kampfsituationen`; Meisterschaften: `ignoriert_situation` | `regelwerk/kampflage.ts` |
| Zauber durch Erfolgsgrade verbessern: EG je Option (Fokus sparen, Schaden, Reichweite, Wirkungsdauer, Wirkungsbereich, Auslösezeit), Höchstzahl und Mindestwerte; Grunddauer des Auslösens | Kernregeln „Zauber durch Erfolgsgrade verbessern“: `strukturiert.optionen`; „Erläuterung der Zauberbeschreibungen“: `strukturiert.ausloesezeit_ticks` | `regelwerk/zauberEg.ts` |
| Zulässige Optionen und Verstärkungen eines Zaubers: EG, Zusatzkosten, verursachte Zustände (Stufe, Ticks, nur bei misslungener Probe); eigene Zauber ohne Paketeintrag nur aus ihrem Text, ohne Zustandssuche | Einträge vom Typ `zauber`: `erfolgsgrade_strukturiert.optionen`, `.verstaerkungen[]` mit `eg`, `kosten`, `wirkung`, `zustaende` (je mit `beleg`) | `regelwerk/zauberEg.ts`, `utils/magicRules.ts` |
| Potenzial von Tieren (Grundwert, Qualität, Kreatur, Vertrauter, Meisterschaften) – nur mit dem Bestienmeister-Grimoire | `strukturiert.potenzial` (Eintrag des Grimoires) | `regelwerk/begleiter.ts` |
| Ausrüstung des Grundregelwerks; Angriffswert (Fertigkeitspunkte + Attribute der Waffe), waffenloser Angriff | Ausrüstungseinträge des GRW-Pakets (`schaden`, `wgs`, `modus`, `merkmale_text`, `attribute`, `vtd_bonus`, `sr`, `behinderung`, `preis`, `last`, `haerte`) | `regelwerk/ausruestung.ts`, `utils/characterCalculations.ts` |
| Pakete laden und im Browser speichern; Start ohne Netz aus der zuletzt geladenen Fassung (Prüfsumme gegen das Manifest); die App-Dateien selbst hält der Service Worker `public/sw.js` vor (Regelpakete laufen nicht über ihn); Manifest und Grundregelwerk immer mit Nachfrage beim Server (das Hosting meldet alle Dateien als unveränderlich) | Paketkopf, Einträge, `sha256` im Manifest | `regelwerk/laden.ts`, `regelwerk/paketSpeicher.ts`, `regelwerk/RegelwerkContext.tsx`, `main.tsx` |
| Einträge finden, Namen und IDs, Umbenennungen | Einträge mit `id`, `typ`, `name`; ID-Register | `regelwerk/katalog.ts`, `regelwerk/bruecke.ts`, `regelwerk/ids.ts` |
| Abgeleitete Werte, Heldengrade, Höchstbonus | Kernregeln: `strukturiert`; an Stärken: `abgeleitete_werte_modifikatoren`; `groessenklasse`; an Ausrüstung: `behinderung`, `vtd_bonus`, `mindest_staerke` | `regelwerk/abgeleitet.ts` |
| Voraussetzungen | `voraussetzungen` (formal, mit IDs; `gleiche_fertigkeit` für „in der gleichen Magieschule“) | `regelwerk/bedingungen.ts` |
| Erschaffung: Rassen, Kulturen, Abstammungen, Module, Grenzen je Schritt; Grenzen im Editor (Attributpunkte und Höchstwert, Fertigkeitspunkte und Höchstwert, nicht-magische Punkte, Ressourcen, Start-Meisterschaften, Sprachen); Schwerpunkte zählen als Meisterschaft der ersten Schwelle | `modulwerte`, `attributsmodifikatoren`, `staerken_refs`, `strukturiert`, `tabelle`; Kernregel „Übersicht über die Charaktererschaffung“: `strukturiert` (`attribute`, `kultur_frei`, `abstammung_frei`, `ausbildung_frei`, `schritt_7`, `feinschliff`, `steigerungskosten_spielbeginn`); Schwerpunkte: `fertigkeit`, `schwelle` | `regelwerk/erschaffung.ts`, `regelwerk/erschaffungEditor.ts`, `regelwerk/grwListen.ts` |
| Archetypen des Grundregelwerks (Anhang 3): Werte der Charakterbögen, Modulwahl, Herkunft jeder Stärke, Meisterschaft, jedes Zaubers und jeder Ressourcenstufe (Rasse, Kultur, Abstammung, Ausbildung, Schritt 7, Feinschliff, Start-Erfahrung), Begründung, wo ein Bogen vom Modul abweicht | Einträge vom Typ `archetyp`: `titel`, `kurzbeschreibung`, `ausbildung_name`, `rasse`, `kultur`, `abstammung`, `mondzeichen`, `attribute`, `attribute_basis`, `rasse_frei`, `kultur_wahl`, `abstammung_wahl`, `kultur_frei`, `abstammung_frei`, `fertigkeiten`, `fertigkeiten_ep`, `staerken`, `meisterschaften`, `zauber`, `ressourcen`, `schwaechen`, `sprachen`, `kulturkunde`, `ausruestung`, `vermoegen`, `splitterpunkte`, `ep` | `regelwerk/archetypen.ts` |
| Wirkungen von Stärken und Meisterschaften (feste Boni, Boni beim Würfeln) | `wirkungen_strukturiert` mit `fertigkeit_refs`, `alle_proben`, `gilt`, `traeger` | `regelwerk/wirkungen.ts` |
| Kosten und Zauberdauer aus Meisterschaften; Wirkungen nur für Zauber eines Typus | `wirkungen_strukturiert`, Gruppe B, `zauber_typus`; Zauber: `typus` | `regelwerk/wirkungen.ts` |
| Wirkung aktiver Zauber (Kampfwerte, Proben, Zusatzschaden, Lebenspunkte, unterdrückte Zustände) | `spielwerte`, `typus`, `reichweite` | `regelwerk/zauberwerte.ts`, `utils/magicRules.ts` |
| Zauber, Meisterschaften, Stärken, Ressourcen aus Grimoires in den Auswahllisten | `schulen`, `kosten`, `zauberdauer`, `reichweite`, `wirkungsdauer`, `wirkung`, `erfolgsgrade`, `schwelle`, `stufe`, `fertigkeit`, `manoever` | `regelwerk/bruecke.ts` |
| Ausrüstung aus Grimoires | Ausrüstungseinträge; `modus` (ersetzt, ergänzt) | `regelwerk/ausruestung.ts` |
| Relikte | `relikt_baukasten`, `baustein` | `regelwerk/relikte.ts` |
| Begleiter: Tiere, beschworene Wesen, Dienste | `werte_berechnet`, `tabellenzeile`, `beschwoerbares_wesen_stufe`, `immer_verfuegbar`; erweiterte Dienste: `erweiterte_dienste`, `freigeschaltet_durch`, `stufengrenze_erhoeht_durch` (je `bis_stufe`); Abrichtungen: `mehrfach_grenze`, `sammel_fuer_gruppe`, `macht_reittier` | `regelwerk/begleiter.ts`, `regelwerk/dienste.ts` |
| Begleiter: Gefolge, erhobene Untote, Golems | `strukturiert` (`gefolge`, `untote`, Golem-Regeln), `wertesaetze`, `attribute`, `modulwerte`, `modifikationen_strukturiert`, `kosten_ep`, `baustein`, `felder`, `tabellen`; Golem-Bausteine: `voraussetzung_name`, `mehrfach_aus_text`; Feinschliff: `sonderausstattung`; Animierungszauber: `golem_stufe_bis` | `regelwerk/gefolge.ts`, `regelwerk/untote.ts`, `regelwerk/golem.ts`, `regelwerk/modifikationen.ts`; Belegung der Ressourcen Kreatur und Golem: `components/begleiter/besitzer.ts` |
| Begleiter: Wesen-Baukasten (beschwörbare Wesen, Kreaturen) | Einträge `wesen_baukasten_basis`, `wesen_baukasten_modul`, `wesen_baukasten_rolle`; `beschwoerbares_wesen_stufe`, `ressource_kreatur`, `stufe_bonus`, `kosten_punkte`, `mehrfach`, `gruppe`, `voraussetzungen`, `moegliche_dienste`, `modifikationen_strukturiert`; Schritt 5: `strukturiert` | `regelwerk/wesenBaukasten.ts`, `regelwerk/modifikationen.ts` |
| Begleiter: Abrichtungen mit Zahlen, Vertraute | Abrichtungen: `modifikationen_strukturiert`, `wahlen`, `werte_hinweis`; Vertrautenmagie: `vertrautenmagie` (Meisterschaften), `typus` (Zauber) | `regelwerk/abrichtungsWerte.ts`, `regelwerk/vertraute.ts` |
| Baukästen: doppelte Merkmale, Verbesserte Angriffe | Feinschliff-Regeln: `strukturiert` (`merkmale_zusammenfuehren`, `verbesserte_angriffe`); Rolle: `verbesserter_angriff`; Waffen: `schaden`, `wgs`, `modus`, `merkmale_text`, `zweihaendig` | `regelwerk/modifikationen.ts`, `regelwerk/wesenBaukasten.ts`, `regelwerk/golem.ts` |
| Lebenspunkte und Stufen der Begleiter | Kernregeln: `strukturiert`; Merkmale: `gesundheitsstufen_namen`, `betaeubungsimmun` | `regelwerk/vitals.ts` |
| Schadens- und Heildialog | Splittergaben: `strukturiert.gaben`; Heilung: `strukturiert.pausen`, `ruheregeln`; Zustände: `hat_stufe`, `zustandswirkung`; Heilkunde: `auswirkungen`; Heiltränke: `heilung_lp` (Alchemika) | `regelwerk/schadenUndHeilung.ts` |
| Sterben: Zustände beim ersten echten Punkt auf der letzten Gesundheitsstufe und wenn dort alle LP verloren sind, Probe gegen Wundschock, Tod; Länge der LP-Leiste | Kernregel „Sterben“: `strukturiert` (`zustand_bei_erstem_schaden`, `zustaende_bei_allen_lp`, `tot_mehr_als_stufen`, `erster_echter_schaden_auf_todgeweiht.probe`) | `regelwerk/schadenUndHeilung.ts`, `hooks/useCharacterState.ts` |
| Mondzeichen-Gaben im Würfeldialog (Probe, Angriff, Zauber), Schwerpunkt-Bonus in Proben; Schwerpunkte wählen (Vorschläge, je Heldengrad einmal); Ressourcen mehrfach erwerbbar; Höchststufe einer Ressource | Mondzeichen: `gabe_strukturiert` (`art`, `hoechster_hoechstens`, `kosten_splitterpunkte`, `beleg`); Regel „Schwerpunkte“: `strukturiert.bonus_je_schwerpunkt`, `strukturiert.hoechstens_je_heldengrad`; Schwerpunkte: `vorschlaege`, `platzhalter`, `nach_typus`, `schwelle`; Ressourcen: `mehrfach_erwerbbar`, `tabelle.zeilen[].punkte` | `regelwerk/grwListen.ts` |
| Rast der Begleiter (Begleiterarten ohne LP-Regeneration in der Ruhephase; Zustände nach Pausen) | Regeltexte: `strukturiert.ruhephase_begleiter`; sonst `ruheregeln` der Kernregel „Heilung“; Zustände: `pause_ende` (über `nachPause`) | `regelwerk/begleiterRast.ts` |

Ansichten (`components/`) greifen nicht selbst in die Paketdaten, sondern fragen die Module aus `regelwerk/`. Wo eine
Ansicht das heute noch tut, steht sie in `src/fundament/altlasten.json` (`paketzugriffe`).

### Regeln, die noch im Code stehen (Altlasten)

Keine. Der Editor startet erst, wenn das Grundregelwerk-Paket geladen ist (`app/RegelwerkTor.tsx`); eingebaute
Rückfall-Listen gibt es nicht mehr. Ohne Paket liefern die Module unter `regelwerk/` leere Listen und neutrale Werte
(keine Erfolgsgrade, keine Kosten, keine Zustände). Neue Altlasten kommen nicht hinzu: Die Prüfungen in
`src/fundament/__tests__` schlagen bei Regelnamen im Code, Paketzugriffen aus Ansichten und Suchmustern auf Regeltext
fehl; die Liste der geduldeten Stellen (`src/fundament/altlasten.json`) ist leer und wird nie von Hand erweitert.

Suchmuster, die Regeltext lesen (eine Wortfolge aus drei oder mehr Wörtern oder der Name einer Regel), sind im Editor nicht
erlaubt: Was aus Fließtext gelesen werden muss, liest die Datenseite (`Werkzeuge/regelpakete/textauslese.py`) und schreibt ein Feld.

Die Archetypen kommen aus dem GRW-Paket (Einträge vom Typ `archetyp`, Datenseite `Werkzeuge/regelpakete/archetypen.json` und
`archetypen.py`); im Code steht kein Beispielcharakter. Beim Laden schreibt der Editor die IDs aus dem Paket mit. Ein Test prüft,
dass jeder Archetyp die Erschaffungsprüfung ohne Befund besteht, nur Einträge des GRW-Pakets nennt und die Start-Erfahrung wie
im Bogen einsetzt (`archetypen.test.ts`); die abgeleiteten Werte stehen als Sollwerte der Bögen in `nachrechnen.test.ts`.
Die Tests laufen wie der Editor mit geladenem Grundregelwerk-Paket (`src/testSetup.ts`).

## 3. Gestaltung

Ein dunkles Erscheinungsbild auf Grundlage von Marineblau und Gold: ruhig, warm, für lange Spielabende.
Das Muster dazu ist das Mockup „FOKUS – Mockup dunkles CD“. Im Zweifel gilt, was dort zu sehen ist:

- Spielansicht: [`docs/fundament/mockup-spielansicht.png`](docs/fundament/mockup-spielansicht.png)
- Bausteine und Farben: [`docs/fundament/mockup-bausteine.png`](docs/fundament/mockup-bausteine.png)

### Werte

Alle Werte stehen in `src/fundament/fundament.css` und **nur dort**. Ansichten verwenden die Namen
(`bg-flaeche`, `text-leise`, `border-gold`, `font-titel`, `rounded-karte`), nie einen Farbwert.

| Name | Wert | Verwendung |
|---|---|---|
| `seite` | `#1C2130` | Hintergrund der App, Spur des Scrollbalkens |
| `flaeche` | `#242A3B` | Karten, Dialoge, Kopfzeile |
| `erhoeht` | `#2C3347` | Eingabefelder, neutrale Knöpfe, Hover |
| `rahmen` | `#3A4258` | Rahmen und Trennlinien |
| `schrift` | `#E6E1D3` | Überschriften, Werte, Fließtext |
| `leise` | `#A3A096` | Beschriftungen, Nebentext, Griff des Scrollbalkens |
| `gold` | `#C9A24C` | Marke, aktiver Reiter, Hauptaktion |
| `gold-hell` | `#D9B563` | Abschnittstitel, Schrift auf goldumrandeten Knöpfen, Hover |
| `unverletzt` / `-grund` | `#7A9D76` / `#26301F` | freie Lebenspunkte, Heilen |
| `erschoepft` / `-grund` | `#C99A4E` / `#332A19` | erschöpfter Fokus, Betäubungsschaden |
| `schaden` / `-grund` | `#B06258` / `#33211D` | Schaden, verzehrter Fokus, Wundabzug, Gefahr |
| `kanalisiert` / `-grund` | `#6C8CAA` / `#1F2836` | kanalisierter Fokus |
| `magie` / `-grund` | `#9683AB` / `#292233` | Zauber, Magieschulen, Zauberboni |
| `temporaer` / `-grund` | `#6BA99C` / `#1E2D29` | temporäre Lebenspunkte |

Schrift: **Cinzel** (`font-titel`) für Marke, Überschriften und große Zahlen; **Merriweather** (`font-text`) für alles andere.
Größen: Fließtext 14, Beschriftung 12, kleinste Schrift 11, Abschnittstitel 17, große Werte 22–30.
Rundungen: Karten und Dialoge 12 (`rounded-karte`), Knöpfe und Felder 8 (`rounded-knopf`), Marken voll gerundet.

### Regeln

1. **Gold ist knapp.** Gold bekommen nur die Marke, Abschnittstitel, der aktive Reiter und die eine Hauptaktion einer
   Ansicht oder eines Dialogs. Alles andere bleibt in den Blaugrau-Tönen.
2. **Bedeutungsfarben sind Rahmen, keine Schrift.** Eine Bedeutung zeigt sich als Rahmen auf ihrem gedämpften Grundton;
   der Text darauf bleibt `schrift`. Bedeutungsfarben als Textfarbe sind zu kontrastarm.
3. **Jede Farbe hat eine Bedeutung.** Rot heißt Schaden oder Gefahr, Grün Gesundheit, Lila Magie – nie Schmuck.
   Eine Bedeutung hängt nie allein an der Farbe: Es steht immer ein Wort oder eine Zahl dabei.
4. **Schaltflächen sind mindestens 44 Pixel hoch** und echte `<button>`- bzw. `<a>`-Elemente. Knöpfe nur mit Symbol
   brauchen eine Beschriftung für Vorleseprogramme (`aria-label`). Eingabefelder haben immer eine Beschriftung.
5. **Keine Verläufe, keine Leuchteffekte, keine Emojis.** Flächen sind einfarbig; Symbole kommen aus `lucide-react`.
6. **Lesbarkeit geht vor.** Schrift und Hintergrund desselben Elements haben ein Kontrastverhältnis von mindestens
   4,5 : 1. Verboten sind damit dunkle Schrift auf dunklem Grund und helle Schrift auf hellem Grund. Erlaubte Paare:

   | Hintergrund | Schrift |
   |---|---|
   | `seite`, `flaeche`, `erhoeht` | `schrift`, `leise`, `gold`, `gold-hell` |
   | `rahmen` (z. B. unter dem Mauszeiger) | `schrift`, `gold-hell` |
   | gedämpfte Grundtöne (`schaden-grund`, `magie-grund` …) | `schrift` |
   | `gold`, `gold-hell` | `seite` |
   | kräftige Bedeutungsfarben (`schaden`, `magie` …) | gar nicht als Fläche hinter Text – nur als Rahmen, Balken, Punkt |

   Ändert ein Zustand (Mauszeiger, gewählt, gesperrt) den Hintergrund, muss die Schriftfarbe dazu passen. Eine Prüfung
   rechnet das für jede Klassenliste nach und schlägt bei einem Verstoß fehl. Sie sieht nur Schrift und Hintergrund am
   selben Element; Schrift, die ihre Farbe von außen erbt, erfasst sie nicht.
7. **Scrollbalken:** Spur `seite`, Griff `leise`, unter dem Mauszeiger `gold`, 10 Pixel breit. Gilt überall von selbst.
7. **Am Handy brauchbar:** Bereiche stapeln sich, Leisten brechen um, breite Tabellen rollen in ihrem eigenen Kasten.

### Bausteine

Ansichten setzen sich aus den Bausteinen in `src/fundament/` zusammen (`import { Knopf, Karte } from '…/fundament'`).
Fehlt einer, wird er dort ergänzt – nicht in der Ansicht nachgebaut.

| Baustein | Zweck | Varianten |
|---|---|---|
| `Knopf` | jede Schaltfläche | `primaer` (Gold, eine je Ansicht), `sekundaer` (goldener Rahmen), `neutral`, `gefahr`, `erholung`; `nurSymbol`; `eng` (schmaler Innenabstand für mehrere Knöpfe in einer Handyzeile) |
| `Wahlknopf` | auswählbare Karte oder Filter (eine Wahl aus mehreren, Umschalter), `aria-pressed` | Ton im gewählten Zustand: `gold`, `erholung`, `gefahr`; `mittig` |
| `Leistenknopf` | Knopf in einer farbigen Leiste (Plus/Minus, mittige Beschriftung); füllt die Höhe der mindestens 44 px hohen Leiste | Farben über `className` aus fundament.css |
| `Feldknopf` | Kästchen einer Punkteleiste (LP, Fokus, temporäre LP), per Klick zurücknehmbar; bewusst klein, damit die Leiste in eine Zeile passt | `beschriftung` (Pflicht, wird title und aria-label), leere Kästchen `disabled` |
| `Reiter` | Reiter einer Leiste (Hauptnavigation, Reiter in Dialogen), `role="tab"`, goldene Unterstreichung | – |
| `Karte` | Fläche für einen zusammengehörigen Bereich | – |
| `Abschnittstitel` | Titel eines Bereichs | `h2`, `h3` |
| `Marke` | kleine Kennzeichnung: Zustand, Bonus, Kosten | Ton: `neutral`, `gold`, `unverletzt`, `erschoepft`, `schaden`, `kanalisiert`, `magie`, `temporaer`; `klein` |
| `Eingabe`, `Auswahl` | beschriftete Felder | Beschriftung sichtbar oder verborgen |
| `Rollbereich` | Bereich mit eigenem Scrollbalken | – |
| `Dialog` | Fenster über der Ansicht: Titelzeile mit goldener Linie, Inhalt, Fußzeile mit Aktionen | `schmal`, `mittel`, `breit` |
| `Dialogkopf` | Titelzeile eines Dialogs mit eigenem Aufbau (Symbol, Titel, Untertitel, Aktionen, Schließen-Knopf); dazu `Dialoghintergrund`, `Dialogfenster`, `useEscape` | Ton des Symbols wie bei `Marke` |
| `Rauten` | Zählbare Punkte wie Splitterpunkte: gefüllte Raute = vorhanden, nur Rand = verbraucht; mit Beschriftung für Vorleseprogramme | – |

### Stand der Umstellung

Alle Ansichten verwenden die benannten Werte; fest eingetragene Farbwerte gibt es nur noch in `fundament.css`. Die frühere
Übergangsdatei ist gelöscht. Gemeinsame Klassen, die keine Bausteine sind (Grundstil der Seite, Protokollkarten,
Würfelbanner, Druck), stehen in `src/fundament/klassen.css` – ebenfalls ohne eigene Farbwerte.

Alle Dialoge haben die Titelzeile aus den Bausteinen (`Dialog` oder `Dialogkopf`, eine Prüfung hält das fest), schließen mit
Escape und haben einen Schließen-Knopf mit Beschriftung für Vorleseprogramme. Schaltflächen kommen aus den Bausteinen (`Knopf`, `Wahlknopf`, `Reiter`, `Leistenknopf`, `Feldknopf`); eine Prüfung zählt selbst gebaute `<button>` je
Datei (`knoepfe` in `src/fundament/altlasten.json`) und lässt sie nur weniger werden.

## 4. Arbeitsweise

1. **Vor der Arbeit:** diese Datei lesen, den aktuellen Stand holen (`git pull`).
2. **Prüfen:** `npx tsc --noEmit` und `npx vitest run` müssen ohne Fehler laufen, `npm run build` muss gelingen.
   Mit den Büchern (nur auf dem Rechner des Projektinhabers, Pfade unter `SCR4P3`) laufen zusätzlich die lokalen Tests:
   `FOKUS_GRIMOIRES=<Regelpakete/editor/grimoires> FOKUS_BUCHFAELLE=<Pruefsuite/editor_buchfaelle.json>
   FOKUS_REFERENZ_VOLL=<Pruefsuite/editor_referenz_voll.json> npx vitest run`. Nach jedem Bauen der Pakete vorher
   `python editor_referenz.py` im Ordner `Pruefsuite`. Ohne diese Variablen werden die lokalen Tests übersprungen.
3. **Altlasten werden nur weniger.** Wer eine Ansicht umstellt oder eine Regel ins Paket verlagert, schreibt die Liste neu:
   `FUNDAMENT_ALTLASTEN=schreiben npx vitest run src/fundament`. Die Liste wird nie von Hand erweitert.
4. **Festhalten:** Jede abgeschlossene Arbeit bekommt einen Eintrag „Stand n“ in `CLAUDE_EDITION.md` (fortlaufend
   nummeriert): was geändert wurde, mit welcher Fundstelle, was offen bleibt.
5. **Arbeit aus Google AI Studio** wird nach GitHub übertragen und gegen das Grundregelwerk geprüft, bevor darauf
   weitergebaut wird. Bildschirmfotos und Buchseiten gehören nicht ins Repository.
6. **Mehrere Bearbeiter zugleich:** jeder auf eigenem Zweig, nacheinander nach `main`. Während eine Ansicht umgestellt
   wird, arbeitet dort niemand sonst.
