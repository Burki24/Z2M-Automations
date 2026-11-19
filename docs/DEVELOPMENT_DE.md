<a id="development"></a>

# Entwicklung

**Deutsch | [English](DEVELOPMENT.md)**

Die Offline-Hilfe wird durch `scripts/build-help.mjs` aus den eingecheckten
DE-/EN-Handbüchern erzeugt. Der bewusst begrenzte Markdown-Konverter maskiert
HTML und weist fremde Links ab. Beide HTML-Dateien, 32 passende Bildschirmbilder,
lokale Stile/Skripte und ein Datei-Prüfsummenmanifest liegen unter
`.build/renderer/help` im paketierten ASAR beider Plattformen. Es gibt weder
Laufzeitdownload noch neue Markdown-Abhängigkeit. `tests/help.test.mjs` prüft
Kapitel, exakte Bilddateien, HTML-Sicherheit und den festen Hilfe-IPC. Die
regulären Quell-, Paket- und Installationstests verlangen nun `DESKTOP_HELP_OK`:
echte Hilfe/F1, Sprache/Suche, alle Bildladevorgänge, Vergrößerung, Trennung des
Viewers, Tooltips, erhaltene Eingaben und 360px-Layout. Nach verpflichtendem
`verify:local` und nativer Paketierung ausführen:
`node scripts/smoke.mjs --no-capture` und
`node scripts/smoke-packaged.mjs --no-capture`. Die Paketprüfung kontrolliert alle
Hilfe-Prüfsummen; die Oberflächenprüfungen erzeugen keine Bilder. Native
Desktop-/Schlüsselbundabnahme bleibt gesondert.

Desktop-Titelhinweise und ausführliche Erklärungen nutzen jetzt einen gemeinsamen
Tooltip mit einheitlicher Schrift. Dynamische Titel und Sprachbindungen werden
ohne zweiten nativen Hinweis übernommen; vorhandene Zugänglichkeitsbeschreibungen
bleiben erhalten. Nach einem Klick kann der Hinweis innerhalb desselben Elements
wieder erscheinen. Verlassen beendet ausstehende Hinweise; nach Escape öffnen
bloße Mausbewegungen innerhalb desselben Elements den Hinweis nicht erneut.
Quell-, Paket- und Installationstests verlangen zusätzlich `DESKTOP_TOOLTIPS_OK`:
echte Maus- und Tastaturereignisse, deaktivierte Elemente, verschachtelte Spans,
Titeländerungen, mit der Maus erreichbare Hinweise und einheitliche
Dialogschriften in DE/EN. Dabei entstehen keine Bilder.

Lauf 44068759284 zeigte einen Überlauf des deutschen Handbuchs bei 360px. Die
lange Überschrift ist mit DejaVu Sans unter Linux oder Verdana unter Windows
reproduzierbar breiter als ihr Textbereich. Handbuchtexte brechen lange Wörter
jetzt um, ohne sie abzuschneiden. Der Hilfe-Test wartet auf die tatsächliche
Fenstergröße und prüft Seiten- sowie Textblockbreiten bei 360/600/1120px in
beiden Sprachen und Designs mit Standard- und breiter Schrift. Verborgene
Windows-Testfenster schalten die Hintergrunddrosselung ab, damit sie sich wie
sichtbare Hilfefenster verhalten; die CI-Grenze von 30 Sekunden bleibt bestehen.
Die regulären Quell-, Paket- und Installationstests prüfen dies ohne Bildaufnahme.

Native VM-Tests zeigten, dass 600ms für Test-RPCs mit echter Dateispeicherung
der Erweiterung zu knapp waren. Die Laufzeit-Testdaten nutzen jetzt begrenzte
2000ms; produktiv bleiben es 10000ms, sämtliche Stopp-/Wiederholungsprüfungen
bleiben bestehen. Der gesamte App-Test behält in der CI seine 30000ms-Grenze;
eine langsamere lokale VM kann ausdrücklich `Z2MA_SMOKE_TIMEOUT_MS=90000`
setzen (geprüfter Bereich 30000–120000). Nach Fristablauf wird zunächst regulär
und nötigenfalls nach fünf Sekunden erzwungen beendet. Ein echter Kindprozess-Test
prüft die Beendigung auch bei ignoriertem SIGTERM. Für Xvfb `WAYLAND_DISPLAY`
entfernen und `XDG_SESSION_TYPE=x11` setzen, damit Electron keine gesperrte native
Wayland-Sitzung auswählt. Die direkte GNOME-Desktop-Prüfung benötigt eine entsperrte
Sitzung; Erfolg auf einer virtuellen Anzeige ersetzt diese Prüfung nicht.

Die RC-Vorbereitung ergänzt `npm run audit:dependencies` für Laufzeit- und
Entwicklungsabhängigkeiten; Befunde ab mittlerem Schweregrad lassen die Prüfung
scheitern. Außerdem folgt nach Plattformabnahme in der CI ein Schritt für
Kandidatenkennung und Prüfsummen. Audit nach einer sauberen Installation mit
`npm ci --ignore-scripts --no-audit --no-fund` ausführen, danach
`npm run setup:tools`, das verpflichtende `npm run verify:local` und bildfreien
Quell-/Paket-Smoke. Tatsächliches `npm run make` prüft die geänderten ASAR- und
NSIS-Abhängigkeitspfade. Für diese Werkzeugkette nie `npm audit fix --force`
verwenden. Siehe [RC1](RC1_DE.md) für geprüfte Überschreibung, unveränderliche
Build-Übergabe und verbleibende Plattformabnahme.

`npm run prepare:rc` benötigt `Z2MA_BUILD_SHA`, einen sauberen Quellcheckout,
einen versionierten nativen Installer und das passende Designer-Archiv. Liefert
CI `Z2MA_BUILD_VERSION`, muss es zu den geprüften Metadaten passen. Die Ausgabe
`candidate-*.json` gehört zu den bestehenden Plattformartefakten. Lokaler
Paketbau mit geänderten Quellen kann die Werkzeugkette prüfen, belegt aber
keine endgültige Kandidatenkennung.

Die RC-Vorbereitung vom 2026-11-16 besteht saubere Installation, vollständigen/
Produktionsaudit ohne Befunde, Windows `verify:local` mit 239 erfolgreichen Tests,
zwei Ubuntu-spezifischen Auslassungen und vollständiger bildfreier Oberfläche,
bildfreien Quell-/Systemverknüpfungs-/Paket-Smoke, NSIS-Setup-Erzeugung und
Designer-Paketbau. Frische Ubuntu-/Installations-CI und gezielte native
RC-Abnahme bleiben getrennt; siehe [RC1-Nachweise](RC1_DE.md).

