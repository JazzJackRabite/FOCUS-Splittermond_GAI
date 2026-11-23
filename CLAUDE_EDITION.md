# FOKUS 1.0 – Claude-Edition

Repository `JazzJackRabite/FOKUS-1.0-claudeedition` (Branch `main`; entstanden als Branch `FOKUS-1.0-claudeedition` von FOKUS-1.0). Ziel: Der Editor arbeitet mit den Splittermond-Regelpaketen aus dem Ordner `SCR4P3/Regelpakete`
(feste IDs statt Namen, Regeln aus den Daten statt fest im Code).

## Stand 1 (05.11.2026): Regelpakete und Lader

- **Eingebaut ist nur das Grundregelwerk:** `public/regelpakete/manifest.json` und `grw.srp.json`
  (erzeugt mit `Werkzeuge/regelpakete/editor_export.py`, Ordner `Regelpakete/editor/basis`). Andere Bücher liegen nicht im Repo.
- **Grimoires lädt man selbst:** Einstellungen → Regelpakete → „Grimoires auswählen“, Dateien aus
  `Regelpakete/editor/buecher` (z. B. `magie.grim`). Sie bleiben im Browser (IndexedDB), werden beim nächsten Start wieder
  geladen und nie an einen Server geschickt. Jedes Grimoire bringt seine Ladeangaben mit (`ladeinfo`: Ladereihenfolge,
  Abhängigkeiten, Regelgruppen, Umbenennungen).
- **Lader in TypeScript** (`src/regelwerk/`): Portierung von `Pruefsuite/lader.py`
  - `Katalog` – Lade-Algorithmus, Ergänzungen/Ersetzungen, Regelgruppen (geltende Fassung), Referenzprüfung
  - `erfuellt` – alle Bedingungsarten der Voraussetzungen
  - `abgeleiteteWerte` – Formeln, Heldengrad, Stärken, Ausrüstung, Höchstbonus, Wunden (GRW S. 13–15)
  - `pruefeErschaffung` – alle Schritte und Budgets der Erschaffung (GRW S. 22–30)
  - `verfuegbareDienste` – Dienste beschworener Wesen (nur mit Grimoire „Die Magie“)
  - `RegelwerkProvider` / `useRegelwerk()` – Katalog für die ganze App
- **Abgleich mit der Python-Referenz:** `src/regelwerk/__tests__/regelwerk.test.ts` vergleicht 161 Voraussetzungen ×
  13 Charaktere, 120 Berechnungen abgeleiteter Werte und 150 Erschaffungen mit den Ergebnissen des Python-Laders.
  Mit allen Büchern lokal: `FOKUS_GRIMOIRES=<Regelpakete/editor/buecher> FOKUS_REFERENZ_VOLL=<referenz_voll.json> npx vitest run src/regelwerk`.

## Stand 2 (05.11.2026): Regeln aus den Daten, Bücher im Editor

- **Abgeleitete Werte nach den Regeldaten** (`regelwerk/bruecke.ts` → `abgeleiteteFuerCharakter`, eingebunden in
  `utils/characterCalculations.ts`). Damit sind vier Abweichungen vom Buch behoben:
  1. Heldengrad-Bonus +2 auch auf die Verteidigung, nicht nur auf GW und KW (GRW S. 89)
  2. +1 Splitterpunkt je Heldengrad (S. 88)
  3. Stärken wirken auf abgeleitete Werte: Flink, Hoher Geistiger/Körperlicher Widerstand, Verbesserte Initiative, Einen Schritt voraus,
     Robust, Erhöhter Fokuspool, Zusätzliche Splitterpunkte
  4. Halbe Behinderung auf GSW kaufmännisch gerundet (S. 11); VTD-Bonus der Ausrüstung bis zum Höchstbonus (S. 18)
  Ohne geladene Regelpakete (z. B. in alten Tests) rechnet der Editor wie bisher.
- **Voraussetzungen über den Katalog** (`utils/prerequisiteValidator.ts` → `voraussetzungAusKatalog`): Jede Meisterschaft, die im Katalog
  steht (GRW und hochgeladene Grimoires), wird formal geprüft; „Entscheidung der Spielleitung“ wird als Hinweis angezeigt.
- **Hochgeladene Bücher im Editor:** Zauber, Meisterschaften (mit Schwelle, Manöver-Kennzeichen, Voraussetzung), Stärken, Schwächen und
  Ressourcen erscheinen in allen Auswahllisten (über `getActivePackages` im `gameResourceManager`). Allgemeine Kampf- und
  Magiemeisterschaften der Bücher stehen bei den passenden Fertigkeiten.
- **Zuordnung Editor-Namen → IDs** geprüft: alle Rassen, Fertigkeiten, Stärken, Ressourcen und Meisterschaften des Editors haben eine ID.

## Stand 3 (05.11.2026): Erschaffung nach Regelwerk

- **Kultur & Abstammung** (neue Karte in der Erschaffung, `components/creation/ErschaffungRegelwerk.tsx`): Modul wählen
  (12 Kulturen und 17 Abstammungen des GRW, dazu Kulturen hochgeladener Bücher) oder frei verteilen. Wahlmöglichkeiten des Moduls
  (z. B. „Redegewandtheit oder eine Magieschule“, Ressourcen, Stärke, Meisterschaft) per Auswahlliste; „Modulwerte eintragen“
  schreibt Fertigkeitspunkte, Ressourcen, Stärke und Meisterschaft in den Charakter, „Werte wieder austragen“ nimmt sie zurück.
  Die Wahl wird mit dem Charakter gespeichert (`erschaffung`, auch im JSON-Export/Import).
- **Regelprüfung der Erschaffung (GRW S. 22–30)** mit `pruefeErschaffung()`: Attribute, freie Rassenmodifikatoren, Kultur, Abstammung,
  Ausbildung, Schritt 7, Start-Erfahrung und Feinschliff. Weil der Editor nur Summen speichert, ordnet `regelwerk/erschaffungEditor.ts`
  die Punkte außerhalb der Module den Schritten zu (maximaler Fluss über die Grenzen je Schritt): Gibt es eine regelgerechte Verteilung,
  wird sie gefunden; sonst meldet die Prüfung den überzogenen Schritt.
- FO in der Erschaffung zeigt jetzt den Gesamtwert mit Stärken (z. B. Erhöhter Fokuspool).
- Damit ist die letzte der sechs bekannten Abweichungen vom Buch behoben.

## Stand 4 (05.11.2026): Würfel, Großmeister, freie Meisterschaften

- **Gemeinsame Würfellogik** (`utils/wuerfeln.ts`) für Probe, Angriff und Zauber nach GRW S. 16–19. Der Angriffsdialog wich vorher
  vom Buch ab (Sicherheitswurf addierte beide Würfel, Patzer nur bei Doppel-1, Triumph nur bei Doppel-10); jetzt einheitlich:
  Patzer bei Augensumme ≤ 3, Triumph ab 19, Sicherheitswurf wertet nur den höheren Würfel.
- **Großmeister** ab 15 Fertigkeitspunkten (Schwelle aus den Regeldaten): automatisch ein zusätzlicher W10 bei Probe, Angriff und Zauber,
  zählt nicht für den Patzer; Hinweis in der Fertigkeitszeile.
- **Freie Meisterschaft trotz unerfüllter Voraussetzung** (GRW S. 92): Sind auf einer Schwelle nur solche Meisterschaften übrig, ist
  eine davon als Gratis-Meisterschaft wählbar (mit Hinweis, dass sie erst mit erfüllter Voraussetzung nutzbar ist).
- Geprüft: Die GRW-Texte der eingebauten Daten stimmen mit den Regelpaketen überein (419 Zauber, 437 Meisterschaften, 43 Stärken,
  20 Schwächen identisch; Ressourcen nur mit eingebetteter Stufentabelle) – kein Austausch nötig.

## Stand 5 (05.11.2026): Begleiter

- **Karte „Begleiter“ im Inventar** (`components/begleiter/BegleiterKarte.tsx`, Logik in `regelwerk/begleiter.ts`), nur mit Regelpaketen.
- **Tiergefährten** über die Ressource Kreatur (GRW S. 78): Auswahl aus allen Kreaturen/Tieren mit Merkmal „Kreatur N“; Tiere über der
  höchsten Ressourcenstufe sind gesperrt, Hinweise bei zu vielen Tieren oder zu niedriger Stufe. Mit dem GRW allein: 11 Tiere
  (Taube bis Riesenschlange, S. 284–287); weitere kommen mit Büchern wie dem Bestienmeister. Wertekasten aufklappbar; bei
  „Werte wie … mit folgenden Änderungen“ die berechneten Werte.
- **Beschworene Wesen** (nur mit „Die Magie“, 65 Wesen): Auswahl, Werte und verfügbare Dienste je nach den Meisterschaften des Charakters.
- Gespeichert im Charakter als `begleiter: [{ id, art, name }]` (Import geprüft); Aktionen `BEGLEITER_HINZU` / `BEGLEITER_ENTFERNEN`.

## Stand 6 (05.11.2026): Wirkungen

- `regelwerk/wirkungen.ts` liest `wirkungen_strukturiert` der Stärken und Meisterschaften des Charakters (nur Wirkungen auf ihn selbst).
- **Eingerechnet:** dauerhafte Boni auf benannte Fertigkeiten (z. B. Einfühlsamkeit: Empathie +2) im Fertigkeitswert (`getSkillTotal`,
  also auch bei Proben); Meisterschaftseffekte sind kumulativ (GRW S. 92). Stärken wie Hoher Geistiger Widerstand wirken wie bisher über
  die abgeleiteten Werte und werden nicht doppelt gezählt. Die Fertigkeitspunkte (`getSkillValue`, z. B. für Großmeister) bleiben unberührt.
- **Angezeigt:** Karte „Wirkungen“ unter „Spielen“ mit Eingerechnet / Dauerhaft (Resistenzen, Immunitäten) / In bestimmten Lagen /
  Bei Manövern; grünes Kästchen am Fertigkeitswert zeigt den Bonus und seine Quellen.
- Datenkorrektur dabei: Wirkungen der Beschwörer-Meisterschaften aus „Die Magie“ betreffen das Wesen, nicht den Zauberer
  (neues Grimoire `magie.grim` nötig).

## Stand 7 (05.11.2026): Charaktere mit Regel-IDs

- Beim Speichern (Browserspeicher) und beim Export steht unter `regelIds` zu jedem Namen die ID aus den Regelpaketen: Rasse,
  Stärken, Schwächen, Ressourcen, Meisterschaften („Fertigkeit|Name“), Zauber („Schule|Name“) und die geladenen Pakete (Prüfsumme).
  Die Namen bleiben das führende Format; alte Charaktere ohne IDs laden wie bisher und erhalten die IDs beim nächsten Speichern.
- Beim Laden mit Regelpaketen (`regelwerk/useNamensAbgleich.ts`, Logik in `regelwerk/ids.ts`): Passt ein Name nicht mehr, die
  gespeicherte ID aber schon (auch über Umbenennungen und Regelgruppen), wird der Name aktualisiert; ein Hinweis nennt die Änderungen.
  Einträge aus nicht geladenen Büchern bleiben unverändert und behalten ihre ID.
- Behoben: Erschaffung nach Regelwerk (Stand 3) und Begleiter (Stand 5) gingen beim Neuladen der Seite verloren (`hydrateState`).

## Stand 8 (05.11.2026): „Admin & Ressourcen“ entfernt (Repository FOKUS-1.2)

- Arbeitsstand liegt jetzt in `JazzJackRabite/FOKUS-1.2` (aus Google AI Studio: npm statt Bun, Entwicklungsserver auf Port 3000,
  `.env.example`). Die Versionsgeschichte der Stände 1–7 liegt in `JazzJackRabite/FOKUS-1.0-claudeedition`.
- Entfernt: Reiter „Admin & Ressourcen“ in den Einstellungen, Admin-Konsole (Module, Beschreibungen ändern, Datenmodell,
  SQLite-Explorer), PIN-Schutz, Ressourcen-Backup, die Demo-Module „Mondstahlklingen“/„Götter & Dämonen“, der JSON-Modulimport,
  `sqliteService` und die Abhängigkeit `sql.js`.
- Bücher kommen nur noch über Einstellungen → Regelpakete. Alte Einträge der früheren Modul- und Beschreibungsverwaltung im
  Browserspeicher werden nicht mehr gelesen (nicht gelöscht).

## Stand 9 (05.11.2026): Bedingte Wirkungen beim Würfeln

- Probe, Angriff und Zauber zeigen einen Abschnitt „Stärken & Meisterschaften“ mit den bedingten Wirkungen, die zu diesem Wurf passen
  können (`situativeBoni()` in `regelwerk/wirkungen.ts`, Anzeige in `components/play/SituativeBoni.tsx`). Der Spieler klickt an,
  was in der Lage zutrifft; der Bonus fließt in den Wurf und steht im Würfelprotokoll.
- Zugeordnet: Boni auf die gewürfelte Fertigkeit (auch Waffen- und Magieschulfertigkeit), auf „Proben“ allgemein, auf Angriffe
  (Nahkampfangriffe nicht bei Schuss-/Wurfwaffen) und auf Zauber. Zusatzschaden, SR ignorieren und Schadensboni erscheinen beim
  Angriff nur als Hinweis; Manöver-Wirkungen stecken weiter in der Manöverauswahl.
- Ohne Regelpakete oder ohne passende Wirkung erscheint der Abschnitt nicht.

## Stand 10 (06.11.2026): Ausrüstung aus den Grimoires

- Vorher kam die Ausrüstung nur aus der eingebauten GRW-Liste (`data/equipment.ts`); Gegenstände, Waffen, Rüstungen usw. der
  hochgeladenen Grimoires fehlten. Jetzt liefert `regelwerk/ausruestung.ts` → `alleAusruestung()` die GRW-Liste plus alle
  Ausrüstungs-Einträge der Bücher (mit allen Büchern rund 820): Waffen, Rüstungen, Schilde, Gegenstände, Kleidung, Projektile,
  Ausrüstungssätze, Alchemika, Kräuter, Gifte, Material, Verbesserungen und magische Gegenstände – mit Werten, Quelle und Seite.
- Inventar („Gegenstand hinzufügen“, Filter nach Quelle) und Kampf-Tab (Waffe bzw. Rüstung/Schild auswählen) nutzen diese Liste.
  Bei mehr als 50 Treffern weist das Inventar darauf hin, die Suche zu verfeinern.
- Änderungen der Grimoires an GRW-Ausrüstung: „ersetzt“ übernimmt die neuen Werte (z. B. Waffenlos mit Freihändig, Mondstahlklingen
  S. 111) und nennt die Änderung in der Beschreibung; Beschreibungen aus „ergaenzt“ (vor allem Mondstahlklingen) werden angehängt.
- Doppelte Einträge mehrerer Bücher fasst der Lader über die Regelgruppen zusammen; sie erscheinen einmal.
- Tests: `regelwerk/__tests__/ausruestung.test.ts` (Testbuch; mit `FOKUS_GRIMOIRES` zusätzlich: jeder Ausrüstungs-Eintrag aller
  Bücher genau einmal in der Liste).
- Noch nicht im Editor: Nachschlage-Inhalte wie Gottheiten, Reliktkräfte, Abrichtungen, Golembausteine, Feenwelten.

## Stand 11 (06.11.2026): Wirkungen vollständig gesichtet

- Neue Regeldaten (`public/regelpakete/grw.srp.json`): Die Wirkungen aller Stärken, Meisterschaften und Zauber sind gesichtet –
  jeder Satz mit Zahl ist entweder strukturiert erfasst oder bewusst Text (mit Grund). Gruppe A (Charakter und Würfe) und
  B (Zaubermechanik: Kosten, Zauberdauer, Schaden …). Über alle Bücher 804 Wirkungen statt bisher 296.
- Neue Felder: `gruppe` (A/B), `pro_eg`, `einheit`, `quelle_wirkung` („erfassung“ = gesichtet), Träger `gegner` (Würfe anderer
  gegen den Charakter), Werte auch als Attributkürzel (z. B. „VER“ bei Begabter Alchemist).
- Editor: Meisterschaften mit dauerhaften Wirkungen auf abgeleitete Werte werden eingerechnet (z. B. Sprinter GSW +1, Gute Reflexe
  VTD +1, Blitzreflexe INI −3); situative Boni in Höhe eines Attributs werden mit dem Attributwert angeboten.
- Grimoires neu erzeugt: Wer Bücher schon hochgeladen hat, lädt sie neu hoch.

## Nächste Schritte

Die geplanten Schritte sind erledigt. Offen bleiben Ideen wie Spielhilfen für bedingte Wirkungen (z. B. Bonus gegen Typus per Klick
anwenden) oder Werte der Begleiter im Kampf.

## Stand 12 (06.11.2026): Zaubermechanik aus Meisterschaften im Zauber-Dialog

- Neuer Abschnitt „Kosten & Zauberdauer aus Meisterschaften“ im Zauber-Dialog: je Meisterschaft ein Knopf zum Anklicken
  (z. B. Sparsamer Zauberer, Eiliger Schutz, Auge des Zauberers mit Zauberdauer und Kosten gemeinsam). Gewählte Änderungen
  fließen in Grundkosten, Fokusabzug, Zauberdauer und die Zusammenfassung ein; Schwierigkeit, Wirkungsdauer, Zusatzschaden u. Ä.
  erscheinen als Hinweis. „(K)2V1“ richtet sich nach dem Zauber, „4V1 oder K3V1“ wählt die passende Variante, Mindestkosten 1.
- Magieschule beachtet: Meisterschaften einer Schule gelten nur für deren Zauber, allgemeine Magiemeisterschaften nur für die
  Schulen, unter denen der Charakter sie führt. Das gilt jetzt auch für die anklickbaren Würfelboni auf Zauber.
- Regelfehler behoben (Ausgangsstand): Fokuskosten mit V wurden doppelt gezählt („5V2“ = 7 Fokus). Nach GRW (Kanalisierte
  Zauber: „K6V2 sind 6 kanalisierte Punkte Fokus insgesamt, davon werden 2 sofort verzehrt“) kostet 5V2 insgesamt 5 Fokus:
  3 erschöpft, 2 verzehrt. Alte Tests auf die Buchregel umgestellt.
