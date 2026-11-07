# Z2M-Automations

## Einstieg und Geltungsbereich

- Lies zuerst `PROJECT_CONTEXT.md`, `docs/DESKTOP_PLAN.md`,
  `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md` und relevante ADRs.
- Dieses Repository ist die eigenständige Desktop-App für Windows und Linux.
  Es ist keine Symcon-Library und setzt zur Laufzeit kein Symcon oder PHP voraus.
- Die allgemeinen Engineering-Prinzipien aus dem benachbarten
  `../SymconDevelopment/principles/` sowie passende Vorgaben zu privaten Daten
  und Git sind Referenzen, sofern lokal verfügbar. Die Desktop-Regeln dieser
  Datei sind maßgeblich. Symcon-spezifische Modulstruktur, Präfixe,
  PHP-/StylePHP-Prüfungen und Storevorgaben werden nicht übernommen.
- Ein fehlendes Schwesterrepository ist keine Laufzeit- oder Buildabhängigkeit.
  Die hier festgehaltenen Regeln gelten auch bei einem alleinigen Clone.

## Ziel und Architektur

- Produkt und Repository: `Z2M-Automations`; Ausgaben ausdrücklich als
  „für Windows“ und „für Linux“ benennen.
- Windows 11 x64 und Ubuntu Desktop LTS x64 parallel entwickeln. Geplant sind
  zunächst Ubuntu 24.04 LTS sowie ein zusätzlicher Abnahmelauf auf 26.04 LTS.
  Das sind Prüfziele, noch keine bestätigte Betriebssystemunterstützung.
- Gemeinsame Codebasis mit TypeScript, Electron, Electron Forge, MQTT.js und
  dem vorhandenen eigenen Designer. Endgültige Versionen erst beim Grundgerüst
  anhand aktueller Primärdokumentation festlegen und per Lockdatei binden.
- Die Automationslaufzeit liegt weiterhin in unserer eigenen Z2M-Erweiterung.
  Die App muss nach erfolgreicher Einrichtung geschlossen werden können.
- Bis zu acht Z2M-Systeme; Broker und Basistopics getrennt modellieren.
  Geräte und Regeln durch stabile Kennungen mit ausdrücklicher Systemzuordnung
  identifizieren. Namen und angezeigte Pfade sind keine Ersatzschlüssel.
- Main-Prozess, Preload und Renderer strikt trennen. Keine Zugangsdaten,
  MQTT-Clients, allgemeinen Dateioperationen oder Shellzugriffe im Renderer.
  IPC hat eine begrenzte Positivliste mit Schema- und Senderprüfung.
- Schema-/Protokolländerungen mit beiden Verwaltungsprodukten abgleichen;
  Revision, Prüfsumme, Sitzung, Zeitlimit und Bestätigung je System erhalten.

## Gemeinsame Quellen und fremder Code

- Vor Umsetzung passende bestehende eigene Bausteine und zentrale Helper prüfen.
  PHP-/Symcon-Helper nicht als Desktop-Abhängigkeit oder veränderte Kopie einbauen.
- Designerquellen sind bis zur geprüften Extraktion im Repository
  `../Symcon_Z2MAutomations` kanonisch. Danach liefert dieses Repository ein
  versioniertes Designerpaket für beide Produkte. Keine zwei UI-Forks pflegen.
- Erweiterung und Schema bleiben zunächst im Symcon-Repository kanonisch.
  Die Desktop-App übernimmt später ein überprüftes Artefakt samt Herkunft,
  Buildkennung und Prüfsummen; sie entwickelt keinen separaten Laufzeitfork.
- Eigene Implementierung. Keinen Code, übersetzten Code oder interne Struktur
  aus `Luligu/zigbee2mqtt-automations` übernehmen. Externe Dokumentation erläutert
  Schnittstellen und ist keine Kopiervorlage.
- Die Desktop-Lizenz und das Vertriebsmodell sind noch offen. Keine fremde oder
  bestehende PolyForm-Noncommercial-Lizenz still ersetzen oder pauschal auf die
  neue App übertragen. Rechte vorhandener Quellen vor ihrer Übernahme klären.

