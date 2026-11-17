<a id="d5-extension-installation-and-storage"></a>

# D5: Erweiterungsinstallation und Speicherung

**Deutsch | [English](D5.md)**

Wähle das Zielsystem im MQTT-Bereich. Dort stehen die installierte und die
mitgelieferte Build-Kennung. Die mitgelieferte Erweiterung 0.2.4 ist das
maßgebliche erzeugte Artefakt aus Symcon-Commit
`2db85997a2a317bee6c59e96d78c050b8c579095`. Der Herkunftsnachweis enthält
Artefakt-, Build- und Schemaprüfsummen. Build-Vorbereitung und Desktop-Hauptprozess
prüfen das Artefakt vor Verwendung. Die Desktop-App sendet es als Daten an
Zigbee2MQTT.

<a id="workflow"></a>

## Ablauf

- **Mitgelieferte Erweiterung installieren** in Schritt 4 führt das gesamte
  Update aus. Bestätige Ziel, Build und Z2M-Neustart und wähle bei gespeicherten
  Regeln einen privaten Sicherungsort. Die App bestätigt den Stopp des
  Automatikbetriebs, überträgt die festgelegte Erweiterung, fordert einen
  Z2M-Neustart an und wartet bis zu 90 Sekunden auf einen aktuellen
  Offline-/Online-Wechsel und eine frische Sitzung mit erwartetem Build. Sie
  prüft genaues ursprüngliches gespeichertes YAML, Revision und Prüfsumme, bevor
  sie zuvor aktiven Automatikbetrieb samt Neustartpräferenz wiederherstellt.
  Zuvor gestoppter Betrieb bleibt gestoppt; unterbrochene Läufe werden beendet.
  Lokale Entwürfe und gespeicherte Regelschalter werden dabei weder übertragen
  noch verändert. Zigbee2MQTT muss anfangs laufen, da die App dessen
  MQTT-Speicher- und Neustartendpunkte verwendet. Das App-Konto benötigt unter
  dem System-Basistopic neben Erweiterungsverwaltung die Rechte für
  `bridge/request/restart` und `bridge/response/restart`. Erstinstallation
  benötigt auch eine bestätigte Erweiterungsliste ohne unsere Erweiterung.
  Bei bereits aktuellem Build erfolgt nur eine lesende Prüfung ohne Änderung.
  Fortschritt und Fehler je Phase bleiben im Erweiterungsbereich sichtbar.
- **Entwurf prüfen** vergleicht frischen Speicherstand mit der lokalen Basis
  und wählt automatisch die passende Prüfung. Inhaltsänderungen bereiten den
  vollständigen Kandidaten mit allen Automationen ausgeschaltet vor. Reine
  Schalteränderungen behalten die vorgesehenen Ein-/Ausschalter; ein identisches
  Dokument benötigt keine Übertragung. Die Validierung prüft Schema, Kataloge,
  Partnerfreigaben und genaue Kandidatenbytes ohne Betriebsänderung. Reine
  Offline-Prüfung erlaubt niemals eine Übertragung.
- **Nach Z2M übermitteln** ausschließlich in Schritt 8 erfordert ausdrückliche
  Bestätigung von Ziel, vollständiger Ersetzung, Änderungen und Schalterrichtlinie.
  Nach privater Sicherung bestätigt der Hauptprozess den Automatikstopp, prüft
  genehmigten Kandidaten und Freigaben erneut, sendet eine Speicheranfrage und
  prüft unabhängig genaues gespeichertes YAML, Revision und Prüfsumme. Die
  Bestätigung bietet **Bisherigen Betrieb anschließend wieder aufnehmen**, bei
  jeder Übertragung zunächst abgewählt und nur bei zuvor bestätigt aktivem
  Betrieb verfügbar. Die Wahl erhält ausdrücklich gesetzte Freigaben des
  geprüften Entwurfs, validiert genau diese Bytes erneut und setzt erst nach
  geprüftem Speichern/Rücklesen und frischer Aktivierungsanforderung fort.
  Neue ausgeschaltete Regeln bleiben aus; gespeicherte Neustartpräferenz bleibt
  erhalten, unterbrochene Einzelläufe werden nicht wiederholt. Ohne diese Wahl
  behalten Inhaltsübertragungen die bisherige Alles-aus-Richtlinie; der Betrieb
  bleibt gestoppt. Einmaliger Test oder manuelle Aktivierung bleiben getrennte
  Folgeschritte. Neuere Entwürfe, geänderte Sitzungen, abgebrochene Dialoge und
  unbestätigte Stopps können nicht übertragen werden.
- **Übertragung prüfen / Updatestatus prüfen** liest nach unklarem Ergebnis.
  Fehlende Antworten können mit unabhängigen frischen Nachweisen geklärt werden.
  Updateprüfungen senden nie Steuerbefehle. Nach bestätigtem Teilupdate fragt
  die Installationsschaltfläche vor Fortsetzen noch nicht gesendeter Phasen
  nach Bestätigung. Bereits gesendete Stopp-, Übertragungs-, Neustart- und
  Aktivierungsbefehle werden nie wiederholt. Ungeklärte Versuche bleiben während
  der App-Sitzung im Speicher; allein eine neue MQTT-Verbindung löscht sie
  nicht. Manuelle Aktivierung und Einmalstarts auf diesem System bleiben bis
  zur Klärung gesperrt; Statuslesen und ausdrückliche Stoppbefehle bleiben möglich.

