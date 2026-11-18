<a id="d4-local-rule-editing-and-private-draft-exchange"></a>

# D4: lokale Regelbearbeitung und privater Entwurfsaustausch

**Deutsch | [English](D4.md)**

Stand: Umsetzung und Windows-/Ubuntu-CI sind abgeschlossen. Der vorhandene
gemeinsame Editor bearbeitet jetzt Desktop-Projektentwürfe über eingeschränkte
Hauptprozessbefehle. MQTT bietet weiterhin nur Leseanfragen. Echte Systeme,
Erweiterungsinstallation, Gerätebefehle, Übermittlung oder Aktivierung waren
nicht beteiligt.

<a id="local-workflow"></a>

## Lokaler Ablauf

Erstelle/öffne ein Projekt, wähle ein System und im MQTT-Bereich **Lokaler
Entwurf**. Der gemeinsame Designer bietet Geräte-, Uhrzeit- und Sonnenauslöser;
Geräte-, Wochentags- und Zeitfensterbedingungen; geordnete Setzen-/Umschalten-/
Szenenaktionen; Farben; wiederverwendbare Aktionsfolgen ohne Unteraufrufe;
Regelkopie/-löschung und gerichtete Senderfreigaben. Neue Regeln und Kopien
starten aus. Einschalten im lokalen Entwurf aktiviert eine Regel nicht entfernt.
Übernimm Änderungen in den lokalen Speicher und speichere das Projekt danach
ausdrücklich. Der gespeicherte Z2M-Stand bleibt getrennt und nur lesbar.

Geräteabhängige Änderungen erfordern einen frischen Katalog mit genauen
Geräte-/Eigenschafts-Zugriffsbits, Werten, numerischen Grenzen und Szenenziel/-endpunkt.
Ein lesbarer Sensor wird nicht zum Aktor. Gruppenfähigkeiten werden nicht aus
Mitgliedern abgeleitet; bestätigte Gruppenszenen können verwendet werden.
Systemübergreifende Bedingungen und Aktionen benötigen eindeutige Basistopics
und ausdrückliche Partnerdeklarationen in beiden lokalen Entwürfen. Das
Z2M-System des Geräts und der Broker werden im Desktop-Formular getrennt gewählt;
Auslöser bleiben lokal. Diese lokalen Freigaben belegen keine installierten
Laufzeitberechtigungen. Vorhandene unbekannte Gerätefelder werden nicht
stillschweigend umgedeutet. Reine Namensänderungen erhalten unveränderte Aktionen
ohne Live-Katalog; neue/geänderte Geräteaktionen und das Einschalten einer Regel
benötigen erneute Bestätigung.

Schreibbare binäre oder diskrete Eigenschaften `state`/`state_<channel>` mit
bestätigten `ON`-/`OFF`-Werten bieten im Desktop-Wertwähler auch natives `TOGGLE`.
Diese reine Schreibauswahl wird weder Auslöser-/Bedingungswerten hinzugefügt noch
für andere Eigenschaften abgeleitet. Sie bleibt mit Helligkeit, Farbe oder
anderen Werten im selben `set`-Befehl und nutzt die native Z2M-Weiterleitung der
vorhandenen festgelegten Erweiterung. Die getrennte cachebasierte Aktion
`toggle` behält ihre bisherige Bedeutung.

Fähigkeitsfehler benennen Automation oder Aktionsfolge, Abschnitt, Eintrag und
genaue Eigenschaft einschließlich zugehörigem System und Gerät. Die Rückmeldung
zeigt den eingegebenen Wert samt Typ und die erlaubten Vergleiche, diskreten
Werte, numerischen Grenzen/Schritte, Farbformat oder Umschaltaktion. Prüfungen
des gesamten Entwurfs sammeln bis zu 20 unterschiedliche Befunde einschließlich
ausgeschalteter Regeln und kennzeichnen weitere ausgelassene Befunde ausdrücklich.
Die Fehlernavigation öffnet den passenden Eintrag und fokussiert den konkreten
Aktionswert auch bei Befehlen mit mehreren Eigenschaften. Diese begrenzten
Details erscheinen nur lokal in der Oberfläche; Aufzeichnungen enthalten keine
privaten Werte. Entfernte Rückmeldungen behalten die bisherige wertfreie
Erlaubnisliste und können keinen Fähigkeitskontext einschleusen.

Regeln behalten ihre Kennungen beim Bearbeiten. Kopieren erzeugt eine neue
protokollkompatible Kennung und schaltet die Kopie aus. Frühe unvollständige
D2-Entwürfe bleiben lesbar; ihre unbeschränkten UUID-Kennungen und unvollständigen
Inhalte können am strengeren Schema scheitern. Kopiere einen solchen Entwurf,
vervollständige die Kopie im Editor und lösche den alten unvollständigen Eintrag
vor dem Export ausdrücklich. Kein automatisches Umschreiben von Kennungen
verändert bestehende Verweise.

