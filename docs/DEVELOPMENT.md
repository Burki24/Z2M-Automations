# Entwicklung

## Aktueller Umfang

Dieses Repository enthält zunächst den übernommenen Plan und Entwicklungsvorgaben.
Es gibt noch keine `package.json`, Lockdatei oder ausführbaren App-/Test-/CI-Befehle.
In diesem Stand keine Abhängigkeiten installieren oder einen Build als bestanden
ausgeben. Die folgenden App-Prüfungen sind Vorgaben für das kommende Grundgerüst.

## Arbeitsablauf

1. Auftrag, [Projektkontext](../PROJECT_CONTEXT.md), [Plan](DESKTOP_PLAN.md),
   relevante Quellen und Arbeitsbaum prüfen. Vorhandene Benutzerarbeit erhalten.
2. Abgegrenzte Änderung mit Windows-/Linux-Auswirkung und passenden Nachweisen planen.
3. Vorhandene eigene Bausteine und Helper-Verträge prüfen. Neue Abstraktionen
   nur einführen, wenn sie den konkreten Auftrag tragen.
4. In kleinen Schritten implementieren und passende vorhandene Prüfungen ausführen.
   Regressionstests prüfen beobachtbares Verhalten statt Implementierungsdetails.
5. Diff, UTF-8/LF, Übersetzungen, Quellenherkunft und Geheimnisfreiheit prüfen.
6. Tatsächliches Ergebnis und offene Plattformnachweise knapp melden. Englische
   Commit-Texte liefern; Commit und Push führt der Benutzer über GitHub Desktop aus.

Arbeitsbranch ist `dev`, Hauptbranch `main`. Freigaben erfolgen per geprüftem
PR von `dev` nach `main`, anschließend Rücksynchronisierung. Keine Veröffentlichung
oder automatische Release-/Signierungsaktion durch die bloße Projektanlage.

## Werkzeug- und Codevorgaben für D1

- Electron-/Node-/Forge-/MQTT.js-/i18next-Versionen vor Einbindung anhand offizieller
  Dokumentation prüfen. Geeignete kompatible Versionen und die Buildumgebung fest
  binden; Lockdatei einchecken. Keine erfundenen oder ungepinnten Tagesstände.
- TypeScript mit strikter Typprüfung; `any` oder unsichere Casts nicht als Ersatz
  für die Prüfung externer IPC-/MQTT-/Dateidaten verwenden.
- Einheitliche Formatierung und Linting; zwei Leerzeichen, UTF-8 ohne BOM und LF.
  Nur englische technische Bezeichner und stabile Meldungsschlüssel verwenden.
- Bei der Paketstruktur echte, dokumentierte Befehle für Typen, Linting,
  Formatprüfung, Tests und Build einrichten. Keine leeren grünen Platzhalterjobs.
- `npm ci` verwendet später die gebundene Lockdatei. Benötigte Lifecycle-/Native-
  Buildschritte ausdrücklich prüfen; nicht pauschal freischalten oder unterdrücken.
- Keine `library.json`, Symcon-Modulmetadaten, PHP-Stubs, StylePHP-Submodule oder
  PHP-Prüfactions allein wegen der Herkunft des Designers übernehmen.
- App-Versionierung, Veröffentlichungsweg und Lizenz vor der ersten Paketabgabe
  festlegen. Noch keine App-Versionsnummer aus der Symcon-Library ableiten.

## Verbindliche Prüfbereiche