Eine fehlgeschlagene Prüfung vor dem Start aktiviert den Betrieb nie. Hat die
Aktivierung selbst ein ungewisses Ergebnis, meldet die Oberfläche bestätigtes
Speichern getrennt von unklarer Wiederaufnahme. Statusabgleich ist lesend und
wiederholt niemals die Aktivierung.

Aktive Laufzeit oder vorgemerkte Neustartwiederherstellung müssen vor dem
Speichern gestoppt werden; die geführte Übertragung übernimmt dies nach
Bestätigung und Sicherung. Ein bestätigt gestoppter Betriebswunsch ist auch
bei gespeicherter Neustartpräferenz true sicher. Erweiterungsupdates stoppen
ausdrücklich zuerst und stellen nur den bisherigen Automatikbetrieb nach
Prüfung wieder her. MQTT-Anfragen verwenden genaue Topics, Transaktionskennungen,
Verbindungsgenerationsprüfungen, QoS 0, weder Retention noch Offline-Warteschlange.
Validierung und Speichern verwenden die YAML-Grenze der Erweiterung von 128 KiB.
Die maßgebliche Speicheranfrage schützt Sitzung und Revision. Die
Bridge-Installation nutzt den Speicherendpunkt der Bridge ohne atomare
Vorbedingung für den bisherigen Build. Installation mit anderen
Verwaltungsclients abstimmen.

Die erste Hintergrundbeobachtung kann die Basis initialisieren. Spätere
Beobachtungen aktualisieren die gespeicherte Ansicht ohne Verschieben der
Entwurfsbasis. Eine Abweichung blockiert Validierung und Speichern, zeigt
geänderte Kennungen und bietet eine private Sicherung mit lokalem Entwurf und
frischer gespeicherter Konfiguration. Nach Prüfung der Sicherung eine neue Basis
über die ausdrückliche D4-Übernahme herstellen. Bestätigtes Speichern setzt die
Basis ebenfalls fort. Speichere das Projekt, um sie dauerhaft zu erhalten.

<a id="verification"></a>

## Prüfung

Beim Aktualisieren der festgelegten Erweiterung die unabhängige
Prüfsummenerwartung für die genaue Übertragung in
`tests/extension-transfer.test.mjs` und `tests/extension-update.test.mjs` aus dem
geprüften maßgeblichen Commit aktualisieren. Beide Prüfungen echter Bytes
behalten; veraltete Erwartungen können die Testübertragung sonst vor dem
beabsichtigten Updatefall ablehnen.

Der isolierte Loopback-Partner prüft genaues ausgeschaltetes YAML, Revisions-/
Prüfsummenbestätigung, Sicherungen, Abbruch, veraltete Revisionen, Sitzungswechsel
nach Bestätigung, verlorene Antworten ohne erneutes Senden, Erstinstallation
mit festgelegten Bytes und Verwerfen einer vor bestätigtem Schreiben
eingereihten alten Beobachtung. Unter Windows bestanden 60 Desktop-Tests,
NSIS-Installerbau, gepackter Electron-Smoke und Bau des gemeinsamen
Designer-Archivs. Die maßgebliche Erweiterung bestand ihre Build-Prüfung und
28 Build-/Laufzeittests. Electron-Smoke prüft synthetisches Lesen und lokales
Bearbeiten. Windows- und Ubuntu-24.04-CI bestanden in
[Lauf 42557311324](https://github.com/Burki24/Z2M-Automations/actions/runs/42557311324).
Native Dialogbedienung und echte Zigbee2MQTT-Kompatibilität bleiben getrennte
praktische Tests.

Die Update-Regression verwendet das eingefrorene, prüfsummengeprüfte maßgebliche
0.2.0-Artefakt und das mitgelieferte 0.2.4-Artefakt mit isolierten MQTT-Partnern
und synthetischen Geräten. Sie reproduziert den früheren falschen Stoppfehler:
`resume_enabled` bleibt eine gespeicherte Präferenz, während
`resume_status: stopped` die Neustartwiederherstellung verhindert. Tests decken
Update-Reihenfolge, beide Wiederherstellungspräferenzen, unveränderte
Sicherung/Speicherung, gestoppten Betrieb, Abbruch, fehlende Bestätigungen,
abgelehnte Befehle, fehlenden oder ausschließlich retained Neustartnachweis,
falsche Builds und geänderte Speicherung ab. Dies ist Protokollnachweis unter
Windows, kein echter Z2M-Dienst oder Ubuntu-Abnahmelauf. Die Anfragefrist des
Partners beträgt zwei Sekunden, weil echte Erweiterungsbefehle Zustand auf
Datenträger schreiben. Regressionen für verzögerte Aktivierung prüfen
Vorbereitung und Wiederherstellung; begrenzte Diagnose meldet nur Vorgangsnamen
und verstrichene Millisekunden. Lauf 43159085338 bestand den gesamten Ubuntu-Job,
zeigte aber vor dem Windows-Paketbau die frühere Testfrist von 100 ms. Beide
Fehlermuster wurden lokal mit 250-ms-Verzögerung reproduziert; ein neuer
Windows-CI-Lauf muss Paketbau und EXE-Upload bestätigen.
`npm run test:extension-update-ui` prüft Renderer-Fortschritt während laufender
Aktion, automatische Prüfauswahl, Rückmeldung der geführten Übertragung, DE/EN
und Scrollgrenzen der Bestätigung in beiden Designs. Es prüft nur DOM/Layout
und erzeugt keine Bilder. Siehe [ADR 0004](adr/0004-guided-draft-transfer_DE.md)
für den ausschließlich auf Desktop bezogenen Übertragungsumfang.
