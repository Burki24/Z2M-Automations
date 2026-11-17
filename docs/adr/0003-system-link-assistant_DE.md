<a id="adr-0003-read-only-assistance-for-connecting-z2m-systems"></a>

# ADR 0003: lesende Hilfe zum Verbinden von Z2M-Systemen

**Deutsch | [English](0003-system-link-assistant.md)**

- Datum: 2026-11-11
- Status: Für die eigenständige Desktop-App umgesetzt.

<a id="decision"></a>

## Entscheidung

In Schritt 3 einen dreistufigen Assistenten anbieten: zwei Systeme auswählen,
Voraussetzungen prüfen und Konfigurationsvorschläge ansehen. Gemeinsamen Designer,
Symcon-Schnittstellen und maßgebliche Erweiterung/Schema unverändert halten.
Dynamic-Security-Verwaltung und automatische Servereinrichtung gehören nicht
zu dieser Änderung.

Der Hauptprozess prüft stabile unterschiedliche Systemkennungen. Planansicht
stellt keine Netzwerkanfragen. Eine ausdrückliche Prüfung startet normale
zugeordnete Status-/Editor-Lesevorgänge für beide gewählten Systeme auf bereits
verbundenen Brokern. Sie verbindet weder getrennte Broker noch sendet sie
Mesh-Test- oder Steuerbefehle. Lesen endet über die vorhandene
Beobachtungswarteschlange; nicht auf diese Rückrufe warten, während diese
Warteschlange gehalten wird. Der offene Dialog fragt Darstellungsstände ab und
macht seine Sitzung beim Projektersatz ungültig. Projektdateischreiben,
Übertragungen und Laufzeitänderungen bleiben getrennte Aktionen.

Lokale, frisch gespeicherte und in der passenden aktiven Revision geltende
Freigaben unterscheiden. Zwischengespeicherte Beobachtungen können keine
Live-Prüfung bestehen. Tatsächliche Z2M-/Bridge-Zugangsdaten, ihre ACLs und der
durchgängige Mesh-Transport bleiben ungeprüft, auch wenn App-Verbindung und
alle Z2M-Beobachtungen erfolgreich sind.

Ergänzende `mesh_peers`- und Mosquitto-ACL-Auszüge mit Erhalt vorhandener lokaler
Partner erzeugen. Nie acht Partner überschreiten, mehrdeutige Basistopics raten,
echte Zugangsdaten einschließen oder Konfigurationsanweisungen aus Anzeigenamen
erzeugen. Broker mit gemeinsam konfiguriertem Endpunkt brauchen keine zusätzliche
Brücke. Bei unterschiedlichen Endpunkten eine Brücke auf dem ersten Broker mit
`topic z2ma/mesh/# both 0`, sauberen Sitzungen, eindeutigen Clientkennungen und
ohne retained Benachrichtigungstopics zeigen. Passwort-/Kontoplatzhalter und bei
TLS serverseitige CA-/Clientzertifikatsplatzhalter mit aktiver Zertifikatsprüfung
verwenden.

Beispiele ergänzen bestehende Serverkonfiguration. Sie erkennen keine vorhandene
Brückentopologie, lösen keine Host-Aliase auf, aktivieren keine Anmeldung,
erstellen keine Konten und ersetzen keine vollständigen Konfigurationsdateien.
Ein Serveradministrator muss bestehende Routen prüfen, Schleifen vermeiden,
Platzhalter ersetzen, Geheimnisdateien schützen und passend zur installierten
Mosquitto-Version neu laden/neu starten.

<a id="evidence-and-limits"></a>

## Nachweise und Grenzen

Unit-/Integrationstests prüfen begrenzte Vorlagen, mehrdeutige Zuständigkeit,
veralteten Stand, fehlgeschlagenes Lesen, Versionsprüfungen und isolierte
MQTT-Partner. Ein getrennt verborgener Electron-DOM-Test prüft den Assistenten
ohne Bildaufnahme. Der Workflow enthält diesen Test in beiden Plattformjobs.
Ein lokaler Windows-Erfolg ist weder Ubuntu-Abnahme noch Nachweis zu den echten
Brokerkonten und Brücken des Benutzers.

Protokoll-/Konfigurationsquellen:

- [Mosquitto-Anmeldung](https://mosquitto.org/documentation/authentication-methods/)
- [Mosquitto-Konfiguration, ACLs und Brücken](https://mosquitto.org/man/mosquitto-conf-5.html)
- [Dynamic-Security-Verwaltung](https://mosquitto.org/documentation/dynamic-security/)
