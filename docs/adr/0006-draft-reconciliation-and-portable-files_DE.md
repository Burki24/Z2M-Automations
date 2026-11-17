<a id="adr-0006-reconcile-connected-workspaces-and-separate-projectdraft-files"></a>

# ADR 0006: verbundene Arbeitsstände abgleichen und Projekt-/Entwurfsdateien trennen

**Deutsch | [English](0006-draft-reconciliation-and-portable-files.md)**

- Datum: 2026-11-15
- Status: Umgesetzt; Live- und Plattformabnahme bleiben getrennt.

<a id="decision"></a>

## Entscheidung

Das erste vollständige Verbindungslesen initialisiert die lokale Arbeitskopie
eines Netzes. Spätere Lesevorgänge vergleichen diese Kopie, die tatsächlich
zuletzt akzeptierte entfernte Konfiguration und das frische entfernte Dokument.
Stabile Regel- und Aktionsfolgenkennungen identifizieren Einträge, keine Namen.
Unabhängige Ergänzungen, Änderungen und Löschungen werden automatisch
zusammengeführt. Abweichende Änderungen, Bearbeiten/Löschen-Paare und
inkompatible Partnerfreigaben verlangen eine ausdrückliche Wahl lokal/entfernt.
Eine ältere Revision/Prüfsumme ohne Inhalt belegt keinen gemeinsamen
Ausgangsstand. Fehlende Ausgangsdaten werden vorsichtig behandelt.

Die reinen maßgeblichen Funktionen für Zusammenführung und Entwurfscontainer
liegen im gemeinsamen Designer. Der Build übernimmt ihre genauen Funktionskörper
als CommonJS für den Desktop-Hauptprozess. Natives PHP setzt denselben Vertrag
unabhängig durch. Weder Renderer noch importierte Dateien dürfen maßgebliche
Validierung, aktuelle Bindungen oder den lokalen Vergleich vor Übernahme umgehen.
Das Anwenden von Entscheidungen prüft erneut einen frischen entfernten Stand.

Lesen und Zusammenführen betreffen nur lokale Arbeit. Offene Formulare bleiben
erhalten, unsichere Leseergebnisse lösen keine Steuerwiederholungen aus und
niedrigere entfernte Revisionen können lokale Arbeit nicht zurücksetzen.
Desktop bietet vor dem ersten Lesen ausdrückliche Offline-Bearbeitung.
Der native Designer fordert je beobachteter Verbindung automatisch einen
Lesevorgang an; reine Ansichtsaktualisierungen wiederholen ihn nicht. Native
Zuordnung/Einrichtung bleibt ausdrücklich.

Jede angewendete Zusammenführung/jeder Import erstellt automatisch eine private
Wiederherstellungssicherung. Rückgängig erfordert genau den resultierenden
lokalen Stand; spätere Änderungen machen diesen Kurzbefehl ungültig. Die nächste
Übertragung benötigt weiterhin frische Prüfungen und getrennte Bestätigung.
Ungeklärter oder fehlgeschlagener Abgleich lässt sich nicht über die
Übertragungs-API umgehen. Unfertige Arbeitsregeln können weiterhin gelesen,
kombiniert und als Entwurf gespeichert werden. Vollständige Laufzeit-Schema-/
Fähigkeitsprüfungen bleiben vor Übertragung verpflichtend. Neue Regeln und
importierte Ergänzungen bleiben aus. Bestehende entfernte Schalter bleiben beim
Lesen erhalten; Dateiimporte können Partnerfreigaben des Ziels nicht erweitern.

<a id="file-contracts-and-compatibility"></a>

## Dateiverträge und Kompatibilität

- `.z2map` ist die Standard-Projektendung der eigenständigen App. Projektformat 2
  speichert Broker, Netzzuständigkeit, lokale Entwürfe, gespeicherte Beobachtungen
  und akzeptierten Basisinhalt. Zugangsdaten bleiben extern. Format 1 und
  bestehende `.z2ma`-Dateien öffnen weiterhin; Speichern schreibt Format 2 ohne
  automatische Umbenennung eines alten Pfades.
- `.z2mad` ist ein versionierter JSON-Container `z2m-automations-draft` mit
  Quellnetzkennung, gewählten Regeln, benötigten Aktionsfolgen und bei
  vollständigem Export der Vergleichsbasis. Er funktioniert in App,
  Browserdesigner und Kachel.
- Native `.z2map`-Arbeitsstandsicherungen enthalten sämtliche zugeordneten lokalen
  Netzentwürfe ohne native Instanzberechtigung oder Broker-Zugangsdaten. Beide
  Produkte können Regeln aus diesen Sicherungen oder eigenständigen
  Projektdateien zu einem ausdrücklich gewählten bestehenden Zielnetz hinzufügen.
  Verbindungserstellung/-zuständigkeit wird niemals importiert.
- YAML-/JSON-Konfigurationsaustausch bleibt getrennt verfügbar. Ein portabler
  Entwurf ergänzt Einträge und ersetzt nicht den gesamten Zielarbeitsstand.

Dateiauswahl, Quell-/Zielzuordnung, Versionsentscheidungen und Bestätigung sind
gemeinsam und übersetzt. Native Dateisystemdialoge und Desktop-Lesen/-Schreiben
bleiben im Hauptprozess. Browserdownloads und vom Benutzer ausgewählte
Browserdateien bleiben innerhalb der Browser-API.

<a id="verification"></a>

## Prüfung

Synthetische Tests prüfen unabhängige Änderungen, unbekannte Basis, gleichzeitige
Eingaben, unterbrochenes Lesen, Freigabekonflikte, private Wiederherstellung,
Projektwiederöffnung und Altformate. Bildfreie Electron- und Browser-/Kacheltests
prüfen die tatsächlichen Bedienelemente. Erforderliche Abschlussbefehle und ihre
Nachweise stehen in DEVELOPMENT.
