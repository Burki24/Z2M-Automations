# Projektkontext: Z2M-Automations

Stand: 07.11.2026. Repository `Burki24/Z2M-Automations`, lokal
`E:\git\Z2M-Automations`. Dauerhafter Arbeitsbranch `dev`; `main` ist Hauptbranch.

## Auftrag und tatsächlicher Stand

Der Benutzer hat eine gemeinsame Windows-/Linux-App und Ubuntu LTS auf x64 als
erste Linux-Referenz bestätigt. Das neue Projekt und Repository wurden vom
Benutzer angelegt. Dieser Einrichtungsschritt übernimmt den bestehenden Plan
und richtet die Entwicklungsvorgaben ein.

Vorhanden sind README, AGENTS, Projektkontext, Architektur, Entwicklungsablauf,
ADR 0001 und Text-/Ignore-Konfiguration. Noch keine App, Paketstruktur,
Abhängigkeiten, Lockdatei, App-CI, Installer oder MQTT-Verbindung implementiert.
Es wurden keine Systeme kontaktiert, installiert oder verändert.

Die operative Agenda ist [DESKTOP_PLAN.md](docs/DESKTOP_PLAN.md), übernommen aus
`Symcon_Z2MAutomations` zum Planstand
`01f444d91d5c664177a5d2a60a5d644c72840523`.
Quellbezüge und Fortschritt werden künftig in diesem Repository gepflegt.

## Bestätigte Richtung

- Produkt: Z2M-Automations für Windows / Z2M-Automations für Linux.
- Windows 11 x64 und Ubuntu Desktop LTS x64 parallel. Geplante Ubuntu-Prüfziele:
  24.04 LTS und zusätzlicher Abnahmelauf auf 26.04 LTS; noch kein Praxisnachweis.
- Gemeinsamer Designer mit Deutsch/Englisch; geplanter Unterbau Electron,
  TypeScript, Electron Forge und MQTT.js. Versionsauswahl folgt im Grundgerüst.
- Bis zu acht Systeme, mehrere Basistopics an einem oder mehreren Brokern.
- Die Laufzeit bleibt in der eigenen Z2M-Erweiterung, unabhängig von der App.
- Desktop-Lizenz, erste App-Version und Vertriebsmodell sind noch offen.

## Quellen und Abgrenzung

`../Symcon_Z2MAutomations` ist die bestehende eigene Symcon-Library. Dort bleiben
Designer und Erweiterung zunächst kanonisch. Erst die geplante Extraktion
verlegt die UI-Quelle nach `packages/designer` und liefert ein versioniertes
Paket an Symcon. Die Erweiterung bleibt zunächst im anderen Repository.
Keine UI-, Helper- oder Laufzeitkopie wurde in diesem Schritt angelegt.

Symcon-Ereignisimport und native Objekt-/Schaltvariablen sind keine Voraussetzung
der App. Ihre Aktionsrechte werden über den bestätigten Z2M-Katalog geprüft.
Vorhandene Symcon- und Geräteprüfungen bleiben Herkunftsnachweise dieses Produkts
und werden nicht als Desktop-Abnahme ausgegeben.

## Nächster Arbeitsschritt

**D0 – Mehrsprachiger Designer:** vorhandene Texte und Meldungsverträge erfassen,
deutsche/englische Kataloge und Sprachwechsel ohne Eingabeverlust umsetzen.
Dieser Schritt betrifft zunächst die noch kanonischen Quellen der Symcon-Library
und wird gesondert umgesetzt. Danach D1 mit beiden Desktop-Zielplattformen.

Die Repositoryeinrichtung erledigt lediglich eine Voraussetzung von D1.
Alle Meilensteine D0–D7 und ihre Plattformabnahmen bleiben offen. Echte
Z2M-/Live-Tests, Paketveröffentlichung sowie Commit und Push sind nicht Teil
dieses Einrichtungsschritts.
