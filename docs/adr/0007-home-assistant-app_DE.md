# ADR 0007 — Z2M-Automations für Home Assistant

**Deutsch | [English](0007-home-assistant-app.md)**

- 2026-11-20
- Status **Vorgeschlagen**

## Produktumfang

Wir starten mit einer App für Home Assistant OS (früher Add-on). Ingress zeigt
den gemeinsamen Designer in der Seitenleiste von Home Assistant an. Das erste
Testimage ist für `amd64` vorgesehen. Unterstützung für `aarch64` setzt eine
eigene Prüfung voraus. Home Assistant Container führt keine Supervisor-Apps
aus. Eine Home-Assistant-Core-Integration für Entitäten oder Aktionen können
wir bei entsprechendem Bedarf prüfen. [Installationsarten von Home Assistant](https://www.home-assistant.io/installation/#about-installation-types),
[Ingress-Leitfaden](https://contributors.home-assistant.io/apps/guides/ingress/).

Der Vorschlag sieht ein eigenes Anwendungsrepository und eine unabhängige
Versionierung vor, wie bereits bei Desktop und Symcon. Die lokale Entwicklung
und Prüfung kann während der ausstehenden Canonical-Forumsentscheidung beginnen.

## Komponenten und Zuständigkeiten

- Den gemeinsamen Designer als fest versioniertes Paket mit Herkunft,
  Lizenz und Prüfsummen der Dateien beziehen. Ein Home-Assistant-Adapter
  verwendet relative URLs und die DE-/EN-Kataloge. Der heutige Browser-Einstieg
  verwendet die Startdaten, Token-Erneuerung und Webrouten von Symcon. Der
  Desktop-Adapter setzt Electron-Preload voraus. Gemeinsame Schnittstellen
  bei Bedarf für den ersten funktionsfähigen Ablauf herauslösen.
  [Gemeinsames Designer-Paket](../../packages/designer/README_DE.md).
- Ein Node.js-Backend stellt die Browser-API und die MQTT-Anbindung bereit.
  Dazu die benötigte plattformunabhängige Logik für korrelierte Anfragen aus
  `mqtt-reader.ts` und `mqtt-protocol.ts` in eine gemeinsame Quelle überführen.
  Systemzuordnung sowie Prüfungen von Sitzung, Revision, Prüfsumme und Zeitlimit
  erhalten. Der bestehende MQTT-Suffix `/symcon/automations/` bleibt aus
  Protokollgründen erhalten. Die vorhandene Zigbee2MQTT-Erweiterung führt die
  Regeln auch bei geschlossener oder entfernter App aus. Die Kompatibilität
  anhand des erkannten Erweiterungsbuilds und des fest gepinnten Schemas prüfen.
  [Aktuelle Architektur](../ARCHITECTURE_DE.md).
- Den MQTT-Dienst des Supervisors verwenden, sofern er eingerichtet und
  verfügbar ist. Einen ausdrücklich konfigurierten externen Broker mit
  TLS-Prüfung zulassen. MQTT-Clients, Broker-Zugangsdaten und Supervisor-Tokens
  bleiben im Backend. HTTP-Zugriffe ausschließlich über Supervisor Ingress
  zulassen. Mit `panel_admin: true` und Supervisor ab 2026.10.2 testen. Ab dieser
  Version prüft der Proxy die Administratorberechtigung. Vor späteren
  Schreibzugriffen Ursprung und Inhalt der Anfrage validieren. Feste API-Routen
  und nur die benötigten Broker-Themen verwenden.
  [MQTT-Diensterkennung](https://contributors.home-assistant.io/apps/guides/services-discovery/),
  [Versionshinweise zu Supervisor 2026.10.2](https://github.com/home-assistant/supervisor/releases/tag/2026.10.2).

## Erster funktionsfähiger Ablauf

1. Den gemeinsamen Designer unter einem Ingress-Pfad öffnen. Deutsche und
   englische Kataloge laden und ein konfiguriertes Z2M-System anzeigen. Seine
   Kennung bleibt von Broker und Basisthema getrennt.
2. Einen isolierten synthetischen Broker verbinden. Erweiterungsstatus,
   Gerätekatalog und gespeicherte Regeln über die vorhandene Abfolge
   `status → editor → status` lesen und anzeigen. Die Ansicht erlaubt nur
   Lesezugriff. Fehlende, veraltete oder unpassende Antworten führen zu einer
   lokalisierten Fehlermeldung. Alte Daten werden dabei als solche angezeigt.
3. Zuerst mit simuliertem Ingress-Pfad und MQTT-Testgegenstelle prüfen, danach
   mit einer separaten Home-Assistant-OS-Testinstallation. Verschachtelte
   Ressourcen- und API-URLs, Berechtigungen, Systemzuordnung und ausschließlich
   nicht-retainierte Leseanfragen im MQTT-Protokoll prüfen. Synthetische Daten
   und bildfreie Tests verwenden.

Spätere Schritte können lokale Entwurfsbearbeitung und `.z2mad`-Austausch,
mehrere Z2M-Systeme sowie explizite Übertragungs- und Betriebsfunktionen ergänzen.
Vor Freigabe von Schreibzugriffen die geschützte Zugangsdatenablage, parallele
Bearbeitung in Desktop, Symcon und Home Assistant, Vergleiche mit dem aktuellen
Stand, Konfliktsicherungen und unabhängige Bestätigungen prüfen.

## Lokale Machbarkeitsprüfung

Am 20.11.2026 lieferte ein temporärer Node.js-Server auf der Loopback-Adresse
die geprüften Einstiegsdateien des Designers und beide Sprachkataloge unter
einem simulierten Ingress-Pfad aus. Eine lesende HTTP-Route lieferte Revision,
Prüfsumme, Regeln und Gerätekatalog über den vorhandenen MQTT-Lesedienst. Die
synthetische Gegenstelle zeichnete drei nicht-retainierte Leseanfragen auf.
Der Betrieb des Designers mit einem Home-Assistant-Adapter und die Prüfung der
Ingress-Anmeldung in Home Assistant OS stehen für die Abnahme noch aus.

## Gemeinsamer Arbeitsbereich

Der Desktop-Hauptprozess und der Home-Assistant-Adapter verwenden dieselbe
Anwendungslogik, Projektverwaltung und MQTT-Anbindung. Electron stellt native
Dialoge und den Zugangsschutz des Betriebssystems bereit. Home Assistant nutzt
Browserdialoge über Ingress und privaten App-Speicher für Dateien und Zugangsdaten.

`npm run pack:workspace` baut das versionierte Archiv des Arbeitsbereichs
zusätzlich zum vorhandenen Designer-Paket. Das Manifest bindet die kompilierten
Dienste, die Desktop-Oberfläche, das Handbuch und die geprüfte Erweiterung an
die passenden Designer-Dateien. Es erfasst den Quellcommit und lokale Änderungen
am Build. Home Assistant bindet beide Archive mit ihren Prüfsummen ein.