- Code: `zauberAnpassungen`, `kostenDelta`, `kostenAnwenden`, `zauberdauerAnpassen`, `giltFuerSchule` in `regelwerk/wirkungen.ts`;
  `useZauberAnpassungen`/`ZauberAnpassungen` in `components/play/SituativeBoni.tsx`. Tests: `zauberWirkungen.test.tsx`. 246 Tests grün.

## Stand 13 (06.11.2026): Probenboni nur bei passenden Fertigkeiten

- Fehler: Wirkungen auf „Proben“ ohne benannte Fertigkeit (z. B. Orientierungssinn „Proben zur Orientierung“, Geländekunde)
  erschienen bei jeder Fertigkeitsprobe, auch bei Alchemie.
- Regelpakete: solche Wirkungen tragen jetzt `fertigkeit_refs` (für welche Fertigkeiten sie gelten) oder `alle_proben: true`
  (z. B. Kühler Kopf). Zuordnung auf der Datenseite in `wirkungen_probenbezug.json` (nur IDs); Meisterschaften ohne Eintrag
  gelten für ihre eigene Fertigkeit. Neues GRW-Paket in `public/regelpakete`.
- Editor: Boni auf „Proben“ nur bei den zugeordneten Fertigkeiten bzw. bei „alle Proben“; ohne Zuordnung nicht im Würfeldialog
  (weiter in der Karte „Wirkungen“). Tests angepasst. 246 Tests grün.

## Stand 14 (06.11.2026): Relikte bauen (Relikt-Werkstatt im Inventar)

- Neue Karte „Relikte“ im Inventar mit der Relikt-Werkstatt (`components/relikte/ReliktKarte.tsx`, Logik in `regelwerk/relikte.ts`):
  Name, Grundgegenstand aus der Ausrüstungsliste (oder frei), Gegenstandsart, Punkte; Bausteine aus den Regelpaketen hinzufügen,
  mit Anzahl, Zaubergrad und Zauber (Zauberverankerung), Stufe (Stärke) oder freier Auswahl (Schwerpunkt, Schadensart, Typus …).
  Punktezähler und Warnungen (Punkte überschritten, Höchstzahl, falsche Gegenstandsart, fehlende Auswahl, Merkmal nötig,
  Materialqualität, nur eine Variante, mehr als die Höchstpunkte). Es wird nur gewarnt, nichts gesperrt.
- Jedes Relikt hat einen Inventareintrag (Kategorie „Relikt“, Werte des Grundgegenstands, Bausteine in der Beschreibung);
  Speichern aktualisiert ihn, Löschen entfernt beides. Neue Felder `relikte` im Charakter (Speichern, Laden, Import).
  Die Karte zeigt die Punkte der Ressource Relikt und die in Relikten vergebenen Punkte.
- Alle Regeln kommen aus den Paketen (`daten.relikt_baukasten`, `daten.baustein`), nichts davon steht im Code. Nur mit dem
  Grundregelwerk: 8 Verbesserungen (S. 142) und 3 Strukturgeber-Wirkungen (S. 254). Mondstahlklingen bringt weitere
  Verbesserungen und legendäre Kräfte, Die Götter göttliche Kräfte und besondere Materialien.
- Neues GRW-Paket in `public/regelpakete` (Herstellung, Verbesserungen, Artefaktwirkungen; 1539 Einträge). Grimoires neu hochladen.
- Noch nicht: Wertänderungen der Bausteine auf Waffe/Rüstung, GW/KW und Zauberverankerung im Magie-Bereich (nächster Stand);
  Wachsen mit Chronik und beseelte Gegenstände (danach).
- Tests: `regelwerk/__tests__/relikte.test.tsx` (Baukasten, Kosten wie im GRW-Beispiel S. 142, Warnungen, Inventareintrag,
  Reducer, Werkstatt; mit `FOKUS_GRIMOIRES` die Bausteine der Erweiterungen). Referenz des Python-Laders für den Katalog neu erzeugt.
  251 Tests grün (mit Büchern).

## Tab „Begleiter“, Teil 1: Tiere (Branch `begleiter-tab`)

- Neuer Tab **Begleiter** (nach Inventar, freigeschaltet wie die anderen Spiel-Tabs). Die Karte „Begleiter“ ist aus dem Inventar
  hierher umgezogen und aufgeteilt in **Tiere** und **Beschworene Wesen** (Dienste wie bisher).
- **Tiere:** alle Tiere mit Wertekasten (Merkmal Kreatur N oder Typus Tier), auch ohne Ressource (gekauft, gezähmt). Je Tier:
  Rufname, zugeordnete Ressource Kreatur (beim Hinzufügen die kleinste freie, die reicht), Qualität, Vertrauter (Stärke
  Tiervertrauter), Notiz. Warnungen: mehr/höhere Kreatur-Zuordnungen als Ressourcen, mehrere Vertraute, Vertrauter ohne Stärke.
  Reittiere werden erkannt (Typus Reittier oder Grundausbildung Reittier I).
- **Abrichtungen und Potenzial (Bestienmeister S. 15–23, nur mit Grimoire):** Potenzial = Grundwert/Qualität + 2 je Kreatur +
  3 Tiervertrauter + Tierspezialist (je 1) + Meister der Bestien (2) + Meisterbändiger (1, nur Kreatur), mit Aufschlüsselung.
  Abrichtungen nach Gruppen wählbar, Kosten in Potenzialpunkten, Mehrfachwahl („maximal viermal“, „einmal pro HG“ …).
  Grundausbildungen (Reittier I, Kampfgefährte …) kosten 1 und brauchen zusätzlich die Voraussetzung der Abrichtung
  „Grundausbildung“ (Dompteur). Voraussetzungen werden geprüft – auch die des Tieres (`traeger: "tier"`: Typus, Größenklasse,
  frühere Abrichtungen) und gestaffelte je Wahl (Kämpfer). Nicht erfüllte Voraussetzungen sind markiert, blockieren aber nicht.
- Grenzen: Boni aus Abrichtungen sind im Wertekasten noch nicht eingerechnet (die Daten haben dafür keine strukturierten Wirkungen).
  Datenfehler: „Kleiner Trick“ verlangt Dompteur vom Tier statt vom Tierführer (`traeger: "tier"` zu viel).
- Code: `regelwerk/begleiter.ts` (alleTiere, abrichtungen, mehrfachGrenze, tierTraeger, pruefeAbrichtung, potenzial),
  `components/begleiter/{TierAbschnitt,WesenAbschnitt,Wertekasten}.tsx`, `features/begleiter/BegleiterView.tsx`,
  Aktion `BEGLEITER_AENDERN`, Import der neuen Felder. Tests: `begleiter.test.tsx` (mit Bestienmeister lokal).

## Tab „Begleiter“, Teil 2: Gefolge (Branch `begleiter-teil2`)

- Neuer Abschnitt **Gefolge** im Tab „Begleiter“ (Ressource Gefolge, GRW S. 77–78), nur Grundregelwerk nötig; Kulturen und Rassen
  aus geladenen Grimoires erscheinen mit.
- **Gefolgsmann:** Rasse und Kultur beim Hinzufügen; Rufname, Aufgabe (Leibdiener, Knappe, Leibwächter …), Notiz. Attribute
  2 + Rassenmodifikator mit Wahl der freien Boni (auch „unterschiedlich“, „nicht Stärke“). Werte des Kulturmoduls mit derselben
  Wahl wie bei der Erschaffung (Fertigkeitspunkte inkl. „eine Magieschule“, Stärke, Meisterschaft). Rassenstärken kommen dazu.
  Abgeleitete Werte nach den GRW-Formeln (Heldengrad 1), Fertigkeitswert = Punkte + Attribute (Kampffertigkeiten: „+ Waffe“).
- **Gefolge-Punkte:** 1 je Gefolgsmann, 1 je Fertigkeit auf der ersten Schwelle (6 Punkte, auch Fertigkeiten außerhalb der
  Kultur), 1 je Meisterschaft bzw. Zauber über den freien. Frei: eine Meisterschaft je angehobener Fertigkeit, Zauber nach der
  Erschaffungsregel (je Magieschule ab 1/3/6 Punkten einer; Zaubergrad n ab 3·n Punkten). Warnung, wenn die Ressource nicht
  reicht oder eine Fertigkeit über dem Höchstwert des Heldengrads des Abenteurers liegt. Meisterschaften: Schwelle 1 ab 1 Punkt,
  allgemeine Meisterschaftsgruppen über jede passende Fertigkeit.
- Code: `regelwerk/gefolge.ts` (gefolgeWerte, kulturWerte, gruppenOptionen, meisterschaftsAngebot, zauberAngebot),
  `components/begleiter/GefolgeAbschnitt.tsx`, Typ `Begleiter` um `art: 'gefolge'` und die Gefolge-Felder erweitert, Import.
  Tests: `gefolge.test.tsx`.

## Tab „Begleiter“, Teil 3: Erhobene Untote und Golems (Branch `begleiter-teil2`)

- **Modifikationen-Texte** (`regelwerk/modifikationen.ts`): „KON +1, STÄ +1; LP +1, VTD +2; Angriff +1, INI −1; Athletik +2;
  zusätzliches Merkmal: …; Merkmal Pazifist entfällt; GK +1 (maximal 7); Waffenmerkmal …“ werden ausgelesen und auf den
  Wertekasten angewendet (Attribute, abgeleitete Werte, Waffen mit Wert/Schaden/WGS/INI, Fertigkeiten, Merkmale, „Zerbrechlich wird
  zu Schwächlich …“ samt LP +1 nach S. 207). Wahlen und Freitexte („ein beliebiges Attribut +1“, freie Punkte/Meisterschaften)
  bleiben als Hinweis für den Feinschliff bzw. die Spielleitung.
- **Erhobene Untote** (Die Magie S. 182–184, nur mit Erhebungszauber im Katalog): Zauber → Wertesatz (Untote erheben:
  Wandelnder Leichnam/Skelett, Totentier: Gruftkatze/Wimmelnder Schrecken, Grabesbestie: Ghul/Seuchenbringer, Der letzte Ruf:
  Knochenschänder/Mumie). Verstand 0. EP aus der Verstärkung (10/15/25/35), mehrfach nur mit Nekromant. Steigerung „von 0 an“
  (Fertigkeitspunkte 3/5/7/9 EP, Attribute 10/15/20 …), Attribute wirken auf abgeleitete Werte (Formeln des GRW), Fertigkeiten
  und Angriff (BEW + STÄ); Pseudo-Fertigkeit „Angriff (Waffen)“. Grenze der neuen Punkte nach Zaubergrad (1–2 → HG 1 …),
  freie Meisterschaft ab 6/9/12/15 Punkten, keine Magieschulen, kein Arkane Kunde/Geschichte und Mythen. Abnormität (5 EP,
  Meister der Abnormitäten) mit ihren Modifikationen.
- **Golems** (Die Magie S. 197–207, nur mit Grimoire): Korpus (Klein/Mittel/Groß), Material (Schritt 2, mit Schwachpunkt),
  Zusätzliche Fähigkeiten, Rollen (Kämpfer braucht Aggressiv), Applikationen (zwei frei bzw. eine je Stufe über die Ressource
  Golem; jede weitere +1 Schwierigkeit, +3 Fortschrittspunkte und ein Schwachpunkt), Schwachpunkte (Anfällig, Feingliedrig,
  Langsam auch in Zahlen), Instruktionen (Folge/Warte immer, eine weitere + „Zusätzliche Instruktion“), Verfügungen,
  Sonderausstattung (eine je zwei Stufen). Ausgabe: Stufe des Merkmals Golem mit Aufschlüsselung, Werte, passender
  Animierungszauber, Konstruktionsprobe, Kaufpreis, Meisterschaftsschwelle für den Feinschliff, Ressource Golem.
- Datenlücke: Skelett, Wandelnder Leichnam, Ghul (GRW-Bestiarium) sowie Mumie und Seuchenbringer (Bestien & Ungeheuer) haben
  keine Werte in den Paketen; diese Untoten lassen sich anlegen und steigern, der Editor verweist auf die Buchseite.
- Code: `regelwerk/{modifikationen,untote,golem}.ts`, `components/begleiter/{UntotAbschnitt,GolemAbschnitt}.tsx`, Typ `Begleiter`
  (`art: 'golem' | 'untoter'`, Felder für Bausteine und Steigerung), Import. Tests: `untoteGolems.test.tsx`. 269 Tests grün.
- Offen: Vertraute aus „Die Magie“, Baukasten für beschwörbare Wesen (Magie S. 193–196) und für Bestien (Bestienmeister),
  Begleiter im Kampf-Tab, Boni aus Abrichtungen im Wertekasten, fehlende Bestiarium-Werte auf der Datenseite.

## Stand 15 (08.–10.11.2026, Google AI Studio): Zaubermodifikationen, Ausrüstungsverzauberung, Schadens- und Heildialog

> Von Gemini in AI Studio erstellt (Commit 3124029), dort als „Stand 6“ eingetragen. Geprüft und korrigiert in Stand 16 –
> wo die Angaben unten davon abweichen, gilt Stand 16.

- **Spezifische Zauber-Verstärkungen & Fokuskosten (`utils/magicRules.ts`):**
  - Parse-Logik für komplexe Fokuskosten-Deltas (`+K1V1`, `+K2V2`, `+1V1`, `+3V3`) aus Spruchbeschreibungen (`parseEnhancementFocusDelta`).
  - Korrekte Verteilung auf die drei Fokus-Pools (erschöpft, kanalisiert, verzehrt) bei aktivierten Verstärkungen (`calculateFinalSpellCosts`).
  - Direkte LP-Heilzauber (*Selbstheilung*, *Leichte Heilung*, *Heilung*, *Wiederherstellung*): Übernahme der spezifischen EG-Verstärkungswerte laut Spruchdaten statt nicht-regelkonformem freiem Verstärken.
  - Wundabzüge: Automatische Verringerung bei kanalisierten Zaubern (*Schmerzen widerstehen*, *Aura der Schmerzlosigkeit*).
  - Bereinigung der Benutzeroberfläche im Zauberdialog (`components/play/CastSpellModal.tsx`): Entfernung redundanter Textbereiche.
- **Ausrüstungsverzauberung & Zielbindung (`components/play/CastSpellModal.tsx`, `components/combat/CombatMagicTab.tsx`, `components/play/AttackModal.tsx`):**
  - Erkennung von Ausrüstungszaubern (*Flammende Waffe*, *Waffe des Lichtes*, *Beflügelte Waffe*, *Magische Rüstung*, *Gegenstand verbessern* etc.) via `isEquipmentTargetingSpell`.
  - **Regel-Constraint nach GRW S. 229:** Waffenloser Kampf kann **nicht** verzaubert werden. Auswahlliste zeigt nur hergestellte Waffen aus dem Inventar sowie „Fremde Waffe / Verbündeter“.
  - Speicherung von `targetItemId` und `targetItemName` auf `ChanneledSpell`.
  - **Schnellansicht & Aktions-Buttons:**
    - Header der Waffe zeigt aktive Verzauberungs-Badges (z. B. `🔥 Flammende Waffe (+2 Feuer)`).
    - SCHADEN-Feld weist den Bonus direkt aus (z. B. `1W6+1 (+2 Feuer)`).
    - AT-Feld und Angriffs-Button berücksichtigen Boni (z. B. `Angriff (Handgemenge) +3` durch *Beflügelte Waffe*).
    - Schadens-Button zeigt `1W6+1 (+2 Feuer) Schaden` und rollt den korrekten Gesamtwert.
  - **Angriffsdialog (`AttackModal`):** Filtert Zauberboni strikt auf die geführte Waffe (`weapon.id`); andere Waffen und waffenlose Angriffe bleiben unbeeinflusst.
  - **Tracker (`ChanneledSpellsTracker`):** Zeigt für kanalisierte Zauber das Badge `Ziel: [Name]`.
- **Würfelformel-Kombinierung (`combineDamageFormula` & `context/PlaySessionContext.tsx`):**
  - Zusammenführung von Grundschaden und statischen Boni zu validen Standard-Würfelformeln (`1W6+1` + `2` $\rightarrow$ `1W6+3`, statt `1W6+1+2`).
  - Robuster Dice-Parser in `handleRollDiceFormula`, der auch mehrteilige Modifikatoren problemlos auflöst.
- **Tests:** 43 Unit-Tests in `src/__tests__/magicRules.test.ts` sichern Fokuskosten, Verstärkungen, Ausrüstungsbindung und Formelkombinierung ab.

## Stand 16 (10.11.2026): Prüfung des AI-Studio-Stands gegen das Grundregelwerk

Geprüft wurde Commit 3124029 (Stand 15) vollständig: Regeln gegen die Texte im GRW-Regelpaket, Typprüfung, Tests, Build.

**In Ordnung:** Schwierigkeit aller 419 Zaubereinträge in `data/spells.ts` (stimmt mit dem GRW überein, sonst nichts an den
Zauberdaten geändert); Heilwerte von Selbstheilung, Leichte Heilung, Heilung, Wiederherstellung; Splitterpunkt senkt Schaden
um 5 (S. 81); Lebenskraft stärken/Aura der Lebenskraft mit zusätzlichen Lebenspunkten und automatischem Ende; Wundabzüge nur
aus echtem Schaden; Würfelformeln zusammenfassen. Die Funktionen aus Stand 9–13 sind erhalten.

**Behoben – Abstürze**
- Proben- und Angriffsdialog hingen in einer Endlosschleife, wenn keine Zauberliste übergeben wurde (`channeledSpells = []`
  als Vorgabe erzeugt je Rendern ein neues Array, der Effekt setzt daraufhin wieder den Zustand). Dadurch lief auch die
  Testsuite nicht mehr durch.
- `ChanneledSpellsTracker`: `useMemo` stand hinter einer frühen Rückgabe → Absturz, sobald der erste Zauber aktiv wird.

**Behoben – Regeln**
- Verstärkungskosten: „+K1V1“ wurde als +2 Fokus gerechnet. Die Zahl hinter V ist Teil der genannten Punkte (GRW S. 221–222:
  „1 Punkt verzehrter Fokus … Kosten -(K)1V1“). Flammende Waffe verstärkt kostet K5V2, nicht K6V2.
- Höchstbonus aus Zauberei fehlte (GRW S. 18–19: 3 Punkte je Quelle, +1 je Heldengrad). Zauberboni auf Proben und auf
  VTD/GW/KW/GSW werden jetzt begrenzt; die Schadensreduktion ist kein abgeleiteter Wert und bleibt unbegrenzt.
