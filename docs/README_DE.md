<a id="documentation"></a>

# Dokumentation

**Deutsch | [English](README.md)**

Beginne für Installation und tägliche Bedienung mit dem
[Anwenderhandbuch](USER_GUIDE_DE.md). Jedes eigene Markdown-Dokument hat eine
vollständige deutsche Fassung mit der Endung `_DE.md`. Der Sprachlink unter dem
Titel wechselt zwischen den Fassungen. Englisch ist die maßgebliche technische
Referenz; beide Versionen werden zusammen gepflegt. Befehle, Protokollwerte,
Kennungen und ursprüngliche Lizenztexte bleiben unverändert.

<a id="using-the-application"></a>

## Anwendung nutzen

| Dokument | Inhalt |
| --- | --- |
| [Anwenderhandbuch](USER_GUIDE_DE.md) | Zwanzig Kapitel mit sechzehn deutschen App-Aufnahmen: Einrichtung, Beispiele, Entwürfe, Betrieb, Updates und Fehlerbehebung. |
| [Windows-Installer](WINDOWS_INSTALLER_DE.md) | Sprache, Installationsbereich, Ordnerauswahl sowie Build-/Abnahmegrenzen. |
| [Herkunft der Bildschirmbilder](images/README_DE.md) | Passende deutsche/englische Bildsätze, Aufnahmeumfang und erforderliche Zustimmung. |
| [Projektübersicht](../README_DE.md) | Produkt, Funktionen, lokaler Start und Lizenz. |

<a id="developing-and-verifying"></a>

## Entwickeln und prüfen

| Dokument | Inhalt |
| --- | --- |
| [Entwicklung](DEVELOPMENT_DE.md) | Einrichtung, Pflichtprüfungen, bildfreie Tests, Paketbau und Plattformnachweise. |
| [Entwicklungsregeln](../AGENTS_DE.md) | Repository-Umfang, Lokalisierung, Datengrenzen und Git-Vorgänge durch den Benutzer. |
| [Projektkontext](../PROJECT_CONTEXT_DE.md) | Aktuelle Umsetzung und dokumentierte Prüfung. |
| [Architektur](ARCHITECTURE_DE.md) | Gemeinsamer Designer, Produktadapter, Systeme, Anfragen und Zugangsdaten-Grenzen. |
| [Umsetzungsplan](DESKTOP_PLAN_DE.md) | Ziele, ursprüngliche Planungsentscheidungen und Abschlusskriterien D0–D7. |
| [Lokalisierung](LOCALIZATION_DE.md) | Lokale DE-/EN-Kataloge, Eingabeerhalt und gemeinsame Integrationsprüfungen. |
| [Versionierung](VERSIONING_DE.md) | Automatische Metadaten, geordnete unveränderliche Build-Übergabe und Versionsquelle. |
| [RC1-Vorbereitung](RC1_DE.md) | Auditkorrekturen, Kandidatenmanifeste und gezielte native Abnahme. |
| [Gemeinsames Designer-Paket](../packages/designer/README_DE.md) | Maßgebliche Quellen, Herkunft, Paketübergabe und Adaptervertrag. |
| [Eingefrorenes Erweiterungs-Testartefakt](../tests/fixtures/extension-0.2.0/README_DE.md) | Herkunft und Prüfsumme des unveränderlichen Regressionstest-Artefakts. |

`npm run check:docs` prüft Sprachpaare, Navigation, lokale Links und die
Zuordnung der Handbuchbilder ohne Bildaufnahme. Es läuft in `npm run check`
und gehört damit zu den lokalen Pflichtprüfungen und beiden Desktop-CI-Jobs.
Es bewertet weder Übersetzungsbedeutung noch visuelle Bildqualität; prüfe diese
bei Änderungen der jeweiligen Inhalte. Vor neuen Bildaufnahmen die aktuellen
Regeln zur Aufnahmezustimmung beachten.

<a id="milestone-records"></a>

## Meilensteinnachweise

Diese Nachweise erhalten Tests und Grenzen ihrer jeweiligen Umsetzungsstufe.
Für heutiges Verhalten aktuelles Handbuch und Projektkontext verwenden.

| Meilenstein | Nachweis |
| --- | --- |
| D1 | [Gemeinsame Desktop-Grundlage](D1_DE.md) |
| D2 | [Lokale Projekte, Entwürfe und geschützte Zugangsdaten](D2_DE.md) |
| D3 | [Lesender MQTT-Zugang](D3_DE.md) |
| D4 | [Lokale Bearbeitung und privater Entwurfsaustausch](D4_DE.md) |
| D5 | [Erweiterungsinstallation und Speicherung](D5_DE.md) |
| D6 | [Aktivierung und Betrieb](D6_DE.md) |
| D7 | [Installierte Beta und spätere Arbeitsablaufabnahme](D7_DE.md) |

<a id="architecture-decisions"></a>

## Architekturentscheidungen

| Entscheidung | Nachweis |
| --- | --- |
| ADR 0001 | [Gemeinsame Windows-/Linux-Anwendung](adr/0001-parallel-desktop-platforms_DE.md) |
| ADR 0002 | [Portable Projekte und getrennter Zugangsdaten-Tresor](adr/0002-local-projects-and-credential-boundary_DE.md) |
| ADR 0003 | [Lesender Systemverknüpfungsassistent](adr/0003-system-link-assistant_DE.md) |
| ADR 0004 | [Gemeinsame Entwurfsprüfung und geführte Übertragung](adr/0004-guided-draft-transfer_DE.md) |
| ADR 0005 | [Gemeinsamer Desktop-/Symcon-Arbeitsbereich](adr/0005-shared-guided-workspace_DE.md) |
| ADR 0006 | [Verbindungsabgleich und portable Projekt-/Entwurfsdateien](adr/0006-draft-reconciliation-and-portable-files_DE.md) |
| ADR 0007 | [Vorgeschlagene App für Home Assistant OS](adr/0007-home-assistant-app_DE.md) |
