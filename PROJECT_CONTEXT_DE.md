<a id="project-context-z2m-automations"></a>

# Projektkontext: Z2M-Automations

**Deutsch | [English](PROJECT_CONTEXT.md)**

Stand: 2026-11-17. Repository Burki24/Z2M-Automations; Arbeitsbranch dev,
Hauptbranch main. Produktausgaben: Z2M-Automations for Windows / for Linux.

<a id="current-state"></a>

## Aktueller Stand

Der Desktop liefert vollständige Offline-HTML-Handbücher auf Deutsch und Englisch
mit ihren 32 sprachlich passenden Abbildungen mit. Hilfe/F1 öffnet das Kapitel zum
aktuellen Schritt in einem getrennten lokalen Fenster mit Inhalt, Suche und
Bildvergrößerung. Lokalisierte Tooltips per Maus und Tastatur erklären wichtige
Funktionen, ohne Betriebswarnungen auszublenden. Die regulären Quell-, Paket- und
Installationstests prüfen die Hilfe bildfrei; die Paketprüfung kontrolliert alle
Handbuchdateien anhand ihres Prüfsummenmanifests.

Der geführte Windows-Installer verwendet das bestehende App-Icon in einer eigenen
Start- und Abschluss-/Deinstallationsseitenleiste sowie einen größeren linken
Logokopf auf den übrigen Seiten. Native deutsche/englische Texte,
Installationsbereich/Administratorrechte und Ordnerwahl bleiben standardmäßig.
Eingecheckte sprachneutrale BMP-Grafiken haben ein optionales
Windows-Erzeugungsskript; keiner der Plattformbuilds erhält eine zusätzliche
Erzeugungsabhängigkeit. Siehe [Windows-Installation](docs/WINDOWS_INSTALLER_DE.md).

Alle eigenen Markdown-Dokumente liegen jetzt als vollständige englisch-deutsche
Paare vor, einschließlich Haupt-README, technischer Anleitungen,
Meilensteinnachweise und ADRs. Englisch bleibt maßgeblich. Gegenseitige Sprachlinks
und eine Dokumentationsübersicht erschließen beide Fassungen. Die bildfreie
Pflichtprüfung `check:docs` läuft lokal und in der Desktop-CI und prüft Paare,
Navigation, lokale Links und die Zuordnung der Handbuchbilder. Siehe
[Dokumentationsübersicht](docs/README_DE.md).

Die Anwenderdokumentation umfasst jetzt aufeinander abgestimmte englische und
deutsche Handbücher mit 20 Kapiteln und jeweils 16 Aufnahmen ausschließlich der
App-Oberfläche, bezogen auf 0.120.0. Sie behandeln Ersteinrichtung, Beispielregeln,
Entwurfsabgleich und Dateien, Wiederaufnahme nach Übertragung, Freigaben,
netzübergreifende Empfänger, Updates und Fehlerbehebung. Die Aufnahmen verwenden
isolierte fiktive Daten und den echten gemeinsamen Renderer. Sie belegen weder
Ergebnisse an einem echten System noch native Ubuntu-Dialoge. Siehe
docs/USER_GUIDE.md, docs/USER_GUIDE_DE.md und docs/images/README.md.

Die RC1-Vorbereitung behebt die acht mittleren Audit-Befunde der Build- und
Paketabhängigkeiten durch ASAR-/glob-Updates der jeweiligen Projekte und eine
versionsgebundene minimatch-Überschreibung. Laufzeitabhängigkeiten bleiben auf
feste Versionen gesetzt. Die CI-Matrix prüft jetzt vor dem Paketbau den gesamten
Abhängigkeitsbaum und erzeugt nach den Abnahmeprüfungen Prüfsummen für Installer
und Designer, gebunden an Commit und Version. RC1 benötigt den Quellcommit und
Push des Eigentümers sowie eine frische Matrix. Die aktuellen lokalen Metadaten
sind keine endgültige Kandidatenkennung. Siehe [RC1-Vorbereitung](docs/RC1_DE.md).

Die gemeinsame geführte Übertragung prüft Entwurf und erforderliche
Partnerkataloge vor dem Betriebsstopp. Fehlen Partnerdaten, läuft der Betrieb
unverändert weiter; Bedingungen und Aktionsfolgen sind eingeschlossen.
Abschließende Validierung und Speicherprüfungen bleiben bestehen. Die
Desktop-Übertragung prüft frische Partnerdaten bereits vor dem Stopp, auch nach
der Bestätigung. Regressionstests sichern diese Grenze ab.

