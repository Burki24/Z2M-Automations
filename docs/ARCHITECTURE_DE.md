<a id="architecture"></a>

# Architektur

**Deutsch | [English](ARCHITECTURE.md)**

Stand: D1-/D2-Umsetzung und Windows-/Ubuntu-CI sind abgeschlossen. D3 mit lesendem
MQTT, D4 mit lokaler Bearbeitung und D5 mit Installation und Speicherung haben
die Plattform-CI bestanden. D6 ergänzt Laufzeitsteuerung im Hauptprozess;
die Ausführung verbleibt in der Erweiterung. Siehe [D5](D5_DE.md) und [D6](D6_DE.md).
Das aktuelle Verhalten beschreiben [D1](D1_DE.md), [D2](D2_DE.md) und [D3](D3_DE.md).
Entscheidungen und vollständige Meilensteine stehen in
[ADR 0001](adr/0001-parallel-desktop-platforms_DE.md) und im
[Desktop-Plan](DESKTOP_PLAN_DE.md).

<a id="shared-application-for-two-platforms"></a>

## Eine gemeinsame Anwendung für zwei Plattformen

Windows und Ubuntu verwenden denselben Designer und dieselbe Fachlogik.
Plattformspezifisch sind Dateipfade, Dialoge, geschützter Zugangsdatenspeicher,
Desktop-Integration und Pakete. Keine getrennten Funktionsumfänge je
Betriebssystem pflegen.

Der Desktop-Rahmen füllt das Fenster. Einrichtungsseiten scrollen innerhalb
ihres Arbeitsbereichs. Der Automationsarbeitsbereich gibt seiner vorhandenen
Liste, Ablaufansicht und Eigenschaftsansicht die verbleibende Höhe unter
kompaktem Kopf und Werkzeugen. In niedrigen Fenstern können die Bedienelemente
der Liste getrennt scrollen, damit Platz für Regeln bleibt. Schmale Ansichten
ordnen die Bereiche untereinander im Arbeitsbereich an. Nummerierter Rahmen und
Regeln für die Fensterhöhe werden über das versionierte Designer-Paket mit
Symcon geteilt; Produktadapter liefern Seiteninhalte und Farbpaletten.
Siehe [ADR 0005](adr/0005-shared-guided-workspace_DE.md).

Zuständigkeiten: Lokale Projekt-/Plattform- und MQTT-Dienste liegen derzeit in
`apps/desktop/src`; core, mqtt und platform sind keine leeren Platzhalterpakete.

| Bereich | Zuständigkeit |
| --- | --- |
| `apps/desktop` | Electron-Hauptprozess, Preload, Fenster und Paketkonfiguration |
| `packages/designer` | Maßgebliche gemeinsame Oberfläche und Sprachkataloge |
| `packages/core` | Entwürfe, Schema-/Fähigkeitsprüfung, Konflikte und Adapterverträge |
| `packages/mqtt` | Broker-Verbindungen und zugeordnete Z2M-Anfragen |
| `packages/platform` | Betriebssystempfade, Dialoge und geschützte Zugangsdaten |
| `tests` | Synthetische Vertrags-, Integrations-, Oberflächen- und Plattformfälle |

Die Oberfläche nutzt einen definierten Adaptervertrag. Symcons
Darstellungsadapter gehört zum gemeinsamen Paket; PHP-Kontrolle und Speicherung
bleiben im Symcon-Repository. Der Desktop-Adapter arbeitet hinter eingeschränkter
IPC. Der Renderer hat weder Node-Zugriff noch Broker-Geheimnisse oder
MQTT-Clients.

<a id="one-canonical-source-per-component"></a>

## Eine maßgebliche Quelle je Komponente

| Komponente | Maßgebliche Quelle | Übernahme |
| --- | --- | --- |
| Designer | `packages/designer/src` | Versioniertes Archiv mit Herkunft, Lizenz und Prüfsummen; feste Übernahme in Symcon |
| Z2M-Erweiterung und Schema | `Symcon_Z2MAutomations/libs/z2m` | Bleibt dort maßgeblich; Desktop enthält ein geprüftes Artefakt mit Herkunft und Build-Kennung |
| Symcon-Hilfsfunktionen | `Symcon_ModuleHelper` und dessen unverändertes Verbraucherpaket | Weitere Nutzung im Symcon-Adapter; keine PHP-Kopien oder neue PHP-Laufzeit im Desktop |
| Lokale Projekte und Zugangsdaten | `apps/desktop/src/project*.ts`, `credentials.ts`, `os-protection.ts` | Geprüfte Hauptprozessbefehle; portable Entwürfe und unabhängiger Geheimnisspeicher |

Die Auslagerung erhält PolyForm-Hinweis, native Darstellungsvorlagen und das
Verhalten der Symcon-Endpunkte. Die feste Dateierlaubnisliste enthält
transport.js. Kein benachbartes Repository stillschweigend als Build-Quelle
verwenden. Ausgelieferte Pakete enthalten festgelegte Dateien; zur Laufzeit gibt
es keine Downloads von GitHub.

