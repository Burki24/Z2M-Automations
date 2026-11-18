<a id="d2-local-projects-drafts-and-protected-credentials"></a>

# D2: lokale Projekte, Entwürfe und geschützte Zugangsdaten

**Deutsch | [English](D2.md)**

Stand: Umsetzung und Plattform-CI sind seit 2026-11-08 abgeschlossen. Die native
Ubuntu-Abnahme für Secret Service und Dialoge bleibt offen. D2 kontaktiert weder
Broker noch Symcon-Instanz oder Gerät. Spätere lesende Verbindungen beschreibt
[D3](D3_DE.md).

<a id="user-workflow"></a>

## Benutzerablauf

Öffne **Lokales Projekt**, erstelle ein Projekt oder öffne eine `.z2map`-Datei
bzw. eine ältere `.z2ma`-Datei über die native Dateiauswahl. Die anfänglichen
synthetischen Beispiele sind eine getrennte Ansicht; ein neues Projekt startet
ohne Broker und Systeme.

1. Übernimm einen Projektnamen.
2. Ergänze einen Broker mit Host, Port und TLS. Dies speichert nur
   Verbindungseinstellungen.
3. Ergänze Systeme, jeweils mit einem Broker und einem eigenen Basistopic. Ein
   Projekt unterstützt höchstens acht Broker und acht Systeme; Systeme dürfen
   einen Broker teilen.
4. Erstelle, benenne, kopiere oder lösche lokale Regelentwürfe für ein ausdrücklich
   gewähltes System. Neue Entwürfe und Kopien sind ausgeschaltet. Löschen muss
   bestätigt werden.
5. Speichere das Projekt, speichere unter anderem Namen oder exportiere eine
   portable Kopie.
6. Wähle ausdrücklich betriebssystemgeschützte oder reine Sitzungsspeicherung
   und importiere über die Systemauswahl eine private Zugangsdaten-JSON-Datei.
   Die Anwendung verbindet sich nicht automatisch. Nur der Hauptprozess liest
   diese Datei; der Designer erhält weder Benutzernamen noch Passwort.

Die private Zugangsdaten-Datei muss genau zwei Zeichenkettenfelder `username`
und `password` enthalten; ein leerer Benutzername ist erlaubt. Sie ist auf
16 KiB begrenzt und muss außerhalb von Repository und portablem Projekt bleiben.
Der Import lässt das Original unverändert; dessen weitere Aufbewahrung oder
Entfernung liegt beim Benutzer. Im normalen Betrieb erzeugt die Anwendung nie
eine Zugangsdaten-Datei im Klartext.

Übernehmen-Schaltflächen übernehmen Formulare ins Projekt im Arbeitsspeicher.
Speichern schreibt übernommene Änderungen auf Datenträger. Unfertige Formulare
blockieren Speichern/Export, überstehen Sprach-/Ansichtswechsel und lassen sich
ausdrücklich verwerfen. Nicht geheime unfertige Felder überstehen auch das
Neuladen des Renderers in begrenztem Sitzungsspeicher. Passwörter werden dort
nie abgelegt. Schließen, Neuerstellen oder Öffnen mit ungespeicherter Arbeit
fragt vor deren Verwerfen nach.

Vorhandene Regeln und Aktionsfolgen behalten ihre Kennungen und Ein-/Ausschalter
beim Speichern und erneuten Öffnen. Der vollständige Geräte-/Zeit-/Bedingungs-/
Aktionseditor und Symcon-Entwurfsimport gehören zu D4. D2 erstellt bewusst
unvollständige ausgeschaltete lokale Entwürfe, keine geprüften
Laufzeitkonfigurationen. Der gespeicherte Z2M-Stand bleibt unbekannt, der Betrieb
während D2 vollständig unverbunden.

<a id="portable-format-and-file-operations"></a>

## Portables Format und Dateivorgänge

Die UTF-8-JSON-Hülle enthält `format: "z2m-automations-project"`, `version: 2`
(Format 1 bleibt lesbar), eine stabile Projektkennung, Namen sowie Broker- und
Systemdatensätze. Jedes System hat einen eigenen Konfigurationsentwurf und
optional eine bekannte Basisrevision mit SHA-256-Prüfsumme. Neue Systeme haben
keine Basis. Änderungen an Broker-Endpunkt, Broker-Zuordnung oder Basistopic
machen die zugehörige Basis ungültig und erhalten lokale Entwürfe.

