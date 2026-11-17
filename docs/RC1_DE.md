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
gesteuert. Die bisherige D7- und 0.99.0-Abnahme bleibt gültig. Nach Commit/Push
des Eigentümers die saubere Matrix erneut prüfen. Ubuntu-26.04-Abnahme und
Installerprüfungen zu Aktualisierung, Rückkehr und Entfernung bleiben von diesem
automatisierten Desktop-Lauf getrennt. Signierung, Veröffentlichung und Stable-Freigabe
bleiben gesonderte Entscheidungen.

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