<a id="systems-data-and-requests"></a>

## Systeme, Daten und Anfragen

- Broker-Verbindungen und Z2M-Systeme getrennt modellieren. Mehrere Basistopics
  können einen Broker teilen; bis zu acht Systeme ausdrücklich zuordnen.
- Automatisches Verbinden wird lokal je Projekt und Broker-Endpunkt ausdrücklich
  freigegeben. Der Hauptprozess speichert die Präferenz getrennt von portablen
  Projekten und Zugangsdaten. Beim Öffnen eines Projekts verbindet er die
  freigegebenen Broker einmal und liest deren Systeme. Fehlende oder gesperrte
  Zugangsdaten werden je Broker gemeldet.
- Identitäten sind stabile System-/Geräte-/Regelkennungen. Anzeigenamen dürfen
  sich ändern.
- Portable Projekte getrennt von Geheimnissen speichern. Private Schlüssel und
  Sitzungen gehören weder in Exporte oder Diagnose noch ins Repository.
- Entwürfe, Z2M-Basisrevisionen/-prüfsummen und bestätigten Betriebszustand
  getrennt halten. Speichern vergleicht mit frischem Stand und meldet Konflikte.
- Wiederverbindung wiederholt unbestätigte Steueranfragen nicht automatisch.
  Eine lokale Symcon-Eigentümerkennung ist keine installationsübergreifende Sperre.
- Die Anwendung führt keine Regeln selbst aus. Z2M bleibt die Laufzeitumgebung;
  Broker-Brücken werden getrennt konfiguriert und nicht von der App installiert.
- Geräteauslöser bleiben lokal. Gerätewertbedingungen dürfen ein Partnersystem
  über dessen eindeutiges Basistopic benennen. Die zuständige Erweiterung prüft
  sie beim Start und vor Aktionen über zugeordnete Mesh-Leseanfragen. Beide
  Partnerdeklarationen, frische Kataloge und kompatible Erweiterungsversionen
  werden vor Übertragung geprüft. Unbekannte Werte, fehlende Freigaben und
  verspätete oder fehlende Antworten können keine Aktion erlauben; Gerätezustände
  müssen nie durch eine laufende Desktop-App geleitet werden.
- Partnerfreigaben gehören zur jeweiligen Systemkonfiguration und werden von
  deren Regeln geteilt. Die Desktop-Übersicht zeigt lokale Deklarationen und
  vorhandene gespeicherte Beobachtungen ohne MQTT-Anfragen. Zwischengespeicherte
  Freigaben und abweichende aktive Revisionen belegen weder aktuelle Freigabe
  noch aktuellen Betrieb. Broker-ACL und Brückeneinrichtung bleiben extern und
  sind in dieser Ansicht ausdrücklich ungeprüft.
- Der Desktop-Verknüpfungsassistent stellt ein gewähltes Systempaar über
  `system-link.ts` und die festen Netzwerkbefehle `linkPlan`/`linkCheck` dar.
  Ein Plan ist lesend. Eine ausdrückliche Prüfung startet nur vorhandene,
  zugeordnete Status-/Katalogabfragen an verbundenen Brokern. Der Abschluss wird
  abgefragt, ohne die Projektwarteschlange während Beobachtungsrückrufen zu
  blockieren. Lokale Deklarationen, frische gespeicherte Freigaben und aktive
  Revisionen bleiben unabhängig. Der Renderer erhält keine Kontogeheimnisse,
  Shell-API oder beliebige Veröffentlichungsfunktion. Mosquitto-ACL- und
  Brückenvorschläge enthalten Platzhalter und ausschließlich Mesh-Topics; sie
  werden nie angewendet. Tatsächliche Kontorechte und Mesh-Transport bleiben
  unbekannt. Siehe [ADR 0003](adr/0003-system-link-assistant_DE.md).

<a id="language-permissions-and-diagnostics"></a>

## Sprache, Berechtigungen und Diagnose

Sichtbare Meldungen enthalten Schlüssel und Parameter. Der Designer löst sie
entsprechend der gewählten Sprache auf; Protokollwerte und benutzerdefinierte
Namen bleiben unverändert. Geräteaktionen erfordern bestätigte
Z2M-Schreibberechtigungen. Sensoren bleiben als lesende Auslöser und Bedingungen
verfügbar.

Alle Anfragen und Entscheidungen sind über strukturierte, bereinigte Ereignisse
nachvollziehbar. System-, Anfrage-, Regel-, Lauf- und Schrittkennungen verbinden
lokale Diagnose mit Erweiterungsmeldungen. Aufzeichnungsbeginn, festes Ende und
Stopp sind ausdrücklich sichtbar. Eine Anfrage gilt erst mit ihrer passenden
Bestätigung als erfolgreich; die physische Gerätewirkung ist getrennt zu prüfen.