- Nicht kombinierbare Zauber wurden addiert (Typus Haut; Rüstung und Schutzfeld; Schaden und Waffe) – jetzt zählt der stärkste.
- Werte: Schutz vor Elementen 10 (nicht 8); Widerstände erhöhen, Segnung, Hohe Segnung auch auf VTD (Widerstandswerte =
  VTD, GW, KW, S. 15); Magieschutz ist ein Malus auf gegnerische Zauber, kein Bonus auf GW/KW; fehlende Verstärkungen
  ergänzt (Rindenhaut, Stahlhaut, Beschleunigen, Schmerzen widerstehen/ignorieren, Eulengespür, Inneres Leuchten, Sinne
  verstärken, Sicht/Gehör verbessern, Verhüllung, Spinnenlauf, Segnung, Hohe Segnung); Aura der Entschlossenheit +2
  Entschlossenheit; Spinnenlauf gilt für Athletik (Klettern), nicht für eine Fertigkeit „Klettern“; Weg durch die Natur
  nur Überleben.
- Boni, die nur in einer Lage gelten, sind nicht mehr vorausgewählt (Sicht/Gehör verbessern, Nebelsicht, Spinnenlauf, Weg
  durch die Natur, Waffe des Lichtes +2 nur gegen Untote/Geisterwesen/Schattenwesen – stand vorher fest im AT-Wert).
  Bärenstärke & Co. bei Angriffen ebenso: die Attribute hängen von der Waffe ab, die der Editor nicht kennt.
- Waffenzauber: trafen im Angriffsdialog auch waffenlose Angriffe (dort fehlte die Waffen-ID); Flammenhand, Schockgriff und
  Krallen wirkten auf Waffen statt waffenlos.
- Magische Rüstung/Magischer Panzer verlangten eine Rüstung aus dem Inventar – sie wirken auf den Zauberer (Reichweite
  „Zauberer“); Rüstung schwächen trifft einen Gegner.
- Erfolgsgrade (schon im Ausgangsstand falsch): Wirkungsbereich kostet 3 EG je Stufe (nicht 1); verzehrter Fokus ist ganz
  einsparbar, solange 1 erschöpfter oder kanalisierter Punkt bleibt (S. 221–222).
- Seitenangaben korrigiert: Heilkunde S. 119–120, Heilung S. 173–174, Schaden S. 172–173, Zustände S. 168–169 (statt
  S. 162–167, 202–205, 238); Zauberseiten nach dem Regelpaket. „Erste Hilfe (EG LP)“ ist keine GRW-Mechanik – im
  Heildialog sind die Methoden nur Beschriftungen, die Menge wird von Hand eingetragen.
- Die Aussage „Waffenloser Kampf kann nicht verzaubert werden (GRW S. 229)“ ist eine Auslegung, keine Regelstelle; der
  Editor behält sie bei (für waffenlose Angriffe gibt es Flammenhand, Schockgriff, Krallen).

**Technik:** Die Zauberwerte standen in Stand 16 als geprüfte Tabelle im Code; seit Stand 17 kommen sie aus den Regelpaketen. 314 Tests grün, Build läuft.

**Offen:** Die Tabellen gelten nur für GRW-Zauber (Namen fest im Code); Zauber aus Grimoires wirken nicht automatisch.
Wiederherstellung entfernt eine feste Liste von Zuständen statt „Zustände, die Folge von Angriffen sind“. (Erledigt: Die
unbenutzten Dateien aus AI Studio sind entfernt, siehe Stand 33.)

## Tab „Begleiter“, Teil 4: würfeln, Lebenspunkte und Fokus

- **Würfeln mit den üblichen Modalen:** Im Wertekasten jedes Begleiters (Tiere, Gefolge, beschworene Wesen, Untote, Golems) sind
  Fertigkeiten Proben (RollModal), Waffenwerte Angriffe (AttackModal mit Schaden), Schadensformeln Schadenswürfe; Zauber des
  Gefolges öffnen das CastSpellModal. Wundabzug des Begleiters wird übergeben; Boni aus Stärken/Meisterschaften und kanalisierten
  Zaubern des Abenteurers gelten nicht, Höchstbonus aus Zauberei nach Heldengrad 1 (Charakter-Kontext ohne Wirkungen),
  keine Splitterpunkte (RollModal blendet den Bereich ohne `onSpendSplitterPoint` aus). Würfe und Ereignisse ins Protokoll
  (`logEintrag` im PlaySessionContext; Würfelprotokoll auch im Tab „Begleiter“).
- **Gefolge mit Waffen:** Waffen der eigenen Kampffertigkeiten aus dem Katalog, Angriffswert = Fertigkeitspunkte + Attribute der Waffe.
- **Lebenspunkte und Fokus je Begleiter** (`regelwerk/vitals.ts`, `components/begleiter/BegleiterSpiel.tsx`): Kästchen je Gesundheitsstufe,
  Stufen und Wundabzüge aus den GRW-Daten; Schwächlich (3 Stufen) und Zerbrechlich (1 Stufe) aus der Merkmalsbeschreibung;
  Betäubungsimmunität (z. B. Konstrukt). Stufe wie beim Abenteurer (Stufe des letzten verlorenen LP), Wundabzug nur aus echtem
  Schaden. „Schaden erleiden“ und „Heilen“ öffnen TakeDamageModal bzw. HealModal (neu: optionale Props `stufen` und `begleiter`
  – ohne Splitterpunkte, temporäre LP und Zustände des Helden). Fokus: erschöpfen/kanalisieren/verzehren, Kanalisierung beenden,
  Zauber ziehen Fokus automatisch ab. Verschnaufpause, Zurücksetzen. Kurzanzeige ♥/FO im Kopf jedes Begleiters. Feld `zustand`.
- Tests: `begleiterSpiel.test.tsx` (7). 334 grün mit allen Büchern (bekannter Relikte-Test mit älteren Grimoires ausgenommen).

## Stand 17 (10.11.2026): Zauberwerte aus den Regelpaketen statt aus dem Code

- Die Tabellen nach Zaubernamen aus Stand 15/16 (`ZAUBER_KAMPFWERTE`, Probenboni, Zusatzschaden, Heilwerte, Liste der
  Waffenzauber) sind entfernt. Was ein aktiver Zauber ändert, steht jetzt im Regelpaket am Zauber (`daten.spielwerte`:
  Bezug, Wert, verstärkter Wert, Fertigkeiten, Attribut, Lage, Ziel, Schadensart; `nicht_kombinierbar` nach Typus) und gilt
  damit auch für Zauber aus hochgeladenen Grimoires.
- Neu `src/regelwerk/zauberwerte.ts` (Kampfwerte, Probenboni, Waffenschaden, Heilung/zusätzliche Lebenspunkte aus dem
  Katalog; Höchstbonus, „nicht kombinierbar“, Verstärkung). `utils/magicRules.ts` reicht nur noch durch. Ob ein Zauber ein
  Ausrüstungsstück verzaubert, ergibt sich aus Typus und Reichweite; die Schadensformel einer Verstärkung aus ihrem Text.
- Datenseite: `Werkzeuge/regelpakete/zauber_spielwerte.py` + `zauber_spielwerte.json` (nur IDs, Zahlen, Kennwörter);
  89 Zauber mit Spielwerten (57 GRW, 32 aus Büchern). Die Prüfsuite prüft jede Zahl gegen den Zaubertext.
  Neues GRW-Paket in `public/regelpakete`; Grimoires neu hochladen.
- Ohne geladenes Regelpaket haben Zauber keine automatische Wirkung (kein Rückfall auf eine Tabelle im Code).
- Erfrischung und Giftbann standen noch nach Zaubername im Code – behoben in Stand 18.
- Die Zauber aus den Büchern sind nur automatisch abgeleitet, nicht einzeln gesichtet; Werte, die nur in einer Lage gelten,
  rechnet der Editor nicht fest ein.
- Tests: `zauberwirkungenGrw.test.tsx` (u. a. ein erfundener Buchzauber wirkt wie ein GRW-Zauber). 323 Tests grün ohne
  Bücher (zusammen mit Begleiter Teil 4), 114 im Ordner `regelwerk` mit allen Büchern vor dem Zusammenführen; Build läuft.

## Stand 18 (10.11.2026): Erfrischung und Giftbann nach Regelwerk

- **Erfrischung** (GRW S. 227) unterdrückt 1 Stufe Erschöpft, verstärkt 3, solange der Zauber wirkt. Vorher senkte der
  Editor den Zustand beim Wirken dauerhaft um 1 Stufe, ohne Verstärkung und ohne Rückkehr beim Ende des Zaubers. Jetzt steht
  der Wert im Regelpaket (`spielwerte`, Bezug `zustand_unterdrueckt` mit Zustands-ID); der gespeicherte Zustand bleibt, beim
  Würfeln gilt die Reststufe (`wirksameZustaende` in `regelwerk/zauberwerte.ts`, genutzt im PlaySessionContext für Proben-,
  Angriffs- und Zauberdialog). Der aktive Zauber zeigt „unterdrückt n Stufen Erschöpft“.
- **Giftbann** hebt keine erfundene Markierung mehr auf: Das GRW kennt keinen Zustand „Vergiftet“, der Zauber hebt Gifte
  nach Grad auf (steht in seiner Beschreibung). „Vergiftet“ bleibt im Schadensdialog als reine Markierung ohne Regelwirkung.
- Damit steht kein Zauber mehr mit Namen in `utils/magicRules.ts`.
- 326 Tests grün ohne Bücher; neues GRW-Paket in `public/regelpakete`.

## Stand 19 (11.11.2026): Fundament – ein dunkles CI, Bausteine, Prüfungen

- **`FUNDAMENT.md` im Wurzelordner** ist ab jetzt die verbindliche Grundlage: Grundsätze, Regelquellen (welche Regel der
  Editor aus welchem Feld der Regelpakete liest, samt Liste der Altlasten im Code), Gestaltung, Arbeitsweise. Entwurf –
  Teil 2 (Regelquellen) ist vom Projektinhaber noch gegenzulesen. Diese Datei hier bleibt das Protokoll der Stände.
- **Helles Design und Farbschema-Menü entfernt** (Entscheidung 11.11.2026): `useTheme`, `themePalettes`,
  `ThemeSettingsModal`, der Umschalter in den Einstellungen, alle Regeln für `focus-light` (85 Regeln) und die unbenutzte
  `tailwind.config.ts` (Tailwind 4 liest sie nicht). Die App ist immer dunkel (`data-theme="focus-dark"` steht fest in
  `index.html`).
- **`src/fundament/`:** `fundament.css` mit den benannten Werten des CI (`@theme` → Klassen wie `bg-flaeche`, `text-leise`,
  `border-gold`, `font-titel`, `rounded-karte`) und dem Scrollbalken; `bausteine.tsx` mit Knopf, Karte, Abschnittstitel,
  Marke, Eingabe, Auswahl, Rollbereich, Dialog; `uebergang.css` = die bisherigen Umbiege-Regeln aus `index.css` (Altlast,
  schrumpft mit der Umstellung). `index.css` bindet nur noch diese Dateien ein.
- **Prüfungen** (`src/fundament/__tests__/fundament.test.tsx`): Farbwerte nur in `fundament.css`; keine Zauber-,
  Meisterschafts- oder Stärkennamen als Text im Programmcode. Bestand als Altlast in `src/fundament/altlasten.json`:
  3344 Farbwerte in 46 Dateien, 53 Regelnamen. Darf nur weniger werden; neu schreiben mit
  `FUNDAMENT_ALTLASTEN=schreiben npx vitest run src/fundament`.
- Die Ansichten sind noch nicht auf die Bausteine umgestellt; sie sehen aus wie bisher im Dunkelmodus, nur der Scrollbalken
  ist neu. Reihenfolge der Umstellung: Dialoge, Spielen und Kampf, Charakter, Inventar, Begleiter, Erschaffung.
- 329 Tests grün ohne Bücher; Build läuft.
- **Nachtrag 11.11.2026 – Regelquellen geprüft:** Tabelle in `FUNDAMENT.md` gegen den Code abgeglichen und ergänzt
  (Auswahllisten aus Büchern über `bruecke.ts`, Paketspeicher, `modifikationen.ts`, `reichweite` wird in
  `utils/magicRules.ts` gelesen). Altlasten nachgetragen: `src/data/rules.ts`, `presets.ts`, `utils/costCalculations.ts`,
  `conditionModifiers.ts`, Heldengrad-Schwellen, Fertigkeitswert je Zaubergrad. Dritte Prüfung eingebaut: Tabelle passt
  zum Code; Paketdaten lesen nur die dort genannten Dateien (7 Ansichten als Altlast `paketzugriffe`). Grundsatz 7 als
  „noch nicht entschieden“ gekennzeichnet.
- **Nachtrag 11.11.2026 – Hausregeln (Grundsatz 7 entschieden):** Sperren ist der Standard; der Schalter „Hausregeln
  erlauben“ (Einstellungen → Allgemein) macht aus Sperren Warnungen. Zentral in `src/fundament/hausregeln.ts`
  (`regelverstoss()`, `useHausregeln()`, Einstellung im Browser unter `fokus_hausregeln`). Umgestellt: Erfahrungspunkte
  und Punktegrenzen bei Stärken, Ressourcen, Sprachen, Meisterschaften, Zaubern, Attributen und Fertigkeiten; Grenzen des
  Heldengrads; Entfernen von Erschaffungswahlen in der Steigerung; Zauber über dem Fertigkeitswert; Voraussetzungen und
  Schwellen der Meisterschaften. Neu gesperrt (vorher nur Warnung): Relikt mit Regelverstoß speichern, Abrichtung mit
  nicht erfüllter Voraussetzung.
- **Nachtrag 11.11.2026 – Hausregeln auch für Gefolge, Untote, Golems:** `gefolgeWerte`, `untotWerte`, `golemWerte`
  liefern neben `hinweise` jetzt `verstoesse` (Kennung und Ausmaß; „noch wählen“-Hinweise zählen nicht dazu).
  `aenderungGesperrt()` sperrt jede Änderung, die einen Verstoß neu schafft oder vergrößert; dazu die Punkte der
  Ressource Gefolge (auch beim Hinzufügen). Nicht gesperrt bleibt der Hinweis „Ressource Golem nötig“.

## Stand 20 (11.11.2026): Alle Ansichten auf das dunkle CI umgestellt

- **Bilder des Mockups** liegen in `docs/fundament/` und sind in `FUNDAMENT.md` verlinkt.
- **Farben:** 4361 Farbklassen in 46 Dateien durch die benannten Werte ersetzt (`bg-flaeche`, `text-leise`, `border-gold`,
  `bg-schaden-grund` …). Grundlage war die Farbe, die jede alte Klasse im Dunkelmodus tatsächlich hatte (im Browser
  ausgelesen), zugeordnet zum nächsten Wert des CI; Bedeutungsfarben nach Farbfamilie. Fest eingetragene Farbwerte: 0
  außerhalb von `fundament.css`.
- **Form:** Rundungen einheitlich (`rounded-karte`, `rounded-knopf`), keine Verläufe, keine Schatten außer bei Dialogen,
  kein Weichzeichner, Rahmen 1 Pixel, kleinste Schrift 11 Pixel, Abschnittstitel in Gold, keine Festbreitenschrift mehr
  (Zahlen mit `tabular-nums`).
- **Kopf und Reiter** nach dem Mockup: flache Kopfzeile, goldener Schriftzug, aktiver Reiter mit goldener Linie.
- **Dialograhmen** aller Dialoge einheitlich (Fläche, Rahmen, Rundung). Der **Würfeldialog** ist als erster ganz auf die
  Bausteine `Dialog` und `Knopf` umgestellt.
- **`uebergang.css` gelöscht** (1790 Zeilen). Neu `src/fundament/klassen.css` (ca. 100 Zeilen): Grundstil, Protokollkarten,
  Würfelbanner, Druck – nur mit benannten Werten.
- Offen: Die übrigen Dialoge und Ansichten bauen Knöpfe und Rahmen noch selbst statt mit den Bausteinen; Knöpfe sind dort
  teils kleiner als 44 Pixel. Zauberwirkungen erscheinen an einigen Stellen grün statt lila.
- **Nachtrag (b1b278d und folgend):** keine Emojis mehr in der Oberfläche (Symbole kommen aus lucide-react), Knöpfe in
  Dialogen und Kopfzeilen mit 44 Pixel Mindesthöhe, Bestätigungsdialog aus den Bausteinen, Zauberwirkungen im Angriffs-
  und Würfeldialog sowie bei kanalisierten Zaubern in Lila. Im Browser geprüft: alle fünf Reiter, Erschaffung,
  Einstellungen, Würfel-, Schadens-, Heil- und Angriffsdialog, dazu Spielen und Kampf in Handybreite (390 Pixel, kein
  seitliches Rollen). Nicht geöffnet: Zauberdialog, Meisterschafts- und Zauberauswahl, Relikt-Werkstatt.
- **Nachtrag Lesbarkeit (11.11.2026):** Fehler aus der automatischen Umstellung behoben – in Auswahlknöpfen mit zwei
  Zuständen (z. B. VTD-Schnellwahl im Angriffsdialog) stand dunkle Schrift auf dunklem Grund. Neue Regel 6 im Fundament
  (Kontrast mindestens 4,5 : 1, Tabelle erlaubter Paare) und eine Prüfung, die jede Klassenliste nachrechnet
  (`kontrastBefunde` in `src/fundament/__tests__/pruefen.ts`). 66 Stellen korrigiert: Schrift auf gedämpften Grundtönen
  ist `schrift`, auf Gold `seite`; kräftige Bedeutungsfarben sind keine Textflächen mehr.
- **Splitterpunkte als Rauten** wie im Mockup (neuer Baustein `Rauten`), statt Sternen in Kreisen.

## Stand 21 (11.11.2026): Relikte, Stufe 2 – Werte, Widerstand, Zauberverankerung

- **Wertänderungen** der Bausteine wirken jetzt auf den Grundgegenstand: Schaden, WGS (mindestens 1), SR, Behinderung,
  Tick-Zuschlag, Last (höchstens halbiert) und Merkmale (neu, erhöhen, entfernen). Das Inventar zeigt die geänderten
  Werte, die Notiz nennt sie („Werte: Schaden 1W6+4 → 1W6+6.“). Höchstwerte von Merkmalen richten sich nach dem
  Schadenswürfel; Bausteine mit Wahl (z. B. Tick-Zuschlag oder Behinderung) fragen in der Werkstatt nach.
