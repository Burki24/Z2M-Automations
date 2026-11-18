<a id="windows-installer-with-a-selectable-directory"></a>

# Windows-Installer mit wählbarem Ordner

**Deutsch | [English](WINDOWS_INSTALLER.md)**

Das Windows-Paket verwendet jetzt einen geführten NSIS-Installer über die fest
gesetzte Version `electron-forge-maker-nsis` 26.18.0. Dies ersetzt
Squirrel.Windows, dessen fester Installationspfad je Benutzer die gewünschte
Ordnerauswahl nicht erfüllte. Ubuntu verwendet weiterhin den bisherigen
Debian-Maker von Forge.

Setup besitzt eine eigene Startseite und passende Abschluss-/Deinstallationsgrafik:
ein großes App-Icon in einer warmen dunklen Seitenleiste links. Die
Zwischenschritte einschließlich Installationsbereich und Ordnerauswahl zeigen
links einen größeren Logokopf. Die Grafik enthält nur den Produktnamen und
passt dadurch zu Deutsch und Englisch; der Assistententext bleibt nativ
übersetzt. Native Schaltflächen, Installationsrechte und Ordnerauswahl behalten
ihr gewohntes Verhalten.

Die eingecheckten 24-Bit-BMP-Dateien unter `apps/desktop/installer` verwenden
die von NSIS empfohlenen Größen 150x57 für den Kopf und 164x314 für die
Seitenleiste mit proportionaler DPI-Skalierung. Erzeuge sie unter Windows aus
dem vorhandenen App-Icon mit `./scripts/build-installer-artwork.ps1` neu.
Das Skript zeichnet Grafiken ohne Bildschirmaufnahme. Windows-Builds nutzen
die eingecheckten Bitmaps; keiner der Plattformbuilds benötigt ein zusätzliches
Grafikwerkzeug oder einen PowerShell-Erzeugungsschritt.

Starte `Z2M-Automations-<version>-Windows-x64-Setup.exe`, wähle Deutsch oder
Englisch und anschließend die Installation für den aktuellen oder alle Benutzer.
Windows fordert für alle Benutzer die Administratorbestätigung an. Wähle einen
eigenen Installationsordner, beispielsweise `E:\Programs\Z2M-Automations`.
Die Installation für den aktuellen Benutzer läuft ohne erhöhte Rechte. Auf der
Abschlussseite lässt sich über ein übersetztes Kontrollkästchen die App starten;
wähle es ab, um ohne Start zu beenden. Setup erstellt im gewählten Geltungsbereich
einen Startmenüeintrag `Z2M-Automations`. Windows führt die installierte App zur
Deinstallation auf. Diese erhält Anwendungsdaten und Zugangsdaten.

Im gewählten Ordner liegen Anwendungsdateien und Deinstallationsprogramm.
Einstellungen und geschützter Zugangsdaten-Tresor bleiben im Windows-Benutzerprofil
auf C:. Portable Projekte werden am beim Speichern gewählten Ort abgelegt.
Temporäre Windows- und Setup-Dateien benötigen weiterhin freien Platz; das
Verschieben der Anwendung beseitigt diesen Bedarf nicht. Bei kleinem Systemlaufwerk
kann Setup aus PowerShell mit temporären Pfaden ausschließlich für diesen
Prozess gestartet werden:

~~~powershell
$setupTemp = 'E:\Temp\Z2M-Automations-Setup'
New-Item -ItemType Directory -Force $setupTemp | Out-Null
$env:TEMP = $setupTemp
$env:TMP = $setupTemp
& 'E:\path\Z2M-Automations-0.11.0-Windows-x64-Setup.exe'
~~~

Eine Squirrel-Installation wird nicht stillschweigend entfernt oder migriert.
Hat ein früherer Versuch eine App installiert, deinstalliere diesen Eintrag
ausdrücklich vor dem Wechsel der Installerfamilie. Ein fehlgeschlagener
Squirrel-Versuch belegt keine abgeschlossene Installation.

<a id="build-and-verification"></a>

## Bau und Prüfung

