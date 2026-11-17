<a id="shared-designer"></a>

# Gemeinsamer Designer

**Deutsch | [English](README.md)**

Der gemeinsame Regeleditor enthält restart_policy (abort, resume, resume_expired)
mit deutschen/englischen Beschriftungen und verlustfreier Vorbelegung. Er
bearbeitet nur den lokalen Entwurf; Ausführung und dauerhafte Wiederherstellung
wartender Läufe bleiben Aufgabe der Z2M-Erweiterung.

Maßgebliche HTML-, CSS-, JavaScript- und lokale deutsche/englische JSON-Kataloge
für Symcon- und Desktop-Produkte. Die ursprüngliche Quelle wurde aus
Burki24/Symcon_Z2MAutomations auf cd5cfc33c921365c69814078238444c3ea7d5ac5
ausgelagert. Vorhandene PolyForm-Noncommercial-1.0.0-Hinweise bleiben in LICENSE.

Bearbeite hier src und führe im Repository-Wurzelverzeichnis npm run pack:designer
aus. Dies erzeugt in artifacts ein versioniertes lokales npm-Archiv mit Lizenz,
Herkunft und SHA-256-Prüfsummen jeder ausgelieferten Datei. Die Inhaltskennung
des Manifests deckt die vollständige geordnete Dateizuordnung ab. Prüfsummen
erkennen Änderungen; sie sind keine Herausgebersignatur. Es findet keine
Veröffentlichung in einer Registry statt.

Symcon übernimmt das geprüfte Archiv über sein Werkzeug tests/import-designer.mjs
und committet die daraus erzeugten festgelegten Dateien. Seine Prüfungen
kontrollieren dieses Manifest ohne dieses Repository, Netzwerkdownload oder
Desktop-Laufzeit zu benötigen. Native Kachel, zentrale Interaktionshilfe,
PHP-Adapter und Z2M-Erweiterung bleiben in ihren bestehenden Repositories.
Die dort ausgelieferten Designer-Dateien nicht bearbeiten.

native-messages.json erhält die vorhandenen Symcon-Darstellungsvorlagen
einschließlich printf-Platzhaltern. Es sind Adapterdaten; zum Bauen oder
Ausführen des Desktops ist kein PHP-Interpreter nötig. Bei späterem
Adapterupdate Änderungen nativer Meldungen und Katalogschlüssel zusammen pflegen.

transport.js bildet die Produktgrenze: Der Webadapter behält seinen
authentifizierten fetch-Vertrag; Desktop installiert vor reader.js einen festen
IPC-Adapter. Jedes Backend prüft seine eigenen lokalen Bearbeitungs-, Datei-,
Abgleich- und ausdrücklichen Steueranfragen. draft-merge.js liefert reine
kennungsbasierte Zusammenführung und portable Containerfunktionen; der
Desktop-Build übernimmt deren genaue Inhalte für den Hauptprozess.
draft-files.js und draft-sync.js liefern die gemeinsamen DE-/EN-Bedienelemente.
Native Dateidialoge, allgemeiner Dateizugriff, Zugangsdaten und MQTT bleiben
außerhalb des Renderers.
