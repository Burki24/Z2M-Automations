<a id="d7-installed-beta-acceptance"></a>

# D7: Abnahme der installierten Beta

**Deutsch | [English](D7.md)**

<a id="completed-acceptance"></a>

## Abgeschlossene Abnahme

Desktop-CI baut bereits Windows-x64- und Ubuntu-24.04-Pakete und prüft Renderer
und vorbereitete native Programme. D7 ergänzt Smoke-Tests für installierte EXE
und DEB auf wegwerfbaren Runnern. Die Tests installieren, starten gegen einen
Loopback-MQTT-Partner mit isoliertem Profil und deinstallieren. Beide
Installationsprüfungen bestanden in
[CI-Lauf 42614544572](https://github.com/Burki24/Z2M-Automations/actions/runs/42614544572).
Der Ubuntu-Runner verwendet Xvfb.

Der Eigentümer meldete erfolgreiche Windows-Desktop-Abnahme.

Der Eigentümer bestätigte den Start aus dem Ubuntu-Anwendungsmenü unter Hyper-V.
Update von 0.29.0 auf 0.30.0, Rückkehr zu 0.29.0 und Projektimport gelangen in
dieser VM. Geschützte Zugangsdaten blieben nach Neustart des Gasts verfügbar.
Nach Deinstallation und Neuinstallation waren Projekt und Sicherung weiterhin
vorhanden; der Entwurf ließ sich wieder öffnen.

D7 ist für Windows und Ubuntu Desktop 24.04 unter Hyper-V abgeschlossen.
Ubuntu Desktop 26.04 bleibt ein zusätzliches Abnahmeziel.

Verwende das [englische Anwenderhandbuch](USER_GUIDE.md) oder
[deutsche Anwenderhandbuch](USER_GUIDE_DE.md) für Installation, Betrieb, Updates
und Rückkehr zur Vorversion. Halte für den Abnahmelauf beide Paketversionen
und ein synthetisches portables Projekt bereit.

<a id="post-d7-regression-acceptance-0690"></a>

## Regression nach D7: 0.69.0

Am 2026-11-11 meldete der Eigentümer erfolgreiche praktische Prüfungen mit der
installierten Ubuntu-App, Version 0.69.0:

- Beide konfigurierten Mosquitto-Broker verbanden sich beim Projektöffnen
  automatisch.
- Fehlende Zugangsdaten und gesperrter Schlüsselbund lieferten die erwarteten
  Korrekturhinweise.
- Entwurfsdialoge ließen sich sofort nach Abbrechen oder Übernehmen wieder
  öffnen und blieben bedienbar.

Dies sind vom Eigentümer gemeldete manuelle Ergebnisse dieser Ubuntu-Installation,
getrennt von CI. Ubuntu-Version und Details der Anzeigesitzung wurden bei dieser
Nachprüfung nicht erneut bestätigt; der bestehende D7-Plattformumfang bleibt
unverändert.

<a id="post-d7-workflow-acceptance-0990"></a>

## Arbeitsablaufabnahme nach D7: 0.99.0

Am 2026-11-13 bestätigte der Eigentümer parallel zur Entwicklung den erfolgreichen
praktischen Abschluss dieser Desktop-Abläufe mit Anwendungsversion 0.99.0:

- Bestehende Automation bearbeiten.
- Neue Automation erstellen.
- Systemübergreifende Automation einrichten.

Jeder Fall umfasste bestätigte Übertragung an Zigbee2MQTT und Ausführung. Diese
Arbeitsabläufe sind für 0.99.0 abgenommen. Plattform- und Sitzungsdetails wurden
für diese Runde nicht angegeben; der bestehende D7-Plattformumfang bleibt
unverändert. Spätere Änderungen benötigen eigene gezielte Regressionstests.

<a id="native-desktop-acceptance"></a>

## Native Desktop-Abnahme

Führe diese Folge unter Windows 11 x64 und Ubuntu Desktop 24.04 LTS x64 aus.
Wiederhole sie unter Ubuntu Desktop 26.04 LTS, bevor du diese Version als geprüft
bezeichnest.

1. Installiere das ältere Paket. Prüfe unter Windows deutsches und englisches
   Setup, beide Installationsbereiche und einen eigenen abweichenden Ordner.
   Bestätige die UAC-Abfrage bei Installation für alle Benutzer. Prüfe unter
   Ubuntu Menüstart und Schlüsselbundzugriff in einer angemeldeten Desktop-Sitzung.
2. Speichere ein synthetisches Projekt mit System und ausgeschaltetem Entwurf.
   Erstelle eine portable Sicherung, schließe und starte die App erneut und
   öffne die gespeicherte Datei wieder.
3. Aktualisiere mit dem neueren Paket. Öffne das Projekt und vergleiche
   Entwurfsinhalt und Systemkennungen mit der Sicherung vor dem Update. Prüfe
   gewählte App-Sprache und geschützte Zugangsdaten, soweit unterstützt. Starte
   das Betriebssystem neu und wiederhole Start- und Öffnungsprüfungen.
4. Folge dem Verfahren zur Rückkehr mit dem aufgehobenen Paket. Prüfe, dass sich
   die Sicherung vor dem Update öffnen lässt und Entwurf und Systembindungen
   behält.
5. Deinstalliere. Prüfe, dass EXE, Anwendungsmenüeintrag und Paketregistrierung
   entfernt, gespeichertes Projekt und Sicherung aber noch vorhanden sind.
   Installiere erneut und öffne das erhaltene Projekt.
6. Erfasse Betriebssystemversion, Paketversionen, ausgeführte Prüfungen und
   Fehler je Plattform. Verwende synthetische Daten und einen isolierten Partner.
   Echte Erweiterungsinstallation und Gerätebefehle benötigen getrennte Freigabe.

Veröffentlichung und Signierung benötigen einen getrennten Auftrag.