Die Partnergeräte-Vorprüfung vom 2026-11-16 prüft erforderliche Kataloge vor jedem
Stopp. Desktop-MQTT-Integrationstests prüfen Aktionen, Bedingungen und Aktionsfolgen
auf zwei unabhängigen synthetischen Brokern, auch bei Datenverlust nach der
Bestätigung. Sie verlangen, dass weder Stopp noch Speicherung oder Aktivierung
erfolgen und Ausführung, Freigaben und Entwürfe unverändert bleiben. Der gemeinsame
Browser-/Kachelablauf prüft vor dem Stopp und nach erforderlichem Stopp erneut;
die native Speicherabsicherung bleibt maßgeblich. Fehlende Kataloge unbeteiligter
Netze blockieren keine rein lokale Übertragung.

Die Windows-Nachprüfung `npm run verify:local` besteht 233 Tests mit zwei
übersprungenen reinen Ubuntu-APT-Fällen, Typen, Build, Integrität und das
vollständige bildfreie Oberflächentestgerüst in 15,5 Sekunden. Ihr erster Lauf
beendete alle DOM-Prüfungen, überschritt aber beim Beenden die unveränderte
Prozessfrist von 30 Sekunden. Die isolierte vollständige Nachprüfung beendete
sich erfolgreich. Anschließend bestand auch
`node scripts/smoke.mjs --no-capture`. Die vollständige PHP-/282-JavaScript-Suite
des Symcon-Verbrauchers und bildfreie DE-/EN-Browser-/Kachelabnahme bestehen
mit gemeinsamem Inhalt `3deb84bb5545`. Ubuntu-CI und installierte Systemabnahme
bleiben getrennt.

Die Prüfung der Modulansicht-Wiederherstellung am 2026-11-15 bestand
`npm run verify:local` mit 230 erfolgreichen Tests, zwei ausgelassenen reinen
Ubuntu-APT-Fällen und vollständigem bildfreiem Erweiterungsupdate-Oberflächentest
in 15,3 Sekunden sowie `node scripts/smoke.mjs --no-capture`. Das festgelegte
Symcon-Paket ist `0.117.0`, Inhalt `1dc396096d94`. Seine vollständige PHP-Suite
und 279 JavaScript-Tests, bildfreie Browser-/Kachelabnahme, Struktur, Kodierung,
offizieller JSON-Stil mit 20 Dateien und PHP CS Fixer mit 164 Dateien bestehen.
Gezielte Tests prüfen wiederholte vorübergehende Fehler, ausgeschöpfte
Wiederholungs-/Zeitbudgets, überfällige Wartezeiten, Abbruch und dauerhafte Fehler.
Live- und neue Plattform-CI-Nachweise bleiben getrennt.

Regressionen verbundener Arbeitsstände prüfen erstes Lesen mit noch nicht
gesendeten lokalen Regeln, dauerhafte tatsächliche Basis, unabhängige
Bearbeitung/Löschung, ausdrückliche Konfliktentscheidungen, offene Formulare,
unterbrochene Nachweise und abgesichertes Rückgängig. Portable Dateiprüfungen
umfassen Format-1-Projekte, Format-2-`.z2map`, `.z2mad`-Auswahlen mit benötigten
Abhängigkeiten, ausgeschaltete neue Regeln und unveränderte Zielfreigaben.
Bildfreie Testgerüste prüfen gemeinsame Bedienelemente in Electron, Browser und
Kachel. Siehe ADR 0006. Echte Systeme oder Laufzeitaktionen gehören nicht dazu.

Abschließende lokale Nachweise vom 2026-11-15: `npm run verify:local` bestand
Build, strikte Typen, Integrität und 230 Tests; zwei native APT-Tests benötigen
Ubuntu. Der vollständige bildfreie Erweiterungsupdate-Oberflächentest bestand
in 15,2 Sekunden. Das folgende `node scripts/smoke.mjs --no-capture` bestand
echten Electron-/MQTT-Abgleich, Bearbeitung, Dateispeicherung, Wiederöffnen,
Speichern beim Schließen und Layouts mit 360/1024/1920/3840 Pixeln in beiden
Designs. Das festgelegte Symcon-Paket ist `0.116.0`, Inhalt `0fde49a6e850`.
Seine vollständige PHP-/278-JavaScript-Suite, bildfreie Browser-/Kacheltests,
Struktur, Kodierung, offizieller JSON-Stil mit 20 Dateien und PHP CS Fixer mit
164 Dateien bestehen. Plattform-CI und installierte/Live-Abnahme bleiben getrennt.

Node 24.20.0 und npm 11 unter Windows 11 x64 oder Ubuntu Desktop LTS x64 verwenden.
Englische Repository-Dokumentation ist maßgeblich, mit vollständigen deutschen
`_DE.md`-Fassungen und gegenseitigen Sprachlinks. Beide Fassungen zusammen
aktualisieren. Codekommentare, technische Bezeichner und Commit-Texte bleiben
englisch. Übersetzte Oberflächentexte gehören in lokale DE-/EN-JSON-Kataloge.
Ausschließlich der Benutzer committet und pusht.

`npm run check:docs` gehört zu `npm run check` und damit zu `verify:local` und
beiden Desktop-CI-Jobs. Es prüft vollständige Sprachpaare, sichtbare gegenseitige
Links, übersetzte Überschriftenstruktur, lokale Pfade/Sprungmarken einschließlich
Groß-/Kleinschreibung sowie sprachgerechte Handbuchbilder und deren
Manifestabmessungen/-größen. Isolierte Regressionstests lehnen fehlende
Übersetzungen, defekte Navigation, ausgelassene Abschnitte, falsche Schreibweise
von Pfaden, fehlende Sprungmarken, sprachfremde Bilder und veraltete Bildmetadaten
ohne Bildaufnahme ab. Übersetzungsbedeutung oder Bilddarstellung werden nicht
bewertet. Siehe [Dokumentationsübersicht](README_DE.md).

