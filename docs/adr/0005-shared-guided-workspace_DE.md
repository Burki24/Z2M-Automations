<a id="adr-0005-shared-guided-workspace-for-desktop-and-symcon"></a>

# ADR 0005: gemeinsamer geführter Arbeitsbereich für Desktop und Symcon

**Deutsch | [English](0005-shared-guided-workspace.md)**

- Datum: 2026-11-13
- Status: Lokal umgesetzt; native Symcon-Abnahme nach Update bleibt getrennt.

<a id="decision"></a>

## Entscheidung

Die abgenommene Desktop-Navigation und das höhenabhängige Layout nach
`packages/designer/src/guided-workspace.js` und `guided-workspace.css` auslagern.
Beide Produkte nutzen denselben nummerierten Rahmen, Automationsliste,
Ablaufansicht, Eigenschaften, Formular und übersetzte Validierungserklärungen.
Das vorhandene Scrollelement und sein responsives Einklappen erhalten. Das
Einklappen in einen eigenen Werkzeugbereich zu verschieben würde
Mausradbehandlung stören. Der Desktop-Einstieg exportiert die gemeinsame
Implementierung erneut.

Der Symcon-Darstellungsadapter wird im selben versionierten Designer-Archiv
ausgeliefert. PHP-Kontrolle, Speicherung, native Kachel, Einbettung und
Interaktionshilfen bleiben im Symcon-Repository maßgeblich. Symcon übernimmt
geprüfte festgelegte Dateien statt einer zweiten bearbeitbaren Oberfläche.
Produktpaletten bleiben unabhängige Anbieter semantischer Farbwerte.

<a id="native-adaptation"></a>

## Native Anpassung

Symcon verwendet eine vorhandene Automationszentrale, übergeordnete
MQTT-Instanzen und Dokumente je System statt portabler Desktop-Projekte und
Desktop-Zugangsdaten-Tresor. Die ersten Seiten erklären native Einstellungen
und listen vorhandene Verbindungen. Ausdrückliche Systemzuordnung verwendet
vorhandene Kandidaten-, Eigentums- und Fingerabdruckprüfungen. Nur die
konfigurierende Zugriffssitzung erhält den geänderten Umfang. Andere Sitzungen
müssen neu öffnen; Zugangsdaten gelangen niemals in die gemeinsame Oberfläche.

Prüfen bleibt von Übertragen getrennt. Befunde benennen Regel und Feld und
können dieses im gemeinsamen Editor öffnen. Schritt 8 erfasst ausdrückliche
Zustimmung, liest frischen Betriebsstatus, stoppt bei Bedarf Betrieb,
Neustartabsicht und übrige Läufe, prüft erneut und speichert einmal über das
bestehende begrenzte native Protokoll. Abfragen zwischengespeicherter GET-Daten
sind begrenzt und wiederholen nie Änderungen. Betriebsstart bleibt standardmäßig
getrennt. Eine je Übertragung zunächst abgewählte Option kann zuvor bestätigt
aktiven Betrieb nur nach erfolgreichem Speichern, frischem Rücklesen und
Aktivierungsprüfungen wieder aufnehmen. Sie erhält die gespeicherte
Neustartpräferenz, gibt niemals neue Regeln frei und wiederholt keine
unterbrochenen Einzelläufe. Fehlende Bestätigung verhindert Aktivierung;
eine unklare Aktivierung wird nie automatisch wiederholt. Native
Ein-/Ausschalter und Laufzeitsicherungen bleiben nativ. Desktop-Sicherungsdialog
und Alles-aus-Inhaltsrichtlinie werden Symcon nicht stillschweigend auferlegt.

Der native Adapter stellt bestätigten `resumeStatus` getrennt von der
gespeicherten Neustartpräferenz bereit. `stopped` bestätigt den aufgehobenen
dauerhaften Startwunsch und erhält die Präferenz; die geführte Übertragung darf
dann prüfen und speichern. Eine eingeschaltete Präferenz allein bedeutet keinen
aktiven Neustartwunsch. Fehlende oder weiterhin vorgemerkte Bestätigung nach
Stopp verhindert Speichern ohne erneuten Stoppbefehl.

Nach erfolgreicher Übertragung darf der gemeinsame Leser einen fehlgeschlagenen
vollständigen GET-Stand bei ausdrücklich vorübergehender Nichtverfügbarkeit oder
veraltetem Stand einmal neu beginnen. Katalogseiten unterschiedlicher Stände
werden niemals kombiniert. Zugriffsfehler und fremde Bindungen bleiben endgültig;
Änderungen liegen außerhalb dieser Wiederherstellung.

Die native Betriebsseite kann den lokalen Ein-/Ausschalter einer Regel über
den vorhandenen authentifizierten Bearbeitungsendpunkt ändern. Prüfen und
Übertragen bleiben ausdrücklich. Gespeicherte Einschaltanzahlen benötigen ein
passendes bestätigtes Dokument. Ein lokales Kontrollkästchen belegt keine
wirksame Z2M-Freigabe.

<a id="verification"></a>

## Prüfung

Die gemeinsame Bereitschaftsanzeige stellt bestätigten Empfängerbetrieb aus
der Systemübersicht jedes Adapters dar. Sie löst entfernte Bedingungs-/Aktions-/
Aktionsfolgenverweise anhand eindeutiger Basistopics auf und navigiert über
stabile Systemkennungen zur vorhandenen Betriebsseite. Die Vorbereitung erklärt
Freigaben, Zielaktivierung und Quellaktivierung. Jeder Start behält seine
vorhandene ausdrückliche Bestätigung und native Kontrolle; Gruppenstart,
Befehlswiederholung oder automatische Übertragung werden nicht eingeführt.
Bestätigungen benennen gespeicherte freigegebene Regeln und erklären reinen
Partnerempfang ohne eingeschaltete lokale Regeln getrennt.

Synthetische PHP-Kernel-/MQTT-Partner und Headless-Browser-/Kacheltestdaten
verwenden. Zuordnungsrechte und Sitzungsumfangsänderungen, genaue lokale
Bearbeitung, Feldkorrektur, Abbruch, Stopp-/Prüf-/Speicherreihenfolge, fehlende
Bestätigungen, DE-/EN-Eingabeerhalt, responsives Layout und echte Mausradbewegung
prüfen. Echter Systemzugriff oder Bildaufnahme sind nicht nötig. Desktop-Quell-Smoke
und vorhandene Mausrad-/Layoutregression schützen die abgenommene Anwendung
während der Auslagerung.