| Bereich | Nachweise vor Abschluss der betreffenden Funktion |
| --- | --- |
| Fachmodell | Schema, Grenzen, Gerätezugriffsrechte, stabile IDs, getrennte Systementwürfe, Konflikte und Rückweg |
| Sprache | Vollständige DE-/EN-Kataloge, gleiche Parameter, Ersatzsprache, Mehrzahl, Zahlen/Datum und Wechsel ohne Eingabeverlust |
| Transport | Isoliertes synthetisches MQTT/Z2M; Anfrage-/Sitzungszuordnung, retained Ablehnung, Timeout, Ausfall/Wiederverbindung und keine Befehlswiederholung |
| IPC/Renderer | Unzulässige Absender und Daten ablehnen, keine Roh-Publish-/Datei-/Shell-API, Navigation und externe Links begrenzen |
| Diagnose | Öffentliche Aufträge und Entscheidungen korrelieren, Geheimnisse entfernen, begrenzte Aufzeichnung und unveränderte ursprüngliche Endzeit |
| Editor | Erstellen/Bearbeiten/Vorbelegung, Dialoge, Suche, Systemwechsel, lange Texte, Tastatur und Drag & Drop |
| Darstellung | Hell/Dunkel, schmale/breite Fenster, Skalierung/DPI, Mausrad und innere/äußere Scrollgrenzen |
| Persistenz | Atomare Änderung, Sicherung/Wiederherstellung, beschädigte Dateien, unterschiedliche Formatversionen und keine exportierten Geheimnisse |
| Pakete | Native Installation, Update, Neustart, Deinstallation und Datenbestand auf beiden OS; Signierung und Prüfsummen vor Veröffentlichung |

Eine erfolgreiche Unit-/Browserprüfung ersetzt keine installierte Desktop-App.
Reale Broker, echte Schaltbefehle und Neustarts benötigen einen gesonderten Auftrag.

## Plattformmatrix und CI

| Referenz | Geplanter Schwerpunkt | Stand |
| --- | --- | --- |
| Windows 11 x64 | Benutzerinstallation, DPI, Dateisperren, geschützte Ablage | Offen; noch kein App-Grundgerüst |
| Ubuntu Desktop 24.04 LTS x64 | `.deb`, Schlüsseldienst, Wayland/X11, Pfade und Abhängigkeiten | Offen; noch kein nativer Desktopnachweis |
| Ubuntu Desktop 26.04 LTS x64 | Zusätzlicher LTS-Abnahmelauf derselben Ausgabe | Offen; konkrete Umgebung noch zu belegen |

Ab D1 getrennte Windows-/Ubuntu-Jobs mit identischem Quellstand. Gemeinsame
Vertragstests ergänzen OS-spezifische Builds. Unter Linux Groß-/Kleinschreibung,
fehlender/gesperrter Keyring und Dateirechte prüfen; unter Windows gesperrte
Dateien und Benutzerpfade. Keine hart codierten Entwicklerpfade oder Shellbefehle
für Dateizugriff. Ein WSL- oder headless Lauf ist kein Ubuntu-Desktopnachweis.

Keine rote Plattform auf „später“ verschieben und beide dennoch als fertig melden.
Die CI erhält außerdem eine Kodierungsprüfung auf ungültiges UTF-8, beschädigte
Umlaute und Zeilenenden. Fremdartefakte bleiben unverändert und sind ausdrücklich
ausgenommen. Diese Prüfautomation wird mit dem Grundgerüst eingerichtet und ist
noch nicht vorhanden. Keine Symcon-ModuleCI-PHP-Action als Desktopprüfung ausgeben.

## Übernahme bestehender Quellen

Die bisherige PHP-Fachlogik wird nur soweit nötig in eigene TypeScript-Logik
überführt; gemeinsame synthetische Fälle prüfen gleiche Verträge. D0 bearbeitet
noch den kanonischen Designer im getrennten Symcon-Repository und benötigt dort
einen eigenen abgegrenzten Auftrag und dessen Prüfungen. In diesem Setup wurde
keine Quelle übernommen, kein Helper verteilt und kein Modul aktualisiert.

Bei D1 den Designer einmalig extrahieren, Paketversion/Herkunft/Prüfsummen und
Symcon-Einbindung gemeinsam prüfen. Die Z2M-Erweiterung und ihr Schema werden
weiterhin aus ihrer bisherigen kanonischen Quelle als überprüftes Artefakt
bezogen. Die App installiert keine Host-Abhängigkeiten auf Z2M.
