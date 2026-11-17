<a id="rc1-preparation"></a>

# RC1-Vorbereitung

**Deutsch | [English](RC1.md)**

Umfang: Z2M-Automations for Windows (Windows 11 x64) und Z2M-Automations for Linux
(Ubuntu Desktop 24.04 LTS x64). Ubuntu-26.04-Abnahme ist getrennt.
RC1 ist eine Abnahmestufe, keine zweite maßgebliche Quelle der Anwendungsversion.

<a id="offline-help-and-focused-verification-on-2026-11-17"></a>

## Offline-Hilfe und gezielte Prüfung am 17.11.2026

Die App liefert beide vollständigen Handbücher mit jeweils 20 Kapiteln und
insgesamt 32 sprachlich passenden Bildern mit. Hilfe/F1 öffnet ohne Internet
das passende Kapitel mit Suche, Sprachwechsel und Bildvergrößerung. Tooltips
per Maus/Fokus erklären zentrale Funktionen; Warnungen zum Betriebsstopp bleiben
auf der Seite und in Bestätigungen. Die Bildreferenz ist 0.125.0; lokale
Prüfpakete nutzen die vorhandenen Metadaten 0.127.0. Diese Builds aus dem
geänderten Arbeitsbaum dienen der Prüfung und sind noch nicht der endgültige RC.

| Prüfung | Windows 11 x64 | Ubuntu 24.04.5 x64, Hyper-V |
| --- | --- | --- |
| Lokale Pflichtprüfung | 255 Tests: 253 bestanden, zwei Ubuntu-Prüfungen übersprungen; vollständiger bildfreier Oberflächentest bestanden | 255 Tests: 252 bestanden, Windows-Prüfung und zwei ausschließlich für wegwerfbare CI-Runner vorgesehene APT-Prüfungen übersprungen; vollständiger bildfreier Oberflächentest bestanden |
| Natives Paket | EXE gebaut; Laufzeit-, Abhängigkeits- und Hilfeprüfung des Pakets bestanden | DEB gebaut; Laufzeit-, Abhängigkeits- und Hilfeprüfung des Pakets unter Xvfb/X11 und nativem GNOME/Wayland bestanden |
| Offline-Auslieferung | Alle 36 Handbuchdateien im ASAR geprüft | Dieselben 36 Dateien geprüft; ASAR des entpackten DEB entspricht dem geprüften Paket |
| Native Desktop-Sitzung | Arbeitsabläufe aus Quellen und Paket bestanden | Vollständiger automatisierter Paketlauf in der entsperrten GNOME-/Wayland-Sitzung bestanden, einschließlich Hilfe/F1, Tastaturfokus, geschützter Test-Zugangsdaten und Speichern beim Beenden |

Der abschließende Ubuntu-Desktop-Lauf nutzte `Z2MA_SMOKE_TIMEOUT_MS=90000 node
scripts/smoke-packaged.mjs --no-capture` direkt in der aktiven Wayland-Sitzung,
ohne Xvfb oder Umgehung der Sandbox. Er endete mit Status null und allen
erforderlichen Ablaufbestätigungen; die Sitzung blieb durchgehend entsperrt.
Die Quellprüfsummen stimmen mit den lokal geprüften Dateien überein. Die bisher
installierte App blieb bestehen; dieser Lauf prüft das gebaute Paket, nicht dessen
systemweiten Aktualisierungs-/Entfernungsablauf.

Sämtliche App- und Netzwerkprüfungen nutzen synthetische Projekte und isolierte
MQTT-Partner. Keine echte Z2M-Installation, Regel oder reales Gerät wurde
gesteuert. Die bisherige D7- und 0.99.0-Abnahme bleibt gültig. Die nachfolgende
saubere Matrix ist unten dokumentiert. Ubuntu-26.04-Abnahme und
Installerprüfungen zu Aktualisierung, Rückkehr und Entfernung bleiben von diesem
automatisierten Desktop-Lauf getrennt. Signierung, Veröffentlichung und Stable-Freigabe
bleiben gesonderte Entscheidungen.