Regeln erlauben bis zu acht Auslöser, sechzehn Bedingungen und sechzehn
Aktionsschritte. Bis zu 32 Aktionsfolgen enthalten nur einzelne Aktionen ohne
Unteraufrufe. Auflösung, fehlende Verweise und zusammengefasste Wartezeiten von
Aufruf und erstem Schritt werden geprüft. Aufgelöste Pläne bleiben bei höchstens
sechzehn Schritten und jede wirksame Wartezeit bei höchstens 86.400 Sekunden.
Referenzierte Aktionsfolgen können nicht gelöscht werden. Änderungen an einer
Aktionsfolge prüfen auch betroffene Aufrufer. Namen, Kennungen, Reihenfolge,
Wiederauslöse-/Neustartrichtlinien und Partnerdeklarationen bleiben ausdrückliche
Daten.

<a id="input-preservation-and-conflicts"></a>

## Eingabeerhalt und Konflikte

Jeder Designerbefehl benennt System, Projektgeneration und eine Prüfsumme des
Entwurfs samt relevantem Katalog/Topologie/Freigaben. Geänderter Stand lehnt eine
alte Editoranfrage ab. Begrenzte Wiederholungserkennung über Anfragekennungen
verhindert doppelte lokale Änderungen. Erfolgreiche Bearbeitung erhöht nur die
lokale Revision. Alle Projektänderungen verwenden weiterhin die vorhandenen
Größenprüfungen, Prüfungen auf externe Dateiänderungen und atomaren Speicherungen.

Sprach-/Designwechsel und Hintergrundlesen erhalten den offenen Editor.
Temporärer Desktop-Editorzustand ist an Projekt/System gebunden und übersteht
Renderer-Neuladen innerhalb dieser App-Sitzung. Übernehmen oder Abbrechen löscht
ihn. Ein offener Editor blockiert Projektspeicherung und wird unabhängig von
unfertigen Projekteinstellungsformularen bei Schließen/Verwerfen berücksichtigt.
Dies verspricht keine Wiederherstellung nach App-Neustart. Systemansichten
halten getrennte Auswahl-/Suchzustände. Ein modaler Editor bindet sein
ursprüngliches System und kann nicht auf die Ersatzgeneration eines anderen
Projekts angewendet werden.

<a id="symcon-draft-import-and-export"></a>

## Symcon-Entwurfsimport und -export

Öffne **Entwurf importieren und exportieren**. Ziel ist das im gemeinsamen
Designer aktuell gewählte System. Nutze dessen lokale Ansicht für Dateiimport/
-export oder kopiere den gespeicherten Stand in einen lokalen Entwurf. Native
Dateiauswahl im Hauptprozess wählt alle Dateien; Pfade und Dateivorgänge werden
über Renderer-IPC nicht bereitgestellt.

Import akzeptiert ein einzelnes UTF-8-YAML-1.2- oder JSON-Konfigurationsdokument,
einschließlich des im Symcon-Editor gezeigten YAML-Entwurfs. Es ist weder ein
Symcon-Kernel-Migrationsarchiv noch Ereignisobjekt- oder native
Variablenberechtigungsexport. Nicht unterstützte Felder und Symcon-Verweise werden
abgelehnt. Benachbarter Klon oder laufende Symcon-Installation sind nicht nötig.
Quellexporte privat und außerhalb von Repositories halten.

Vor Ersetzung zeigt ein nativer Dialog bisherige/eingehende Regelanzahlen,
Aktionsfolgen- und Freigabeanzahlen sowie die Richtlinie für ausgeschalteten
Import. Eine getrennt gewählte private `.z2ma`-Projektsicherung ist verpflichtend.
Abbrechen oder fehlgeschlagene Sicherung lässt den Entwurf unverändert.
Eingehende Regel-/Aktionsfolgenkennungen und Aktionsreihenfolge bleiben erhalten;
eingehende Regeln sind ausgeschaltet. Gespeichertes YAML/Prüfsumme und entfernter
Betrieb werden nicht ersetzt. Export erzeugt YAML aus der lokalen Konfiguration,
prüft gesamtes Schema und Aktionsfolgenverweise und kann den aktiven Projektpfad
nicht überschreiben. Bestehende Exportziele erhalten eine `.bak` über den
gemeinsamen atomaren Schreiber.

