<div align="center">
<img width="1200" height="475" alt="FOCUS Banner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# FOCUS – Freier Online Charaktereditor für Splittermond

**FOCUS** ist ein moderner, browserbasierter Charaktereditor für das Pen-&-Paper-Rollenspiel **Splittermond**. Das Tool unterstützt dich vollständig bei der Charaktererschaffung, Steigerung mit Erfahrungspunkten und der Verwaltung deines Charakters während der Spielsession – alles nach den offiziellen Splittermond-Regeln.

> **Claude-Edition:** lädt die Splittermond-Regelpakete; eingebaut ist nur das Grundregelwerk, Grimoires lädt man in den Einstellungen selbst. Details: [CLAUDE_EDITION.md](CLAUDE_EDITION.md).

## 🎯 Wofür ist FOCUS da?

FOCUS ersetzt den klassischen Papiercharakterbogen durch eine digitale, benutzerfreundliche Lösung. Egal ob Neuling oder erfahrener Held – das Tool führt dich durch alle drei Modi:

- **Charaktererschaffung** – Intuitive Schritt-für-Schritt Erstellung mit vollständiger Regelvalidierung
- **XP-Steigerung** – Entwickle deinen Charakter nach Missionen mit dem Erfahrungspunkte-System
- **Spielmodus** – Verwalte deine LP, Fokus, Splitterpunkte und alle Statuseffekte in Echtzeit

## ✨ Hauptfunktionen

### 📊 Umfassende Charakterverwaltung
- **Charaktererschaffung** – Verteile Attributspunkte, Fertigkeitspunkte, Stärken, Ressourcen, Sprachen und Start-Meisterschaften nach offiziellen Regeln
- **XP-Modus** – Steigere deinen Helden mit Erfahrungspunkten und optimiere seine Fähigkeiten
- **Spielmodus** – Echtzeit-Tracking von LP, Fokus, Splitterpunkten, Statuseffekten und kanalisierten Zaubern im Spieleinsatz
- **Abgeleitete Werte** – Automatische Berechnung von GSW, INI, LP, FO, VTD, SR, GW, KW

### 📚 Vollständige Regelwerk-Datenbank
- **Meisterschaften & Zauber** – Komplette Datenbank mit allen verfügbaren Meisterschaften, Schwellen und kostenlosen Slots
- **Zauber nach Magieschule** – Sortierung und Filterung nach Magieschule und Zaubergrad
- **Stärken / Schwächen / Ressourcen / Sprachen** – Mit Regelwerk-Referenzen und informativen Tooltips
- **Regelwerk-Validierung** – Das Tool überprüft alle Eingaben gegen die offiziellen Splittermond-Regeln

### 💾 Datenmanagement & Flexibilität
- **localStorage-Persistierung** – Dein Charakter wird automatisch gespeichert und beim nächsten Besuch wiederhergestellt
- **JSON-Import/Export** – Vollständige Charaktere als strukturierte JSON speichern und laden
- **Schema-validierter Import** – Jedes Feld wird gegen das CharacterState-Schema geprüft; ungültige Daten werden gefiltert
- **PDF-Export** – Exportiere dein komplettes Charakterdokument als professionelle PDF zum Ausdrucken

### 🎨 Moderne Benutzeroberfläche
- **Responsive Design** – Funktioniert perfekt auf Desktop, Tablet und Smartphone
- **Intuitive Navigation** – Drei klare Modi über Tab-Interface
- **Dark & Light Mode** – Komfortable Nutzung in jeder Umgebung
- **Fantasy-Styling** – Immersives Splittermond-Design mit thematischen Elementen

### 🛡️ Robustheit & Qualität
- **TypeScript strict mode** – Vollständige Typsicherheit für zuverlässigen Code
- **Error Boundary** – Fehler in Unterkomponenten crashen nicht die gesamte App
- **Toast-Benachrichtigungen** – Klare Rückmeldungen zu deinen Aktionen

