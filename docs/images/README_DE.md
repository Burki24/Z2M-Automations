<a id="user-guide-screenshots"></a>

# Bildschirmbilder der Anwenderhandbücher

**Deutsch | [English](README.md)**

Dies sind genehmigte Aufnahmen des tatsächlichen gemeinsamen Desktop-Renderers
und seiner Bestätigungsvorlage mit isolierten synthetischen Darstellungsdaten.
Echte Broker, Geräte, private Projekte, Zugangsdaten-Dialoge oder Desktop wurden
nicht aufgenommen. Beide Sprachsätze zeigen dieselben Situationen und sind keine
über ein Bild gemalten Übersetzungen. Geräte- und Projektnamen sind je Sprache
eigens erstellte Beispieldaten; die Anwendung übersetzt benutzerdefinierte Namen
nicht.

Die Renderer-Referenz steht in manifest.json: Anwendungsversion, Inhaltskennung
des gemeinsamen Designers, Aufnahmeplattform und Abmessungen jedes Bildes.
Windows lieferte die Aufnahmeumgebung. Dies sind gemeinsame Anwendungsansichten,
keine Nachweise nativer Ubuntu-Installations-/Schlüsselbunddialoge oder echter
Ausführung. Unterschiede der Betriebssysteme beschreiben die Handbücher.

<a id="regenerate-after-permission"></a>

## Nach Freigabe neu erstellen

Vor jeder künftigen Aufnahme nach der globalen Aufnahmeregel die ausdrückliche
Freigabe für diese Dokumentationsaufgabe einholen. Der folgende Befehlsschalter
ist eine zusätzliche Absicherung und ersetzt die Zustimmung des Benutzers nicht.
Vorher Ziel (diese App), Zweck (Anwenderdokumentation) und Umfang (synthetische
DE-/EN-Ansichten) benennen.

~~~sh
npm run build
node scripts/capture-user-guide.mjs --approved
~~~

Das Skript verwendet die bestehende Electron-Abhängigkeit, ein wegwerfbares
Profil und lokale kompilierte Dateien. Seine Testdaten haben weder
MQTT-Transport noch allgemeine Dateivorgänge oder Zugangsdatenzugriff. Es nimmt
nur App-Inhalte auf und schließt die App danach. Es läuft weder in der CI noch
in den normalen Prüfbefehlen.

Beide Sprachsätze visuell prüfen, Links und übereinstimmende Situationsnamen
kontrollieren und anschließend die bildfreien lokalen Pflichtprüfungen
ausführen. Bildänderungen zusammen mit passenden Handbuch- und Manifeständerungen
halten. Native Installationsaufnahmen sind getrennt auf dem genannten
Betriebssystem nach eigener eingegrenzter Zustimmung zu erstellen.
