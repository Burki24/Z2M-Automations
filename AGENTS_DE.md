<a id="z2m-automations"></a>

# Z2M-Automations

**Deutsch | [English](AGENTS.md)**

<a id="entry-points-and-scope"></a>

## Einstiegspunkte und Geltungsbereich

- Lies vor Änderungen `PROJECT_CONTEXT.md`, `docs/DESKTOP_PLAN.md`,
  `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md` und die relevanten ADRs.
- Dieses Repository enthält die eigenständige Desktop-Anwendung für Windows und
  Linux. Sie ist keine Symcon-Bibliothek und benötigt zur Laufzeit weder Symcon
  noch PHP.
- Allgemeine Entwicklungsgrundsätze aus dem benachbarten Verzeichnis
  `../SymconDevelopment/principles/` sowie relevante Regeln für private Daten
  und Git dienen als Referenz, sofern sie lokal vorhanden sind.
  Die Desktop-Regeln dieser Datei haben Vorrang. Übernimm keine
  Symcon-Modulstrukturen, Präfixe, PHP-/StylePHP-Prüfungen oder Store-Regeln.
- Ein fehlendes Nachbar-Repository ist keine Laufzeit- oder Build-Abhängigkeit.
  Diese Regeln gelten auch für einen eigenständigen Klon.

<a id="documentation-language"></a>

## Sprache der Dokumentation

- Englisch ist die maßgebliche Referenzsprache der Repository-Dokumentation.
  Pflege zu jedem eigenen Markdown-Dokument eine vollständige deutsche Fassung
  mit der Endung `_DE.md`, auch zu READMEs, Projektkontext, Plänen, ADRs und
  Entwicklungsregeln. Beide Fassungen benötigen eine gut sichtbare gegenseitige
  Sprachauswahl. Aktualisiere beide Fassungen und ihre lokalen Links gemeinsam.
- Codekommentare, technische Bezeichner, Befehle und API-Verträge bleiben
  englisch. Ursprüngliche Hinweise und Lizenztexte Dritter behalten Sprache
  und Bedingungen ihrer Quelle.
- Technische Bezeichner, Commit-Betreff und Commit-Beschreibung sind englisch.
- Diese Dokumentationsregel ersetzt nicht die Lokalisierungsanforderungen.
  Die Anwendung muss Deutsch und Englisch über Sprachkataloge unterstützen;
  übersetzbare Oberflächentexte gehören in diese Kataloge.
- Nutze lokale JSON-Kataloge und unsere kleine eigene Auflösung. Führe weder
  i18next noch eine andere Übersetzungsbibliothek als Laufzeitabhängigkeit ein.
  Verwende die `Intl`-Funktionen der Plattform.

<a id="goals-and-architecture"></a>

## Ziele und Architektur

- Produkt und Repository heißen `Z2M-Automations`. Benenne die Editionen
  ausdrücklich „für Windows“ und „für Linux“.
- Entwickle Windows 11 x64 und Ubuntu Desktop LTS x64 parallel. Zunächst sind
  Ubuntu 24.04 LTS und eine zusätzliche Abnahme unter 26.04 LTS vorgesehen.
  Dies sind Prüfziele, keine bereits bestätigte Betriebssystemunterstützung.
- Nutze eine gemeinsame Codebasis mit TypeScript, Electron, Electron Forge,
  MQTT.js und unserem vorhandenen Designer. Wähle die endgültigen Versionen
  beim Grundgerüst anhand aktueller Primärdokumentation und fixiere sie im Lockfile.
- Automationen laufen weiterhin in unserer Z2M-Erweiterung. Nach erfolgreicher
  Einrichtung muss die Anwendung sicher geschlossen werden können.
- Unterstütze bis zu acht Z2M-Systeme. Modelliere Broker und Basistopics getrennt.
  Identifiziere Geräte und Regeln über stabile Kennungen mit ausdrücklicher
  Systemzugehörigkeit. Anzeigenamen und Pfade ersetzen keine Schlüssel.
- Trenne Hauptprozess, Preload und Renderer strikt. Zugangsdaten, MQTT-Clients,
  allgemeine Dateioperationen und Shell-Zugriff gehören nicht in den Renderer.
  IPC verwendet eine begrenzte Positivliste mit Schema- und Absenderprüfung.
- Stimme Schema-/Protokolländerungen zwischen beiden Verwaltungsprodukten ab.
  Erhalte Revision, Prüfsumme, Sitzung, Timeout und Bestätigungsbehandlung je System.