Bei vorübergehend blockierter Modulansicht wird jetzt eine begrenzte
GET-Wiederholung mit übersetzter Warteanzeige verwendet. Innerhalb von zehn
Sekunden beginnen höchstens fünf Wiederholungen. Bisherige Lesewarnungen bleiben
während der Wiederherstellung ausgeblendet. Steueranfragen werden nicht erneut
gesendet; dauerhafte Fehler bleiben sichtbar. Browser und Kachel prüfen mehrere
Lesefehler nach dem Speichern sowie deutsche und englische Wartezustände ohne
Bildaufnahmen.

Lesevorgänge bei bestehender Verbindung gleichen das frische Z2M-Dokument, lokale
Arbeit und den tatsächlichen Inhalt der zuletzt akzeptierten Basis ab.
Unabhängige Ergänzungen, Änderungen und Löschungen werden zusammengeführt;
abweichende Versionen erfordern eine Entscheidung je Eintrag. Offene Eingaben
bleiben erhalten. Vor der Übernahme wird eine lokale Wiederherstellungssicherung
angelegt. Neue Netze erfordern ein erstes Einlesen oder die ausdrückliche Wahl
der Offline-Bearbeitung. Lese- und Dateivorgänge steuern den Z2M-Betrieb nicht.

Die Standard-Projektendung ist `.z2map` mit Format 2; Format 1 und `.z2ma`
bleiben lesbar. Gemeinsame `.z2mad`-Dateien enthalten ausgewählte Regeln,
benötigte Aktionsfolgen und die Quellkennung. Beide Adapter unterstützen das
Hinzufügen von Dateien zu einem gewählten bestehenden Netz. Native
Projektsicherungen enthalten zugeordnete Entwürfe ohne Broker-Zugangsdaten oder
native Berechtigungen. Siehe [ADR 0006](docs/adr/0006-draft-reconciliation-and-portable-files_DE.md).

Die Katalogkorrektur trennt typisierte Geräteeigenschaften vom bisherigen Limit
der Erweiterung von 1.024 Auswahleinträgen. Auch später aufgeführte Fenstergriffe
und Sensoren behalten lesbare Zustände, Aufzählungswerte und numerische
Einheiten. Zu große Kataloge werden ausdrücklich abgelehnt, statt Geräte
stillschweigend wegzulassen. Quellarten filtern Kanäle und keine Gerätenamen:
Taster können Batteriemesswerte anbieten, Radarsensoren die Beleuchtungsstärke.
Das gemeinsame Formular erklärt diesen Unterschied jetzt in beiden Sprachen.

Die App enthält die maßgebliche Erweiterung `0.2.4`, Build `3f8a06859635`, aus
Symcon-Commit `2db85997a2a317bee6c59e96d78c050b8c579095` mit geprüften
Artefakt- und Schemaprüfsummen. Bestehende Installationen benötigen ein
ausdrückliches Erweiterungsupdate und ein erneutes Einlesen der Gerätedaten, um
die korrigierten Metadaten zu erhalten. Es wurde kein echtes System verändert.

Schritt 8 bietet jetzt in App, Symcon-Browserdesigner und Kachel die Option
**Bisherigen Betrieb anschließend wieder aufnehmen**, die bei jeder Übertragung
zunächst abgewählt ist. Nur ein zuvor bestätigt aktiver Betrieb darf nach
erneuter Validierung, geprüftem Speichern und unabhängiger frischer
Status-/Rückleseprüfung fortgesetzt werden. Geprüfte Freigaben und die bisherige
Neustartpräferenz bleiben erhalten; neue ausgeschaltete Regeln bleiben aus.
Unterbrochene Einzelläufe und unklare Steueranfragen werden niemals wiederholt.
Die gemeinsame Umsetzung wird mit festgelegter Version in Symcon übernommen.
Eine Erweiterungs-/Schemaänderung oder Installation an einem echten System ist
nicht erforderlich.

