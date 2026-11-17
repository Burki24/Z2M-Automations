<a id="z2m-automations"></a>

# Z2M-Automations

**Deutsch | [English](README.md)**

![Z2M-Automations für Windows und Ubuntu: visueller Automationsdesigner, verbundene Zigbee2MQTT-Netzwerke, Projekte und Entwürfe sowie Ausführung in Zigbee2MQTT](docs/images/readme-hero-de.png)

**Dein Zigbee. Deine Automationen.**

Mit Z2M-Automations machst du aus Tastern, Sensoren, Leuchten und anderen
Zigbee-Geräten praktische Alltagsautomationen – ohne Programmierung. Die App
ist als **Z2M-Automations für Windows** und **Z2M-Automations für Linux (Ubuntu)**
verfügbar und verbindet sich direkt mit deiner vorhandenen Zigbee2MQTT-Installation.

<a id="idea-and-purpose"></a>

## Idee und Ziel

Baue eine Regel visuell auf: **Wenn → Nur wenn → Dann**. Wähle den Auslöser,
ergänze bei Bedarf Bedingungen und lege fest, was passieren soll. Die übersichtliche
Ablaufansicht hilft dir, deine Automationen später zu verstehen und anzupassen.

Die App speichert deine Regeln direkt in Zigbee2MQTT. Dort führt unsere Erweiterung
sie aus. **Nach Übermittlung, Freigabe und Aktivierung kannst du die App schließen.**
Zigbee2MQTT, die Erweiterung, die MQTT-Verbindungen und die beteiligten Geräte
halten die Automationen am Laufen.

<a id="what-you-can-do"></a>

## Möglichkeiten

- Auf Tastendruck, Bewegung, Fenstergriffstellungen und andere Gerätezustände reagieren.
- Temperaturen und andere Messwerte, Zeitpläne, Sonnenaufgang und Sonnenuntergang nutzen.
- Bedingungen, geordnete Aktionen, Wartezeiten, Szenen und wiederverwendbare Aktionsfolgen kombinieren.
- Bis zu **acht Zigbee2MQTT-Netzwerke** an einem oder mehreren MQTT-Brokern verwalten.
- Geräte aus verschiedenen Netzen in derselben Automation zusammenarbeiten lassen.
- Vorhandene Automationen einlesen, neue Regeln erstellen und Änderungen vor der Übermittlung prüfen.
- Erkennen, welche Regeln freigegeben sind und ob der Automatikbetrieb aktiv ist.
- Auf **Deutsch oder Englisch** arbeiten, im hellen oder dunklen Design.

<a id="everyday-examples"></a>

## Beispiele für den Alltag

- Das Flurlicht bei Bewegung einschalten und nach einer Wartezeit ausschalten.
- Mit einem Wandtaster eine Leuchte umschalten oder eine Aktionsfolge starten.
- Eine Fenstergriffstellung in einer Heizungs- oder Lüftungsregel berücksichtigen.
- Die Außenbeleuchtung bei Sonnenuntergang schalten.
- Mit einem Taster in einem Zigbee-Netz eine Leuchte in einem anderen Netz steuern.

<a id="keep-your-work-organized"></a>

## Deine Arbeit übersichtlich speichern

Speichere Verbindungen, Netze und Entwürfe zusammen als **Projekt (.z2map)**.
Ausgewählte Automationen kannst du auch getrennt als **Entwurfsdatei (.z2mad)**
speichern und einem anderen Projekt hinzufügen. Bestehende **.z2ma**-Projektdateien
lassen sich weiterhin öffnen.

Beim Verbinden liest die App die in Z2M gespeicherten Automationen ein und führt
sie mit deiner lokalen Arbeit zusammen. Bei widersprüchlichen Änderungen
entscheidest du, welche Fassung du behalten möchtest. Sicherungen helfen dir,
frühere Arbeitsstände wiederherzustellen. Neue Regeln bleiben bis zu deiner
Freigabe ausgeschaltet.

<a id="requirements"></a>

## Voraussetzungen

- Ein Rechner mit **Windows 11 x64** oder **Ubuntu Desktop 24.04 LTS x64**.
- Eine vorhandene **Zigbee2MQTT-Installation** mit den gewünschten Geräten.
- Ein erreichbarer **MQTT-Broker**, seine Adresse, gegebenenfalls Zugangsdaten
  und passende Zugriffsrechte.
- Unsere kompatible **Z2M-Automations-Erweiterung** in jeder beteiligten
  Zigbee2MQTT-Instanz. Die App bringt sie mit und bietet Installation und Updates an.
- Für Automationen über getrennte Broker: eine MQTT-Bridge, die die benötigten
  Nachrichten zwischen ihnen überträgt.
- Unter Ubuntu ein verfügbarer Desktop-Schlüsselbund, wenn du Zugangsdaten
  dauerhaft geschützt speichern möchtest.

<a id="user-manual"></a>

## Anwenderhandbuch

Das [ausführliche Handbuch mit Bildern](docs/USER_GUIDE_DE.md) erklärt die
Installation, deine erste Automation, den Umgang mit Entwürfen, Übermittlung
und Aktivierung sowie die Fehlerbehebung. Die Bildschirmbilder passen zur
jeweils gewählten Dokumentationssprache.
Das vollständige Handbuch ist auch offline in der App über **Hilfe · F1** erreichbar.

<a id="license"></a>

## Lizenz

Z2M-Automations steht unter der
[PolyForm Noncommercial 1.0.0](LICENSE) für die nichtkommerzielle Nutzung bereit.