Verwende den normalen Befehl `npm run make`. Forge stellt die geprüften
Produktionsabhängigkeiten bereit; NSIS verpackt genau diesen vorbereiteten
Ordner. Anwendungs- und Installerversion stammen aus `version.json`, nicht der
Version des Quellpakets. Die feste Installer-Anwendungskennung lautet
`de.kneiseler.z2m-automations`. Build-Werkzeuge werden über die Sperrdatei auf
feste Versionen gesetzt; deren NSIS-/7-Zip-Downloads mit Integritätsprüfung
erfolgen beim Bauen. `setup:tools` ruft jetzt ausschließlich den geprüften
Electron-Download-Lebenszyklus auf. Weder automatische Installer-/App-Updates
noch Veröffentlichung sind aktiviert.

Der Konfigurationstest prüft Ordnerauswahl, Installationsbereich und erhöhte
Rechte für alle Benutzer, beide Sprachen, den Erhalt von Benutzerdaten sowie die
Übernahme der maßgeblichen Version. Lokal bestanden Windows `npm run verify`
mit 45 Tests, NSIS `npm run make` und der gepackte Electron-/MQTT-Smoke-Test.
Oberflächenautomatisierung war in dieser Sitzung nicht verfügbar. Eine echte
unbeaufsichtigte Installation für den aktuellen Benutzer in einen eigenen Ordner
auf E: gelang. Die SHA-256 der installierten ASAR entsprach der vorbereiteten
ASAR. Die installierte EXE bestand den vollständigen synthetischen
Electron-/MQTT-Smoke-Test. Die unbeaufsichtigte Deinstallation entfernte diese
Test-App und ihren Windows-Deinstallationseintrag. Diese Tests verwendeten
prozesslokale TEMP/TMP auf E:, keinen echten Broker und kein privates Projekt.
Die manuelle Abnahme der Ordnerdialoge und des übersetzten Assistenten bleibt
getrennt. Der neue Windows-/Ubuntu-CI-Lauf steht noch aus. Der Installer ist
nicht signiertes Entwicklungsmaterial, keine veröffentlichte Version.

Der deutsche Abschlusstitel benötigt bei normaler Assistentenbreite drei Zeilen.
Unsere kleine Datei `installer.nsh` reserviert diese Titelhöhe für Installation
und Deinstallation mit der unterstützten Dreizeileneinstellung von NSIS Modern UI.
Die mitgelieferte Übersetzung und der darunterliegende Inhaltsbereich bleiben
erhalten.

Prüfung der Gestaltung am 2026-11-17: Der tatsächliche Windows-Setup-Bau gelingt.
Ein getrennter Build mit isolierter Test-Anwendungskennung prüft dieselben
Grafiken/dieselbe Include-Datei und die nativen deutschen/englischen Start-,
Installationsbereichs- und Ordnerseiten ohne Installation. Die
Steuerelementmetadaten bestätigen geladene Seitenleiste mit 164x314,
linken Kopf mit 150x57, zwei Installationsoptionen, ein Ordnerfeld und keine
Überlappung zwischen Kopf und Titel. Es wird kein Fenster aufgenommen.
Abschluss-/Deinstallationsansicht sowie andere DPI- oder
Kontrasteinstellungen bleiben manuelle Abnahme; für diese reine
Windows-Darstellungsänderung lief kein Ubuntu-Build.
Das isolierte vollständige `npm run verify:local` besteht 248 Tests mit zwei
reinen Ubuntu-Auslassungen und den kompletten bildfreien Oberflächentest.
Der erste Lauf bestand alle Unit-Tests, erreichte aber die Frist
`load-workspace` des vorhandenen Oberflächentestgerüsts; die zeitliche Ursache
bleibt ungeklärt. Gemeinsame Renderer-Quellen oder Fristen wurden nicht verändert.

Primärquellen: [offizielle Forge-Integration](https://www.electron.build/v26/docs/features/electron-forge/)
und [NSIS-Optionen](https://www.electron.build/nsis/). Diese Entscheidung ersetzt
die ursprüngliche Squirrel-Paketwahl des Desktop-Plans, nicht die gemeinsame
Anwendungsarchitektur.
