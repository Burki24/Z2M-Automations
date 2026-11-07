# Architektur

Stand: Planung, noch keine implementierte App. Entscheidungen und vollständige
Meilensteine stehen in [ADR 0001](adr/0001-parallel-desktop-platforms.md) und im
[Desktop-Plan](DESKTOP_PLAN.md).

## Gemeinsame Anwendung für zwei Plattformen

Windows und Ubuntu verwenden denselben Designer und dieselbe Fachlogik.
Plattformspezifisch sind Dateipfade, Dialoge, geschützte Geheimnisablage,
Desktopintegration und Pakete. Keine getrennten Funktionsstände je Betriebssystem.

Geplante Zuständigkeiten, noch nicht angelegte Paketverzeichnisse:

| Bereich | Zuständigkeit |
| --- | --- |
| `apps/desktop` | Electron-Main, Preload, Fenster und Paketkonfiguration |
| `packages/designer` | Nach der Extraktion: gemeinsame Oberfläche und Sprachkataloge |
| `packages/core` | Entwürfe, Schema-/Fähigkeitsprüfung, Konflikte und Adapterverträge |
| `packages/mqtt` | Brokerverbindungen und korrelierte Z2M-Aufträge |
| `packages/platform` | OS-Pfade, Dialoge und geschützte Zugangsdaten |
| `tests` | Synthetische Vertrags-, Integrations-, UI- und Plattformfälle |

Die Oberfläche arbeitet gegen einen festen Adaptervertrag. Der Symcon-Adapter
bleibt im Symcon-Repository; der Desktop-Adapter läuft hinter begrenztem IPC.
Der Renderer enthält weder Node-Zugriff noch Brokergeheimnisse oder MQTT-Clients.

## Eine maßgebliche Quelle je Komponente

| Komponente | Bis zum Übergang | Geplanter Bezug danach |
| --- | --- | --- |
| Designer | `Symcon_Z2MAutomations/Z2MAutomations/visualization` | Einmalige Übernahme nach `packages/designer`; versioniertes Paket für Symcon und Desktop |
| Z2M-Erweiterung und Schema | `Symcon_Z2MAutomations/libs/z2m` | Dort weiterhin kanonisch; Desktop bündelt verifiziertes Artefakt mit Herkunft und Buildkennung |
| Symcon-Helper | `Symcon_ModuleHelper` und unverändertes Consumerpaket | Im Symcon-Adapter weiterverwenden; keine PHP-Kopien oder neue Desktop-PHP-Laufzeit |
| Desktop-Fachlogik | Noch nicht vorhanden | Eigene TypeScript-Implementierung mit gemeinsamen synthetischen Vertragsfällen |

Vor der Extraktion werden Ressourcenpfade, CSP, Asset-Allowlist, Übersetzungen,
Lizenzrechte und der Rückweg für beide Produkte geprüft. Ein Schwesterrepository
wird nicht heimlich als Buildquelle verwendet. Ausgelieferte Pakete enthalten
die fest gebundenen Assets; keine Laufzeitdownloads aus GitHub.

## Systeme, Daten und Aufträge

- Brokerverbindung und Z2M-System getrennt modellieren. Mehrere Basistopics
  dürfen einen Broker teilen; maximal acht Systeme bleiben ausdrücklich zugeordnet.
- Identitäten sind stabile System-/Geräte-/Regelkennungen. Anzeigenamen sind veränderbar.
- Portables Projekt und Geheimnisse getrennt ablegen. Private Schlüssel und
  Sitzungen gehören weder in Exporte noch in Diagnose oder Repository.
- Entwurf, Z2M-Basisrevision/-prüfsumme und bestätigten Betriebsstand getrennt halten.
  Speichern vergleicht gegen einen frischen Stand und meldet Konflikte.
- Wiederverbindung wiederholt keine unbestätigten Steueraufträge automatisch.
  Eine lokale Symcon-Besitzerkennung ist keine installationsübergreifende Sperre.
- Die App führt keine Regeln selbst aus. Z2M bleibt die Laufzeit; Broker-Bridges
  werden gesondert eingerichtet und nicht durch die App installiert.

## Sprache, Rechte und Diagnose

Sichtbare Meldungen tragen Schlüssel und Parameter. Der Designer löst sie anhand
der gewählten Sprache auf; Protokollwerte und benutzerdefinierte Namen bleiben
unverändert. Geräteaktionen benötigen bestätigte Z2M-Schreibrechte; Sensoren
bleiben als lesbare Auslöser und Bedingungen verwendbar.

Alle Aufträge und Entscheidungen sind mit strukturierten, bereinigten Ereignissen
nachvollziehbar. System-, Auftrags-, Regel-, Lauf- und Schrittkennung verbinden
lokale Diagnose und Erweiterungsmeldungen. Start, feste Endzeit und Stopp einer
Aufzeichnung sind ausdrücklich sichtbar. Ein Auftrag gilt erst nach seiner
passenden Bestätigung als erfolgreich; eine Gerätewirkung ist getrennt zu prüfen.
