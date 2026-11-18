<a id="d3-read-only-mqtt"></a>

# D3: lesender MQTT-Zugang

**Deutsch | [English](D3.md)**

Stand: Umsetzung und Windows-/Ubuntu-CI sind seit 2026-11-08 abgeschlossen.
[Lauf 42491457811](https://github.com/Burki24/Z2M-Automations/actions/runs/42491457811)
bestand für Quelle `1ebaeadad642d6f1de3f493338074e0bcdbde0be`: Windows alle
45 Tests, Ubuntu 24.04 44 mit übersprungener reiner Windows-Sperrprüfung.
Beide beendeten nativen Paketbau, Quell-/Paket-Smoke, Prüfung der
Produktionsabhängigkeiten und Artefaktupload. Echte Broker, Symcon-Installationen
oder Geräte wurden nicht kontaktiert.

<a id="workflow-and-boundaries"></a>

## Ablauf und Grenzen

Erstelle/öffne ein lokales Projekt, konfiguriere Broker und ordne bis zu acht
Systeme mit unterschiedlichen Basistopics je Broker zu. Importiere nötige
Zugangsdaten über die vorhandene Dateiauswahl ausschließlich des Hauptprozesses.
Öffne **MQTT** und verbinde einen gewählten Broker ausdrücklich. Eine spätere
lokale Freigabe in der Broker-Einrichtung erlaubt jetzt auch automatisches
Verbinden beim Projektöffnen. Systeme eines Brokers teilen eine Verbindung;
getrennte Broker behalten unabhängige Verbindungen.

Der Bereich zeigt Verbindungs-/Leseaktualität, Erweiterungsstatus und Geräte-/
Szenenkataloge. Wähle im Designer lokale Entwürfe oder gespeicherte
Z2M-Konfiguration. Lesen erhält lokale Entwürfe, Ein-/Ausschalter und unfertige
Formulare. Bestätigtes Lesen aktualisiert den gespeicherten Stand und markiert
bei Änderungen das Projekt als geändert. Speichere ausdrücklich, um den Stand
zu erhalten. Trennen behält den letzten Stand als veraltet und entfernt die
Bestätigung des aktiven Betriebs.

MQTT.js 5.16.1 läuft ausschließlich im Hauptprozess. Begrenzte IPC bietet
Verbinden, Trennen, Aktualisieren, Ansicht und Zertifikatsauswahl/-status. Sie
bietet weder beliebiges Topic-/Nutzdaten-Senden noch Übermittlung, Installation
oder Gerätesteuerung. Anfragen verwenden nur die Operationen `status` und
`editor` unserer Erweiterung. Lesen und Wechseln der angezeigten Quelle starten
oder stoppen keine Automationen.

TLS prüft Serverkette und Hostnamen mit TLS 1.2 oder neuer. Systemvertrauen
funktioniert ohne zusätzliches Material. Für private CA oder gegenseitiges TLS
importiere über die Hauptprozess-Dateiauswahl ein privates UTF-8-JSON-Paket:
`ca` enthält PEM-CA-Zertifikate; `cert` und `key` eine zusammengehörige
PEM-Clientidentität; optionale `passphrase` entsperrt deren Schlüssel. Nur diese
Felder sind erlaubt. Das Paket ist auf 192 KiB, jedes Feld auf 64 KiB begrenzt
und wird vor Nutzung durch Nodes TLS-Kontext geprüft. Eine Umgehung der
Prüfung gibt es nicht. Zertifikatsmaterial gilt nur für die Sitzung, außerhalb
portabler Projekte, Renderer-Zustände und Diagnose. Es wird bei Projektersatz
oder Endpunktänderung gelöscht. Die Quelldatei bleibt unter Benutzerkontrolle.
Benutzername-/Passwortschutz bleibt wie in [D2](D2_DE.md).

<a id="protocol-and-stored-data"></a>

## Protokoll und gespeicherte Daten

Genaue Abonnements je System decken Bridge-Zustand, Erweiterungsstatus und beide
Leseantworttopics ab. Lesen verwendet zugeordnete status/editor/status-Transaktionen
und verlangt passendes Protokoll, Schema, Sitzung, Revision und SHA-256-Prüfsumme.
Retained-Antworten, fremde Topics, falsche/abgelaufene Transaktionen und überholte
Verbindungsgenerationen können keine Daten bestätigen. Wartezeiten für Abonnement
und Antwort sind begrenzt. Wiederverbinden führt neue Lesevorgänge mit neuen
Transaktionen aus. QoS 0, nicht aufbewahrte Anfragen, deaktivierte
Offline-Warteschlangen und ausdrückliches Neuabonnieren verhindern erneutes
Senden alter Anfragen. MQTT-Clientkennungen sind unabhängig von anderen
Verwaltungsanwendungen.

Katalogauswertung erhält stabile System-/Geräte-/Szenenkennungen, typisierte
Zugriffsmetadaten und Szenenendpunkte. Unbekannte Berechtigungen bleiben nicht
verfügbar; Gruppenfähigkeiten werden nicht aus einem Mitglied abgeleitet.
Kataloggrenzen je Antwort: 256 Geräte, 256 Gruppen und 512 Szenen. Öffentliche
Diagnose nutzt die vorhandene begrenzte Bereinigung und feste Ereignis-/
Fehlercodes mit Zuordnungskennungen. Sie schließt Rohantworten, Geräteinhalte,
YAML, Brokernamen/-hosts und Geheimnisse aus.

Projektformat 1 erhält einen optionalen `stored`-Stand je System mit genauem
Quell-YAML, ausgewerteter Konfiguration, Revision und Prüfsumme. Bestehende
D2-Projekte bleiben lesbar. Lokale Entwurfs-`configuration` bleibt getrennt.
YAML wird ohne Änderung von Kommentaren oder Zeilenenden gehasht und ist auf
1 MiB je System begrenzt; das Gesamtprojekt bleibt auf 2 MiB begrenzt.
Zu große Beobachtungen scheitern ohne Ersatz lokaler Daten. Sitzungs- und
Aktivierungstoken werden nie exportiert. Endpunkt-/Zuordnungsänderungen machen
gespeicherte Basis und Cache ungültig. Prüfungen von Konfigurationsform und
Transportidentität sind keine vollständige Laufzeit-Schema-/Fähigkeitsprüfung
aus D4/D5.

<a id="verification-and-remaining-acceptance"></a>

## Prüfung und verbleibende Abnahme

Die 45-Test-Suite verwendet echtes MQTT.js gegen einen unabhängigen, nur über
Loopback erreichbaren MQTT-3.1.1-Partner: acht gemeinsame Systeme, getrennte
Broker, Eigentum, Retained- und verspätete Antworten, fehlende/verweigerte
Abonnements, Fristen, Sitzungs-/Prüfsummenwechsel, Wiederverbindung, gesperrte
Zugangsdaten und abgelehnte Anmeldung. Echte TLS-Tests prüfen private CA,
falsche Hostnamen und gegenseitige Clientanmeldung. Zertifikate werden mit
OpenSSL vorübergehend erzeugt; private Schlüssel werden nicht eingecheckt.
Portable Stände erhalten beim Speichern/Öffnen Entwürfe und enthalten keine
Sitzungen.

Electron-Smoke prüft außerdem den Weg Oberfläche/Hauptprozess/MQTT mit einem
temporären isolierten Partner, Wechsel gespeichert/lokal, Kataloge,
Trennungszustand, Sprach-/Eingabeerhalt und Ablehnung von Steueroperationen.
Quell- und Paket-Smoke verwenden ausschließlich synthetische Daten. Native
Dialogbedienung bleibt eine getrennte manuelle Abnahmeaufgabe.

Beim Paketbau zeigte sich zunächst eine fehlende hochgezogene
Workspace-Abhängigkeit: Ein gebauter Installer enthielt MQTT.js nicht. Forge
stellt jetzt alle installierten Produktionsabhängigkeiten einschließlich
Original-Lizenzen ohne Installationsskripte oder Netzwerkzugriff bereit.
Ein Regressionstest prüft diese Bereitstellung. Paket-Smoke prüft unabhängig
jede Produktionsmanifest-Abhängigkeit innerhalb der ASAR vor dem App-Start.
Dies verhindert versehentliche Auflösung aus dem umgebenden Quellverzeichnis.

Windows `npm run verify` bestand alle 45 Tests sowie Typ-, Katalog- und
Integritätsprüfungen. `npm run smoke`, `npm run make`, `npm run smoke:packaged`,
`npm run pack:designer` und `git diff --check` bestanden lokal. Paket-Smoke
prüfte alle 45 Produktionsmanifeste einschließlich App innerhalb der ASAR.
Das nicht signierte Setup wurde unter `apps/desktop/out/make` mit
prozesslokalen temporären Ordnern auf E: erzeugt.

Ein parallel zur Installererzeugung ausgeführter Paket-Smoke scheiterte, weil
sein natives Mausradereignis nicht empfangen wurde. Der anschließende
sequentielle Lauf bestand. Die Ursache der zeitweise fehlenden Eingabe ist nicht
geklärt. CI führt Paketbau und Smoke nacheinander aus. Dies bleibt eine
Beobachtung des Testgerüsts, kein Nachweis manueller Mausradabnahme.

CI führt jetzt Paket-Smoke sowie Quell-Smoke unter Windows und Ubuntu 24.04 aus.
Ein lokaler Windows-Erfolg schließt die Ubuntu-Desktop-Abnahme nicht ab.
Echte Linux-Schlüsselbund-/Dialogprüfungen, Ubuntu 26.04, Wayland/X11 und
Abnahme installierter Apps bleiben offen. Echtes Z2M-Zusammenspiel und praktische
Tests benötigen einen getrennten ausdrücklichen Auftrag. Vollständige lokale
Bearbeitung gehört zu D4; Validierung/Speicherung/Installation und Betrieb zu
D5/D6.

Primärquellen: [MQTT.js 5.16.1](https://github.com/mqttjs/MQTT.js/tree/v5.16.1),
[Z2M-MQTT-Topics](https://www.zigbee2mqtt.io/guide/usage/mqtt_topics_and_messages.html),
[Z2M-Exposes](https://www.zigbee2mqtt.io/guide/usage/exposes.html).
Das Protokoll bleibt Eigentum unserer Erweiterung im Symcon-Repository; D3
erstellt oder verändert keine eigene getrennte Laufzeitimplementierung.