Gemeinsamer geführter Rahmen und Symcon-Darstellungsadapter sind unter
`packages/designer/src` maßgeblich; der Desktop-Arbeitsbereich exportiert den
Rahmen erneut. Nach Änderungen Desktop prüfen und Ausgabe von
`npm run pack:designer` mit dem geprüften Importwerkzeug nach Symcon übernehmen.
Symcons PHP-/Node-Suite und die bildfreie
`tests/designer-localization.browser.mjs` mit bestehender Playwright-Installation
ausführen. Das Testgerüst prüft tatsächliche Listen-/Editor-Mausradeingabe,
Feldkorrektur, lokale Regelschalter, Abbruch und ausdrücklichen begrenzten
Stopp/Prüfen/Speichern in Browser und Kachel. Es kontaktiert ausschließlich
seine eigenen Loopback-Testdaten. Native Installationsabnahme und Plattform-CI
von diesen lokalen Prüfungen getrennt halten.

Die geführte Symcon-Übertragung unterscheidet gespeicherte Neustartpräferenz vom
dauerhaften Neustartzustand des Empfängers. Ein bestätigtes
`resumeStatus: stopped` verhindert Neustart auch bei eingeschaltetem
`resumeAfterRestart`. Diese Präferenz erhalten; Speicherung nicht blockieren und
bereits gestoppten Empfänger nicht wiederholt stoppen. Fehlende oder weiterhin
vorgemerkte Neustartbestätigung muss Speicherung weiter blockieren.
Regressionen prüfen die neue Regel zusammen mit dem vollständigen bisherigen
Entwurf in Browser/Kachel.

Schritt 8 bietet auf allen drei Oberflächen eine pro Übertragung zunächst
abgewählte Wiederaufnahme des bisherigen Automatikbetriebs. Nur ein zuvor
bestätigt aktiver Empfänger darf nach erneuter Validierung, bestätigter
Speicherung, frischem Rücklesen und neuer Aktivierungsanforderung fortsetzen.
Gespeicherte Neustartpräferenz erhalten; nie eine neue ausgeschaltete Regel
freigeben oder einen unterbrochenen Einzellauf wiederholen. Ohne diese Wahl
bleibt der Betrieb gestoppt. Desktop-Inhaltsübertragungen erhalten geprüfte
Schalter nur mit dieser ausdrücklichen Wahl; sonst bleibt die bisherige
Alles-aus-Richtlinie. Regressionen prüfen beide Wiederherstellungspräferenzen,
gestoppte Systeme, Abbruch, geänderte Eingaben, fehlgeschlagene Prüfungen/
Rücklesen, verlorene Antworten und lesenden Abgleich. Verborgenes Electron
und Headless-Browser-/Kacheltests prüfen echtes DE-/EN-Kontrollkästchen,
sicheren Anfangsfokus, Zurücksetzen je Übertragung und begrenztes Dialoglayout
ohne Aufnahme.

Modulansicht-Lesen erholt sich von ausdrücklich vorübergehenden HTTP-Verfügbarkeitsfehlern
oder veraltetem Arbeitsstands-/Systemstand mit höchstens fünf Wiederholungen
nach 250/500/1000/2000/2000 ms. Außerhalb des Wiederherstellungsfensters von
zehn Sekunden startet keine neue Wiederholung; einzelne Lesevorgänge behalten
ihre bisherigen Anfragefristen. Wiederherstellung beginnt das gesamte GET-Lesen
mit allen Katalogseiten neu; teilweise gelesene alte Seiten werden verworfen.
Die Ansicht bleibt beschäftigt mit übersetztem neutralem Fortschritt. Eine
bisherige rote Lesewarnung wird währenddessen ausgeblendet und erscheint nur,
wenn das begrenzte Lesen endgültig scheitert. Berechtigungsfehler, fremde
Bindungen und fehlerhafte Daten bleiben Fehler. Dauerhafte Fehler erhalten das
bisherige Anzeigemodell mit Lesewarnung. Wiederherstellung wiederholt nie
Übertragungs-, Laufzeit-, Installations- oder Editoränderungen. Strukturierte
Konsolenereignisse enthalten nur Lesephase, festen Grund, HTTP-Status und
Versuch. Die Browser-/Kachelregression fügt nach erfolgreichem Speichern drei
vorübergehende Lesefehler ein und prüft Warten und Erholung mit genau einer
Speicheranfrage. Sie prüft auch dauerhaften Fehler und spätere ausdrückliche
Ansichtsaktualisierung.

Gerätebausteine und Eigenschaftsfelder benennen das zugehörige Z2M-Netz mit
Systemname und Basistopic. Lokale Zugehörigkeit folgt der gewählten stabilen
Systemkennung; entfernte Verweise verwenden ihr deklariertes Basistopic, auch
bei fehlenden Geräten. Die bildfreien Browser-/Kacheltests prüfen beide
Sprachen, Systemwechsel und gleiche Gerätekennungen in mehreren Netzen.
Unbekannte oder mehrdeutige Topics behalten ihre wörtliche Kennung, statt
Anzeigenamen anderer Systeme zu übernehmen.

Der gemeinsame Editor ermöglicht in beiden Produkten Netzauswahl über
`deviceSystems`-Metadaten des Adapters. Geräteauslöser bleiben lokal. Symcon
erhält gerichtete Aktionsfreigaben; entfernte Bedingungen brauchen zusätzlich
die Freigabe der Antwortrichtung. Optionales `conditionReason` unterscheidet
diese Einschränkung von Aktionszugriff. Fehlende Partnerkataloge bleiben mit
Hinweis wählbar, ohne lokale Geräte zu übernehmen oder implizites Kataloglesen
zu starten.

Symcons Hinweis auf fehlenden/unbestätigten Katalog steht über dem Arbeitsbereich;
die primäre Navigation direkt unter dem Warntext. Der begrenzte Meldungsbereich
hält die Aktion in schmalen Kacheln erreichbar. Öffnen von Schritt 4 oder
Aktualisieren der Modulansicht darf kein Gerätelesen starten. In Schritt 4 hebt
die Katalogkarte die ausdrückliche Aktualisierung hervor; der überflüssige
Navigationshinweis entfällt. Andere Formularwarnungen und fehlgeschlagenes
Ansichtslesen bleiben sichtbar. Die Offline-Browser-/Kacheltests prüfen Navigation,
Aktualisierung, Sprachwechsel und Wiederherstellung getrennt und den Erhalt
von Entwürfen in DE/EN.

Beide Desktop-Ausgaben halten die Symcon-Warnung bereits aus ihrem Arbeitsbereich
heraus. Fehlt aktuelles Lesen, hebt die Verbindungsseite Verbinden oder Bestand
lesen hervor. Bildfreier Desktop-Smoke prüft auch, dass Schritt 4 weder auf
sich selbst verlinkt noch eine doppelte Symcon-Warnung enthält.