- **Verbesserter Widerstand (GW/KW)** gilt, solange das Relikt im Inventar ist. Bei mehreren Relikten zählt nur der
  höchste Bonus (GRW S. 254); eingerechnet in `calculateCharacter`.
- **Zauberverankerung:** Grad und Zauber werden in der Werkstatt gewählt (Zauber aus dem Katalog). Unter Kampf & Magie
  erscheint der Abschnitt „Aus Relikten“; der Zauberdialog würfelt auf Arkane Kunde, den Fokus trägt der Charakter
  (GRW S. 255).
- **Werkstatt** ganz aus den Bausteinen (`Dialog`, `Knopf`, `Eingabe`, `Auswahl`). Mehr Punkte als die Ressource Relikt
  oder andere Prüfbefunde sperren das Speichern; mit Hausregeln wird nur gewarnt. Paketzugriffe liegen jetzt in
  `regelwerk/relikte.ts`, die Altlast für `ReliktKarte.tsx` ist entfernt.
- **Datenfelder** in `relikt_bausteine.json` (Werkzeuge): `wirkt`, `ausloesung`, `aenderungen_wahl`,
  `hoechstens_nach_schadenswuerfel`; vom Paketbau geprüft. `grw.srp.json` neu gebaut, Prüfsuite ohne neue Befunde.
- Im Browser geprüft: Relikt mit GW-Bonus (GW 15 → 16), Sperre bei überzogener Ressource, Speichern mit Hausregeln,
  Zauber aus Relikt im Zauberdialog mit Arkane Kunde.
- **Nachtrag:** Relikte, die vor Stand 21 gebaut wurden, standen mit den Grundwerten im Inventar (Waffenschaden und
  WGS ohne Wirkung). `ReliktAbgleich` (in `App.tsx` eingehängt) trägt die Werte aus den Bausteinen nach, sobald sie vom
  Inventareintrag abweichen (`veralteteReliktEintraege` in `regelwerk/relikte.ts`). Damit lassen sich die Spielwerte
  eines Relikts nicht mehr von Hand im Inventar überschreiben; geändert wird es in der Werkstatt.
- Offen: Wachsen des Relikts und Chronik, beseelte Gegenstände, Schwerpunkt-Bonus bei Proben, Härte (kein Feld im
  Inventar, nur als Text).

## Stand 22 (11.11.2026): Begleiter – Bausteine, Zustände, waffenlos, freie Meisterschaften, Golem-Feinschliff

Alle Begleiter bleiben im Tab „Begleiter“ (Entscheidung 11.11.2026: kein Bereich im Tab „Kampf & Magie“).

- **Bausteine (FUNDAMENT Teil 3):** Tiere, Gefolge, beschworene Wesen, Untote, Golems und der Spielbereich verwenden `Karte`,
  `Abschnittstitel`, `Knopf` (44 px), `Marke`, `Auswahl`, `Eingabe`. Gemeinsame Hülle `Eintrag` (aufklappbarer Titel, Marken,
  Entfernen), `Hinweise`, `Notiz`, `MarkeMitEntfernen` (Entfernen als eigener Knopf neben der Marke) in
  `components/begleiter/Wertekasten.tsx`. Keine Symbole oder Emojis mehr in Auswahllisten (Wörter statt Häkchen), Bedeutungsfarben
  als Rahmen, Kurzanzeige LP/FO als Marke.
- **Paketzugriffe aus den Ansichten entfernt:** Wesen, Untote, Golems und Gefolge fragen `regelwerk/` (`wesenStufe`,
  `abnormitaetText`, `steigerbareFertigkeiten`, `bausteinInfo`, `materialInfo`, `korpusGK`, `kulturModul`, `rasseText`,
  `anhebbareFertigkeiten`, `zauberAlsSpell` in `bruecke.ts`). Alle fünf Begleiter-Dateien sind aus der Altlast `paketzugriffe` heraus.
- **Zustände für Begleiter:** dieselbe Zustandsliste wie beim Abenteurer (`CONDITIONS_WITH_LEVELS`/`…_WITHOUT_LEVELS`, Abzüge über
  `getConditionMalus`), je Begleiter in `zustand.zustaende`; gehen in Probe, Angriff und Zauber ein.
- **Waffenloser Angriff für Gefolgsleute:** Waffen ohne Preis und ohne Verfügbarkeit hat jeder (GRW-Paket: nur Waffenlos, S. 183;
  als Auslegung gekennzeichnet, `angeboreneWaffen()`); Angriffswert Handgemenge + Attribute der Waffe.
- **Untote: freie Meisterschaften wählbar:** ein Platz je erreichter Schwelle einer gesteigerten Fertigkeit, Auswahl bis zur Schwelle
  des Platzes, gespeichert in `meisterschaften`; ohne Platz ein Regelverstoß (Hausregeln: Warnung). Im Wertekasten angezeigt.
- **Golem-Feinschliff bedienbar:** Wahl-Texte der Bausteine werden zu Auswahlen (`leseWahlen`, Zahlen aus dem Paket-Text):
  Attribut („ein beliebiges Attribut +1“, „BEW oder INT oder KON oder STÄ +1“, wirkt auf abgeleitete Werte und Fertigkeiten),
  freie Meisterschaft („[Schwelle 1]“ bzw. „[Schwelle siehe Schritt 5]“ nach Stufe), Fertigkeit („auf 6 oder +3“), Punkte verteilen
  („8 freie Fertigkeitspunkte, max. +2“). Feste Meisterschaften aus den Bausteinen erscheinen im Wertekasten. Feld `feinschliff`.
- Tests: `begleiter`, `begleiterSpiel`, `gefolge`, `untoteGolems` angepasst und erweitert. 354 grün mit allen Büchern
  (bekannter Relikte-Test mit älteren Grimoires ausgenommen), FUNDAMENT-Prüfungen grün, Build gelingt, im Browser geprüft.
- **Offen (Datenseite, Ordner `Werkzeuge`):** Zahlenwerte für Abrichtungen (Boni im Wertekasten), Vertraute aus „Die Magie“ (im Paket
  nur Verweise), Regelwerte von Gefolge/Untoten/Golems in `strukturiert`, fehlende Bestiarium-Werte. **Offen (Entscheidung):**
  Baukasten für beschwörbare Wesen und Bestien braucht eine neue Zeile in der Tabelle „Regelquellen“.
- **Reiter „Spielen“ und „Kampf & Magie“ im Aussehen des Mockups** (Anordnung und Felder unverändert): Karten auf
  `flaeche` mit 20 Pixel Innenrand und 20 Pixel Abstand, Titel 17 Pixel, innere Kacheln auf `erhoeht`; Balken 18 Pixel
  hoch; Legenden als 12-Pixel-Quadrate; Farben nach Bedeutung (echter Schaden/verzehrt `schaden`, Betäubung/erschöpft
  `erschoepft`, kanalisiert `kanalisiert`, freie Lebenspunkte `unverletzt`-Rand); Knöpfe „Schaden“/„Heilung“ und Zähler
  44 Pixel hoch; keine Linie mehr unter Kartentiteln.

## Stand 23 (11.11.2026): Wesen-Baukasten – beschwörbare Wesen und Kreaturen

Entscheidung 11.11.2026: neue Zeile „Begleiter: Wesen-Baukasten“ in FUNDAMENT.md (Regelquellen), vom Projektinhaber freigegeben.

- **Regelmodul `regelwerk/wesenBaukasten.ts`** für beide Baukästen, alles aus den Paketen: Grundwerte der Basis bzw. des
  Korpus; Stufe des Merkmals Beschwörbares Wesen = `beschwoerbares_wesen_stufe` + `stufe_bonus` (Die Magie S. 193:
  „zusammengezählt“); Ressource Kreatur = `ressource_kreatur` + `kosten_punkte` (Bestienmeister S. 50). Module mit Kostentext
  ohne Zahl („speziell“) werden genannt, nicht eingerechnet; Rollen der Kreaturen ohne Kostenangabe kosten nichts (Auslegung von
  „Basis und Rolle“). Mehrfachwahl aus `mehrfach`, Voraussetzungen aus `voraussetzungen` (Bedingungen mit Träger „wesen“ über
  `regelwerk/bedingungen.ts`), Dienste aus `moegliche_dienste`, höchste Schwelle/Zaubergrad und Zahl der Dienste aus
  `strukturiert` der Regel „Schritt 5: Feinschliff“ (Die Magie S. 196).
- **Werte** über `regelwerk/modifikationen.ts`; neu dort: „Waffenmerkmal X entfällt“ und „Initiative“ als Kürzel für INI.
  Wahlen (beliebiges Attribut, freie Meisterschaft, Fertigkeit auf 6 oder +3, freie Fertigkeitspunkte) sind bedienbar: Die
  Auswertung `wahlenAnwenden()` und die Ansicht `Feinschliff.tsx` teilen sich Golem und Wesen-Baukasten (aus `golem.ts` bzw.
  `GolemAbschnitt.tsx` herausgelöst).
- **Oberfläche** (`components/begleiter/WesenBaukasten.tsx`): „Eigenes Wesen bauen“ im Abschnitt „Beschworene Wesen“ (Korpus
  Klein/Mittel/Groß), „Eigene Kreatur bauen“ im Abschnitt „Tiere“ (Basis Agil/Robust/Schnell/Stark). Bausteine je Gruppe,
  Aufschlüsselung der Stufe, Dienste mit Basisdienst, Feinschliff. Mehrfachwahl und Voraussetzungen sperren
  (`aenderungGesperrt`, mit Hausregeln Warnung). Gebaute Kreaturen haben Abrichtungen, Potenzial, Lebenspunkte und Würfeln wie
  andere Tiere. Felder `dienste`, `basisdienst` am Begleiter (Speichern, Laden, Import).
- **Korrektur:** Die Liste der beschwörbaren Wesen zeigte die drei Korpusse des Baukastens als fertige Wesen (65 statt 62).
- Tests: `wesenBaukasten.test.tsx` (5). Alle Tests grün mit allen Büchern außer dem bekannten Relikte-Test (ältere Grimoires in
  dieser Umgebung).
- Offen (Datenseite): Regeln zum Zusammenführen doppelter Merkmale (Die Magie S. 196) und Verbesserte Angriffe (S. 196–197)
  stehen nur als Text im Paket; Zahl der Dienste ist Text („halbe Stufe“), keine Zahl.

## Stand 24 (11.11.2026): Erweiterungsbände heißen Grimoires (.grim)

Entscheidung des Projektinhabers 11.11.2026: Die nachladbaren Erweiterungsbände heißen im Editor **Grimoires** (das Grimoire,
die Grimoires), Dateiendung `.grim`. Das Grundregelwerk ist kein Grimoire; es bleibt eingebaut (`public/regelpakete/grw.srp.json`).

- **Begriffe** in Oberfläche, Meldungen, Kommentaren, FUNDAMENT.md (Grundsatz 1 nennt den Begriff), README und `manifest.json`:
  „Buchpaket(e)“ und „Bücher“ im Sinn der nachladbaren Pakete → „Grimoire(s)“. „Buch“ für das gedruckte Werk („laut Buch“,
  „Buch S. 196“) bleibt.
- **Code:** `grimoireLesen` (vorher `buchpaketLesen`), `grimoireModule`, `grimoireAusruestung`, `grwMitGrimoireAenderungen`;
  im Regelwerk-Kontext `grimoires` statt `buecher`.
- **Dateien:** Die Dateiauswahl in Einstellungen → Regelpakete nimmt `.grim`; ältere Exporte mit `.srp.json` werden weiter
  gelesen. Der Dateiinhalt ist unverändert (`format: splittermond-regelpaket`). Der interne Speichername im Browser (IndexedDB)
  bleibt, damit bereits gespeicherte Grimoires erhalten bleiben.
- **Tests:** Ordner der Grimoires über `FOKUS_GRIMOIRES` (`FOKUS_BUECHER` gilt weiter); `<id>.grim`, sonst `<id>.srp.json`
  (`hilfen.ts`: `GRIMOIRE_ORDNER`, `grimoireDatei`, `istGrimoireDatei`). Mit `.grim`-Kopien aller Bücher geprüft.
- **Erledigt in Stand 25:** Der Export der Datenseite schreibt `.grim`; die Übergangsregeln sind entfernt.

## Stand 25 (11.11.2026): Datenseite schreibt Grimoires, Übergang beendet

- **Datenseite (`Werkzeuge`, auf der Platte des Projektinhabers, nicht im Repo):** `regelpakete/editor_export.py` schreibt je
  Erweiterungsband `Regelpakete/editor/grimoires/<id>.grim` (vorher `editor/buecher/<id>.srp.json`), Inhalt unverändert.
  Beschreibung und Lade-Algorithmus im Editor-Manifest sprechen von Grimoires, gleich dem Stand in `public/regelpakete/manifest.json`.
  Liegen im alten Ordner `editor/buecher/` noch `.srp.json`-Dateien, meldet der Export das (löscht nichts).
  `LIESMICH.md` in `Werkzeuge`, `Werkzeuge/regelpakete` und `Regelpakete/editor` nachgezogen. Die zwölf Grimoires liegen bereits
  als `.grim` in `Regelpakete/editor/grimoires/` (Kopien des Exports vom 10.11.2026). Das Grundregelwerk bleibt `grw.srp.json`;
  auch die internen Pakete `Regelpakete/pakete/<id>.srp.json` (Regelbrowser, Prüfsuite) behalten ihre Endung.
- **Editor:** Dateiauswahl nimmt nur noch `.grim`; der Hinweis auf `.srp.json` ist weg. Tests lesen nur `<id>.grim` aus
  `FOKUS_GRIMOIRES` (`FOKUS_BUECHER` und die `.srp.json`-Ausweichregel entfallen). Bereits im Browser gespeicherte Grimoires
  bleiben erhalten (IndexedDB-Speicher unverändert).
- **Geprüft:** alle Tests mit `FOKUS_GRIMOIRES` auf die neuen `.grim`-Dateien grün (370 bestanden), auch der bisher mit älteren
  Paketen fehlschlagende Relikte-Test.

## Stand 23 (12.11.2026): Oberfläche fertig umgestellt, Steigerungsregeln aus dem Paket, Zustände nach Regelwerk

- **Geprüft im Browser** mit einem zaubernden Beispielcharakter: Zauberdialog, Schadens-, Heil-, Angriffs- und
  Profildialog, Relikt-Werkstatt, alle Reiter, Spielen und Kampf in Handybreite. Zauberdialog: „Würfeln!“ ist die
  goldene Hauptaktion.
- **Charakter, Inventar, Begleiter, Erschaffung** haben Karten und Titel wie im Mockup (Fläche, 20 Pixel Innenrand,
  Titel 17 Pixel, keine Linie unter Kartentiteln). Anordnung unverändert.
- **Alle Dialoge** liegen auf den neuen Bausteinen `Dialoghintergrund` und `Dialogfenster` (19 Dialoge in 16 Dateien);
  Fläche, Rahmen, Rundung, Höhe und Schatten sind nur noch dort festgelegt. Eine Prüfung verhindert eigene Dialograhmen.
- **Kosten in Erfahrungspunkten und Heldengrade** kommen aus den Kernregeln des Grundregelwerk-Pakets
  (`regelwerk/steigerungsregeln.ts`): Attribute, Fertigkeitspunkte, Stärken, Ressourcen, Sprachen, Zauber,
  Meisterschaften, Schwellen und Grenzen der Heldengrade, Fertigkeitspunkte je Zaubergrad. Die eingebauten Zahlen
  bleiben als Rückfall ohne Paket; ein Test hält sie mit dem Paket gleich. Verstreute Formeln in den Handlern entfernt.
- **Zustände nach Regelwerk korrigiert** (GRW S. 168–169, Texte aus dem Paket). Vorher zog der Editor Abzüge ab, die
  es nicht gibt: Benommen (verlangsamt nur um 1 Tick je Stufe), Angsterfüllt (nur Sicherheitswürfe), Panisch, Lahm,
  Siechtum – jetzt ohne Probenabzug. Erschöpft gilt nur für Kampf- und allgemeine Fertigkeiten, nicht für Magieschulen;
  Glaubenskrise nur für Magieschulen; Geblendet höchstens bis Stufe 4; Verwundet zählt beim Wundabzug als eine
  Wundstufe schwerer je Stufe (statt pauschal −1). Die Beschreibung eines Zustands kommt aus dem Paket.
- Offen: Die Abzüge der Zustände stehen weiter im Code (`utils/conditionModifiers.ts`), bis sie im Paket strukturiert
  vorliegen – das braucht die Datenseite auf D:. Nicht umgesetzt: Wirkung von Zuständen auf abgeleitete Werte (Erschöpft:
  GSW −1, INI +1 je Stufe; Ringend: VTD −3, GSW 0; Lahm: halbe GSW). „Verwirrt“ ist kein Zustand des Grundregelwerks;
  sein Wert ist unverändert.
- **Liegend** ist eine Kampfposition (GRW S. 170), kein Eintrag der Zustandsliste: −6 auf eigene Angriffe (aus der
  Tabelle der Kampfpositionen im Paket), kein Abzug auf andere Proben. Vorher −2 auf alles. Begleiter-Regeln und die Listen in `src/data` stehen weiter im Code.
- **Zustandsauswahl aus den Paketen** (`regelwerk/zustaende.ts`): Wählbar sind die Einträge vom Typ `zustand` aus dem
  Grundregelwerk und aus geladenen Büchern, mit Stufe laut Paket. Damit ist „Krank“ wählbar (fehlte), und die drei
  Zustände aus „Hinter dem Schleier“ erscheinen, sobald das Buch geladen ist. „Verwirrt“ ist entfernt (kein Zustand in
  Splittermond). „Liegend“ bleibt als Kampfposition in der Auswahl.
- Offen bei den Zuständen: Schwermut, Verorkt und Verstoßen stehen in keinem Paket. Die Abzüge der Zustände aus den
  Büchern (Erschaudert, Übergangsschock) rechnet der Editor nicht – sie müssten im Paket strukturiert vorliegen;
  Zahlen aus Erweiterungen gehören nicht in den Code.