Import und Export sind auf 1 MiB begrenzt. Doppelte Schlüssel, Aliase, mehrere
Dokumente, unbekannte Tags sowie unsichere/private Felder werden abgelehnt.
Diese Prüfungen belegen ein unterstütztes lokales Dokument, keine vollständige
Geräte-/Laufzeitgültigkeit. Offline-Importe können Geräte enthalten, die im
aktuellen Katalog fehlen; spätere Gerätebearbeitung und D5-Übertragungsprüfung
müssen diese prüfen. Ersetzen/Importieren lokaler Daten sendet kein MQTT und
speichert das aktive Projekt nicht automatisch.

Schritt 5 zeigt Regel-, eingeschaltete Regel- und Aktionsfolgenanzahlen für
lokalen Entwurf und gespeicherten Stand getrennt, auch in der gespeicherten
Ansicht. Ihre Revisionszähler sind unabhängig. Die verpflichtende Sicherung vor
Import enthält den bisherigen Entwurf; ihre Auswahl ändert das Speicherziel des
aktiven Projekts nicht. Speichere nach dem Import das Projekt, um den neuen
Entwurf zu erhalten. Regressionstests übernehmen zwei Ersatzregeln einschließlich
eines 30-Sekunden-Auslösers für einen falschen Sensorzustand, speichern und öffnen
dann über einen neuen Projektdienst erneut. Der alte Entwurf bleibt in der
Sicherung, eingehende Kennungen/Zeiten erhalten sich, und ausgeschaltete lokale
Schalter bleiben von gespeicherten Freigaben getrennt.

<a id="schema-ownership-and-evidence"></a>

## Schemaherkunft und Nachweise

Die Anwendung übernimmt das maßgebliche Schemaartefakt aus
`Symcon_Z2MAutomations/libs/z2m/automations.schema.json` auf Commit
`369e2808270e2d1eedb9f6bd932ac9250daf5a3c`. Es ergänzt ein optionales
`system`-Basistopic in Gerätewertbedingungen. Herkunft und SHA-256 stehen in
`apps/desktop/schema/provenance.json`; Build und Tests prüfen die Integrität.
Es ist kein getrennt bearbeitbarer Laufzeit-/Schemafork. AJV 8.20.0 prüft das
draft-07-Schema ohne Typumwandlung/Entfernung; YAML 2.9.1 übernimmt begrenzten
privaten Dateiaustausch. Beide laufen im Hauptprozess und sind in der Sperrdatei
festgelegt. Keine Abhängigkeit gelangt in gemeinsamen Browserdesigner oder
Preload.

Die 53-Test-Suite umfasst veraltete/idempotente lokale Schreibvorgänge,
fehlerhaftes Schema und Werte, Zeitzonen, Zugriffsrichtung, Szenenendpunkte,
gerichtete Partnerfreigaben, Auflösung/Löschen von Aktionsfolgen, begrenzte IPC,
privates YAML, abgebrochenen Import, Pflichtsicherung, erhaltenen gespeicherten
Stand und Schemaherkunft. Electron-Smoke ergänzt echte Bearbeitung über
Hauptprozess/Preload/Renderer, Sprachwechsel, Wiederherstellung temporärer Eingaben
nach Renderer-Neuladen, Übernehmen eines Entwurfs und Speichern einer
Szenenfolge. Der unabhängige MQTT-Partner prüft, dass der gesamte Ablauf nur
Leseanfragen sendet. DE-/EN-Kataloge, Typen, Integrität und sechs
Größen-/Designlayouts werden geprüft.

Lokal unter Windows bestand `npm run verify` alle 53 Tests sowie Typ-/Katalog-/
Integritätsprüfungen. `npm run smoke`, `npm run make`, `npm run smoke:packaged`,
`npm run pack:designer` und `git diff --check` bestanden. Quell- und
Paket-Electron-Smoke bestanden den kombinierten D1–D4-Ablauf. Die Paketprüfung
bestätigte alle 51 Produktionsmanifeste einschließlich Anwendung.
[CI-Lauf 42553084613](https://github.com/Burki24/Z2M-Automations/actions/runs/42553084613)
schloss D4-Plattform-CI für Commit `dae69b8` ab. Windows bestand 53 Tests,
Ubuntu 24.04 52 mit übersprungener reiner Windows-Sperrprüfung. Beide bestanden
nativen Paketbau und Quell-/Paket-D4-Smoke. Tatsächliche native Dialogbedienung,
installiertes Ubuntu, 26.04/Wayland und echtes Z2M-/Symcon-Zusammenspiel bleiben
getrennte Abnahmen. D5 umfasst weiterhin frische entfernte Validierung,
Erweiterungsartefakte/-installation und Speichern; D6 umfasst Aktivierung und
Geräte-/Laufzeitsteuerung.