Nachprüfung zu CI-Lauf 44068759284: Der Überlauf der deutschen Überschrift bei
360px wurde vor der Korrektur auf beiden Plattformen mit breiten Desktop-Schriften
reproduziert. Der Textumbruch besteht jetzt 24 Kombinationen aus Sprache, Design,
Schrift und Breite bei 360/600/1120px. Frische Quell- und Paketprüfungen bestehen
unter Windows sowie unter Ubuntu mit `CI=true`, Xvfb und Software-Rendering; alle 36
gepackten Handbuchdateien sind geprüft. Beide vollständigen `verify:local`-Läufe
bestehen mit den obigen Testzahlen und der bildfreien Erweiterungsoberfläche.
Die abschließenden Läufe wurden getrennt ausgeführt, nachdem eine erste Windows-
Erweiterungsoberflächenprüfung beim Laden der Testseite während des VM-Tests ihre
Frist überschritt. Die App-Testfrist bleibt bei 30 Sekunden. Der Tooltip-Test
wechselt den Fokus ausdrücklich, statt einen bereits aktiven Button erneut zu
fokussieren. Diese erste Nachprüfung baute Anwendungspakete mit
`npm run package`; der nachfolgende gehostete Lauf unten liefert die
Installer-Nachweise.

<a id="clean-ci-confirmation-on-2026-11-17"></a>

## Bestätigung durch saubere CI am 17.11.2026