## Stand 26 (12.11.2026): Begleiter-Regeln aus den Paketen, Relikte Stufe 3, Knöpfe und Zauberfarbe, Buch-Zauber gesichtet

- **Begleiter-Regeln nur noch aus den Paketen** (Grundsatz 2 und 3). Gefolge, erhobene Untote und Golems lesen ihre
  Regelwerte aus `daten.strukturiert` (Ressource Gefolge im GRW; Regeltexte „Werte und Steigerung von Untoten“ und
  „Golems – Weitere Regelelemente“ in Die Magie), aus `daten.wertesaetze` an den Erhebungszaubern (Kreatur-IDs oder
  Fundstelle, EP je Verstärkung) und aus `daten.baustein_werte` an den Schwachpunkten. Steigerungskosten,
  Meisterschaftsschwellen, Grenzen der Heldengrade und freie Zauber kommen aus den Kernregeln des GRW. Im Code stehen
  keine Namen, Fundstellen oder Zahlen aus Die Magie mehr. Ohne den Band zeigen die Abschnitte, dass die Regeln fehlen.
- **Werte für Ghul, Skelett, Wandelnder Leichnam** (GRW S. 272, 279, 282) im GRW-Paket. Mumie und Seuchenbringer
  stehen in „Bestien & Ungeheuer“, das es nicht als Paket gibt; der Editor nennt dort die Fundstelle.
- **Relikte, Stufe 3:** Chronik des Relikts (legendäre Tat mit Beschreibung, neuer Heldengrad, Abenteuerbelohnung;
  Regeln aus Mondstahlklingen), beseelte Gegenstände (Domäne, Kräfte I/II/III+ mit Questen, Gebote, ruhende Kräfte
  nach Verstoß; Regeln aus Die Götter), Schwerpunkt-Bonus eines Relikts zum Anklicken bei passenden Proben.
- **Fundament:** Knöpfe der Dialoge und Karten mindestens 44 Pixel hoch, Zauberwirkungen einheitlich in der
  Magie-Farbe. Mit den Dialog-Bausteinen der parallelen Sitzung zusammengeführt.
- **Spielwerte der Buch-Zauber:** alle 32 automatisch abgeleiteten Zauber einzeln gegen den Zaubertext gesichtet,
  Korrekturen in `zauber_spielwerte.json` (Datenseite). Grimoires neu hochladen.
- Datenseite: `Werkzeuge/regelpakete/begleiter_regeln.json` + `.py` (prüft jede Zahl gegen den Text der Belege),
  `Werkzeuge/grw/ergaenzung9.py` (drei Untote), `relikt_bausteine.json` mit `strukturiert` für Wachsen und Beseelung.
  Prüfsuite ohne neue Befunde. Am Abend mit dem Grimoire-Stand der Werkzeuge zusammengeführt, neu gebaut und auf D:
  geliefert (Werkzeuge, Regelpakete mit Grimoires, Prüfsuite, GRW-Datenbank).
  Die parallele Sitzung hat danach die Zustände (`zustaende.py`) dazugeliefert und auf D: neu gebaut; Werkzeuge,
  Pakete und Grimoires auf D: enthalten beide Lieferungen, das GRW-Paket auf D: ist gleich dem im Editor.
- Tests der Relikte laden Bücher jetzt über die Grimoire-Hilfen (`FOKUS_GRIMOIRES`).
- **Zustände aus den Paketen statt aus dem Code (Korrektur, 12.11.2026):** Die Zustände des Grundregelwerks kommen
  aus dem GRW-Paket, alle anderen ausschließlich aus den Grimoires. Die Zustände aus anderen Bänden und ihre Zahlen
  sind wieder aus dem Code entfernt; `src/data/zustaende.ts` enthält nur noch den Rückfall für die 17 Zustände des
  Grundregelwerks. Stufe (`hat_stufe`), Abzüge (`daten.zustandswirkung`) und Quelle stehen im Paketeintrag.
- **Quelle beim Überfahren mit der Maus:** Zustandsmarken, Auswahllisten und Schnellwahl zeigen „Quelle: GRW S. 168“
  bzw. Buchkürzel und Seite; „Liegend“: „GRW S. 170 (Kampfposition)“.
- **GRW-Paket:** `daten.zustandswirkung` an Erschöpft, Geblendet, Glaubenskrise, Lahm, Ringend, Verwundet ergänzt
  (Zahlen gegen den Beschreibungstext geprüft), Prüfsumme im Manifest angepasst.
- **Datenseite (am 12.11.2026 abends auf D: geliefert, Pakete und Grimoires dort aktualisiert):** neues Modul `Werkzeuge/regelpakete/zustaende.py` mit
  Tabelle `zustaende.json` (nur IDs, Seiten, Zahlen, Kennwörter), Aufruf in `export.py` nach `zauber_spielwerte.py`,
  Schema in `write.py`. Ergänzt Schwermut („Jenseits der Grenzen“ S. 51, aus der Tabelle „Wandel der Umwelt“) und
  Verstoßen („Die Götter“ S. 147, mit Stufe; ein Viertel des Fokus je Stufe dauerhaft kanalisiert) als Einträge in den
  Grimoires und schreibt `zustandswirkung` für GRW-, Schleier-, Jenseits- und Götter-Zustände. Prüfsuite: 0 neue
  Befunde. Nach dem Bauen auf D: Grimoires neu hochladen.
- **Zustände wirken auf alle Werte** (`regelwerk/zustandswerte.ts`, Zahlen aus `daten.zustandswirkung.werte`):
  Geschwindigkeit, Initiative, Verteidigung, Geistiger und Körperlicher Widerstand, Schadensreduktion und Fokus –
  in „Spielen“, „Kampf & Magie“ (VTD), im Zauberdialog (verfügbarer Fokus) und bei Begleitern (Hinweiszeile, Fokus).
  Reihenfolge: Zu- und Abschläge, dann Faktor (abgerundet), dann gesetzter Wert. Erschöpft: GSW −1, INI +1 je Stufe;
  Ringend: VTD −3, GSW 0; Lahm: halbe GSW; Schwermut: GW −2; Erschaudert: GW −Stufe; Übergangsschock: VTD und GW
  −Stufe; Verstoßen: ein Viertel des Fokus je Stufe dauerhaft kanalisiert. Bewusstlos und Schlafend gelten als liegend
  (`gilt_als`): Hinweis „Nahkampf gegen den Charakter +6, Fernkampf −6“. Entfernt, weil nicht im Regelwerk: VTD 0 bei
  Bewusstlos, VTD −2 bei Liegend.
- **Geblendet** gilt laut GRW nur für Handlungen, bei denen die Sicht zählt: bei Angriffen und Zaubern gesetzt, bei
  Fertigkeitsproben abwählbar und nicht vorausgewählt.
- Offen: Verorkt („Ungebrochen“ S. 123) – das Buch ist nicht im Bestand. Begleiter: Die Wertetabellen der Abschnitte
  zeigen die Grundwerte; die Änderung durch Zustände steht darunter als Hinweiszeile. Hinweis: „Verstoßen“ war bisher ausgeschlossen (Verstoßene/Gefallene
  aus „Die Götter“); aufgenommen ist nur der Zustand, nicht das übrige Kapitel.
- **Gesamtprüfung nach den parallelen Sitzungen (12.11.2026, spät):** Aus den aktuellen Werkzeugen und Datenbanken
  auf D: neu gebaut. Ergebnis: Alle Einträge in Paketen und Grimoires sind inhaltlich gleich mit D:. Prüfsuite
  0 neue Befunde, Praxistest 109 von 109, Wirkungsprüfung ohne Hinweise. Der Handpatch der Zustände-Lieferung hatte aber Metadaten
  nicht nachgezogen: Eintragszahl in `ladeinfo` der Grimoires „goetter“ und „jenseits“ (Editor meldete beim
  Hochladen „Anzahl ≠ manifest“), Bytezahlen in den Manifesten, zwei IDs im ID-Register, `zustandswirkung` im
  Schema, Regelbrowser und LIESMICH. Die neu gebauten Dateien liegen jetzt auf D:. Im Editor die Bytezahl des
  GRW-Pakets im Manifest korrigiert. Tests: 393 grün mit allen 12 Grimoires, 368 ohne Bücher; Build läuft.

## Stand 27 (12.11.2026): Zustände bei Begleitern eingerechnet, Kennzahlenprüfung, Volltest, GRW-Listen aus dem Paket

- **Begleiter:** Der Wertekasten von Tieren, Gefolge, Untoten, Golems und Wesen rechnet die Zustände ein (GSW, VTD, SR,
  KW, GW, Initiative der Waffen; `regelwerk/zustandswerte.ts`, `textMitZustaenden`). Der Grundwert steht in Klammern
  daneben, die Erklärung beim Überfahren mit der Maus; die Zeile unter den Zuständen heißt jetzt „In die Werte eingerechnet“.
- **Kennzahlen:** Neuer Test `konsistenz.test.ts` (Prüfsumme, Bytezahl, Eintragszahl im Manifest; mit FOKUS_GRIMOIRES
  auch `ladeinfo.original` und Statistik der Grimoires). Gegenstück in der Prüfsuite (`pruefungen.py`, Prüfung `konsistenz`).
  Beide fangen den Fehler vom Abend („Anzahl ≠ manifest“) ab.
- **Volltest wieder scharf:** `Pruefsuite/editor_referenz.py` erzeugt die Vergleichsdatei `editor_referenz_voll.json`
  (liegt auf D:, nicht im Repo). Aufruf siehe `vollabgleich.test.ts`; 5 von 5 grün.
- **GRW-Listen aus dem Paket** (`regelwerk/grwListen.ts`): Zauber, Meisterschaften (Schwellenwerte aus „Meisterschaften
  erhalten“), Stärken, Schwächen, Ressourcen (mit Stufenübersicht), Sprachen, Mondzeichen, Fertigkeiten mit Attributen,
  Rassen, Stärkenpunkte der Erschaffung, Attribute, Gesundheitsstufen, kostenlose Stärke der Kultur. Ausrüstung des
  GRW aus dem Paket (`ausruestung.ts`, `grwAusruestung`; 177 statt 142 Einträge – dazu Kleidung, Gifte, Material,
  Verbesserungen; Beschreibungen mit Attributen, Mindestattributen, Härte). Alte Ausrüstungs-IDs („waffen|…“) bei Relikten
  werden weiter gefunden (`findeAusruestung`). `src/data` und die Listen in `rules.ts` sind nur noch Rückfall ohne Paket;
  `grwListen.test.ts` und `ausruestung.test.ts` halten sie gleich.
- **Korrekturen am Rückfall nach dem Paket:** Wie oft Stärken wählbar sind (Datenseite: `daten.mehrfach_waehlbar`):
  Erhöhter Fokuspool beliebig oft, Hoher GW/KW einmal pro Heldengrad (höchstens 4), Erwählter der [Wesen] und Kulturkunde
  je Typus bzw. Kultur (vorher pauschal 5). Sprachen: S. 315, Familien wie im Buch, „Sprache der Orks“ statt „Ork-Sprache“,
  „Gesamt-Gnomisch“ entfernt (nicht im GRW). Gesundheitsstufe 1 heißt „Unverletzt“ wie im GRW.
- **Beispielcharaktere:** Beim Laden einer Vorlage schreibt der Editor die IDs aus dem Paket mit; `vorlagen.test.ts` prüft,
  dass jeder Name eine ID hat.
- **Datenseite (auf D: geliefert):** `Werkzeuge/regelpakete/staerken_mehrfach.py` + `.json`, Schema in `write.py`;
  GRW-Paket und Manifeste neu gebaut; Prüfsuite 0 neue Befunde.
- Tests: 417 grün mit allen 12 Grimoires und Volltest, 386 ohne Bücher; Build läuft.
- Offen: Würfelmechanik, Fokuskosten, Kampfmanöver nach Namen, einzelne Stärken nach Namen (characterCalculations,
  RestSection), Heimatregionen (stehen nicht im GRW-Paket) – siehe FUNDAMENT.md, Altlasten.

## Stand 28 (21.11.2026): Pausen, Ruhewirkungen, Wundabzüge, Rüstung/Schild und Heimatregionen aus dem Paket

- **Keine Stärken und Meisterschaften mehr nach Namen** in `characterCalculations.ts` und `RestSection.tsx`
  (Regelnamen im Code 53 → 39). Neues Modul `regelwerk/spielwirkungen.ts`:
  - `ruheregeln`: Ruhephase (Konstitution × 2 LP, Willenskraft × 2 Fokus, mindestens 1, 6 Stunden) und Verschnaufpause
    (30 Minuten) aus `daten.ruheregeln` der Kernregel „Heilung“; Fundstelle „GRW S. 173–174“ statt fest eingetragener S. 160.
  - `ruhewirkungen`: `daten.ruhewirkung` (z. B. Erhöhte Lebensregeneration ×3, Schnell wieder auf den Beinen +1,
    Dickschädel 15 Minuten); bedingte Wirkungen (Eins mit der Natur) erscheinen als „nicht eingerechnet“; Beleg beim Überfahren.
  - `wundabzugMinderung`: Wirkungen „Wundabzug gesenkt“ (Schmerzresistenz, Schmerzwiderstand I/II).
  - `ausruestungsMinderung`: Behinderung und Tick-Zuschlag getrennt für Rüstung und Schild (`gilt_fuer`); Rüstungsträger II
    und Starker Schildarm II senken jetzt auch den Tick-Zuschlag (vorher gar nicht berücksichtigt).
- **Schadensreduktion aus Stärken** über `abgeleitete_werte_modifikatoren` (Natürlicher Rüstungsschutz +1); `KatalogWerte.SR`.
- **LP/FO/SP aus Stärken** nur noch aus dem Paket; ohne Paket gibt es keine Boni nach Namen mehr.
- **Heimatregionen** = Kulturkunde der Kultur-Module (`grwHeimatregionen`, GRW: die zwölf Kulturen); ein früher gewählter
  Name bleibt in der Auswahl stehen. Die kostenlose Stärke der Kultur heißt überall wie im Paket (`gratisStaerkeDerKultur`).
- **Regelkorrekturen:**
  - GSW-Abzug durch Behinderung kaufmännisch gerundet (GRW S. 11: „wird stets kaufmännisch gerundet“), auch im Rückfall;
    Behinderung 1 kostet also 1 GSW, Behinderung 3 kostet 2. Tests entsprechend korrigiert.
  - „Segen der Mondkraft“ halbiert die Pausendauer nicht mehr automatisch, sondern nur beim Einsatz der Gabe für einen
    Splitterpunkt (GRW S. 81, 83); der Rast-Dialog zeigt das als Hinweis.
  - Die Schwäche „Dahinsiechen“ gibt es nicht (Dahinsiechen ist ein Zauber in „Die Magie“); die Sonderbehandlung ist entfallen.
- **Datenseite (auf D:):** `spielwirkungen.py` + `.json`, `abgeleitet.py` (SR), Schema in `write.py`, `lader.py` der Prüfsuite;
  GRW- und Magie-Paket sowie Grimoire „magie“ neu gebaut. Prüfsuite 0 neue Befunde, Praxistest 109/109.
- Tests: 422 grün mit allen 12 Grimoires und Volltest, 391 ohne Bücher; Build läuft.

## Stand 29 (21.11.2026): Kampfmanöver aus dem Paket

- **Bestandsaufnahme** der 23 Manöver und 5 freien Manöver in `combatRules.ts` gegen GRW S. 95–100 und 160–161:
  - **Erfunden (entfernt):** freie Manöver „Gezielter Schlag/Schuss“ (Rüstung umgehen), „Defensiver Angriff“, „Finte“,
    „Zu Boden werfen/Umreißen“ für 2 EG. Die „Liste der freien Manöver“ (S. 161, geprüft an den Rohzeilen der PDF-Seite 162)
    kennt nur Wuchtangriff, Betäubungsschlag und Störender Angriff. „Scharfschütze“ ist kein Manöver (S. 99).
  - **Falsch:** Wuchtangriff +2 statt +1 Schaden je EG (+2 nur mit dem Merkmal Wuchtig, S. 186; Beispiel S. 161:
    1 EG macht aus 1W6+4 dann 1W6+5), Wuchtangriff war für Schusswaffen gesperrt (S. 162: freie Manöver gelten auch im
    Fernkampf); Schmetterschlag Verwundet 1 statt Benommen 1 für 30 Ticks; Sehnenschneider Lahm 60 Ticks statt Lahm;
    Umklammern ohne KW und ohne halben Schaden.
  - **Fehlte:** Wirkung von Knochenbrecher (Verwundet 1), Schmerzhafter Hieb (Lahm 60 Ticks), Ausfall (Ziel −3 Ticks),
    Verwirrung (gegen GW, halber Schaden), Vorstürmen (+halbe GSW, höchstens 8), Würgegriff (+STÄ), Meisterschuss und
    Meisterwurf (+INT), Harter Wurf (+halbe STÄ), Entwaffnen und Schildbrecher (kein Schaden), Rundumschlag (halber
    Schaden, 2 weitere Ziele), Umreißen als Meisterschaft (KW, halber Schaden); die Kosten von 1 EG je angesagtem Manöver
    und der Streiftreffer (S. 161).
- **Datenseite (auf D:):** `Werkzeuge/regelpakete/manoever.py` + `.json`: `manoever_regeln` (freie Manöver, EG-Kosten,
  Streiftreffer), `manoeverwirkung` an allen 29 Manöver-Meisterschaften, `wuchtangriff_je_eg` am Merkmal Wuchtig; jede Zahl
  gegen einen Belegsatz geprüft. Prüfsuite 0 neue Befunde, Praxistest 109/109.
- **Editor:** `combatRules.ts` ohne Namenslisten (`KNOWN_MASTERY_MANEUVERS` entfernt); `getAvailableCombatManeuvers`
  liest die gelernten Manöver-Meisterschaften aus dem Katalog (auch aus Grimoires; ohne `manoeverwirkung` aus den Wirkungen
  „beim Manöver“). Eine Meisterschaft gilt nur in ihrer Fertigkeit. Angriffsdialog: Manöverkarten mit EG-Kosten, Fundstelle
  und Belegsätzen beim Überfahren; Zielwert-Beschriftung nach Widerstand (VTD/KW/GW); Voraussetzungen (Zielen, ringend,
  Größenklasse); Erfolgsgrade für Wuchtangriff (mit Merkmal der Waffe), Störenden Angriff, Betäubungsschlag (nur Nahkampf)
  und weitere EG des Manövers; Streiftreffer-Hinweis und Schadensabzug; halber Schaden kaufmännisch gerundet.
  Zusatzschaden aus STÄ, INT und GSW des Angreifers (`angreiferWerte`).
