# ADR 0001: Gemeinsame Desktop-App für Windows und Linux

- Datum: 07.11.2026
- Status: Ziel, Produktname und parallele Plattformarbeit bestätigt;
  App-Implementierung und Plattformabnahmen noch offen.
- Übernommen aus [Symcon-ADR 0034](https://github.com/Burki24/Symcon_Z2MAutomations/blob/01f444d91d5c664177a5d2a60a5d644c72840523/docs/adr/0034-desktop-windows-linux-and-localization.md).

## Entscheidung

Z2M-Automations ist eine eigenständige Anwendung aus einer gemeinsamen Codebasis
für Windows 11 x64 und Ubuntu Desktop LTS x64. Beide Plattformen werden parallel
entwickelt und geprüft. Die Ausgabe nennt das Betriebssystem ausdrücklich.
Weitere Distributionen, ARM64 und macOS sind keine zugesagten ersten Zielplattformen.

Geplanter Unterbau sind Electron, TypeScript, Electron Forge und MQTT.js.
Deutsch/Englisch werden zuerst am bestehenden Designer mit lokal eingebundenen
Katalogen vorbereitet; i18next ist die vorgesehene Übersetzungsbibliothek.
Tauri bleibt eine betrachtete Alternative, wird für den ersten gemeinsamen
Umsetzungsweg wegen zusätzlicher Rust-/WebView-Arbeit nicht gewählt.

Der Desktop-Adapter verwendet direkte MQTT-Verbindungen über einen isolierten
Unterbau. Symcon-PHP, Symcon-IDs und native Schaltvariablen sind keine
App-Voraussetzung. Aktionen benötigen bestätigte Z2M-Fähigkeiten und Schreibrechte.
Die Automationslaufzeit bleibt in unserer eigenen externen Z2M-Erweiterung.
Nach erfolgreicher Einrichtung und Aktivierung darf die Desktop-App geschlossen werden.

## Quellzuständigkeit

Bis zur tatsächlichen Extraktion bleiben Designer und Erweiterung im getrennten
Repository `Symcon_Z2MAutomations` kanonisch. Danach besitzt dieses Repository
den gemeinsamen Designer als versioniertes Paket für beide Produkte. Keine
unabhängig fortgeschriebenen UI-Kopien und keine veränderten PHP-Helperkopien.
Die Erweiterung samt Schema bleibt zunächst im Symcon-Repository maßgeblich;
die Desktop-App bindet später ein genau bezeichnetes, überprüftes Artefakt ein.

Die neue App übernimmt keine Symcon-Ereignisimportfunktion ohne Symcon-Adapter.
Eine lokale Symcon-Besitzerzuordnung wird nicht als globaler Schreibschutz
gegenüber Desktop-Apps ausgegeben. Konflikte benötigen frische Z2M-Stände.

## Folgen und Grenzen

- Renderer ohne Node-Integration, sandboxed und mit begrenztem, geprüftem IPC.
  MQTT, Dateien und Geheimnisse verbleiben im Desktop-Unterbau.
- Projekte enthalten keine Passwörter oder privaten Schlüssel. Fehlende geschützte
  Ablage unter Linux führt nicht still zu Klartextspeicherung.
- Desktop-Lizenz, erste Version und Vertriebsmodell bleiben ausdrücklich offen.
  Rechte bereits bestehender Quellen werden durch die Projektanlage nicht geändert.
- Allgemeine Engineering-/Git-/Datenschutzprinzipien bleiben erhalten;
  Symcon-Modulstruktur, PHP-Werkzeuge und Storevorgaben gelten hier nicht.
- Die operative Agenda ist [DESKTOP_PLAN.md](../DESKTOP_PLAN.md). Repository und
  Vorgaben sind eingerichtet; D0–D7 sind damit nicht implementiert oder abgenommen.
- Keine Installation, Brokerverbindung, Live-Änderung oder Veröffentlichung
  ist Teil dieses Einrichtungsschritts.