[Lauf 44077203946](https://github.com/Burki24/Z2M-Automations/actions/runs/44077203946)
bestand Windows und Ubuntu im ersten Versuch. Beide Jobs bauten Version 0.129.0
aus Metadatencommit `9e17622a7c816b6d43d9c258ca8fc960827311c3` nach Quellcommit
`ca644ddbcfa8d929376a6f4c015a9696b9070f07`. Beide Abhängigkeits-Audits melden
null Befunde. Quellprüfungen sowie Tests gepackter und frisch installierter Apps
bestanden, einschließlich Offline-Hilfe bei 360/600/1120px in DE/EN, Hell/Dunkel
und mit System-/breiten Schriften. Alle 36 Handbuchdateien wurden in jedem Paket
geprüft. EXE-/DEB-Uploads und beide Kandidatenmanifeste wurden heruntergeladen und
abgeglichen: Die Manifeste nennen dieselbe Version und denselben Commit; Größen
und SHA-256-Werte stimmen mit den Artefakten überein. Diese Tests zu Neuinstallation
und Entfernung belegen keine Aktualisierung mit erhaltenen Anwenderdaten und
ersetzen keine native Desktop-Abnahme.

<a id="tooltip-follow-up-on-2026-11-17"></a>

## Tooltip-Nachprüfung am 17.11.2026

Der Eigentümer meldete uneinheitliche Anzeige und Schriftgrößen der Hinweise in
0.129.0. Native Titelhinweise und ausführliche Hilfen nutzen jetzt einen gemeinsamen
Desktop-Tooltip, auch bei neuen Elementen und in Dialogen. Nach einem Klick im
selben Element erscheinen Hinweise per Maus wieder. Sprachabhängige Titeländerungen
erhalten den letzten Wert und vorhandene Zugänglichkeitsbeschreibungen. Lange
Hinweise halten den Abstand zum Fensterrand ein.

Frische `verify:local`-Läufe bestehen unter Windows (253 bestanden, zwei
Plattformprüfungen übersprungen) und Ubuntu 24.04.5 (252 bestanden, drei
Plattform-/Wegwerf-CI-Prüfungen übersprungen), jeweils mit 255 Tests und der
vollständigen bildfreien Erweiterungsoberflächenprüfung. Frische Quell- und
Paketläufe bestehen auf beiden Plattformen; Ubuntu nutzt `CI=true`, Xvfb/X11,
Software-Rendering und die Chromium-Sandbox. Beide Pakete prüfen alle 36
Handbuchdateien. Quell-, Paket- und Installationstests verlangen
`DESKTOP_TOOLTIPS_OK`: echte Maus-/Tastaturereignisse, Wiederanzeige nach Klick,
deaktivierte Elemente, gebündelte Titeländerungen, Ausblenden, Dialogschriften
und DE-/EN-Texte ohne Bilder.

Ein erster Windows-Paketlauf überschritt nach erfolgreichen Tooltip-/Hilfeprüfungen
die unveränderte 30-Sekunden-Frist. Die gemeinsame Maus-/Zeitlogik wird jetzt einmal
geprüft, ergänzt um sprachabhängige Tastatur-/Titel-/Dialogprüfungen auf Deutsch.
Der abschließende vollständige Windows-Paketlauf besteht in 25,3 Sekunden;
Quellläufe und Ubuntu-Paketlauf bestehen ebenfalls die normale Frist. Weder
Produktverzögerungen noch Testfrist wurden erhöht. Diese lokalen Builds behalten
die Metadaten 0.129.0 bei und aktualisieren die installierte App nicht. Die
Tooltip-Korrektur benötigt nach Commit/Push des Eigentümers eine frische gehostete
Matrix. Tatsächliche Installer-Aktualisierungen und aktuelle native Desktop-Abnahme
bleiben gesondert.

<a id="candidate-identity-and-build-gates"></a>

## Kandidatenkennung und Build-Bedingungen

Der endgültige Kandidat benötigt Quellcommit und Push des Eigentümers. Die
bestehende Metadaten-Voraussetzung wählt anschließend einen unveränderlichen
Commit und eine Version für beide Plattformjobs. `version.json` nicht manuell
bearbeiten und keinen lokalen Prüfbuild mit alten Metadaten als endgültigen RC
verteilen.

Die Matrix prüft vor Paketbau alle Abhängigkeiten. Bestehende Quellprüfungen,
bildfreie Oberflächentests und Tests gepackter und installierter Apps gelten
weiterhin. Nach deren Erfolg und Bau des Designer-Archivs erzeugt
`npm run prepare:rc` in jedem hochgeladenen Artefakt `candidate-Windows.json`
oder `candidate-Linux.json`. Jedes Manifest enthält geprüften Commit, Version,
Build/Date, Plattform, Installergröße/-SHA-256 und Archiv-/Inhaltsprüfsummen des
Designers. Die Vorbereitung lehnt geänderte oder nicht versionierte Quellen,
abweichende Kennung und fehlende, leere oder doppelte Installer ab. Ignorierte
Build-Ausgaben sind erlaubt. Ein Manifest dokumentiert die Build-Kennung;
es ersetzt weder native Abnahme noch signiert es ein Paket.

Bewahre beide Plattformmanifeste zusammen mit EXE, DEB und Rückkehrpaketen auf.
Akzeptiere RC1 nur, wenn beide Manifeste denselben Commit und dieselbe Version
benennen und die Installerprüfsummen übereinstimmen. Pakete bleiben unsigniert
und unveröffentlicht. Stable-Einstufung, Tags, Signieren, Zusammenführen und
Veröffentlichung benötigen einen getrennten Auftrag.

<a id="packaging-dependency-remediation"></a>

## Behebung der Paketabhängigkeitsbefunde

Der Ausgangsaudit meldete acht mittlere Paketbefunde aus zwei Hinweisen:
[glob-Abbruch](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) und
[minimatch-Musterverstärkung](https://github.com/advisories/GHSA-g3hv-75wg-m249).
Diese Pakete sind Build-Werkzeuge; der reine Produktionsaudit meldete keine
Befunde.

- Kompatibles ASAR des Ursprungsprojekts auf 4.3.2 aktualisieren. Es bringt glob
  14.0.6 und den korrigierten modernen Matcher in den gesperrten Abhängigkeitsbaum.
- Der aktuelle NSIS-Builder benötigt weiterhin betroffene minimatch-9/10-Versionen.
  Die Überschreibung im Wurzelpaket betrifft nur minimatch `>=7.0.0 <11.0.1`
  und wählt 11.0.8. Benannter Matcher und die von diesen Verbrauchern genutzte
  Klasse `Minimatch` werden geprüft. Ältere aufrufbare minimatch-3/5-Verbraucher
  bleiben unberührt.
- Forge, NSIS-Maker und Laufzeitabhängigkeiten bleiben auf feste Versionen gesetzt.
  Die vom Audit-Werkzeug vorgeschlagene NSIS-Herabstufung nicht anwenden.
  Überschreibung entfernen, sobald die betroffenen Verbraucher korrigierte
  Versionen übernehmen; dann saubere Installation, Audit und tatsächlichen
  Paketbau auf beiden Plattformen wiederholen.

<a id="local-verification-on-2026-11-16"></a>

## Lokale Prüfung am 2026-11-16

- Saubere Installation mit festen Versionen, geprüfte Werkzeugvorbereitung und
  vollständiger sowie reiner Produktionsaudit bestehen; alle
  Schwachstellenanzahlen sind null.
- Unter Windows besteht `npm run verify:local` Build, Typen, Text-/Designer-Integrität,
  239 Tests und den vollständigen bildfreien Erweiterungsupdate-Oberflächentest.
  Zwei Ubuntu-spezifische APT-Tests werden unter Windows übersprungen.
- Bildfreier Quell-Smoke, Systemverknüpfungs-Oberflächentest und Paket-Smoke
  bestehen. Der tatsächliche NSIS-Setup-Bau gelingt; Produktversion und gepackte
  Anwendung lesen beide die vorhandenen Metadaten `0.119.0`. Das Designer-Archiv
  wird ebenfalls gebaut.
- Dieser nicht eingecheckte lokale Build prüft die geänderte Werkzeugkette,
  keine endgültige RC-Kennung. Frische Windows-/Ubuntu-CI, Tests installierter
  Pakete und die gezielte native Abnahme bleiben nach Quellcommit/Push des
  Eigentümers erforderlich. Lokal stand keine Ubuntu-Shell für einen neuen
  Linux-Build bereit. Echter Z2M-Zugriff, Gerätebefehle oder Bildaufnahmen
  gehörten nicht zu dieser Prüfung.

<a id="focused-native-acceptance-after-the-new-matrix"></a>

## Gezielte native Abnahme nach der neuen Matrix

Die abgeschlossene D7- und 0.99.0-Arbeitsablaufabnahme erhalten; spätere Änderungen
prüfen:

1. Installierte App aktualisieren und ein aufgehobenes `.z2ma`-Projekt öffnen.
   `.z2map` speichern/öffnen und gewählte `.z2mad`-Regeln mit benötigten
   Aktionsfolgen importieren/exportieren.
2. Mit noch nicht gesendeter lokaler Arbeit und neueren Z2M-Änderungen erneut
   verbinden. Unabhängige Zusammenführung, ausdrückliche Konfliktwahl,
   Abbruch und Wiederherstellungssicherungen prüfen.
3. Gerätenetzauswahl und typisierte Fenstergriff-/Sensorkanäle prüfen. Fehlende
   Partnerdaten müssen vor dem Stopp blockieren und bisherigen Betrieb erhalten.
4. Geprüfte Änderung mit und ohne ausdrückliche Wiederaufnahme übertragen.
   Gespeicherte Revision, bisherige Neustartpräferenz und ausgeschaltete neue
   Regeln bestätigen.
5. Native Dialoge, Mausrad-/Tastaturgrenzen, Neustart/Wiederverbindung und
   geschützte Zugangsdaten unter Windows und in angemeldeter Ubuntu-Desktop-Sitzung
   prüfen. Update, Rückkehr und Entfernung ohne Verlust aufbewahrter Projekte prüfen.

Synthetische Projekte und isolierte Partner verwenden. Echter Zugriff und
tatsächliche Gerätebefehle benötigen eigene praktische Testfreigabe.
Betriebssystem-/Paketversionen und Ergebnisse je Plattform getrennt erfassen.
Headless-CI nicht mit Desktop-Abnahme gleichsetzen. Blockierende Befunde vor
Stable beheben; während dieser Kandidatenrunde keine sachfremden Funktionen
ergänzen.