- Regelnamen im Code 39 → 16. Tests: 426 grün mit allen 12 Grimoires und Volltest, 395 ohne Bücher; Build läuft.
- Offen: Situationsknöpfe im Angriffsdialog („Gegner liegt +2“, „Vorteil +1“, „Deckung +2 VTD“) stehen noch als Zahlen im
  Code und weichen teils von der Tabelle Kampfpositionen (S. 170) ab; nur ein Manöver je Angriff wählbar (das GRW erlaubt
  mehrere); Würfelmechanik und Erfolgsgrad-Bezeichnungen (`calculateAttackEG`) noch im Code.

## Stand 30 (21.11.2026): Begleiter-Tab neu – Blatt wie „Kampf & Magie“, Erstellen im Assistenten

- **Blatt je Begleiter** (`components/begleiter/BegleiterBlatt.tsx`), aufgebaut wie „Kampf & Magie“: Kopf mit Name, Art,
  Kurzangaben, „Bearbeiten“ und „Entfernen“ (mit Rückfrage); darunter „Lebenspunkte & Fokus“ (LP-Kästchen, Fokus,
  Zustände, Pausen) neben „Werte“ (abgeleitete Werte und Attribute als Kacheln, Zustände eingerechnet); dann links
  „Angriffe“ (Waffenkarten mit Kacheln und Knöpfen Angriff/Schaden) und „Fertigkeiten“ (Würfelknöpfe), rechts „Zauber“
  (Wirken), „Fähigkeiten“ (Typus, Merkmale, Meisterschaften, Abrichtungen, Instruktionen, Dienste … je Art) und Notiz.
  Eine Leiste im Kopf des Tabs wählt den Begleiter; dort auch Ressourcen und übergreifende Hinweise.
- **Erstellen nur im Assistenten** (`components/begleiter/assistent/`): Knopf „Begleiter erstellen“ öffnet einen Dialog,
  ein Schritt nach dem anderen mit Schrittleiste. Zuerst die Art (Tier, Gefolgsmann, Beschworenes Wesen, Erhobener
  Untoter, Golem; ohne passendes Grimoire gesperrt mit Hinweis), dann die Schritte der Art:
  Tier: Tier wählen (Katalog oder eigene Kreatur) · Grundangaben · Module · Abrichtungen · Übersicht;
  Gefolgsmann: Rasse und Kultur · Grundangaben · Fertigkeiten · Waffen · Meisterschaften und Zauber · Übersicht;
  Wesen: Wesen wählen · Name (und Dienste) · Module, Rollen und Dienste · Übersicht;
  Untoter: Zauber und Wertesatz · Verstärkung und Abnormität · Steigerung · Freie Meisterschaften · Übersicht;
  Golem: Korpus · Material und Animierung · Fähigkeiten und Rollen · Applikationen und Schwachpunkte ·
  Instruktionen und Verfügungen · Sonderausstattung und Feinschliff · Übersicht.
  Geändert wird ein Entwurf; erst „Erstellen“ bzw. „Übernehmen“ schreibt ihn in den Charakter. „Bearbeiten“ öffnet
  denselben Assistenten ohne Art und Grundlage (Lebenspunkte, Zustände und Notiz bleiben). Sperren wie bisher
  (`aenderungGesperrt`, `regelverstoss`; mit Hausregeln Warnung).
- Gemeinsame Teile: `besitzer.ts` (Ressourcen, Meisterschaften, Zauber des Abenteurers), `ansicht.ts` (einheitliche Sicht
  auf alle Arten für Blatt und Übersicht). Die alten Abschnitte (`Tier-/Gefolge-/Wesen-/Untot-/GolemAbschnitt.tsx`)
  sind entfernt; ihre Bedienelemente stecken unverändert in den Schritten. Der Text mit festen EP-Kosten beim
  Untoten ist entfallen (Zahlen nur aus dem Paket).
- Tests: Oberflächentests auf den Assistenten umgestellt (Hilfen `begleiterErstellen`, `weiter`, `abschliessen`,
  `blattWaehlen` in `__tests__/hilfen.ts`); 417 Tests grün mit den Grimoires vom 12.11. auf D:, Build läuft.

## Stand 31 (21.11.2026): Lage beim Angriff, mehrere Manöver, Proben und Zauber-EG aus dem Paket

- **Lage beim Angriff** (`regelwerk/kampflage.ts`, Datenseite `Werkzeuge/regelpakete/kampfsituationen.py` + `.json`): die
  erfundenen Knöpfe „Gegner liegt +2“, „Vorteil +1“, „Ziel in Deckung +2 VTD“ sind entfernt. Neu im Angriffsdialog, alle
  Zahlen aus dem GRW-Paket: eigene Position und Position des Ziels nach der Tabelle Kampfpositionen (S. 170, mit eigener
  Zeile für Armbrüste), Taktische Vorteile (+3 je Vorteil), Überzahl (+1 je Kämpfer, höchstens +3, nur Nahkampf), Lücke
  suchen bzw. Zielen (+1 je 2 Ticks, höchstens +3), im Fernkampf Deckung (leicht 1, schwer 2 zusätzliche EG, sonst „trifft
  die Deckung“) und Kampfgetümmel (−6; entfällt mit Scharfschütze, `ignoriert_situation`). Hinweis, wenn ein Manöver Zielen
  voraussetzt und keine Ticks eingetragen sind.
- **Mehrere Meisterschafts-Manöver je Angriff** (GRW S. 161; `manoever_regeln.kombination` mit Belegsätzen):
  nur gegen denselben Widerstand, jedes einmal, EG-Kosten addiert, Zusatzschaden und Zustände gesammelt, Schadens-
  einschränkung (halb/kein Schaden) für den ganzen Angriff, Streiftreffer −2 je angesagtem Manöver, weitere EG je Manöver.
  `kombiniereManoever` und `manoeverHinzufuegbar` in `combatRules.ts`; gesperrte Karten nennen den Grund.
- **Proben** (`regelwerk/proben.ts`): Würfelanzahl je Wurfart, Patzer- und Triumphgrenzen, EG je 3 Punkte und die
  Einstufungen aus den Kernregeln (S. 16–18). Korrigiert: Triumph gibt +3 EG und nur, wenn die Probe rechnerisch gelingt
  (vorher +1 und automatisch gelungen); Patzer EG −3, höchstens −1. Gilt für Proben, Angriffe und Zauber.
- **Zauber-EG** (`regelwerk/zauberEg.ts`): EG je Option, Höchstzahl, Mindestwerte und die Grunddauer des Auslösens (3 Ticks,
  neu als `strukturiert.ausloesezeit_ticks`, Beleg S. 194) aus dem Paket; die erfundene Liste `STANDARD_SPELL_ENHANCEMENTS`
  („+2 FO“) ist entfernt.
- **Potenzial von Tieren** (Bestienmeister S. 15) stand mit Zahlen im Code; jetzt `strukturiert.potenzial` im Grimoire
  (`begleiter_regeln.json`, Tabellenzellen gelten als Beleg). Ohne Bestienmeister kein Potenzial und keine Qualitätsauswahl.
- **Regelnamen im Code 16 → 0** (Voraussetzungsprüfung ohne Namenssonderfälle, das Paket hat alle formal; Lichtschaden vor
  Blitzschaden erkannt). Altlasten-Tabelle: Würfelmechanik, Fokuskosten und Regelnamen gestrichen.
- Tests: 437 grün mit allen Grimoires und Volltest, 406 ohne Bücher; Prüfsuite 0 neue Befunde, Praxistest 109/109; Build läuft.

## Stand 32 (21.11.2026): Begleiter-Werte – Abrichtungen, Vertraute, doppelte Merkmale, Verbesserte Angriffe

- **Abrichtungen mit Zahlen** (Bestienmeister S. 16–23; Datenseite `Werkzeuge/regelpakete/begleiter_werte.py` + `.json`,
  jeder Wert mit Belegsatz): 14 Abrichtungen tragen `daten.modifikationen` (z. B. Angreifer, Kämpfer, Gefestigt, Renner,
  Reittier I/II) und `daten.wahlen` (Merkmal-Option, Meisterschaft mit Schwelle oder nach Kampfabrichter, Fertigkeit +N).
  `regelwerk/abrichtungsWerte.ts` rechnet sie in Werte, Angriffe und Fertigkeiten des Tieres ein; der Assistent fragt die
  Wahlen im Schritt Abrichtungen ab und zeigt „Werte: …“ je Abrichtung. Neu in der Schreibweise: „Merkmal X N oder +M“.
- **Vertraute**: eigene Karte „Vertrauter“ im Assistenten (gesperrt ohne Stärke Tiervertrauter, mit Hausregeln Warnung).
  Auf dem Blatt „Vertrautenmagie“: Meisterschaften mit `daten.vertrautenmagie` (über die formalen Voraussetzungen ab
  Tiervertrauter, dazu Vertrauter des Glaubens I) und Zauber mit Typus „Vertrauter“ (`regelwerk/vertraute.ts`).
  „Die Magie“ hat zu Vertrauten nur Verweise.
- **Doppelte Merkmale** in den Baukästen (Wesen S. 196, Golem S. 207, Kreatur Bestienmeister S. 58):
  `strukturiert.merkmale_zusammenfuehren` – Ersetzungen, Stufen addieren, gegenseitiges Aufheben, LP je „robuster“.
  `merkmaleZusammenfuehren` in `modifikationen.ts`, genutzt von Wesen-Baukasten, Golem und Kreatur.
- **Verbesserte Angriffe** (Die Magie S. 196–197): Punkte aus der Rolle Kämpfer und dem Korpus, Kauf von Wertesets,
  „stumpf“ und Waffen (Kosten aus der Tabelle) im Wesen-Baukasten; Überziehen gibt einen Hinweis.
- **Begleiter-Leiste**: jeder Chip zeigt LP, Fokus, kampfunfähig und Zustände, verletzte Begleiter mit rotem Rand.
- `write.py`: Ohne PDF beim Bau bleibt die volle Prüfsumme aus dem bisherigen Paket erhalten.
- Tests: 439 grün mit allen Grimoires (5 übersprungen), 408 ohne Bücher; Prüfsuite regelpakete 0 Befunde; Build läuft.

## Stand 33 (21.11.2026): Schaden und Heilung aus dem Paket, Härte, Bakebakeku, Schaltflächen aus den Bausteinen

- **Schadensdialog** (`regelwerk/schadenUndHeilung.ts`): Gesundheitsstufen aus den Kernregeln, Schadensminderung durch
  einen Splitterpunkt aus den Splittergaben (−5, GRW S. 81). Die feste Schnellauswahl „Blutend 1–2, Brennend 1–3,
  Benommen 1–2, Vergiftet“ ist entfernt: Die Höchststufen standen in keinem Regeltext, „Vergiftet“ ist kein Zustand.
  Zustände kommen aus der Liste der Pakete, eine Höchststufe nur, wo das Paket sie nennt (Geblendet 4).
- **Heildialog:** „Erste Hilfe“ und „Wundversorgung“ (wählten Blutend automatisch ab, ohne Regelgrundlage im Paket)
  sind durch „Heilkunde“ ersetzt (Auswirkungen aus der Fertigkeit als Hinweis); welche Zustände enden, wählt der
  Spieltisch. „Erholung“ heißt jetzt Verschnaufpause, Dauer und Wirkung aus der Kernregel Heilung.
- **Gefolge, Untote, Golems:** Die Altlasten-Zeile war überholt; alle Regelwerte kommen schon aus `strukturiert`.
  Beide Zeilen sind aus der Altlasten-Tabelle gestrichen, die Regelquellen ergänzt.
- **Härte** als Feld am Gegenstand (`hardness`): aus den Paketen für Waffen, Rüstungen, Schilde und Gegenstände,
  im Inventar angezeigt und bearbeitbar, beim Relikt mit „Härte +1“ hochgerechnet (vorher nur Text). Der Rückfall
  `src/data/equipment.ts` trägt die Härte der 79 GRW-Waffen und -Rüstungen mit.
- **Bestiarium** (Datenseite `Werkzeuge/regelpakete/kreatur_varianten.py` + `.json`): Bakebakeku (Bestienmeister S. 48)
  hatte nur Zuschläge zu Wareishi und keine Waffe; jetzt `werte_berechnet` (Zuschläge, Körper 20 / 2W6+5 / WGS 9 aus der
  Zeilenfolge der PDF-Seite, Merkmale ersetzt, Zauber und Meisterschaften ergänzt). Weitere Lücken gibt es nur bei
  Tieren aus Preislisten, deren Band keinen Wertekasten hat (GRW: Esel, Wach- oder Jagdhund; Mondstahlklingen u. a.
  Pony, Äffchen, Sperberdrache); dafür steht nichts in den Büchern.
- **Schaltflächen aus den Bausteinen:** neu `Wahlknopf` (auswählbare Karte, `aria-pressed`) und `Reiter` (Reiterleiste,
  `role="tab"`). Rund 120 selbst gebaute `<button>` in Hauptnavigation, Spiel-, Kampf-, Inventar-, Erschaffungs- und
  Begleiteransicht sowie allen Dialogen sind umgestellt (mindestens 44 Pixel hoch). Neue Prüfung: selbst gebaute
  `<button>` je Datei stehen als Altlast (`knoepfe`) und dürfen nur weniger werden; übrig sind 6 in `PlaySharedVitals.tsx`
  (LP-, Fokus- und Temp-LP-Kästchen, Zähler).
- **Reste aus AI Studio:** `.aistudio/`, `public/assets/aistudio/` und die leere `src/data/splittermond_grw.sqlite` waren
  schon entfernt (Commit 6954724, `.gitignore` hält sie draußen). Dazu jetzt: `metadata.json` ohne die ungenutzte
  Gemini-Berechtigung (die App ruft keine KI auf), Name und Beschreibung aktuell; README verweist auf `FOKUS-1.2` statt
  `FOCUS_GoogleAIStudio`; die Kopfzeilen in `src/data/*.ts` nennen sie als Rückfall statt einer gelöschten Datenbank.
- Tests: 448 grün mit allen Grimoires (5 übersprungen); Prüfsuite regelpakete 0 Befunde; Build läuft; im Browser geprüft
  (Hauptnavigation, Schaden, Heilung, Einstellungen, Profile, Inventar, Angriff, Begleiter-Assistent).

## Stand 34 (21.11.2026): Textauslese auf der Datenseite, keine eingebauten Regeln mehr, Dialogköpfe

Zusammengeführt mit Stand 33 (Zweig `stand33`): Dort umgestellte Schaltflächen, Schaden/Heilung aus dem Paket, Härte und
Bakebakeku bleiben; die eingebauten Listen in `src/data`, die Stand 33 noch ergänzt hatte, entfallen hier ganz.

- **Textauslese auf der Datenseite** (`Werkzeuge/regelpakete/textauslese.py`, als letzter Inhaltsschritt in `export.py`):
  Modifikationen-Texte der Baukästen und Abrichtungen (`modifikationen_strukturiert` mit Wahlen), Golem-Bausteine
  (`voraussetzung_name`/`_ref`, `mehrfach_aus_text`), Sonderausstattung (`sonderausstattung`), Mehrfachgrenze der
  Abrichtungen (`mehrfach_grenze`), eigene Gesundheitsstufen und Betäubungsimmunität der Merkmale, Golemstufe der
  Animierungszauber, Ressource Kreatur und Stufenmerkmal, „in der gleichen Magieschule“ (`gleiche_fertigkeit`),
  mehrfach wählbare Meisterschaften (`mehrfach_waehlbar`). Selbsttest mit den früheren Editor-Beispielen beim Bau.
  Im Editor entfallen `leseModifikationen`, `leseWahlen`, `mehrfachAusText` und alle Suchmuster mit Wortlaut aus den
  Büchern; neue Fundament-Prüfung „keine Suchmuster, die Regeltext lesen“. `besitzer.ts` erkennt Kreatur, Gefolge,
  Golem, Tiervertrauter und Konstrukteur an der ID.
- **Keine eingebauten Regeln mehr:** Der Editor startet erst mit geladenem Grundregelwerk-Paket (`app/RegelwerkTor.tsx`,
  Ladeanzeige, Fehler mit „Neu laden“). `src/data` enthält nur noch die Beispielcharaktere; die Typen stehen in
  `src/types/regeldaten.ts`. Ohne Paket liefern alle Module leere Listen bzw. neutrale Werte. Die Voraussetzungsprüfung
  arbeitet nur formal über den Katalog (Schwelle 1 aus `schwellenwert`). Tests laufen mit dem GRW-Paket (`src/testSetup.ts`).
- **Korrekturen:** Traglast nach der Optionalregel GRW S. 165 (Stärke × 2 Last, je weiterem Punkt Behinderung +1, neu
  `strukturiert.traglast`; vorher KON + STÄ). Keira (Gnom mit Flink) hat GSW 8, nicht 7. Wunderwirker verlangt Zauberfinger
  in derselben Magieschule.
- **Erschaffung:** `ErschaffungRegelwerk.tsx` liest das Paket über `erschaffungEditor.ts`; der Text der freien Erschaffung
  kommt aus den Kernregeln (`kultur_frei`, `abstammung_frei`).
- **Dialoge:** neuer Baustein `Dialogkopf` (Symbol, Titel, Untertitel, Aktionen, Schließen-Knopf) und `useEscape`; alle
  Dialoge mit eigenem Aufbau nutzen ihn, schließen mit Escape und tragen `role="dialog"`. Prüfung „jeder Dialog hat die
  Titelzeile aus den Bausteinen“. Im Angriffsdialog nur eine goldene Hauptaktion.
- **Altlasten:** Regelnamen, Paketzugriffe, Suchmuster, Farbwerte 0; die Altlasten-Tabelle im FUNDAMENT ist leer.
  Übrig: 6 eigene `<button>` in `PlaySharedVitals.tsx` (aus Stand 33).
- Tests: 456 grün mit allen Grimoires und Volltest, 420 ohne Bücher; Prüfsuite 0 neue Befunde, Praxistest 109/109; Build;
  im Browser geprüft (Ladeanzeige, Angriff, Schaden; Desktop und Handy).