<a id="setup-and-checks"></a>

## Einrichtung und Prüfungen

Katalogregressionen füllen das bisherige Auswahlbudget vor einem synthetischen
Fenstergriff und Sensor. Typisierte Kanäle und numerische Einheiten müssen ohne
Erweitern alter Listen oder Verändern von Lese-/Schreibrechten erhalten bleiben.
Der Katalogbau der Erweiterung hat ein eigenes Bytebudget von 512 KiB und lehnt
ein zu großes Gesamtergebnis ab. Der Desktop-Parser akzeptiert typisierte
Einheiten auch bei erschöpften alten numerischen Listen und meldet
`catalog_limit` ohne Teilinventar zu akzeptieren. Gemeinsame Browser-/Kacheltests
wählen Griffpositionen und numerische Kanäle gemischter Geräte in DE/EN, ohne
Regeln zu erstellen oder MQTT-Befehle zu senden.

Die mitgelieferte Korrektur ist Erweiterung `0.2.4`, Build `3f8a06859635`,
festgelegt auf maßgeblichen Commit `2db85997a2a317bee6c59e96d78c050b8c579095`.
Die abschließende lokale Prüfung besteht 219 Desktop-Tests mit zwei unter
Windows übersprungenen nativen Linux-APT-Fällen und die vollständige bildfreie
Oberflächensuite. Der erste gleichzeitige Oberflächenlauf überschritt nach
abgeschlossenen DOM-Prüfungen die Prozessfrist von 30 Sekunden; das abschließende
isolierte `verify:local` bestand mit festgelegtem Artefakt, Oberflächenteil in
15,3 Sekunden. Diese Frist nicht erhöhen oder Teilprüfungen zur Freigabe nutzen.

Empfängerbereitschaftsregressionen prüfen entfernte Bedingungen, Aktionen und
Aktionsfolgenverweise, getrennte Zustände gestoppt/unbekannt/aktiv und stabile
Systemnavigation. Laufzeitintegrationstests prüfen gespeicherte Regelnamenvorschau,
Abbruch und ausdrückliche Partnerempfangsaktivierung ohne lokale Regelfreigabe.
Das vollständige Symcon-Browser-/Kacheltestgerüst prüft echte Navigation,
Aktivierungsbestätigung, Rückweg und Sprachwechsel ohne Aufnahme oder echte Systeme.

