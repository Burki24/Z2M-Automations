<a id="adr-0004-common-draft-check-and-guided-desktop-transfer"></a>

# ADR 0004: gemeinsame Entwurfsprüfung und geführte Desktop-Übertragung

**Deutsch | [English](0004-guided-draft-transfer.md)**

- Datum: 2026-11-12
- Status: Für die eigenständige App umgesetzt; vom Eigentümer gemeldete
  Arbeitsablaufabnahme mit Anwendung 0.99.0 am 2026-11-13 abgeschlossen.

<a id="decision"></a>

## Entscheidung

Prüfen und Übertragen in den Schritten 7 und 8 getrennt halten. Die gemeinsame
Aktion **Entwurf prüfen** wählt ihren Modus im Hauptprozess anhand des frisch
gespeicherten Dokuments:

- Inhalt, Reihenfolge, Aktionsfolgen oder Partnerfreigaben geändert: vollständigen
  Kandidaten mit allen Automationen ausgeschaltet prüfen und bisherige
  Übertragungsrichtlinie erhalten.
- Nur Regelschalter geändert: vorgesehene Ein-/Ausschalter ohne Inhaltsänderung
  prüfen. Lokale Revisionszähler beeinflussen diese Einteilung nicht.
- Dokumente stimmen überein: keine Übertragung nötig melden und unnötiges
  Speichern verhindern.

Die strikte Aktion `validateEnabled` bleibt ein interner Kompatibilitätseinstieg;
die App zeigt eine einzige Prüfaktion. Offline-Prüfungen bleiben lokal und
erlauben keine Übertragung. Entfernte Prüfung liest nur und stoppt/startet
keinen Betrieb.

Schritt 8 übernimmt den geprüften Kandidaten. Der Hauptprozess bestätigt Ziel,
Ersetzungsumfang, Änderungen, Schalterrichtlinie und automatischen Stopp.
Der Benutzer wählt vor jedem Steuerbefehl eine private Sicherung. Abbrechen
erhält den Betrieb. Der Hauptprozess prüft genehmigtes Projekt, Endpunkt,
Entwurf, Sitzung, Build und Basis erneut und stoppt danach bei Bedarf den
Automatikbetrieb. Ein frisch gestoppter Betriebswunsch bestätigt den Stopp
auch bei weiterhin wahrer gespeicherter Wiederherstellungspräferenz.

Der Hauptprozess prüft genauen Kandidaten und frische Fähigkeiten erneut,
sendet eine Speicheranfrage mit Sitzungs-/Revisionsvorbedingungen und prüft
unabhängig gespeichertes YAML, Prüfsumme, Revision, Build und gestoppten Zustand.
Der Betrieb bleibt gestoppt. Das Ergebnis bietet Navigation zum einmaligen Test
oder Automatikbetrieb, jeweils mit eigener ausdrücklicher Aktion.
Konfigurationsübertragung startet Z2M niemals neu.

Speicherbelege beschreiben bestätigtes Speichern und frisch bestätigte Anzahl
eingeschaltet/gesamt, ohne dauerhaft ausgeschalteten oder gestoppten Zustand zu
behaupten. Spätere Revision oder Erweiterungsbuild machen Beleg und
Übertragungsbewertung ungültig. Verlorene Aktualität, laufendes Lesen oder
ungeklärte Übertragung/Update ersetzen grünen Erfolg durch eine Warnung zum
unbestätigten Stand. Geplante Übertragungsanweisungen werden nach Erfolg
ausgeblendet.

Fortschritt ist eine begrenzte Darstellung, die bei belegter
Änderungswarteschlange lesbar bleibt. Unbestätigter Stopp blockiert Speichern;
unbestätigtes Speichern blockiert weitere Übermittlung und manuelle Starts bis
zum Abgleich. Statusprüfungen senden keine Steueranfragen. Fehlende Antworten
werden über unabhängige Nachweise geklärt, niemals durch erneute Befehle.

Die Betriebsseite bietet auch direkte Freigaben gespeicherter Regeln mit
bestätigter Anzahl eingeschaltet/gesamt. Ein begrenzter Befehl `setRuleFlags`
trägt gewählte stabile Kennungen und einen undurchsichtigen, an Projekt,
Endpunkt, lokalen Entwurf und gespeicherte Kennung gebundenen Kontext.
Der Hauptprozess liest das gespeicherte Dokument erneut und übernimmt nur
gewählte Schalter über denselben Pfad aus Validierung, ausdrücklicher
Bestätigung, Sicherung, Stopp und geprüftem Speichern. Passende Entwürfe werden
nach Erfolg synchronisiert, abweichender lokaler Inhalt bleibt erhalten.
Kontextänderungen lehnen veraltete Auswahlen ab. Diese Aktion startet nie
Betrieb und kann Sperren ungeklärter Übertragung/Updates nicht umgehen.

<a id="scope-and-evidence"></a>

## Umfang und Nachweise

Nur Desktop-Ablaufsteuerung, Desktop-Renderer und DE-/EN-Meldungen ändern sich.
Symcon-Formulare, maßgebliche Erweiterung/Schema und festgelegtes Laufzeitartefakt
bleiben unverändert. Tests verwenden die echte mitgelieferte Erweiterung und
synthetische MQTT-Partner für automatische Einteilung, Zustimmung und
Sicherungsreihenfolge, Abbruch, veraltete Entwürfe/Sitzungen, fehlende Antworten,
unklare Ergebnisse und Routing zwischen acht Systemen. Die vorhandenen
DOM-Testdaten prüfen zusätzlich einzige Aktion, Modusrückmeldung und Fortschritt
laufender Übertragung in DE/EN ohne Bildaufnahme. Automatisierte Testergebnisse
und praktische Arbeitsablaufabnahme des Eigentümers mit 0.99.0 sind getrennte
Nachweise. Siehe [D7-Abnahme](../D7_DE.md#post-d7-workflow-acceptance-0990) für
bestätigte Fälle bestehender, neuer und systemübergreifender Automation und deren
Umfang.
