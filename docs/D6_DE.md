<a id="d6--activation-and-operation"></a>

# D6 – Aktivierung und Betrieb

**Deutsch | [English](D6.md)**

<a id="operator-workflow"></a>

## Bedienablauf

Die gewählte Automation zeigt die Z2M-Netze, die ihre entfernten Gerätebedingungen
und Aktionen einschließlich wiederverwendbarer Aktionsfolgen benötigen. Rot
bedeutet bestätigt gestoppt, Gelb unbekannt und Grün bestätigt aktiv. Jedes
bekannte Ziel öffnet direkt die Betriebsseite dieses Netzes. Eine
Zurück-Schaltfläche führt ins ursprüngliche Netz. Die Betriebsseite listet die
von freigegebenen gespeicherten Regeln verwendeten Ziele und erklärt die
Reihenfolge: Freigaben wählen, Empfängernetze aktivieren, dann die Quelle
aktivieren. Navigation startet und überträgt nichts.

Die Aktivierungsbestätigung listet gespeicherte Regeln auf, die aktiv werden.
Ein Netz mit gespeicherten Partnerfreigaben kann stattdessen **Partnerempfang**
ohne freigegebene lokale Regeln aktivieren. Die Bestätigung erklärt, dass nur
Partnerempfang eingeschaltet wird. Netze ohne freigegebene Regeln und ohne
gespeicherte Freigaben bleiben gesperrt. Diese Anzeigen bestätigen nur den
Laufzeitstatus, keine korrekte MQTT-Brücke oder ACL und keine physische Wirkung.

Öffne **Betrieb** und wähle ein System. Regelliste und Ausführungsstatus stammen
aus der gespeicherten Revision. Ein Einzellauf kann eine ausgeschaltete
gespeicherte Regel ausführen. Die Erweiterung prüft Bedingungen, leitet lokale
und erlaubte entfernte Gerätebefehle weiter und meldet das Ergebnis.

Inhaltsänderungen werden mit allen Regeln ausgeschaltet gespeichert, sofern
Schritt 8 nicht ausdrücklich den bisherigen Betrieb mit den bereits im geprüften
Entwurf gesetzten Freigaben wieder aufnimmt. Diese einmalige Option gibt nie
eine neue Regel frei; neue Regeln bleiben bis zur ausdrücklichen Freigabe aus.
Die bisherige Neustartwiederherstellung bleibt unabhängig von der Übertragungswahl
erhalten. **Betrieb** zeigt die frisch bestätigte Anzahl freigegeben/gesamt und
erklärt die Startsperre bei fehlenden Freigaben. Wähle gewünschte gespeicherte
Regeln in der sortierten scrollbaren Liste und **Freigaben prüfen und übernehmen**.
Der Hauptprozess prüft die genaue gespeicherte Revision, validiert reine
Schalteränderungen, fragt ausdrücklich nach Bestätigung und erstellt vor
Betriebsstopp und einmaligem Speichern eine private Sicherung. Unabhängiges
Rücklesen bestätigt das Ergebnis. Aktivierung bleibt getrennt, sofern die
Übertragungsbestätigung nicht ausdrücklich zuvor aktiven Betrieb fortsetzen soll.
Der Freigabestatus verwendet Text und Desktop-Farben: Rot **Nicht bestätigt**
bei geänderter/veralteter Auswahl oder abgelehnter Prüfung; Gelb **Unbekannt**
bei getrennter Verbindung, Lesen, Übernehmen oder Abgleichen einer ungeklärten
Übertragung/eines Updates; Grün **Bestätigt**, wenn die Auswahl mit frisch
bestätigten Z2M-Freigaben übereinstimmt. Bestätigte Freigaben können ausgeschaltete
Regeln einschließen. Dieser Status trifft keine Aussage über gestoppten oder
aktiven Betrieb; der aktuelle Betriebsstatus ist getrennt.