<a id="shared-sources-and-third-party-code"></a>

## Gemeinsame Quellen und fremder Code

- Prüfe vor einer Umsetzung passende bestehende Komponenten und zentrale
  Hilfsfunktionen. Führe keine PHP-/Symcon-Helfer oder veränderte Kopien als
  Desktop-Abhängigkeiten ein.
- Die maßgeblichen Designer-Quellen liegen in `packages/designer/src`.
  Beide Produkte übernehmen diese Quelle über ein versioniertes Paket; Symcon
  übernimmt geprüfte, festgelegte Assets. Pflege keine zwei unabhängig
  bearbeitbaren Oberflächenzweige.
- Erweiterung und Schema bleiben zunächst im Symcon-Repository maßgeblich.
  Die Desktop-App übernimmt ein geprüftes Artefakt mit Herkunft, Build-Identität
  und Prüfsummen; sie darf keinen eigenständigen Laufzeitzweig anlegen.
- Verwende unsere eigene Umsetzung. Kopiere weder Code, übersetzten Code noch
  interne Implementierungsstrukturen aus `Luligu/zigbee2mqtt-automations`.
  Fremddokumentation beschreibt Schnittstellen, ist aber keine Bauvorlage.
- Für die gesamte Desktop-Anwendung gilt die vom Eigentümer ausdrücklich
  bestätigte PolyForm Noncommercial 1.0.0. Erhalte vorhandene Quellhinweise.
  Fremdpakete behalten ihre jeweiligen Lizenzen; ersetze diese nicht.

<a id="desktop-visual-identity"></a>

## Erscheinungsbild der Desktop-Anwendung

Nutze unter Windows und Linux die Palette aus
`apps/desktop/renderer/desktop-palette.css`. Verwende ihre semantischen Tokens
für Arbeitsbereich, Formulare und App-Dialoge. Die eingebettete Symcon-Palette
des gemeinsamen Designers bleibt getrennt. Native Zugangsdialoge verwenden
dieselben Farben, soweit das Toolkit es unterstützt. Beachte hohen Kontrast
und betriebssystemeigene Oberflächen.

| Rolle | Hell | Dunkel |
| --- | --- | --- |
| Hintergrund | `#F4F1EC` | `#1B1918` |
| Oberfläche | `#FFFCF7` | `#262321` |
| Zweite Oberfläche | `#EEE8DF` | `#302B28` |
| Rahmen | `#D8CFC5` | `#554B45` |
| Starker Rahmen | `#87796E` | `#93847A` |
| Text | `#282321` | `#F7F0E8` |
| Zweiter Text | `#665C55` | `#C6B9AD` |
| Primär, Erfolg und Aktion | `#3D7058` | `#A5C7AF` |
| Text auf Primärschaltflächen | `#FFFFFF` | `#17291F` |
| Primär bei Mauszeiger | `#315D49` | `#B9D6C1` |
| Primärtönung | `#E4EDE5` | `#293C31` |
| Auslöser und Tastaturfokus | `#70416C` | `#D6A8CD` |
| Auslösertönung | `#F1E4EF` | `#422F40` |
| Bedingung und Warnung | `#835514` | `#E6B76A` |
| Warntönung | `#F6EAD4` | `#44331F` |
| Fehler und destruktive Aktion | `#9F283F` | `#F0A6B1` |
| Fehlertönung | `#FAE8EB` | `#482930` |
| Schatten | `#28232112` | `#00000040` |
| Abdeckung | `#28232166` | `#00000099` |

Ergänze semantische Farben durch Texte oder Symbole. Prüfe Lesbarkeit und
Tastaturfokus in beiden Designs. Halte die Logofarben in Kopfzeile und
Windows-Symbol einheitlich: Zigbee-Rot `#E50E46` für die Kachel, `#F4F5F6`
für das verbundene Z und Waldgrün `#3D7058` für das Wiedergabesymbol.

<a id="interaction-localization-and-debug"></a>

## Bedienung, Lokalisierung und Diagnose

- Unterstütze von Anfang an Deutsch und Englisch. Verwende für sichtbare Texte
  stabile Nachrichtenschlüssel mit Parametern. Eine ausdrückliche Sprachwahl
  hat Vorrang vor dem Systemstandard; Englisch ist die festgelegte Rückfallebene.
  Nutze `Intl` für Zahlen, Datumsangaben und Mehrzahlformen.
