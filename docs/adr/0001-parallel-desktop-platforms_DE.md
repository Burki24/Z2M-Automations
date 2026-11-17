<a id="adr-0001-shared-desktop-application-for-windows-and-linux"></a>

# ADR 0001: gemeinsame Desktop-Anwendung für Windows und Linux

**Deutsch | [English](0001-parallel-desktop-platforms.md)**

- Datum: 2026-11-07
- Status: Bestätigt; D1-Offline-Grundlage und Windows-/Ubuntu-CI am 2026-11-08
  abgeschlossen. Spätere Meilensteine und native Abnahme installierter Apps bleiben offen.
- Abgeleitet aus [Symcon ADR 0034](https://github.com/Burki24/Symcon_Z2MAutomations/blob/01f444d91d5c664177a5d2a60a5d644c72840523/docs/adr/0034-desktop-windows-linux-and-localization.md).

<a id="decision"></a>

## Entscheidung

Z2M-Automations ist eine eigenständige Anwendung aus gemeinsamer Codebasis für
Windows 11 x64 und Ubuntu Desktop LTS x64. Beide Plattformen parallel entwickeln
und prüfen. Das Betriebssystem in jeder Ausgabe ausdrücklich benennen. Andere
Linux-Distributionen, ARM64 und macOS sind keine zugesagten anfänglichen Ziele.

Geplante Grundlage sind Electron, TypeScript, Electron Forge und MQTT.js.
Deutsch/Englisch zuerst im vorhandenen Designer mit lokal mitgelieferten
JSON-Katalogen und einer eigenen kleinen Auflösung vorbereiten. Der Benutzer
wählte diesen Ansatz ohne Zusatzabhängigkeit am 2026-11-07 ausdrücklich statt
i18next. Tauri bleibt eine in der Planung betrachtete Alternative, wird für den
anfänglichen gemeinsamen Ansatz wegen zusätzlicher Rust-/WebView-Arbeit aber
nicht gewählt.

Der Desktop-Adapter nutzt direkte MQTT-Verbindungen über ein isoliertes Backend.
Symcon-PHP, Symcon-Kennungen und native Aktionsvariablen sind keine Voraussetzungen
der Anwendung. Aktionen benötigen bestätigte Z2M-Fähigkeiten und Schreibrechte.
Automationen laufen weiterhin in unserer eigenen externen Z2M-Erweiterung. Nach
erfolgreicher Einrichtung und Aktivierung darf die Desktop-App geschlossen werden.

<a id="source-ownership"></a>

## Quellzuständigkeit

Bis zur Auslagerung bleiben Designer- und Erweiterungsquellen im getrennten
Repository `Symcon_Z2MAutomations` maßgeblich. Anschließend besitzt dieses
Repository den gemeinsamen Designer als versioniertes Paket für beide Produkte.
Keine unabhängigen Oberflächenkopien oder veränderten PHP-Hilfskopien pflegen.
Erweiterung und Schema bleiben zunächst im Symcon-Repository maßgeblich; die
Desktop-Anwendung übernimmt ein ausdrücklich gekennzeichnetes geprüftes Artefakt.

Die neue Anwendung übernimmt ohne Symcon-Adapter keinen Symcon-Ereignisimport.
Eine lokale Symcon-Eigentumszuordnung ist keine globale Schreibsperre gegen
Desktop-Anwendungen. Konflikterkennung benötigt frischen Z2M-Stand.

<a id="consequences-and-boundaries"></a>

## Folgen und Grenzen

- Renderer in der Sandbox ohne Node-Integration halten und eingeschränkte
  geprüfte IPC bereitstellen. MQTT, Dateien und Geheimnisse bleiben im Backend.
- Projekte enthalten weder Passwörter noch private Schlüssel. Fehlender
  geschützter Linux-Speicher darf keinen stillen Klartextrückfall auslösen.
- Eigentümerentscheidung vom 2026-11-07: Desktop verwendet PolyForm
  Noncommercial 1.0.0; Quellhinweise und Fremdlizenzen bleiben intakt.
  Anwendungsversionierung ist unabhängig und beginnt bei 0.1.0;
  version.json ist maßgeblich.
- Allgemeine Entwicklungs-, Git- und Privatdatenregeln erhalten. Symcon-Modulstrukturen,
  PHP-Werkzeuge und Store-Vorgaben gelten hier nicht.
- Die Arbeitsplanung steht in [DESKTOP_PLAN.md](../DESKTOP_PLAN_DE.md).
  Repository und Richtlinien sind vorbereitet. D0 und D1-Offline-Grundlage sind
  umgesetzt; D1-Windows-/Ubuntu-CI bestand. Native Abnahme installierter Apps
  und spätere Meilensteine bleiben offen. Siehe [D1-Nachweis](../D1_DE.md).
- Installation, Broker-Verbindungen, Live-Änderungen und Veröffentlichung gehören
  nicht zu dieser Ersteinrichtung.