## Stand 35 (22.11.2026): Start ohne Netz, keine Altlasten, nachgerechnet, Typus des Ziels

- **Start:** Das Grundregelwerk wird nach dem Laden im Browser gespeichert (IndexedDB `fokus-grundregelwerk`). Ist der
  Server nicht erreichbar, startet der Editor mit der gespeicherten Fassung; sie wird gegen die Prüfsumme im Manifest
  geprüft. Ein schließbarer Hinweis nennt das Datum der Fassung. Im Browser geprüft mit Unterpfad-Build (`--base=/fokus/`,
  wie beim Hosting unter einem Pfad): Start mit Netz etwa 0,5 s, ohne Netz aus dem Speicher.
- **Altlasten bei null:** neue Bausteine `Leistenknopf` (Plus/Minus und Beschriftung in farbigen Leisten) und `Feldknopf`
  (Kästchen der LP-/Fokusleisten, mit Beschriftung); `PlaySharedVitals.tsx` hat keine eigenen `<button>` mehr. In den
  Begleiter-Ansichten stehen die Entfernen-Knöpfe neben der Marke (`MarkeMitEntfernen`) statt darin.
- **Nachgerechnet** (`regelwerk/__tests__/nachrechnen.test.ts`): Sollwerte von Hand nach dem GRW für alle sieben
  Beispielcharaktere (Rassenmodifikatoren S. 33–37, abgeleitete Werte S. 13–15, Stärken S. 71–74), Steigerungskosten
  (S. 25, 86–87), Erfolgsgrade beim Angriff (S. 17–18), Erfolgsgrade bei Zaubern (S. 221–222), Ruhephase (S. 173–174, 196).
  Dazu für das GRW und jedes Grimoire: Jeder feste Bonus einer Stärke oder Meisterschaft auf abgeleitete Werte oder
  Fertigkeiten kommt genau so im Editor an (ohne Regelnamen aus den Erweiterungen im Code). Keine Abweichungen gefunden.
- **Spielhilfen:** In Probe, Angriff und Zauber gibt es „Typus des Ziels“, sobald ein Bonus nur gegen einen Typus gilt
  (Paketfeld `gegen_typus`, z. B. Untotenjäger gegen Untote): Die Wahl wählt die passenden Boni aus und blendet die
  übrigen typusgebundenen aus.
- **Begleiter:** Probe, Angriff und Zauber eines Begleiters laufen weiter über dieselben Dialoge, zeigen aber nicht mehr
  die Stärken, Meisterschaften und Relikte des Helden (`wuerfelnder`, `angreifer`, `zaubernder` = `begleiter`).
- Tests: 496 grün mit allen Grimoires und Volltest, 448 ohne Bücher; Build; im Browser geprüft (Start ohne Netz,
  Spielen-Ansicht auf Handy und Desktop ohne Querscrollen).

## Stand 36 (22.11.2026): Keine Buchinhalte aus Erweiterungen im Quelltext

- **Tests:** Fälle aus einzelnen Grimoires (IDs, Namen, Sollwerte) stehen nicht mehr im Repository, sondern in der lokalen
  Falldatei `Pruefsuite/editor_buchfaelle.json` (Umgebungsvariable `FOKUS_BUCHFAELLE`, Hilfsfunktion `buchfaelle()` in
  `regelwerk/__tests__/hilfen.ts`). Umgebaut: `untoteGolems`, `begleiter`, `begleiterWerte`, `wesenBaukasten`, `zustaende`,
  `zustandswerte`, `relikte`, `ausruestung`. Wo es ging, prüfen allgemeine Tests alle Einträge eines Grimoires statt
  einzelner Fälle (Wirkungen auf andere Wesen: jetzt 22 Einträge statt einem; Zustände: jeder ist wählbar und nennt seine
  Seite). Beispiele ohne Buch sind erfunden (Merkmalsnamen, Zahlen).
- **Programmcode:** Die Merkmalskette des „robuster“-Satzes kommt jetzt aus den Daten (`robuster_kette`, Datenseite
  `textauslese.py`) statt aus Merkmalsnamen im Editor; ohne Feinschliff-Regel steigen die LP nicht mehr pauschal.
  Hinweistexte in Golem- und Wesen-Ansicht formulieren keine Regeln aus „Die Magie“ mehr aus (Voraussetzungen,
  Konstruktionsproben, Ritus-Arten); Zitate aus Büchern in Kommentaren entfernt.
- **Neue Prüfung (lokal):** sucht im ganzen `src` nach Eintragsnamen aus den Grimoires, die nicht im GRW stehen; erlaubte
  allgemeine Begriffe stehen ebenfalls in der Falldatei.
- Tests: 508 grün mit allen Grimoires, Falldatei und Volltest, 448 ohne Bücher; Prüfsuite 0 neue Befunde, Praxistest
  109/109; Build.

## Stand 37 (22.11.2026): Begleiter – gemeinsame Rast, PDF-Export, Handy-Ansicht

- **Gemeinsame Rast** (`regelwerk/begleiterRast.ts`, `components/begleiter/rast.tsx`): In „Regeneration & Pausen“ steht
  „Begleiter rasten mit (N)“ (voreingestellt an), sobald es Begleiter gibt. Ruhephase und Verschnaufpause des Abenteurers
  gelten dann auch für alle Begleiter, mit Konstitution und Willenskraft aus ihrem berechneten Wertekasten und den
  `ruheregeln` der Kernregel „Heilung“. Begleiterarten, die laut Paket in der Ruhephase keine Lebenspunkte regenerieren,
  stehen als `strukturiert.ruhephase_begleiter` an den Regeltexten (Datenseite `begleiter_werte.py`, Abschnitt
  `ruhephase_begleiter`, mit Belegen); der Hinweis nennt die Fundstelle. Zustände der Begleiter bleiben. Ein
  Protokolleintrag nennt je Begleiter, was geheilt wurde. Im Blatt jedes Begleiters gibt es neben der Verschnaufpause jetzt
  auch die Ruhephase.
- **Rückgängig im Spiel** sichert jetzt auch den Spielzustand der Begleiter (neue Aktion `BEGLEITER_ZUSTAENDE_SETZEN`, je
  Stelle in der Liste). Vorher nahm „Rückgängig“ Schaden, Heilung und Fokus der Begleiter nicht zurück.
- **PDF-Export** (`components/export/begleiterPdf.ts`): nach den Zaubern eine Seite „Begleiter“, je Begleiter Kopf mit Art
  und Kurzangaben, abgeleitete Werte und Attribute, Angriffe, Fertigkeiten, Typus, Merkmale, Meisterschaften, die Angaben
  der Art (Abrichtungen, Vertrautenmagie, Dienste, Stärken …), Zauber, Notiz und Kästchen für Lebenspunkte je
  Gesundheitsstufe und Fokus zum Abhaken. `besitzerBerechnen` (ohne React) liefert dafür die Angaben des Abenteurers.
- **Handy (390 px)** geprüft: Begleiter-Leiste, Blatt, Assistent (Tier, Gefolgsmann mit sieben Schritten), Bearbeiten,
  Rast. Geändert: Schrittleiste in einer Zeile zum Schieben, Namen nur beim aktuellen Schritt; Fokus-Menge und die drei
  Fokus-Knöpfe in einer Zeile (neu `Knopf eng`); Wahlkarten linksbündig; Abstand unter Erklärungen (die `m-0` hob den
  Abstand von `space-y` auf); Spaltenköpfe der Waffentabelle mit Abstand. Kein waagrechtes Scrollen außer der Reiterleiste.
- Tests: 459 grün ohne Bücher; mit Grimoires ohne Falldatei alles grün (Falldatei-Tests übersprungen); Build; im Browser
  geprüft (Rast mit Begleitern und Rückgängig, Handy und Desktop, PDF als Bild).
- **Datenseite** (nachgeliefert 22.11.2026 vormittags, auf den neuen Stand von `begleiter_werte.*` mit `abrichtung_rollen`
  aufgesetzt): `begleiter_werte.py`/`.json` Abschnitt `ruhephase_begleiter`, LIESMICH; neu gebaut ist nur das Magie-Paket
  (zwei Regeltexte mit `strukturiert.ruhephase_begleiter`) samt Grimoire und Manifest. Prüfsuite 0 Befunde; der allgemeine
  Test in `begleiterRast.test.ts` läuft damit (vorher übersprungen).

## Stand 38 (22.11.2026): Kopfzeile am Handy, letzte Namensregeln auf der Datenseite

- **Kopfzeile:** Auf schmalen Handys wurde der Zurücksetzen-Knopf abgeschnitten. Der Markenblock schrumpft jetzt, unter
  360 px entfällt die Unterzeile, unter 430 px ist „Meine Charaktere“ nur ein Symbol (mit Beschriftung für
  Vorleseprogramme). Geprüft bei 320, 390, 412, 768 und 1280 px.
- **Abrichtungen:** Die Sammel-Abrichtung des Bestienmeisters und die Abrichtung, nach der ein Tier als Reittier gilt,
  erkennt der Editor nicht mehr an Name, Gruppenname oder ID-Muster, sondern an den neuen Feldern `sammel_fuer_gruppe`
  und `macht_reittier` (Datenseite `begleiter_werte.py`, Abschnitt `abrichtung_rollen`, mit Belegsätzen).
- **Arbeitsweise:** Der vollständige lokale Testlauf mit allen Büchern steht jetzt im FUNDAMENT (Teil 4).
- Tests: 508 grün mit allen Grimoires, Falldatei und Volltest, 448 ohne Bücher; Prüfsuite 0 neue Befunde, Praxistest
  109/109; Build.

## Stand 39 (22.11.2026): Start ohne Netz wirklich ohne Netz

- **Fehler aus Stand 35:** Der Rückfall auf das gespeicherte Grundregelwerk griff nur, wenn die Seite selbst noch vom
  Server kam. War das Netz ganz weg, lud der Browser die App gar nicht (Rückmeldung des Projektinhabers). Der Test hatte
  nur die Regelpakete abgeschaltet.
- **Service Worker** `public/sw.js` (ohne Abhängigkeit, angemeldet in `main.tsx`, nur im gebauten Editor): speichert Seite,
  Skripte, Stile und Schriften, immer zuerst aus dem Netz, ohne Netz aus dem Zwischenspeicher. Beim ersten Besuch schickt
  die Seite die schon geladenen Dateien nach. Regelpakete laufen nicht über ihn; das Grundregelwerk kommt ohne Netz wie
  bisher aus IndexedDB, mit Hinweis. `ignoreVary`, weil manche Server „Vary: Origin“ senden.
- Geprüft im Browser mit ganz abgeschaltetem Netz (Playwright `setOffline`), im Wurzelverzeichnis und unter `/fokus/`:
  Editor startet, Hinweis erscheint. Ein Browser, der die App noch nie mit Netz geöffnet hat, kann sie ohne Netz
  erwartungsgemäß nicht laden.

## Stand 40 (22.11.2026): Ressource Golem, EG-Verteilung, Heilung und Pausen nach GRW

Ab hier ist das Repository **FOCUS-Splittermond_GAI** maßgeblich (aus Google AI Studio übernommen, Stand 39 identisch).

- **Angriff:** Nach einem Treffer sind keine EG mehr vorbelegt (bisher steckte der Editor alle freien EG still in den
  Wuchtangriff). Vor dem Schadenswurf fragt der Dialog nach, wenn noch EG frei sind: als Wuchtangriff verwenden,
  verfallen lassen oder zurück.
- **Ressource Golem** (Die Magie S. 203): Jeder Golem „über Ressource Golem“ belegt eine eigene Ressource; Auslegung wie
  bei Kreatur: Stufe des Golems höchstens so hoch wie die Ressource. Ohne passende freie Ressource gesperrt bzw. mit
  Hausregeln eine Warnung; der Assistent zeigt die Belegung, die Begleiter-Übersicht warnt.
- **Heilung (GRW S. 15, 119–120, 173–174):** Heilkunde, Heilzauber und Heiltränke heilen echten Schaden; eine Verteilung auf
  Betäubungsschaden ist im GRW nicht geregelt und nur mit Hausregeln wählbar, ebenso „Freie Heilung“. Die Verschnaufpause
  ist aus dem Heildialog heraus (sie steht unter „Rast“). Kanalisierter Schaden heilt nicht; ist sein Zustand
  aufgehoben, wird er im Heildialog zu Betäubungsschaden („freigeben“, neue Aktion `PLAY_KANALISIERT_FREIGEBEN`).
- **Pausen:** Verschnaufpause und Ruhephase heilen keinen kanalisierten Schaden mehr; die Verschnaufpause beendet keine
  kanalisierten Zauber mehr (erst die Ruhephase, S. 196). Welche Zustände eine Pause aufhebt oder abbaut, kommt aus dem
  neuen Paketfeld `pause_ende` (Datenseite `zustaende.py`, allgemein aus dem Beschreibungstext: GRW Erschöpft, Glaubenskrise,
  Lahm, dazu ein Zustand aus „Hinter dem Schleier“) statt aus Zustandsnamen im Code. Auch die Ruhephase der Begleiter
  lässt kanalisierten Schaden stehen.
- Tests: 474 grün ohne Bücher, 535 mit allen Grimoires, Falldatei und Volltest; Prüfsuite 0 neue Befunde, Praxistest
  109/109; Build. Neue Tests: `egVerteilung`, `golemRessource`, `pausen`, Heildialog.
- **Offen (gefunden, nicht geändert):** Die Ruhephase setzt den Sterbend-Zähler auf 0; laut GRW heilt ein Sterbender nicht
  natürlich. Ruhephasen je Tag (`je_tag` im Paket) werden nicht gezählt.

## Stand 41 (22.11.2026): Zustände der Begleiter bei Rast

- Verschnaufpause und Ruhephase der Begleiter (gemeinsam mit dem Abenteurer und im Blatt jedes Begleiters) beenden bzw.
  senken jetzt auch ihre Zustände, nach demselben Paketfeld `pause_ende` und derselben Funktion `nachPause` wie beim
  Abenteurer (Stand 40). Bisher blieben Zustände der Begleiter bei jeder Rast stehen. Protokoll und Meldung nennen die
  Änderung, z. B. „Erschöpft 3 → 2, Lahm beendet“. Zustände ohne `pause_ende` (z. B. Blutend) bleiben.
- Code: `regelwerk/begleiterRast.ts` (`verschnaufpauseBegleiter` nimmt jetzt den Katalog), Aufrufe in
  `components/begleiter/rast.tsx` und `BegleiterSpiel.tsx`. Test in `begleiterRast.test.ts`.
- Tests: 475 grün ohne Bücher; 531 mit Grimoires und Falldatei (Volltest übersprungen); Build.

## Stand 42 (22.11.2026): Grenzen der Rast, Wiederherstellung

- Keine natürliche Heilung: Zustände mit dem neuen Paketfeld `keine_natuerliche_heilung` (Datenseite `zustaende.py`,
  Abschnitt 4; im GRW nur Sterbend, Beleg aus der Zustandsbeschreibung) verhindern, dass Verschnaufpause und Ruhephase
  Lebenspunkte heilen. Die Ruhephase setzt die Sterbe-Stufe dann nicht mehr zurück; Fokus und Zustände regenerieren
  weiter. Gilt auch für Begleiter. Die Rast-Ansicht zeigt einen Hinweis, das Protokoll eine Zeile.
- Ruhephasen pro Tag: Höchstzahl aus `ruheregeln.ruhephase.je_tag` (`ruheregeln().ruhephasenJeTag`, GRW: 2). Die Karte
  „Ruhephase“ zeigt „Ruhephasen heute: n von 2“ und den Knopf „Neuer Tag“; eine weitere Ruhephase sperrt
  `regelverstoss` (mit Hausregeln nur Warnung). Zähler `playState.ruhephasenTag`, Aktionen `PLAY_REST_HEAL` (zählt) und
  `PLAY_NEUER_TAG`.
- Wiederherstellung (Heilzauber mit „alle LP“): Die fest verdrahtete Liste aufzuhebender Zustände (mit dem
  Nicht-GRW-Zustand „Vergiftet“) ist weg. Nach dem gelungenen Wurf wählt der Spieler im Zauberdialog, welche aktiven
  Zustände der Zauber laut Beschreibung aufhebt (vorbelegt: alle).
- Fehler behoben: Die Ruhephase heilte das Doppelte der angezeigten Menge (die Ansicht übergab schon KON×2, der Reducer
  verdoppelte noch einmal). Bei der Wiederherstellung überschrieb das Entfernen der Zustände die eben geheilten
  Lebenspunkte mit dem alten Spielstand.
- Code: `regelwerk/zustaende.ts` (`ohneNatuerlicheHeilung`), `spielwirkungen.ts`, `begleiterRast.ts`,
  `hooks/useCharacterState.ts`, `context/PlaySessionContext.tsx`, `components/play/{RestSection,PlayTab,CastSpellModal}.tsx`.
  Test `regelwerk/__tests__/rastGrenzen.test.tsx`.
- Tests: 484 grün ohne Bücher; 545 mit Grimoires, Falldatei und Volltest; Build.

## Stand 43 (22.11.2026): Regeln aus dem Paket statt aus dem Code

- Rast-Karten: Welche Zustände Verschnaufpause und Ruhephase abbauen oder aufheben, steht im Text aus `pause_ende`
  (`pausenZustandstext`); kein fester Satz mehr.
- Liegend: Die Beschreibung kommt aus der Tabelle der Kampfpositionen (`positionsText`, GRW S. 170).
- Verwundet: über das Paketfeld `zustandswirkung.probe.art` „wundstufe“ statt über den Namen (`wundstufenVerschiebung`).
  Fehler behoben: Beim Abenteurer zählte Verwundet doppelt (verschobener Wundabzug und zusätzlicher Zustandsabzug in der
  Probe). Jetzt steckt es genau einmal im Wundabzug, auch bei Begleitern (`lebenslage`).
- Zauber-Verstärkungen: neue Paketangabe `erfolgsgrade_strukturiert.verstaerkungen[].zustaende` (Datenseite
  `zustaende.py`, Abschnitt 5; Name, Stufe, Ticks, Beleg; Liegend nur „bei misslungener Probe“). GRW 27 Verstärkungen,
  Die Magie 11, Die Götter 2, Hinter dem Schleier 1. Der Editor liest Optionen und Verstärkungen aus dem Paket
  (`zauberErfolgsgrade`); die Textsuche nach Zustandsnamen ist entfernt (sie traf auch „unterdrückt“ und „geheilt“). Der
  Zaubern-Dialog zeigt den verursachten Zustand je Verstärkung. Eigene Zauber ohne Paketeintrag werden weiter aus ihrem
  Text gelesen, ohne Zustände.