- Erhalte ungespeicherte Eingaben bei Sprachwechsel, Systemwechsel und
  Aktualisierung. Übersetze keine Gerätenamen, Kennungen, MQTT-Werte oder YAML-Schlüssel.
- Biete anpassungsfähige Layouts, helle/dunkle Designs, skalierbare Schrift und
  vollständige Tastaturbedienung. Prüfe ausdrücklich Auswahlfelder, Dialoge,
  Ziehen/Ablegen, Mausrad und Scrollgrenzen.
- Diagnoseausgaben sind verpflichtend. Öffentliche Anfragen, Entscheidungen und
  Datenflüsse müssen über strukturierte Ereignisse mit System-, Anfrage-, Regel-,
  Lauf- und Schrittkennungen nachvollziehbar sein. Anzeigen und Meldungen sind
  zu lokalisieren.
- Verwende eine gemeinsame Bereinigung für Diagnoseinhalte. Protokolliere nie
  Zugangsdaten, private Geräteinhalte oder vollständige Automationsdateien.
  Aufzeichnung muss begrenzt sowie ausdrücklich start- und stoppbar sein.
  Speichern und Statusabfragen dürfen den ursprünglichen Endzeitpunkt nicht verlängern.

<a id="data-testing-and-systems"></a>

## Daten, Prüfungen und Systeme

- Unterscheide sichtbar Entwurf, gespeicherten Z2M-Stand und laufenden Betrieb.
  Neue Regeln und Kopien beginnen ausgeschaltet. Lesen startet oder stoppt nichts.
- Vergleiche vor Schreibvorgängen mit frischem Z2M-Stand; sichere Konflikte und
  zeige Unterschiede. Wiederhole nach Timeout oder Wiederverbindung keine
  Uploads, Installationen oder Gerätebefehle blind. Steuerbefehle werden nie retained gesendet.
- Speichere Geheimnisse außerhalb portabler Projekte im Betriebssystemschutz.
  Falle bei fehlendem Linux-Schlüsseldienst nicht still auf Klartext zurück.
- Nutze synthetische Daten und isolierte Gegenstellen in Tests. Reale Broker,
  private Exporte und Produktivkonfigurationen gehören weder ins Repository noch in CI.
- Live-Zugriff, Erweiterungsinstallation, Neustarts und reale Gerätebefehle
  erfordern einen gesonderten ausdrücklichen Praxistestauftrag. Übertrage keine
  Freigaben früherer Symcon-Tests auf dieses Projekt.
- Führe die geeigneten Prüfungen aus `docs/DEVELOPMENT.md` aus. Berichte Ergebnis
  und Grenzen getrennt. Ein Windows-Erfolg belegt keine Ubuntu-Abnahme.
- Führe vor Abschluss von Codeänderungen `npm run verify:local` aus. Dazu gehören
  Build, Typen, Integrität, Unit-Tests und der vollständige bildfreie
  Oberflächentest für Erweiterungsupdates. `npm run verify` allein genügt lokal
  nicht. Linux-Anforderungen an Anzeige und Sandbox stehen in `docs/DEVELOPMENT.md`.

<a id="working-practices-and-git"></a>

## Arbeitsweise und Git

- Bleibe im beauftragten Umfang, erhalte bestehende Arbeit und prüfe zuerst den
  Arbeitsbaum. Führe keine spekulativen Frameworks oder Platzhalter ein.
- Nutze den dauerhaften Entwicklungszweig `dev` und Hauptzweig `main`.
  Erzeuge keine getrennten Windows-/Linux-Quellzweige. Integriere freigegebene
  Arbeit von dev nach main und synchronisiere den freigegebenen Stand zurück
  nach dev. Lösche dev nicht.
- Ausschließlich der Benutzer committet und pusht über GitHub Desktop.
  Liefere nach Änderungen englischen Commit-Betreff und Beschreibung.
  Ohne gesonderten Auftrag weder mergen, veröffentlichen noch signieren.
- Verwende UTF-8 ohne BOM und LF gemäß `.gitattributes` und `.editorconfig`.
  Erhalte Fremdartefakte entsprechend ihren Quellverträgen.
- Halte Dokumentation knapp und zutreffend. Ein Plan ist weder Umsetzung noch
  praktischer Prüfnachweis. Entscheide Paket-/App-Versionierung anhand von
  `docs/VERSIONING.md`; führe nicht die Symcon-Bibliotheksnummerierung fort.