## Bedienung, Sprache und Debug

- Deutsch und Englisch von Beginn an; sichtbare Texte über stabile Schlüssel
  und Parameter. Spracheinstellungen haben Vorrang vor der Systemvorgabe;
  definierte Ersatzsprache ist Englisch. `Intl` für Zahlen, Datum und Mehrzahl.
- Sprachwechsel, Systemwechsel und Aktualisierungen erhalten offene Eingaben.
  Gerätenamen, IDs, MQTT-Werte und YAML-Schlüssel werden nicht übersetzt.
- Responsiv, Hell/Dunkel, skalierbare Schrift und vollständige Tastaturbedienung.
  Auswahllisten, Dialoge, Drag & Drop, Mausrad und Scrollgrenzen gezielt prüfen.
- Debug ist verpflichtend: öffentliche Aufträge, Entscheidungen und Datenfluss
  durch strukturierte Ereignisse mit System-, Auftrags-, Regel-, Lauf- und
  Schrittbezug nachvollziehbar machen. Anzeige und Meldungen sind lokalisierbar.
- Eine gemeinsame Bereinigung für Diagnose verwenden. Keine Zugangsdaten,
  privaten Geräteinhalte oder vollständigen Automationsdateien protokollieren.
  Aufzeichnung ist begrenzt, ausdrücklich start-/stoppbar und verlängert ihre
  ursprüngliche Endzeit nicht durch Speichern oder Statusabfragen.

## Daten, Tests und Systeme

- Entwürfe, gespeicherten Z2M-Stand und laufenden Betrieb sichtbar unterscheiden.
  Neue Regeln und Kopien beginnen ausgeschaltet. Lesen startet oder stoppt nichts.
- Vor Schreiben frischen Z2M-Stand vergleichen; Konflikte sichern und anzeigen.
  Keine blinde Wiederholung von Uploads, Installations- oder Schaltaufträgen nach
  Timeout oder Wiederverbindung. Keine retained Steueraufträge.
- Geheimnisse außerhalb portabler Projekte in OS-geschützter Ablage halten.
  Bei fehlendem Linux-Schlüsseldienst kein stiller Klartext-Ersatz.
- Tests verwenden synthetische Daten und isolierte Gegenstellen. Keine realen
  Broker, privaten Exporte oder produktiven Konfigurationen in Repository/CI.
- Live-Zugriffe, Extension-Installationen, Neustarts und reale Schaltbefehle
  benötigen einen gesonderten ausdrücklichen Praxisauftrag. Keine Freigabe aus
  früheren Symcon-Tests auf dieses Projekt übertragen.
- Passende Prüfungen gemäß `docs/DEVELOPMENT.md` ausführen. Ergebnisse und
  Grenzen getrennt melden; Windows-Erfolg ersetzt keine Ubuntu-Abnahme.

## Arbeitsweise und Git

- Änderungen auf den Auftrag begrenzen, vorhandene Arbeit erhalten und den
  Arbeitsbaum vor Beginn prüfen. Keine vorsorglichen Frameworks oder Platzhalter.
- Dauerhafter Arbeitsbranch `dev`, Hauptbranch `main`. Keine getrennten
  Windows-/Linux-Quellbranches. Freigaben von `dev` nach `main`, anschließend
  den freigegebenen Stand zurück nach `dev` synchronisieren; `dev` nicht löschen.
- Commit und Push ausschließlich durch den Benutzer über GitHub Desktop.
  Nach Änderungen englischen Commit-Betreff und englische Erklärung liefern.
  Keine Merge-, Release-, Signierungs- oder Veröffentlichungsaktion ohne Auftrag.
- UTF-8 ohne BOM und LF nach `.gitattributes`/`.editorconfig` verwenden;
  unveränderte fremde Artefakte nach ihrem Herkunftsvertrag behandeln.
- Dokumentation knapp mit tatsächlichem Stand führen. Eine Planung ist keine
  Implementierung und kein Praxisnachweis. Paket-/App-Versionierung wird vor dem
  Grundgerüst festgelegt; Symcon-Library-Versionen nicht weiterzählen.