Die Prüfung lehnt nicht unterstützte Formatversionen, zusätzliche Hüllenfelder,
ungültige Verweise, doppelte Systemkennungen/-bindungen, zu große oder fehlerhafte
Dateien, unsichere JSON-Schlüssel und Zugangsdaten-/Sitzungs-/Symcon-Verweisfelder
ab. Dateien sind auf 8 MiB begrenzt; auch Verschachtelung, Sammlungen und
Zeichenketten sind begrenzt. Diese Projektprüfungen ersetzen keine spätere
Z2M-Schema-/Fähigkeitsprüfung.

Schreibvorgänge verwenden eine eindeutige temporäre Nachbardatei, schreiben sie
vollständig auf den Datenträger und benennen sie dann um. Vor Ersetzung wird die
vorherige Datei als `.bak` gesichert. Fehler erhalten den Entwurf im Speicher;
temporäre Ausgaben werden bereinigt. Speichern vergleicht die aktuelle
Dateiprüfsumme mit der geöffneten/gespeicherten Version und lehnt externe
Änderung oder Löschung ab. Speichern unter kann nach einem Konflikt eine eigene
lokale Version erhalten. Export ändert weder aktiven Pfad noch den
Speicherstatus von Entwürfen. Export auf den aktiven Pfad wird abgelehnt, damit
Konfliktprüfungen nicht umgangen werden. Für ausdrücklich gewählte Ziele gilt
die normale Überschreibbestätigung der Betriebssystemauswahl.

Wiederherstellen liest nach Bestätigung die letzte `.bak` als geänderte lokale
Arbeit in den Speicher. Es ersetzt weder die aktuelle Datei noch verändert es
Z2M. Sicherungen sind private lokale Projektdaten und dürfen nicht eingecheckt
werden. Die Prüfsummenprüfung ist optimistische Konflikterkennung, keine
verteilte Sperre gegen andere, nicht kooperierende Schreibprogramme.

<a id="credential-boundary"></a>

## Grenze für Zugangsdaten

Der Hauptprozess verwaltet den Tresor im Benutzerverzeichnis der Anwendung.
Datensätze nutzen gehashte Projekt-/Brokerkennungen und enthalten vom
Betriebssystem verschlüsselte Werte, gebunden an Brokerkennung, Host, Port und
TLS-Einstellung. Ein Datensatz kann nicht für ein anderes Projekt oder einen
anderen Endpunkt wiederverwendet werden. Zugangsdaten-IPC akzeptiert nur
Brokerkennung und Speichermodus. Dateiauswahl, Auswertung und Verschlüsselung
bleiben im Hauptprozess. Der Designer hat weder Passwortfelder noch eine
Zugangsdaten-Lesefunktion. Der Hauptprozess liefert nur den Speicherstatus.
Projektexporte und Diagnose enthalten weder Zugangsdaten noch private
Zertifikatsschlüssel.

Windows verwendet Electrons asynchrone safeStorage-API auf DPAPI-Basis. Linux
benötigt einen verfügbaren Schlüsselbund und ein ausdrücklich erkanntes Backend;
`basic_text` und unbekannte Backends werden abgelehnt. Im festgelegten Electron
45 belegt allein asynchrone Verfügbarkeit keinen Schlüsselbundschutz. Der
Linux-Adapter nutzt deshalb die abgesicherte synchrone API samt Backendprüfung
und aktiviert niemals Klartextmodus. Diese Kompatibilitätsentscheidung muss vor
dem Wechsel zu Electron 46 neu geprüft werden, in dem die synchrone API
entfernt werden soll.

Nicht verfügbarer oder gesperrter Schutz scheitert ohne Schreiben einer
Ersatzdatei. Der Benutzer kann ausdrücklich Sitzungsspeicherung wählen. Diese
entfernt ältere dauerhafte Broker-Zugangsdaten. Sitzungswerte verschwinden bei
Neustart, Öffnen/Neuanlegen eines Projekts oder Wiederherstellen. Ausdrückliches
Entfernen leert beide Speicher. Geschützte Datensätze überstehen App-Neustarts,
fehlen aber bewusst in portablen Exporten. Betriebssystem-Benutzertrennung
schützt nicht vor sämtlichen anderen Apps desselben Benutzers.

Alle Dateipfade stammen aus Systemdialogen des Hauptprozesses. Die Schnittstelle
bietet feste Projekt- und Zugangsdatenbefehle, keine beliebigen Dateisystem-,
Shell-, MQTT- oder Geheimnis-Lesevorgänge. Der Hauptprozess serialisiert Projekt-
und Tresorvorgänge. Diagnose nutzt die vorhandene begrenzte Bereinigung mit
festen Ereignis-/Vorgangsschlüsseln und Anfragekennungen. Projektnamen, Hosts,
Dateipfade, Dateiinhalte und geheime Werte werden nicht aufgezeichnet.