## 🚀 Schnelleinstieg

### Voraussetzungen
- Node.js (empfohlen: 18+)
- npm oder yarn

### Installation & Start

```bash
# Repository klonen
git clone https://github.com/JazzJackRabite/FOKUS-1.2.git
cd FOKUS-1.2

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev
```

Der Entwicklungsserver startet standardmäßig auf `http://localhost:3000` und ist sofort einsatzbereit!

### Produktion
```bash
# Produktions-Build erstellen
npm run build

# Produktions-Build lokal testen
npm run preview
```

## 🛠️ Technologie-Stack

| Technologie | Version | Zweck |
|-------------|---------|-------|
| React | 19.x | Modernes UI-Framework |
| TypeScript | 5.8 (strict) | Typsicherheit & Entwicklererfahrung |
| Vite | 6.x | Blitzschnelle Build-Tool & Dev-Server |
| Tailwind CSS | 4.x | Modernes Utility-basiertes Styling |
| jsPDF + autoTable | 2.5 / 3.5 | PDF-Generierung für Charakterbögen |
| react-hot-toast | 2.4 | Elegante Toast-Benachrichtigungen |
| lucide-react | 0.330 | Konsistente Icon-Bibliothek |

## 📁 Projektstruktur

```
src/
├── app/
│   └── ErrorBoundary.tsx           # Fehlerbehandlung für Komponenten
├── features/
│   ├── creation/
│   │   └── CreationView.tsx        # Charaktererschaffung & XP-Steigerung
│   ├── advancement/
│   │   └── AdvancementView.tsx     # Charakter-Weiterentwicklung
│   └── play/
│       └── PlayView.tsx            # Spielmodus & Live-Verwaltung
├── components/
│   ├── ui/                         # Generische UI-Bausteine
│   ├── character/                  # Charakterzustand & Überblick
│   ├── attributes/                 # Attribut-Management
│   ├── skills/                     # Fertigkeits-Management
│   ├── items/                      # Ausrüstungs-Verwaltung
│   ├── modals/                     # Dialog-Fenster (XP, Gegenstände, Zauber)
│   ├── play/                       # Spielmodus-Komponenten
│   └── export/                     # PDF-Export-Funktionalität
├── context/
│   └── CharacterContext.tsx        # Zentraler State Management Context
├── hooks/
│   ├── useCharacterState.ts        # Hauptzustand + localStorage-Persistierung
│   ├── useCalculations.ts          # Abgeleitete Werte & Formeln
│   ├── useLocalStorage.ts          # Generischer localStorage-Wrapper
│   ├── useAttributeHandlers.ts     # Attribut-Modifikationen
│   ├── useItemHandlers.ts          # Ausrüstungs-Verwaltung
│   ├── useMasteryHandlers.ts       # Meisterschaften-Verwaltung
│   ├── useSpellHandlers.ts         # Zauber-Verwaltung
│   ├── useFileHandlers.ts          # Import/Export-Funktionen
│   └── useModals.ts                # Modal-Zustände
├── data/                           # Vollständige Regel- & Metadaten
│   ├── rules.ts                    # Splittermond-Regelwerk
│   ├── masteries.ts                # Meisterschaften-Datenbank
│   ├── spells.ts                   # Zauber-Katalog
│   └── ...                         # Weitere Regelwerk-Dateien
├── types/
│   └── index.ts                    # TypeScript-Typdefinitionen
├── utils/
│   ├── costCalculations.ts         # XP-Kostenberechnungen
│   ├── importValidation.ts         # Schema-Validierung für Importe
│   ├── modalHelpers.ts             # Dialog-Hilfsfunktionen
│   ├── validation.ts               # Splittermond-Regelvalidierung
│   └── id.ts                       # Eindeutige ID-Generierung
└── App.tsx                         # Haupt-App & Router
```