Direkte Freigaben ändern gespeicherte Regeln ohne Übertragung anderer
Entwurfsinhalte. Ein zur bisherigen gespeicherten Konfiguration passender lokaler
Entwurf wird nach Erfolg synchronisiert; ein abweichender bleibt erhalten.
Abbrechen von Bestätigung oder Sicherung lässt Eingaben und laufenden Betrieb
unverändert. Offene Auswahlen überstehen Sprach-/Systemwechsel und
Renderer-Neuladen innerhalb der App-Sitzung. Geänderter Kontext erfordert eine
ausdrückliche Auswahlaktualisierung. Unbestätigte Übertragungen blockieren Starts
und bieten lesenden Abgleich ohne erneute Befehle.

Der bestehende Entwurf-/Prüf-/Schritt-8-Ablauf erkennt auch reine
Schalteränderungen. Die Neustartwiederherstellung ist zunächst aus und wird beim
Wählen eines anderen Systems zurückgesetzt.

Verwende **Ausgewählten Lauf stoppen** für einen bestimmten laufenden Vorgang
oder **Gesamten Betrieb stoppen**, um Automatik und alle Läufe zu stoppen und
Neustartwiederherstellung zu verhindern. Erweiterung 0.2.0 und mitgelieferte
0.2.4 erhalten die gespeicherte Neustartpräferenz, speichern aber den inaktiven
Betriebswunsch und melden `resume_status: stopped`. Das ist ein bestätigter
Stopp auch bei weiterhin wahrem `resume_enabled`. Abwählen des Kontrollkästchens
betrifft die nächste Aktivierungsanfrage und bearbeitet die gespeicherte
Präferenz nicht direkt. Ein unabhängig geprüfter Stopp kann eine verlorene
Antwort ohne erneutes Senden bestätigen. Schließen der Desktop-App trennt den
MQTT-Client und überlässt die Automation weiterhin der Erweiterung.

<a id="safety-and-diagnostics"></a>

## Absicherung und Diagnose

Hauptprozessbestätigung benennt je nach Vorgang System, Broker, Topic, Revision,
Regel und Lauf. Starts benötigen frische Sitzungs-/Revisionsnachweise, eine
einmalige Aktivierungsanforderung und unabhängig zugeordnetes Rücklesen. Eine
verlorene Antwort führt niemals zu erneutem Senden. Bei unklarem Startergebnis
bleiben weitere Starts dieses Endpunkts für die App-Sitzung gesperrt, bis ein
Systemstopp bestätigt ist. Vor der Stoppentscheidung kann der Benutzer den
aktuellen Status lesen.

Die Desktop-Diagnose zeichnet begrenzte Ausführungsbeobachtungen mit System,
Regel, Lauf, Zustand und Schritt auf. Sie erfasst von der Erweiterung
veröffentlichte Momentaufnahmen und kann Zwischenzustände auslassen, die die
Erweiterung zusammenfasst. Ein Ergebnis bestätigt den Ausführungsstatus der
Erweiterung. Physischer Gerätezustand gehört nicht zu dieser Bestätigung.

<a id="verification"></a>

## Prüfung

Loopback-MQTT-Tests verwenden das festgelegte Erweiterungsartefakt und
synthetische Zigbee-Geräte. Sie prüfen Weiterleitung, Ein-/Mehrsystemauswahl,
Schaltervalidierung, Stopp des genauen Laufs, Neustartwiederherstellung mit beiden
Einstellungen, fehlende Bestätigungen und Fortsetzung der Erweiterung nach
Trennen des Desktop-Clients. Die maßgebliche Erweiterungssuite prüft getrennt
gemeinsame Ziele, gesperrte Ziele und isolierte Zweigfehler einschließlich
Routing über acht Systeme. Echtes Zigbee2MQTT, physische Geräte und
Ubuntu-Desktop-Abnahme benötigen getrennte Prüfung.