<a id="evidence-and-remaining-checks"></a>

## Nachweise und verbleibende Prüfungen

Die Suite mit 28 Tests prüft Projektspeicherung und erneutes Öffnen, nicht
unterstützte/zu große/fehlerhafte Eingaben, Eigentums-/Verweisgrenzen, Sicherungen,
Wiederherstellung, Export, Konflikte, Bereinigung nach fehlgeschlagener Ersetzung,
eine echte exklusive Windows-Dateisperre, Endpunktänderungen, Zugangsdatenisolation
und -verschlüsselung, fehlenden/Klartext-/gesperrten Schlüsselbund, ausdrücklichen
Sitzungsmodus, Geheimnisentfernung, begrenzten Zugangsdatenimport und
IPC-Ablehnung. Schutztests verwenden synthetische authentifizierte
Verschlüsselung; sie sind keine native Linux-Schlüsselbundabnahme.

Der echte Electron-Smoke-Test prüft neue Formulare, Eingabeerhalt bei Sprach-/
Ansichtswechsel, ausgeschaltete Entwürfe/Kopien, Speichern/Öffnen/Wiederherstellen
über den Hauptprozessdienst, Zugangsdatenimport ausschließlich im Hauptprozess,
Sitzungszugangsdaten, echten Betriebssystemschutz sofern verfügbar,
Tastaturfokusfolge und Mausradscrollen. Er prüft auch sechs Größen-/
Designkombinationen und Bildschirmaufnahme. Dateiauswahl und Bestätigungen sind
im Smoke-Test auf synthetische Dateien im temporären Testprofil festgelegt;
Produktion verwendet native Dialoge. Dies belegt keine manuelle native
Dialogabnahme.

Windows-Build, Typ-/Katalog-/Integritätsprüfungen, alle 28 Tests, Electron-Smoke,
`npm run package`, Smoke der gepackten App und `npm run pack:designer` bestanden
lokal. Der Renderer-Neuladetest bestätigt auch die Wiederherstellung unfertiger
nicht geheimer Formulareingaben. Erste native Eingabetests zeigten eine
Fokus-/Scroll-Synchronisierung im Testgerüst; dieses fokussiert jetzt Webinhalte,
wartet auf Eingabeverarbeitung und setzt Zeiger sowie Erlaubnis für Mausradscrollen
ausdrücklich. Quell- und Paket-Smoke bestanden; Ubuntu benötigt weiterhin
CI-Nachweise.

`npm run make` scheiterte lokal in den Squirrel-/NuGet-Werkzeugen: zunächst
`WriteEntryTo or OpenEntryStream can only be called once`, anschließend
`Cannot access a closed stream`. Beide Versuche stellten die Anwendung
erfolgreich bereit. Das Systemlaufwerk hatte weniger als 100 MiB frei;
prozesslokale TEMP/TMP und SQUIRREL_TEMP auf E: ergaben keinen erfolgreichen
Installerbau. Die genaue Werkzeugursache bleibt ungeklärt. Es wird weder
Installererfolg noch neue D2-Plattformabnahme behauptet; die Paketkonfiguration
wurde nicht verändert. Der spätere CI-Lauf
[42481799451](https://github.com/Burki24/Z2M-Automations/actions/runs/42481799451)
bestand für Quelle `29005ae875a502b834423eaeb7dc7fee21a724a0`: Windows alle
28 Tests, Ubuntu 24.04 27 mit übersprungener reiner Windows-Sperrprüfung. Beide
Jobs beendeten nativen Paketbau, Electron-Smoke und Artefaktupload. Dies schließt
D2-Umsetzung und CI einschließlich des vom lokalen Werkzeugfehler offen
gelassenen Installer-Baunachweises ab. Native Linux-Secret-Service-Sperrung und
-Entsperrung, echte Desktop-Dateiauswahl, Wayland/X11, Ubuntu 26.04 und Abnahme
installierter Apps bleiben getrennte Nachweise. Veröffentlichung, Signierung,
Live-Installation oder Geräteausführung gehören nicht zu D2.

Primärquellen: [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage),
[API-Verfügbarkeit in der festgelegten Version](https://github.com/electron/electron/blob/v45.2.3/shell/browser/api/electron_api_safe_storage.cc),
[native Dialoge](https://www.electronjs.org/docs/latest/api/dialog).