## 🏗️ Architektur

### Context-basiertes State Management
Der gesamte Charakterzustand wird über einen `useReducer` verwaltet und über den `CharacterContext` bereitgestellt. Dies ermöglicht zentrale Zustandsverwaltung ohne komplexe Library-Abhängigkeiten.

### Feature-basierte Modularität
Die App ist in drei klar getrennte Modi aufgeteilt:
- **CreationView** – Charaktererschaffung und XP-Steigerung
- **AdvancementView** – Weiterentwicklung des Charakters
- **PlayView** – Live-Spielmodus mit Echtzeitverwaltung

### Robuste Datenvalidierung
Alle JSON-Importe werden durch das Schema validiert – nur bekannte und valide Felder werden akzeptiert, ungültige Daten gefiltert.

## 📖 Benutzerführer

### 1. Neuen Charakter erstellen
1. Wähle den Tab **"Charaktererschaffung"**
2. Verteile deine Attributspunkte nach den Regeln
3. Wähle Fertigkeiten, Stärken und Meisterschaften
4. Der Charakter wird automatisch gespeichert

### 2. Charakter steigern
1. Navigiere zum Tab **"Steigerung"**
2. Gebe deine verdiensten Erfahrungspunkte ein
3. Investiere diese in Attribut- und Fertigkeitssteigerungen
4. Änderungen werden live angewendet und gespeichert

### 3. Im Spiel verwenden
1. Wechsle zum Tab **"Spielmodus"**
2. Verwalte deine LP, Fokus und Splitterpunkte
3. Tracking von Statuseffekten und kanalisierten Zaubern
4. Alle Änderungen bleiben über die Session erhalten

### 4. Charakter exportieren/importieren
- **Exportieren**: Nutze den "Exportieren"-Button, um deine Charakterdatei zu speichern
- **Importieren**: Lade eine zuvor exportierte JSON-Datei
- **PDF**: Exportiere deinen Charakter als druckbares PDF-Dokument

## ⚔️ Regelwerk-Kompatibilität

FOCUS basiert vollständig auf dem **Splittermond Grundregelwerk**. Alle Berechnungen, Kosttabellen, Heldengrade und abgeleiteten Werte entsprechen den offiziellen Regeln. Das Projekt wird regelmäßig mit Errata-Updates und neuen Inhalten aktualisiert.

## 🌟 Besonderheiten

- **Keine Server-Abhängigkeit** – Läuft vollständig im Browser
- **Datenschutz** – Alle Daten werden lokal gespeichert, nichts wird hochgeladen
- **Offline-Fähig** – Nach dem erstmaligen Laden funktioniert FOCUS auch ohne Internet
- **Plattformunabhängig** – Funktioniert auf Windows, Mac, Linux, iOS und Android
- **Open Source** – Transparent, anpassbar und von der Community erweiterbar

## 📝 Changelog

### v0.3 (aktuell)
- ✨ App-Struktur vollständig überarbeitet mit Feature-Views
- 🔒 Schema-Validierung für JSON-Import implementiert
- 🛡️ TypeScript strict mode aktiviert
- 🎨 Error Boundary mit Fantasy-UI hinzugefügt
- 🐛 Diverse Bugfixes und Stabilisierungen
- 🚀 Firebase Studio Integration

### v0.2
- Erster öffentlicher Stand mit vollständigem Splittermond-Regelwerk

## 🤝 Beiträge & Community

Fehler gefunden? Ideen für neue Features? Dein Input ist willkommen!

- **Issues**: [GitHub Issues](https://github.com/JazzJackRabite/FOKUS-1.2/issues)
- **Pull Requests**: Wir freuen uns über Verbesserungen!

## 📄 Lizenz

MIT License – Siehe [LICENSE](./LICENSE) für Details.

---

**FOCUS** – Dein Splittermond-Charakter verdient ein modernes Tool! 🗡️✨
