# Datenschutzerklärung für Z2M-Automations

**Deutsch | [English](PRIVACY.md)**

## Geltungsbereich und Kontakt

Diese Erklärung gilt für die Desktop-App Z2M-Automations für Windows und Linux.
Verantwortlich für die hier beschriebene Datenverarbeitung durch den Herausgeber
ist Burkhard Kneiseler.

Postanschrift: Am Espenpfuhl 55a, 12355 Berlin, Deutschland

Datenschutz-E-Mail: [datenschutz@kneiseler.de](mailto:datenschutz@kneiseler.de)

## In der App verarbeitete Daten

Z2M-Automations nutzt die von dir eingerichteten MQTT-Broker, um Daten aus
deinen Zigbee2MQTT-Systemen zu lesen und Automationen zu verwalten. Je nach
Projekt verarbeitet die App Broker-Adressen und MQTT-Topics, MQTT-Zugangsdaten,
Geräte- und Kanalnamen, Kennungen, verfügbare Eigenschaften, Regelkonfigurationen
sowie Status- und Ausführungsmeldungen. Regeln für Sonnenaufgang und Sonnenuntergang
können von dir eingegebene Koordinaten enthalten. Gerätenamen, Regelinhalte oder
Koordinaten können Rückschlüsse auf einen Haushalt oder seine Bewohner zulassen.

Zur Anmeldung sendet die App die MQTT-Zugangsdaten an den von dir eingerichteten
Broker. Über diesen Broker tauscht sie Gerätekataloge, Automationskonfigurationen
und Anfragen mit deinen Zigbee2MQTT-Systemen aus. Wähle TLS für Verbindungen, die
bei der Übertragung verschlüsselt werden sollen. Nutzt du einen externen Broker
oder eine MQTT-Bridge, kann deren Betreiber Nachrichten und Verbindungsdaten nach
seiner Konfiguration und seinen Datenschutzbestimmungen verarbeiten. Übermittelte
Regeln werden in Zigbee2MQTT gespeichert und dort ausgeführt. Die App benötigt
kein Konto beim Herausgeber und sendet ihm keine Nutzungsstatistiken oder
Diagnosedaten automatisch zu.

## Lokale Speicherung und deine Einstellungen

Projekte, Entwürfe, Sicherungen und Exporte werden als lokale Dateien gespeichert.
Sie können Verbindungseinstellungen, Gerätebezüge, konfigurierte Werte und
Automationsregeln enthalten. Projekt- und Entwurfsexporte enthalten keine von
der App verwalteten Broker-Zugangsdaten. Wenn du die geschützte Speicherung wählst,
verschlüsselt die App die MQTT-Zugangsdaten mit Mitteln des Betriebssystems und
legt sie getrennt vom Projekt ab. Sitzungsbezogene Zugangsdaten liegen bis zum
Schließen der App im Arbeitsspeicher.

Unter **Broker einrichten** kannst du einen Broker konfigurieren, seine Verbindung
trennen und gespeicherte Zugangsdaten entfernen. Du kannst Projekt- und
Entwurfsdateien sowie selbst erstellte Kopien einsehen, exportieren und löschen.
Daten in Zigbee2MQTT, im Broker und in deren Sicherungen liegen weiterhin im
Verantwortungsbereich der jeweiligen Systembetreiber. Die lokale Diagnose startet
auf deine Anforderung und erfasst begrenzte technische Ereignisdaten. Sie stehen
lokal für die Fehlersuche zur Verfügung.

## Kontaktaufnahme und externe Dienste

Wenn du den Herausgeber per E-Mail kontaktierst, verarbeitet er deine
E-Mail-Adresse, deine Nachricht und gegebenenfalls die von dir mitgesendeten
Dateien, um dein Anliegen und Rückfragen zu bearbeiten. Grundlage ist sein
berechtigtes Interesse an der Beantwortung und Bearbeitung von Anfragen nach
Art. 6 Abs. 1 Buchst. f DSGVO. Er speichert diese Daten so lange, wie es für die
Bearbeitung erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
Für die Zustellung verarbeitet der E-Mail-Dienst Verbindungs- und Nachrichtendaten.

Wenn du diese Erklärung oder das Projekt auf GitHub aufrufst, verarbeitet GitHub
Webzugriffsdaten wie die IP-Adresse nach seinen eigenen Datenschutzbestimmungen.
GitHub Issues ist öffentlich. Verwende für Anfragen mit personenbezogenen Daten
bitte die Datenschutz-E-Mail-Adresse.
[GitHubs allgemeine Datenschutzerklärung](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

## Deine Datenschutzrechte

Soweit die DSGVO gilt, hast du unter den jeweiligen gesetzlichen Voraussetzungen
das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und
Datenübertragbarkeit. Du kannst der Verarbeitung auf Grundlage berechtigter
Interessen unter den gesetzlichen Voraussetzungen widersprechen und dich bei
einer Datenschutzaufsichtsbehörde beschweren. Für Rechte in Bezug auf Daten, die
der Herausgeber verarbeitet, nutze die oben genannten Kontaktdaten.