- Ideen-Seite: Idee 1 nennt die fest verdrahteten Schwellen für Sterbend 2/3, Bewusstlos und Tod als offenen Punkt.
- Code: `regelwerk/{zustaende,vitals,kampflage,zauberEg}.ts`, `utils/{characterCalculations,conditionModifiers,magicRules}.ts`,
  `components/play/{RestSection,CastSpellModal}.tsx`. Tests `regelnAusPaket.test.ts`, `regelwerk/__tests__/verstaerkungen.test.ts`.
- Tests: 494 grün ohne Bücher; 555 mit Grimoires, Falldatei und Volltest; Praxistest 109 ok; Build.

## Stand 44 (22.11.2026): Befunde aus dem Praxistest der veröffentlichten App

Durchgeklickt mit einem Varg auf Heldengrad 1 (Steigern, Meisterschaft, Zauber, Schaden, Rast, Heilung, Inventar, Begleiter,
Relikt-Werkstatt, Handy-Breite). Behoben:
- Angriffswert: zählte nur die Fertigkeitspunkte. Jetzt Punkte + die beiden Attribute der Waffe aus dem Paket
  (`daten.attribute`, GRW S. 181) + Boni aus Wirkungen (`getAttackValue`, `waffenAttribute`). Waffen im Inventar werden
  über ID oder Name gefunden. Der waffenlose Angriff nimmt Schaden, WGS, Merkmale und Attribute aus dem GRW-Paket statt fester
  Werte im Code.
- Alte Regelpakete im Browser: Das Hosting schickt für alle Dateien „max-age=1 Jahr, immutable“. Manifest und
  Grundregelwerk werden jetzt mit `cache: 'no-cache'` geladen (Nachfrage beim Server, unverändert 304).
- Quellenangabe: Zauber- und Meisterschaftsdialog zeigten bei Einträgen aus Grimoires „GRW S. …“. Jetzt das Kürzel des Pakets.
  Vorlagen werden erst beim Zugriff aufgelöst; vorher stand im Protokoll „Quelle: unbekannt“.
- Lebenspunkte: Anzeige „54 / 54 LP“ zählte die Kästchen der Sterbe-Rechnung mit; jetzt LP × Zahl der Gesundheitsstufen.
  Ändern sich die LP je Stufe (Robust, KON), ziehen die Kästchen mit (`PLAY_LP_ANPASSEN`), der Schaden bleibt.
- Vorschau des Wundabzugs im Schadens- und Heildialog rechnet Verwundet ein (auch Zustände dieses Treffers bzw. beendete).
- Tiergefährte: Ein Tier über der Stufe der Ressource Kreatur ließ sich anlegen (nur Hinweis). Jetzt `regelverstoss`
  (mit Hausregeln Warnung), `kreaturFehlt`.
- Kleinigkeiten: Dauer der Pausen im Protokoll aus dem Paket (stand fest „15 Min“), Tragkraft-Formel aus dem Paket (stand
  „KON + STA“), Potenzial-Aufschlüsselung mit Doppelpunkt, „Gratis-Slot nutzen“ im Meisterschaftsdialog vorgewählt, wenn
  eine freie Meisterschaft offen ist, gesperrte Knöpfe für Attribute und Fertigkeiten nennen den Grund.
- Tests: 501 grün ohne Bücher; 562 mit Grimoires, Falldatei und Volltest; Build.

## Stand 45 (22.11.2026): offene Punkte aus dem Praxistest

- Sterben aus dem Paket (Kernregel „Sterben“, GRW S. 172–173): neue Felder `zustand_bei_erstem_schaden`,
  `zustaende_bei_allen_lp`, `tot_mehr_als_stufen` (Datenseite `kernregeln.py`). Der Editor setzt beim ersten echten Punkt
  auf Todgeweiht Sterbend 2, bei allen LP dort Bewusstlos und Sterbend 3 (Bewusstlos fehlte bisher) und erst bei MEHR als
  einer Stufe darunter Tod (bisher schon bei genau einer). Die LP-Leiste hat dafür LP × (Stufen + 1) + 1 Kästchen
  (`lpKaestchen`, `sterbestand`); gespeicherte Charaktere passen sich von selbst an. Der Schadensdialog nennt die Probe auf
  Zähigkeit gegen 20. Feste Zahlen 4/5/6 im Reducer sind weg.
- Grenzen der Erschaffung aus dem Paket (`erschaffungsGrenzen`): 18 Attributpunkte (1–3), 55 Fertigkeitspunkte (höchstens
  6), 5 nicht-magische Punkte, 8 Ressourcenpunkte, 3 Start-Meisterschaften, 2 Sprachen; vorher fest im Code. Schwellen
  der Meisterschaften in der Fertigkeitszeile aus dem Paket (`schwellenwert`).
- Verwundet: nur der Wundabzug verschiebt sich, die Gesundheitsstufe bleibt (GRW: „gilt in Bezug auf die Wundabzüge …
  als um eine Wundstufe schwerer verletzt“). Die Probe zeigt „Wundabzug (Angeschlagen, Verwundet 1)“.
- Anzeige: „Abzüge durch Erschöpft halbiert“ statt „Abzüge aus Zuständen −Hälfte“; im Zauberdialog nur noch eine goldene
  Hauptaktion; Protokoll „4 Schaden“ statt „4 SP“.
- Vorlage Arrou: Wildnisläufer ist eine der drei freien Start-Meisterschaften (kostete 5 EP).
- Tests: 506 grün ohne Bücher; 567 mit Grimoires, Falldatei und Volltest; Praxistest 109 ok; Build.

## Stand 46 (23.11.2026): Aufräumen – Favicon, Umgebungsvariablen, unbenutzte Dateien

Übertragen aus FOCUS-Splittermond (dort Stand 40, 22.11.2026); die Stände 46–48 sind die Arbeit einer zweiten Sitzung,
die versehentlich im umbenannten FOKUS-1.2 (heute FOCUS-Splittermond) lief, und hier zusammengeführt.
- **Favicon:** vorher ein PNG mit 1000 × 1000 Pixeln (610 KB) unter dem Namen `favicon.ico`, doppelt im Wurzelordner und
  in `public/`. Jetzt nur `public/favicon.ico` als echte ICO-Datei (16–64 px, 18 KB) und `public/apple-touch-icon.png`
  (180 px); beide in `index.html` verlinkt (auch unter einem Unterpfad).
- **`.env.example`:** nennt `FOKUS_GRIMOIRES`, `FOKUS_BUCHFAELLE`, `FOKUS_REFERENZ_VOLL` statt des alten `FOKUS_BUECHER`.
- **Entfernt:** `public/sql-wasm.wasm` (seit Stand 8 unbenutzt) und `public/dice-icon.svg` (nirgends eingebunden).

## Stand 47 (23.11.2026): Kampfpositionen vollständig nach GRW S. 170 (Idee #16)

- **Geprüft:** Die Tabelle im GRW-Paket stimmt in allen sieben Zeilen mit S. 170 überein (neuer Test schreibt sie ab).
- **Doppelter Abzug behoben:** „Liegend“ aus den Zuständen zog im Angriffsdialog −6 als Zustand ab, und die eigene
  Position ließ sich zusätzlich auf „Liegend“ stellen (−12). Jetzt ist „Liegend“ (und jeder Zustand, der als liegend gilt)
  im Angriffsdialog als **eigene Position vorausgewählt** („liegt laut Zuständen“) und wirkt nur darüber.
- **Armbrust im Liegen:** kein Abzug mehr (vorher −6 über den Zustand, obwohl die Tabelle keinen vorsieht).
- **Andere Proben:** Der Abzug für „Liegend“ traf jede Probe mit einer Kampffertigkeit; laut Tabelle gilt er nur für
  Angriffe. `getConditionMalus` liefert für „Liegend“ keinen Abzug mehr.
- **Zauber gegen die Verteidigung:** Im Zauberdialog gibt es „Position des Ziels“; die Modifikatoren gegnerischer
  Fernkampfangriffe gelten auch für diese Zauber (S. 170). Steht im Würfelprotokoll.
- **Zusammengeführt** mit `positionsText` aus Stand 43 (Beschreibung des Zustands „Liegend“ nutzt jetzt diesen Text).
- **Keine Zahlen im Code:** eingebaute −6 und das Lesen der Tabelle über ihren Zeilentext entfernt; Beschreibung und Hinweis
  („Angriffe gegen den Charakter Nahkampf +6, Fernkampf −6, mit Armbrust −6“) entstehen aus der Tabelle
  (`positionsBeschreibung`, `positionsQuelle` in `regelwerk/kampflage.ts`, `liegtLautZustaenden` in `regelwerk/zustandswerte.ts`).
- Tests: neu `kampfpositionen.test.tsx` (Tabelle, Armbrust, Beschreibung, Angriffsdialog mit und ohne Zustand, Zauberdialog);
  drei ältere Tests auf die neue Regel umgestellt. 470 grün ohne Bücher; Build.

## Stand 48 (23.11.2026): Waffenmerkmale wirken (Idee #14)

- **Datenseite:** `merkmal_werte.json` + `merkmal_werte.py` schreiben `daten.merkmal_wirkung` an die Merkmale des GRW
  (S. 186) und die gleichnamigen der Grimoires (12 Merkmale, 41 Einträge). Jede Zahl wird gegen den Text des Eintrags
  geprüft. Prüfsuite ohne neue Befunde; Pakete und Grimoires auf D: geliefert.
- **Schadenswurf** (`executeAttackDamageRoll`): Würfel mindestens Stufe (nur Waffenwürfel, nicht aus Manövern), Zusatz je
  Höchstwurf, Zusatzwürfel mit Wertung der besten, ignorierte Schadensreduktion (zählt zu der aus Manövern), ganzer Schaden
  als Betäubungsschaden (auch aus Manövern), fester Zusatzschaden. Abzug gegen Rüstung ohne das Merkmal nach der
  Schadensreduktion, nie unter 0. Rechnung steht im Ergebnis und im Würfelprotokoll.
- **Angriffsdialog:** Abschnitt „Merkmale der Waffe“ mit den wirkenden Merkmalen und Schaltern für die Bedingungen
  („zweihändig geführt“, „vom Reittier“, „Ziel trägt Rüstung ohne Primitiv“). Meisterschaften als Bedingung
  (Improvisation, Reiterkampf) werden über ihre IDs geprüft. Merkmale zur Aktiven Abwehr als Hinweis.
- **Verteidigung:** geführte Waffen mit „Unhandlich“ senken die VTD um 2 (einmal), im Überfahren der VTD erklärt.
- **Code:** neu `regelwerk/merkmale.ts` (Auswertung); gelesen wird `merkmal_wirkung` in `utils/combatRules.ts`
  (`merkmaleMitSpielwerten`). Tabelle „Regelquellen“ in FUNDAMENT.md nach Freigabe des Projektinhabers (23.11.) ergänzt:
  Spielwerte der Merkmale, Feld `merkmal_wirkung`, Datei `regelwerk/merkmale.ts`.
- Tests: neu `merkmale.test.tsx` (Werte, Bedingungen, Schadenswurf mit festen Würfeln inkl. Beispiel S. 186, Dialog;
  Grimoire-Merkmale nur über ihre Werte). Nach dem Zusammenführen 533 grün ohne Bücher, 590 mit allen Grimoires und
  Buchfällen; Build.
- **Zusatz je Höchstwurf zählt auch Manöverwürfel** (z. B. der W6 aus Hammerschlag oder Zielschuss): Auslegung nach dem
  Wortlaut „jeder Schadenswürfel“ – anders als beim Mindestwert der Würfel nennt das Merkmal keine Ausnahme für Manöver.
  Entscheidung des Projektinhabers am 23.11.2026; Test dazu.
- Das GRW-Paket dieses Repositorys (Stand 17ad2ce, mit Sterbe-Feldern) enthält die Spielwerte der Merkmale bereits.
- Offen: Merkmale der Rüstung des Ziels (z. B. halbierter Wuchtangriff, ignorierte Durchdringung) – der Editor kennt die
  Rüstung des Gegners nicht; Defensiv wirkt nur als Hinweis, weil es keinen eigenen Dialog für die Aktive Abwehr gibt.

## Stand 49 (23.11.2026): Browser-Prüfung nach der Veröffentlichung

Die veröffentlichte App mit Stand 48 durchgeklickt (Arrou): Angriffswerte (Waffenlos 12, Langbogen 14, Speer 13),
Kampfpositionen im Fernkampf, Merkmale im Angriffsdialog, Nachfrage zu übrigen EG, LP 42 / 50 mit 61 Kästchen, Verwundet
nur im Wundabzug („Wundabzug (Unverletzt, Verwundet 1)“), Sterben mit Hinweis auf die Zähigkeitsprobe, Gründe an gesperrten
Knöpfen, Tragkraft-Formel, freie Meisterschaft vorgewählt, Wolf mit Kreatur 2 gesperrt. Behoben:
- Sterben: Sterbend 2 und Sterbend 3 standen nebeneinander. Jetzt ein Zustand, dessen Stufe steigt; beim Zurücknehmen
  von Schaden sinkt sie wieder (3 → 2) oder entfällt.
- Kampf-Tab: „Schusswaffen (FW 14)“ zeigte den Angriffswert als Fertigkeitswert; jetzt die Fertigkeitspunkte wie beim
  waffenlosen Angriff, der Angriffswert steht unter AT.
- Tests: 534 grün ohne Bücher; 596 mit Grimoires, Falldatei und Volltest; Build.

## Stand 50 (23.11.2026): Erschaffung im Browser durchgespielt

Neuer Charakter (Mensch, Kultur Selenia, Abstammung Gelehrte, Magierin) in der veröffentlichten App erschaffen. Korrekt:
Grenzen aus dem Paket (18/55/8/8/2/3), Sperren bei Attribut 4, Fertigkeit 7, 19. Attribut- und 56. Fertigkeitspunkt,
9. Stärke- und Ressourcenpunkt; Modulwerte eintragen; alle abgeleiteten Werte nachgerechnet. Behoben:
- Zauber, die bei der Erschaffung über die freien hinaus gewählt werden, kosteten keine EP (Kosten nur im Steigerungsmodus
  gezählt). Jetzt Kosten des Grades aus dem Paket.
- Freie Zauber: bei der Erschaffung genau ein Zauber des Grades 0/1/2 je Stufe (GRW S. 25, wie die Regelprüfung);
  danach je neuer Schwelle einer dieses oder eines niedrigeren Grades (S. 223). Der Zauberdialog bot bei der Erschaffung
  einen zweiten Zauber des Grades 0 frei an, die Regelprüfung meldete ihn dann als Fehler. Schwellen aus dem Paket
  (`zauber_nach_grad`, `freieZauberGrade`) statt fester 1/3/6/9/12/15 im Code.
- Meisterschaftsdialog bei der Erschaffung: „Als Start-Meisterschaft“ ist vorgewählt, solange Kultur/Ausbildung offen sind;
  vorher wurde der freie Platz der Schwelle verbraucht und die Regelprüfung meldete „2 Meisterschaften wählen“.
- „Erschaffung abschließen“ ging trotz offener Fehler der Regelprüfung; jetzt Sperre (mit Hausregeln Warnung) mit dem
  ersten offenen Punkt.
- Gesperrte Plus-Knöpfe nennen auch bei der Erschaffung den Grund (Höchstwert je Attribut/Fertigkeit, alle Punkte verteilt).
- Tests: 535 grün ohne Bücher; 597 mit Grimoires, Falldatei und Volltest; Build.

## Stand 51 (23.11.2026): Steigerung bis Heldengrad 4 durchgespielt

Liora mit 2000 EP bis Heldengrad 4 gesteigert (Fertigkeiten bis 15, Attribute +4, Meisterschaften bis Schwelle 4,
Zauber bis Grad 5, Stärken, Ressourcen, Sprachen) und alle Reiter durchgeklickt. Korrekt: Heldengrad bei 100/300/600
ausgegebenen EP, Kosten je Zielwert, abgeleitete Werte, Splitterpunkte 8 (6 + Zusätzliche Splitterpunkte), freie
Meisterschaften und Zauber je Schwelle, Voraussetzungsketten. Behoben:
- Stärken „nur bei Generierung“ (z. B. Flink) ließen sich nach der Erschaffung kaufen, wenn die Suche nur sie übrig ließ
  (der Dialog wählte dann den gesperrten Eintrag). Neue Prüfung `regelwerk/listenAuswahl.ts` für Dialog und Kauf.
- Mehrfach wählbare Stärken (Robust, bis zu dreimal) hatten keine Obergrenze; vorhandene Stufen zählen jetzt mit.
- Ressourcen: ein zweiter Kauf legte einen zweiten Eintrag an und überschritt die Höchststufe (Vermögen 2 + 5).
  Jetzt höchstens die oberste Stufe der Tabelle (`maxStufe`), weitere EP-Käufe erhöhen den EP-Eintrag
  („Ressource gesteigert“), die Liste zeigt „+N · gesamt M“.
- Sprachen: eine bekannte Sprache ließ sich noch einmal wählen (Basargnomisch doppelt).
- Quelle „unbekannt“ bei Kulturkunde (Selenia) und beim Kultur-Schwerpunkt; jetzt GRW S. 74 bzw. Regel Schwerpunkte S. 92.
- Meisterschaften im Kampf- und Spiel-Reiter zeigten die Schwelle doppelt („(S2) (T2)“).
- Inventar: Startvermögen laut Vermögenstabelle (Stufe aus der Erschaffung) mit Knopf „Als Geld übernehmen“; bisher
  blieb der Geldbeutel bei 5 Lunaren.
- Tests: 545 grün ohne Bücher; 607 mit Grimoires, Falldatei und Volltest; Build.

## Google AI Studio

Unverändert eine Vite-/React-App mit `metadata.json` im Wurzelordner; Import über „Import from GitHub“, Hosting über Cloud Run.
Neue Abhängigkeiten gibt es nicht. Die Regelpakete liegen in `public/` und werden zur Laufzeit geladen.