Der gemeinsame Designer erklärt jetzt den erforderlichen Empfängerbetrieb für
systemübergreifende Bedingungen und Aktionen einschließlich Aktionsfolgen.
Bestätigt gestoppte, unbekannte und aktive Ziele haben getrennte Text- und
Farbanzeigen sowie einen direkten Wechsel zur Betriebsseite mit Rückweg.
Startvorbereitung und Vorschau der gespeicherten Regelnamen machen die
Aktivierung ausdrücklich. Desktop-Empfänger mit gespeicherten Partnerfreigaben
können ohne eingeschaltete lokale Regeln aktiviert werden. Es wurden weder
automatische Mehrsystemsteuerung noch Laufzeit-/Schemaänderungen eingeführt.
Siehe [D6](docs/D6_DE.md).

Die lokale Prüfung besteht 230 Tests; zwei native Linux-APT-Prüfungen werden
unter Windows übersprungen. Hinzu kommt die vollständige bildfreie
Oberflächenprüfung des Erweiterungsupdates mit Empfängernavigation,
Desktop-Farbzuständen und Startbedienung für reine Partnerempfänger.
Auch der vollständige bildfreie Electron-Smoke-Test besteht: mit noch nicht
übermittelten lokalen Regeln, automatischem Verbindungsabgleich, Bearbeiten,
Export, erneutem Öffnen und Speichern beim Schließen. Die fest übernommene
Symcon-Anpassung besteht ihre vollständige Offline-Suite mit 279
JavaScript-Tests, bildfreier Browser-/Kachelabnahme und Struktur-/Stilprüfungen.
Neue Plattform-CI und praktische Abnahme nach einem Update bleiben getrennt.

Der Eigentümer hat die drei Arbeitsabläufe mit App 0.99.0 erfolgreich abgenommen.
Der abgenommene nummerierte Arbeitsbereich wird jetzt über ein versioniertes
Paket mit dem Symcon-Browserdesigner und der nativen Kachel geteilt. Native
Verbindungen, Speicherung, Berechtigungen und Transport bleiben unter
Symcon-Kontrolle. Die eigenständige App behält ihre eigenen Projekt-,
Zugangsdaten- und Übertragungsdienste. Siehe
[ADR 0005](docs/adr/0005-shared-guided-workspace_DE.md). Die native Abnahme dieser
neuen Symcon-Oberfläche nach einem Modulupdate bleibt von der Desktop-Abnahme
getrennt.

D0-Lokalisierung ist umgesetzt. D1 bietet eine gemeinsame Grundlage mit
TypeScript/Electron/Forge: Offline-Renderer, zwei synthetische Systeme, streng
begrenzte Preload-IPC, lokale Dateien, DE/EN-Wechsel und begrenzte, ausdrücklich
gestartete Diagnose. D2 umfasst portable lokale Projekte, Entwürfe je System,
Sicherung/Wiederherstellung, Konflikterkennung, native Dateidialoge und einen
getrennten betriebssystemgeschützten bzw. sitzungsbezogenen Zugangsdaten-Tresor.
D3 ergänzt ausdrückliche MQTT-/TLS-Verbindungen im Hauptprozess, zugeordnete
lesende Status-/Editoranfragen, Geräte-/Szenenkataloge und getrennte Sicherungen.
D4 verbindet den gemeinsamen Regel-/Aktionsfolgeneditor mit lokalen Entwürfen,
ergänzt Schema-/Fähigkeitsprüfungen im Hauptprozess, gerichtete Entwurfsfreigaben
und privaten YAML-/JSON-Import/-Export mit vorgeschriebener Ersetzungssicherung.
D5 ergänzt ausdrückliche Erweiterungsinstallation, Validierung und Speicherung
ausgeschalteter Regeln mit privaten Sicherungen und unabhängiger
Statusbestätigung. Siehe docs/D5.md. D6 ergänzt bestätigte Aktivierung, Stopp,
Einzelläufe und Wiederherstellung nach Neustart für gespeicherte Regeln mit
zugeordneten Laufbeobachtungen. Siehe docs/D6.md. Die gesamte Desktop-Anwendung
verwendet nach ausdrücklicher Eigentümerentscheidung PolyForm Noncommercial
1.0.0; vorhandene Designer-Hinweise bleiben erhalten.

Die maßgebliche Oberfläche liegt jetzt in packages/designer/src. Symcon
übernimmt ein ausdrücklich versioniertes Archiv mit Herkunftsnachweis und
Dateiprüfsummen. Kachel, Hilfsfunktionen, nativer Adapter und Z2M-Erweiterung samt
Schema bleiben in ihren ursprünglichen Repositories. Es gibt weder eine
unabhängig bearbeitbare Oberflächenkopie noch eine Laufzeitabhängigkeit von einem
benachbarten Repository.