Desktop-CI auf `dev` versioniert zuerst über eine wiederverwendbare Voraussetzung
und checkt danach genau diesen Metadatencommit in beiden Plattformjobs aus.
Die Build-Ref-Hilfe prüft HEAD und Version vor Werkzeugen oder Paketbau.
Pull Requests und `main` behalten rein lesende eingecheckte Metadaten. Siehe
[Versionierung](VERSIONING_DE.md#build-order-and-immutable-checkout).
Die Git-gestützte Regression in `tests/ci-versioning.test.mjs` prüft auch
manuelle Neubauten, überholte Pushes, Fehlergrenzen und einen zwischen beiden
Plattform-Checkouts weiterlaufenden Branch. Echte Repository-Pushes oder
Paketveröffentlichung gehören nicht dazu. Lokale Prüfung bestand mit 201 Tests,
vollständigem bildfreiem Erweiterungsupdate-Test und darin acht Git-gestützten
Workflow-Fällen; zwei native APT-Fälle brauchen Ubuntu. Die geordnete
GitHub-Pipeline ist nach dem Push dieser Workflow-Änderung noch zu bestätigen.

Actionlint 1.7.12 prüft den Workflow-Graphen mit zwei engen lokalen Ausnahmen
für veraltete `create-github-app-token@v3`-Eingabemetadaten. Die aktuelle
[Aktionsdefinition](https://github.com/actions/create-github-app-token/blob/v3/action.yml)
unterstützt `client-id` und macht `app-id` optional. Diese geprüfte Eingabe
erhalten; keine workflowweite Lint-Unterdrückung oder Änderung von
Tokenberechtigungen einführen.

~~~sh
npm ci --ignore-scripts --no-audit --no-fund
npm run setup:tools
npm run verify:local
npm run smoke
npm start
~~~

setup:tools ruft ausdrücklich nur den geprüften festgelegten Electron-Download
auf. Nicht sämtliche Abhängigkeits-Lebenszyklusskripte aktivieren, um fehlende
Werkzeuge zu umgehen.

`npm run verify:local` ist die verpflichtende lokale Prüfung vor Abschluss von
Codeänderungen. Sie führt `npm run verify` und danach das vollständige
Testgerüst `test:extension-update-ui` aus und scheitert, wenn einer der Schritte
fehlschlägt. Erfolgreiches `verify` allein genügt nicht zur lokalen Abnahme.
Das Oberflächentestgerüst nutzt ein verborgenes Electron-Fenster ohne
Bildaufnahmen. Linux ohne Desktop-Sitzung braucht Xvfb und die im CI-Workflow
gezeigte Sandbox-Einrichtung. CI behält ihre getrennten plattformspezifischen
Schritte.

Vorübergehende Electron-Downloadfehler werden höchstens dreimal wiederholt,
mit einer und drei Sekunden Abstand und höchstens drei Minuten je Versuch.
Integritäts-, dauerhafte HTTP- und lokale Installer-Hilfsfehler scheitern
weiterhin sofort. CI teilt `electron_config_cache` zwischen Setup und Forge und
speichert nur Downloadartefakte zwischen. Forge nutzt auch Electrons feste
Prüfsummenliste.

Ubuntu-CI nutzt `scripts/ubuntu-apt.mjs` für Build-Werkzeuge und Abhängigkeiten
der gebauten DEB. Eine vollständige `dpkg-query`-Installationsstatusprüfung
überspringt Netzwerkzugriff, wenn alle vier Build-Pakete vorhanden sind; eine
gebaute DEB wird so nie übersprungen. Updates verwenden `--error-on=any`:
Fehlgeschlagene Indizes dürfen alte Metadaten nicht stillschweigend weiterverwenden.
Nur vorübergehende Beschaffungsfehler werden höchstens zweimal je Spiegel und
Phase mit einer Sekunde Abstand wiederholt. Aufrufe erhalten für kalte Indizes
bis zu drei Minuten innerhalb eines gemeinsamen sechsminütigen
Beschaffungsbudgets plus begrenztem Prozessende. Verbleibende Zeit wird auf
gewählte Spiegel verteilt, damit ein hängender erster Spiegel nicht die
Ersatzzeit verbraucht. Signatur-, Prüfsummen-, TLS-Prüf-, Abhängigkeits- und
Prozessfehler bleiben endgültig.

Vor nötiger Beschaffung laufen lesende Proben in derselben sudo-Umgebung wie
APT. Sie melden Azures IPv4-DNS-Ergebnis und prüfen HTTPS-InRelease-Dateien
für noble, noble-updates und noble-security auf offiziellen Ubuntu-Servern und
unabhängig betriebenen Spiegeln von [kernel.org](https://mirrors.kernel.org/)
und [OSU Open Source Lab](https://ftp.osuosl.org/pub/ubuntu/). Jede curl-Probe
hat drei Sekunden Verbindungs- und acht Sekunden Gesamtfrist. Protokolle
unterscheiden DNS-, TCP-Verbindungs- und TLS-Handshake-Zeiten. Nur vollständig
erreichbare Repositories kommen infrage, höchstens zwei werden gewählt. IPv4
wird erst nach erfolgreichen IPv4-HTTPS-Proben gewählt. Ist keines geeignet,
scheitert die Beschaffung vor APT-Start. HTTPS-Proben ersetzen keine
APT-Signatur-/Prüfsummenprüfung.

Alle Kandidaten verwenden isolierte Ubuntu-24.04-x64-deb822-Quellen und den
installierten Ubuntu-Archivsignaturschlüssel, begrenzt auf main/universe in
noble, updates und security. Für Spiegel wird kein Vertrauensschlüssel
hinzugefügt. Unerreichbare Runnerquellen und sachfremde Fremdrepositories
werden ohne Umschreiben von Systemdateien ausgeschlossen. Unnötige Übersetzungs-
und DEP-11-Indizes sind deaktiviert. Eine Repository-Kennung wird erst nach
APT-Prüfung signierter Metadaten über `GITHUB_ENV` gemerkt; der nächste Schritt
prüft diese Auswahl erneut.

Quellen, Paketlisten und Downloads liegen in einem zufälligen Ordner direkt
unter `/tmp`, außerhalb möglicherweise privater übergeordneter Runner-Home-Ordner.
Nur die zwei partiellen Downloadordner gehören `_apt`. Vor APT-Start prüfen
tatsächliche `_apt`-Aufrufe Ordnerdurchquerung, Schreiben in partielle Ordner
und Lesen von Quelle/Schlüsselbund. `dpkg-deb` liest ohne sudo die Kennung des
gebauten Pakets. Die DEB wird als `Package_Version_Architecture.deb` mit Modus
0644 ins isolierte `archives` kopiert, per SHA-256 mit dem Original verglichen
und als `_apt` lesend geprüft; das Originalartefakt bleibt unverändert.
Kennungsfelder sind begrenzt, mit maßgeblicher App-Version x.y.z und Architektur
amd64/all. APT kann während `--download-only` eine lokale DEB direkt lesen, ohne
seinen Archivcache zu füllen. Ausdrückliches Bereitstellen hält das lokale
Archiv für den folgenden `--no-download`-Vorgang bereit. Erfolgreiche
Beschaffung darf nicht als Ursache eines späteren Fehlers angenommen werden.
Archivsuche ist in [APTs Archivbehandlung](https://github.com/Debian/apt/blob/main/apt-pkg/acquire-item.cc)
implementiert. Keine Runner-Home-Berechtigungen werden erweitert. Unerwarteter
Rückfall auf Root-Download gilt auch bei APT-Status null als Berechtigungsfehler.
Pakete werden vor einer einmaligen, auf zwei Minuten begrenzten
`--no-download`-Installation heruntergeladen. Installations-/Konfigurationsfehler
werden nie wiederholt. Vorhandener Installations-Smoke, Entfernung und
Artefaktupload ausschließlich bei Erfolg bleiben verpflichtend. Begrenzte
Diagnose enthält Phase, Spiegel, Versuche, Byteanzahlen, Fehlerkategorien
(einschließlich fehlender Archive, Abhängigkeiten und dpkg-Fehler), ausdrückliches
Warnkennzeichen für Downloads ohne Sandbox, Zugriffsprüfumfang und die letzten
acht APT-Indexereignisse. Hosts/Suites/Indextypen stehen auf Erlaubnislisten;
private URLs, Pfade, Prozessausgaben und Zugangsdaten werden nicht ausgegeben.
Synthetische Tests und echte Unterprozessausgabeprüfungen decken Bereitschaft,
Routing, Wiederholung/Ersatz, identische Paketbereitstellung und Fehlerwege ab.
Ein nativer Linux-CI-Regressionstest belegt, dass `_apt` keine privaten
Vorfahrenordner durchqueren kann und neue Quellen, Caches und bereitgestelltes
Paket ohne Veränderung erreichen kann. Ein zweiter nativer Test baut eine kleine
abhängigkeitsfreie DEB und prüft echte APT-Beschaffung mit leeren Quellen und
isolierter leerer Paketdatenbank. Er folgt der Produktionsreihenfolge: Archiv
bereitstellen, Abhängigkeiten beschaffen, `--no-download` prüfen. Beide APT-Aufrufe
müssen ohne Archivbeschaffung gelingen; Paketbytes und Datenbank bleiben
unverändert. Alle Aufrufe sind ausschließlich downloadend: Kein Paket wird
entpackt oder konfiguriert, kein Netzwerkrepository kontaktiert.

CI-Lauf 43069225091 bestätigte Sandbox-Prüfungen, HTTPS-Routing, signierte
Metadaten, Abhängigkeitsdownloads und Quell-/Paket-Smoke. Die abschließende
Installation endete mit Code 100; der ursprüngliche APT-Fehlertext blieb nicht
erhalten. Lauf 43072699700 stoppte früher, weil der ergänzte native Test nach
erfolgreicher Beschaffung fälschlich Exit 100 erwartete; APT lieferte tatsächlich
null. Diese Zusicherung wurde durch die Prüfung erfolgreicher Nutzung des
bereitgestellten Archivs ersetzt. Ein neuer Ubuntu-CI-Lauf muss
Installations-Smoke, Entfernung und DEB-Upload bestätigen. Windows-Prüfungen und
nicht installierende APT-Regression belegen dieses Ergebnis nicht.

verify baut maßgeblichen Designer und TypeScript-Backend und prüft UTF-8/LF,
passende Katalogschlüssel/-parameter, Markup-/Schlüsselverweise, erzeugte
Dateiprüfsummen, strikte Typen und Verhaltenstests. smoke öffnet ein eigenes
Electron-Fenster mit temporärem Profil, nutzt nur synthetische Daten und beendet
sich. Unter Windows bleibt das Fenster verborgen; unter Linux wird es zur
Bildaufnahme auf der CI-Xvfb-Anzeige eingeblendet. Lokal unter Linux erscheint
kurz ein Fenster. Geprüft werden echtes Preload/Renderer, Systemwechsel,
Sprach-/Eingabeerhalt, Diagnose und helle/dunkle Layouts. Die lokale Aufnahme
liegt unter apps/desktop/out/smoke.png. Entwurfs-Smoke benennt jede Wartephase
und speichert bei Fehler begrenzte Zustandsdiagnose und ein Bild als
apps/desktop/out/smoke-failure.*. CI lädt diese bei fehlgeschlagenem Job
getrennt hoch. Die Testdaten für gemeinsam genutzte Broker verzögern die
Katalogantwort des zweiten Systems für unabhängige Lesezeiten. Entwurfsbearbeitung
wartet auf alle zugeordneten Systemlesevorgänge und passenden dargestellten
Kontext. Die systemübergreifende Formularprüfung wählt fremde Bedingungs-/
Aktionsgeräte, prüft alphabetische Sortierung und stabile Zugehörigkeit und
öffnet den gespeicherten Entwurf über einen Sprachwechsel erneut.
Übertragungstests nutzen zwei isolierte Broker und lehnen alte
Erweiterungsversionen und entzogene Empfängerfreigaben vor der Validierung ab.

D2 ergänzt echten temporären Projektspeicher, Wiederöffnen/Sichern/Wiederherstellen,
Entwurfsverwaltung, Zugangsdatenimport nur im Hauptprozess, Betriebssystemschutz
sofern verfügbar und Tastatur-/Mausradprüfungen im Smoke. Testdialoge wählen nur
synthetische Dateien im temporären Profil; Produktion nutzt native Dialoge.
`tests/projects.test.mjs` prüft auch eine tatsächliche exklusive Windows-Dateisperre.
Die Hilfe bevorzugt installiertes PowerShell 7 und fällt auf Windows PowerShell
zurück. Ein ereignisgesteuerter Handshake erlaubt bis zu 30 Sekunden Startzeit
und verlangt vor der Speicherprüfung ein ausdrückliches Sperre-bereit-Signal.
Bereinigung wartet vor Entfernen der Testdateien auf Freigabe und Prozessende;
auch fehlgeschlagene Prüfungen geben den Helfer frei. Der Test bestätigt danach,
dass Speichern nach Entsperren gelingt.

`LOCK_HELPER_DIAGNOSTICS` meldet Shellname, PID, Phase, vergangene Zeit,
Exitcode/-signal, Ausgabebyteanzahlen und erlaubten Ausnahmetyp/HRESULT.
Rohe stdout/stderr, Dateipfade und Befehlsinhalte werden nie eingeschlossen.
Phasen unterscheiden Prozessstart, Sperrnahme und Freigabe. Portable
Lebenszyklustests prüfen verzögerte/fragmentierte Bereitschaft, Startfehler,
frühes Ende, begrenzte Start-/Endfehler und Bereinigung nach fehlgeschlagener
Prüfung. Sie ersetzen keinen nativen Windows-Sperrtest, der in Windows-CI
verpflichtend bleibt.

Dieselben Prüfungen unter Ubuntu ausführen; simulierte fehlende/gesperrte
Schlüsselbünde belegen keine native Secret-Service-Abnahme. Siehe [D2](D2_DE.md)
für Format-, Speicher- und Zugangsdaten-Grenzen.

Nach `npm run build` führt `npm run test:system-link-ui` ein eigenes verborgenes
Electron-Testgerüst mit synthetischen Daten aus. Es prüft nur DOM/Layout und
erzeugt nie Bilder. Abgedeckt sind die drei Assistentenphasen, acht sortierte
Systemauswahlen, DE-/EN-Erhalt, fehlgeschlagene Prüfungen, Offline-/gemeinsame
Broker, Konfigurationsauswahl, Korrekturlinks und Wiederöffnen. Tastatur, Escape
und seitenlokale Mausradeingabe prüfen die innere Scrollgrenze. Die Mausradprüfung
wartet auf das beobachtete Scrollergebnis. Layoutprüfungen nutzen beide Designs
bei 360 und 1280 Pixeln. Linux braucht Xvfb und Electrons Sandbox-Einrichtung
wie im CI-Workflow. Dieser Test ersetzt weder vollständigen Quell-/Paket-Smoke
noch native Ubuntu-Abnahme. Die normale Unit-Suite prüft auch reine
Mesh-Vorschläge, Vorlagensicherheit, Schemagrößen und tatsächliche zugeordnete
Lesevorgänge gegen isolierte Loopback-MQTT-Partner.

`npm run test:extension-update-ui` ist verpflichtender Teil von `verify:local`
und beiden Plattformjobs. Seine feste Dateiliste muss indirekte
Designer-Importe einschließlich `layout.js` → `symcon-workspace.js` →
`draft-sync.js` enthalten. Es prüft Fortschritt laufender Updates/Übertragungen,
automatische Entwurfsprüfmodi, einzige Prüfaktion, ausdrückliche
Übertragungsbedienung und DE-/EN-Rückmeldung. Bestätigungslayout wird in beiden
Designs geprüft. Es erzeugt keine Bilder. Backend-Integrationstests verwenden
die echte festgelegte Erweiterung für Zustimmung, Sicherung und Stoppreihenfolge,
reine Schalter-/unveränderte Entwürfe und verlorene Antworten ohne Wiederholung.
Electron-Start und erstes Laden des Arbeitsbereichs haben jeweils 20 Sekunden
Zeit, damit auch ein frisch gestarteter Renderer laden kann. Für die folgenden
Phasen gelten jeweils 8 Sekunden und für den Prozess insgesamt 60 Sekunden.
Scheitert eine Navigation, meldet der Test das letzte Ladeereignis. Bei einem
Renderer-Abbruch meldet er den Grund und den Exitcode.
Das DOM-Testgerüst prüft auch ausführliche Fähigkeitsbefunde in DE/EN,
wörtliche Beschriftungsdarstellung, genaue Korrekturziele und begrenzte
Editorzusammenfassungen. Entwurfs-Smoke öffnet einen Befund zum zweiten Wert
einer Mehrfacheigenschaftsaktion und prüft ausschließlich dessen Markierung und
Fokus. Synthetische Backend-Tests prüfen mehrere ungültige Werte, ausgeschaltete
Regeln, gemeinsame Aktionsfolgen, fremde Gerätezugehörigkeit, numerische
Grenzen/Schrittweiten und Ausschluss privater Rückmeldung aus Protokollen.
Umschaltregressionen prüfen schreibbare gegenüber rein lesenden Statuskanälen,
unveränderte Lesewerte, natives TOGGLE-Wählen/Wiederöffnen in DE/EN sowie
Validieren, Speichern und einmaliges Ausführen von TOGGLE mit Helligkeit über
die echte festgelegte Erweiterung gegen isolierte synthetische Partner.
Freigabeprüfungen decken bestätigte Anzahlen, Erklärungen bei null Freigaben,
sortierte Kontrollkästchen, DE-/EN-Erhalt, Abbruch, veraltete Auswahl und Sperren
laufender Übertragung ab. Reine DOM-Layoutprüfungen verwenden lange unabhängig
scrollbare Listen bei 360/1280 Pixeln in beiden Designs. Quell-Smoke prüft
systemgebundenen Auswahlerhalt und verbietet Freigabeschreiben aus dem
Smoke-Profil. Tests mit echter festgelegter Erweiterung prüfen reine
Schalterspeicherung, ausdrückliche Zustimmung, Sicherungsabbruch, Erhalt
abweichender Entwürfe, Entzug der letzten Regel, unbekannte/doppelte Kennungen
und Ablehnung erneuten Sendens eines unbestätigten Stopps.
Die DOM-Regression wechselt auch zwischen Rot **Nicht bestätigt**, Gelb
**Unbekannt** und Grün **Bestätigt** in DE/EN und prüft tatsächliche Farbwerte
beider Designs. Auswahländerung, Abbruch, veralteter Kontext, verlorene
Aktualität und ungeklärte Übertragung/Updates dürfen keine falsche grüne
Bestätigung zeigen. Starten/Stoppen ändert bestätigte Freigaben nicht und
sendet keine zusätzlichen Steueranfragen.
Schritt-8-Belegregressionen prüfen eingeschaltete reine Schalterspeicherung
gegenüber ausgeschalteter Inhaltsspeicherung, frische Rückleseanzahlen in DE/EN,
späteren Start, Aktualitätsverlust und neuere gespeicherte Revision.
Abgeschlossene oder ungültig gewordene Übertragungen dürfen geplante
Übertragungsanweisungen nicht behalten oder erneute Übertragung erlauben.
Die Desktop-Arbeitsbereichsregression nutzt tatsächliches Markup, gemeinsame
Layoutcontainer und Desktop-Rahmen mit 30 langen synthetischen Regeln.
Beide Designs prüfen 1440 Pixel breite Fenster bis zu 500 Pixel Höhe,
zweispaltigen Arbeitsbereich, 150 Prozent Text und schmales gestapeltes Layout.
Sie prüft, dass das äußere Fenster nicht scrollt, die Liste begrenzt bleibt,
die letzte Regel erreichbar ist und Tastaturfokus ihren Namen sichtbar macht.
Chromium-Mausradeingabe in hell/dunkel sowie normalen/niedrigen Fenstern muss
die Liste in beiden Richtungen tatsächlich scrollen, während Bedienelemente und
äußere Container stehen bleiben. Das Testgerüst prüft vertrauenswürdige, nicht
abgebrochene Ereignisse und beobachtete Scrollposition; allein synthetisches
DOM-Ereignis genügt nicht. Native Betriebssystemeingabe bleibt Teil der
Installationsabnahme. Es gibt keine Bildaufnahme.
Layoutprüfungen warten auf die angeforderte Renderer-Fenstergröße und lesen
tatsächliche DOM-Geometrie ohne Animationsframes im verborgenen Testfenster
abzuwarten. Diese Frames können sich um Sekunden verzögern und erschöpften
zuvor die unveränderte Prozessgrenze von 30 Sekunden.
`EXTENSION_UPDATE_DOM_STEP` meldet feste Phasennamen, Größen-/Designfälle und
vergangene Zeit; jede Phase hat zusätzlich acht Sekunden Frist. Prozessfehler
melden Fristablauf, vergangene Zeit, Exitcode und Signal. Diese Diagnose
enthält nur synthetische Testmetadaten und erzeugt keine Bilder.

Verwende `npm run smoke -- --no-capture` für vollständigen Quell-Smoke ohne Bilder
oder nach Paketbau `npm run smoke:packaged -- --no-capture`. Der Schalter
deaktiviert Erfolgs- und Fehleraufnahmen; begrenzte JSON-Diagnose bleibt
verfügbar. Der Runner lehnt Builds ohne bildfreie Unterstützung ab und entfernt
in diesem Modus keine vorhandene PNG-Diagnose. Normale CI-Befehle behalten ihre
Aufnahmeprüfungen. Beide Modi führen dieselben Funktions-, Layout- und
Speichern-beim-Schließen-Prüfungen aus. Die Entwurfsprüfung prüft eingeordneten
Zustand und Übertragbarkeit statt eines festen übersetzten Erfolgssatzes.

~~~sh
npm run package
npm run make
npm run smoke:packaged
npm run pack:designer
~~~

package stellt eine ausführbare Anwendung bereit; make baut natives
Windows-Setup oder Ubuntu-DEB. Beide lesen version.json einschließlich der
kopierten Anwendungspaketversion. Versionierte Paketversionen oder version.json
nicht manuell erhöhen. Signierung, Installationsabnahme und Veröffentlichung
gehören zu D7. Über diese lokalen Befehle nie veröffentlichen.
Forge-Abhängigkeiten sind Entwicklungswerkzeuge, keine Renderer-APIs.

Der Windows-Maker ist jetzt NSIS mit deutschem/englischem Ordnerauswahlassistent;
siehe [Windows-Installer](WINDOWS_INSTALLER_DE.md). Er verpackt die durch Forge
vorbereitete Anwendung und liest maßgebliche Versionsmetadaten. Reine
Build-Downloads verwenden `ELECTRON_BUILDER_CACHE`, sofern gesetzt. Lokale
Builds dürfen diesen und prozesslokale TEMP/TMP auf einen ignorierten Ordner
eines Laufwerks mit ausreichend Platz verweisen. Produktionsabhängigkeiten und
Ubuntu-Maker bleiben unverändert.

D3-Tests nutzen einen unabhängigen temporären Loopback-MQTT-Partner, nie echte
Broker. Auf Entwicklungs-/CI-Rechnern OpenSSL für temporäre CA- und gegenseitige
TLS-Testzertifikate installieren; Git for Windows liefert ein unterstütztes
lokales Programm. MQTT.js 5.16.1 ist eine feste Hauptprozess-Produktionsabhängigkeit;
mqtt-packet 9.0.2 ist Testwerkzeug. Paketbau übernimmt die von der Sperrdatei
gewählten Produktionsabhängigkeiten mit Original-Lizenzen. `smoke:packaged`
prüft diese innerhalb der ASAR und wiederholt dann den tatsächlichen lesenden
Oberflächen-/MQTT-Smoke gegen die gepackte EXE. Es muss auf `package` oder
`make` folgen. Siehe [D3](D3_DE.md).

<a id="shared-source-ownership"></a>

## Lokaler Snap-Prototyp für Ubuntu

Unter Ubuntu 24.04 amd64 mit installiertem Snapcraft lässt sich der lokale Snap
aus einem geprüften Release-DEB bauen. Der Snap übernimmt die paketierte App
und deren Versionsnummer aus dem DEB. `--destructive-mode` installiert
Build-Abhängigkeiten auf dem Host und gehört daher in eine isolierte
Build-Umgebung.

```sh
bash scripts/build-snap-prototype.sh path/to/z2m-automations_0.135.0_amd64.deb artifacts/snap-prototype
sudo snap install --dangerous artifacts/snap-prototype/z2m-automations_0.135.0_amd64.snap
sudo snap connect z2m-automations:chromium-sandbox
snap run z2m-automations
```

Der Prototyp verwendet strikte Sandbox-Regeln und benötigt eine manuelle
Verbindung zur Chromium-Sandbox-Schnittstelle. Verbinde für geschützte
MQTT-Zugangsdaten in der Test-VM ausdrücklich
`z2m-automations:password-manager-service`. Das gewährt Zugriff auf den
Passwortmanager des Desktops. Ist der Schlüsselbund ohne diese Schnittstelle
nicht erreichbar, muss die App das geschützte Speichern ablehnen.

Öffne die vorhandene `.z2map`-Projektdatei und getrennte `.z2mad`-Entwürfe aus
einem sichtbaren Ordner im Home-Verzeichnis. Der Snap nutzt ein eigenes Profil
unter `~/snap/z2m-automations/current/.config/Z2M-Automations`. Um die
Übernahme der Zugangsdaten im selben Ubuntu-Konto zu prüfen, schließe beide
Varianten und kopiere nur den verschlüsselten Ordner `credentials` aus dem
DEB-Profil in ein Snap-Profil ohne vorhandenen Zugangsspeicher. Das DEB-Profil
und der GNOME-Schlüsselbund bleiben dabei erhalten. Prüfe nach dem Neustart des
Snaps die erfolgreiche Anmeldung an einem synthetischen Testbroker.

Snapcraft kann Build- und Laufzeitabhängigkeiten herunterladen. Der Prototyp
wird lokal mit der Einstufung als Entwicklungsbuild gebaut und installiert.

## Gemeinsame Quellzuständigkeit

Der gemeinsame Adapter bietet „Aus Z2M aktualisieren“ in Schritt 6 und portable
Dateibedienung in Schritt 5. Symcon implementiert feste HTTP-Routen und native
Speicherung; Desktop bildet dieselbe Oberfläche auf eingeschränkte
Hauptprozess-IPC ab. Verbindungslesen gleicht lokale Entwürfe automatisch ab.
`tests/draft-sync.test.mjs` prüft Anfrageumfang, Antwortgrenzen,
Vorgangsidentität und fehlende Befehlswiederholungen. Der bildfreie Browsertest
des Verbrauchers prüft Browser- und Kachelabläufe.

packages/designer/src bearbeiten, versioniertes Archiv bauen und Manifest prüfen.
Symcon importiert dieses ausdrückliche Archiv und prüft seine eingecheckten
Dateien ohne diesen Klon zu benötigen. Siehe packages/designer/README.md.
Native Kachel-/Hilfsquellen bleiben in Symcon, ebenso maßgebliche Z2M-Laufzeit
und Schema. Importierte gemeinsame Quellen behalten vier Leerzeichen Einrückung;
neue Desktop-/Werkzeugquellen nutzen zwei. Fremdquellen unverändert erhalten.

<a id="platform-verification"></a>

## Plattformprüfung

Die Desktop-CI-Matrix verwendet Windows und Ubuntu 24.04 aus demselben Commit.
Ubuntu-Paketbau braucht fakeroot und dpkg; Renderer-Smoke verwendet Xvfb mit
aktiver Chromium-Sandbox. Lokaler Windows-Erfolg ist keine Ubuntu-Abnahme.
Tatsächliche Ubuntu-24.04-/26.04-Desktop-Installation, Wayland/X11, DPI, Dialoge,
Zugangsdaten, Update und Deinstallation bleiben getrennte Meilensteinnachweise.
Während D1 war lokal kein Ubuntu oder WSL verfügbar. Ausdrücklicher
Linux-CI-Smoke verwendet Software-Rendering vor Electron-Start; normale Starts
und Windows behalten ihre bestehenden Renderer-Einstellungen. Bildaufnahme
bleibt verpflichtend. CI-Lauf 42472007945 bestand beide Plattformen einschließlich
Aufnahme; siehe docs/D1.md für abgeschlossenen D1-Umfang und verbleibende native
Installationsprüfgrenzen.

Echte Broker, Symcon-Systeme, private Projekte oder Gerätebefehle gehören nicht
zu D1-/D2-/D3-/D4-Prüfungen. D2 prüft temporäre Speicherung und Zugangsdaten;
D3 ergänzt synthetische MQTT-/TLS-Protokoll- und Wiederherstellungsprüfungen.
D2-CI-Lauf 42481799451 bestand Windows und Ubuntu 24.04; D3-Lauf 42491457811
ebenfalls. D4 benötigt nach dem Push des Benutzers einen neuen Plattformlauf.
D4 ergänzt lokale Editor-/Freigabe-/Schema-/Aktionsfolgen-/Austauschtests und
tatsächliche Electron-Eingabewiederherstellung nach Renderer-Neuladen.
Der Build prüft vor Bereitstellung das festgelegte Schemaartefakt.
AJV 8.20.0 und YAML 2.9.1 sind reine Hauptprozess-Produktionsabhängigkeiten;
keine Validierungs-/Übersetzungslaufzeit gelangt in die gemeinsame Browseroberfläche.
Den aktuellen Umfang beschreiben docs/D1.md bis docs/D4.md.
