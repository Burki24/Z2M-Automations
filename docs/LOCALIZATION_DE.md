<a id="d0-dependency-free-designer-localization"></a>

# D0: Designer-Lokalisierung ohne zusätzliche Abhängigkeiten

**Deutsch | [English](LOCALIZATION.md)**

Stand: 2026-11-07. Seit der D1-Auslagerung liegen die maßgeblichen Quellen in
packages/designer/src. Symcon übernimmt geprüfte Artefakte mit festgelegter
Version. Desktop lädt dieselben Kataloge lokal; die Abnahme der installierten
App bleibt getrennt.

<a id="implemented"></a>

## Umgesetzt

- Lokale JSON-Kataloge in locales/de.json und locales/en.json, stabile
  Meldungsschlüssel und benannte Platzhalter. Kein Übersetzungspaket, Download
  oder Online-Dienst.
- Die Browsersprache liefert den Standard. Eine gespeicherte manuelle Wahl hat
  Vorrang; Englisch ist der Rückfall. Die Desktop-Auswahl steht im App-Kopf.
  Die Symcon-Auswahl bleibt in Browser und Kachel auch in offenen HTML-Dialogen
  erreichbar.
- Texte und Darstellungsattribute ändern sich an Ort und Stelle. Eingaben,
  eingegebene Werte, Gerätesuche, Kanäle, Wochentage, Schrittfolge, geänderte
  Wartezeiten und Scrollposition bleiben erhalten.
- Natives Intl übernimmt Zahlen, Daten und Pluralformen. Namen, Szenennamen,
  Kennungen, MQTT-Werte, Regelzeiten und Zeitzonen bleiben Daten.
- Native Antworten behalten ihren Text und ergänzen begrenzte
  Darstellungsschlüssel/-parameter. Die ausführliche Validierung nutzt in
  beiden Sprachen den vorhandenen Formatierer mit Bindung an ihren ursprünglichen
  Auftrag/Kontext. Unbekannter Anbietertext bleibt unverändert.
- Ein geschützter Diagnoseendpunkt erhält nur Sprachcodes und ein Kennzeichen
  für einen offenen Editor. Er protokolliert deutsche native Diagnose, verändert
  keinen Entwurf und sendet kein MQTT.

<a id="verify-the-pinned-integration-in-the-symcon-repository"></a>

## Fest übernommene Integration im Symcon-Repository prüfen

~~~sh
npm run check:locales
node --import ./tests/locale-setup.mjs --test tests/designer-localization.test.mjs
php tests/designer.php
~~~

In diesem Repository erzeugt npm run pack:designer aus den maßgeblichen Quellen
locales.js und den nativen Darstellungsindex. Symcon importiert das geprüfte
Archiv mit node tests/import-designer.mjs <archive.tgz>; seine Prüfungen sind
lesend. Sie weisen fehlende Schlüssel, inkompatible Platzhalter, Markup in
Katalogen, unbekannte Ansichtsschlüssel und veraltete Artefakte zurück.

Der Offline-Test tests/designer-localization.browser.mjs startet einen eigenen
Loopback-Server und synthetische Systeme. Z2MA_PLAYWRIGHT_MODULE verweist auf eine
vorhandene Playwright-Installation. Er installiert keine Abhängigkeit und
kontaktiert weder echte Broker noch Symcon-Instanzen. Er prüft offene Bearbeitung
und nachfolgende synthetische Entwurfsübermittlung, Standard-/Rückfall-/Wahlsprache,
Systemtrennung, echtes Mausrad sowie Layouts mit 360/1920/3840 Pixeln.

Dies sind Prüfungen des gemeinsamen Designers unter Windows, keine
Desktop-Plattformabnahme. Eine echte Symcon-/Kachelprüfung nach Modulupdate
bleibt getrennt. Es wurde kein echtes System verändert. D1 hat das gemeinsame
Paket ausgelagert und prüft den echten Windows-Renderer. Ausgelieferte Oberfläche
oder Kataloge in Symcon nicht unabhängig bearbeiten.