Windows-Kompilierung, echter Electron-Smoke-Test und Test der gepackten App
haben bestanden; das Windows-Setup wurde ohne Signatur erstellt. Gemeinsame
Prüfungen decken strikte Typen, ungültige IPC/Ursprünge, lesende Isolation,
Diagnoseablauf und responsive Designs ab. Desktop-CI-Lauf 42472007945 bestand
unter Windows und Ubuntu 24.04 für Quelle
f878516f2c677d5f45780523313bc599068ab82f: alle 13 Tests, Paketbau, echter
Renderer-Smoke-Test, sechs Layout-/Designkombinationen, nicht leere Bildaufnahme
und Upload von Designer-Archiv und Artefakten. D1 ist für seine
Offline-Grundlage und CI abgeschlossen. Begrenzte Download-Wiederholungen, ein
gemeinsamer geprüfter Cache und Software-Rendering ausschließlich in der
Linux-CI behoben die zuvor beobachteten CI-Fehler dieses Laufs. Native
Ubuntu-Abnahme, 26.04 und Tests installierter Apps bleiben offen. Siehe docs/D1.md.
Es wurde kein echtes System kontaktiert oder verändert.

D2-CI-Lauf 42481799451 bestand unter Windows und Ubuntu 24.04 für Quelle
29005ae875a502b834423eaeb7dc7fee21a724a0 einschließlich Paketbau und Smoke-Test.
D3-CI-Lauf 42491457811 bestand unter Windows und Ubuntu 24.04 für Quelle 1ebaead.
Die NSIS-Ordnerauswahl bestand beide Plattformen in Lauf 42494004402. Der
Eigentümer bestätigt das aktualisierte Windows-Setup; installiertes Ubuntu ist
noch nicht geprüft. D4 bestand Windows-/Ubuntu-CI in Lauf 42553084613, D5 beide
Jobs in Lauf 42557311324. Native Linux-Nachweise für Schlüsselbund und Dialoge
bleiben offen. Siehe docs/D2.md und docs/D3.md.

<a id="versioning-and-next-work"></a>

## Versionierung und nächste Arbeiten

Die Desktop-CI führt die Erzeugung der Anwendungsmetadaten jetzt als
Voraussetzung aus und übergibt den daraus resultierenden unveränderlichen Commit
an beide Plattformjobs. Dies ersetzt die parallele Versionierung und
Paketerstellung, die Installer mit einer älteren Version erzeugen konnte.
Geprüfte Übergabe und Abbruchbedingungen beschreibt die
[Versionierung](docs/VERSIONING_DE.md#build-order-and-immutable-checkout). Lokale
Git-Testdaten decken Wiederholungen und gleichzeitige Quelländerungen ab. Ein
neuer GitHub-Lauf nach dem Push des Benutzers bleibt zur Bestätigung der
vollständig geordneten Pipeline erforderlich.

Die automatische Metadatenaktion in Symcon_ModuleCI/main funktioniert.
Lauf 42367039704 bestand; Bot-Commit
744fc251503047068bed507a6f84cd4457cf6cb8 setzte version.json auf 0.2.0.
Der folgende D1-Quellpush erzeugte Metadatencommit
1d4f284274bc1f67dd7e24c788026f1eec6438b1 mit Version 0.3.0. Der damalige
Metadatencommit fb1d07c setzt nach D4 Version 0.14.0. Builds lesen diese
maßgeblichen Metadaten; nicht manuell erhöhen.

Die Arbeitsplanung steht in docs/DESKTOP_PLAN.md, die D1-Plattform-CI-Nachweise
in docs/D1.md. D2-Umsetzung und CI sind abgeschlossen. D3 mit lesendem MQTT
bestand seine Windows-/Ubuntu-CI, D4 mit lokaler Bearbeitung beide Plattformjobs.
D5-Übertragung bestand beide Jobs, D6-Betrieb beide Jobs in Lauf 42561493087.
D7 mit CI installierter Pakete und Desktop-Abnahme ist für Windows und Ubuntu
Desktop 24.04 unter Hyper-V abgeschlossen. Siehe docs/D7.md. Eingaben und
Systemtrennung sind durchgehend zu erhalten. Bestehende praktische Symcon-Tests
belegen keine Desktop-Abnahme. Ausschließlich der Benutzer erstellt Commits und
Pushes über GitHub Desktop.
