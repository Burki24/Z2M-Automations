<a id="adr-0002-portable-local-projects-and-a-separate-credential-vault"></a>

# ADR 0002: portable lokale Projekte und ein getrennter Zugangsdaten-Tresor

**Deutsch | [English](0002-local-projects-and-credential-boundary.md)**

- Datum: 2026-11-08
- Status: Für D2 umgesetzt; Plattformabnahme wird in [D2](../D2_DE.md) geführt.

<a id="decision"></a>

## Entscheidung

Eine begrenzte versionierte JSON-Projekthülle mit stabilen Projekt-, Broker- und
Systemkennungen verwenden. Entwürfe und bekannte entfernte Basis je System
halten. Die aktuellen lokalen Dienste liegen hinter der Desktop-Preload-Grenze
in `apps/desktop/src`. Außer Betriebssystemadapter und Hauptprozessintegration
haben sie keine Electron-Abhängigkeiten. Keine leeren künftigen Pakethüllen
erstellen.

Nur der Hauptprozess darf Pfade wählen und Projekte lesen/schreiben. Speichern
erkennt externe Änderungen, erhält eine Sicherung der Vorversion und ersetzt
die Datei atomar. Wiederherstellen einer Sicherung ändert bis zum ausdrücklichen
Speichern nur den lokalen Speicher. Portable Exporte behalten Kennungen und
Entwurfsinhalte, schließen aber sämtliche Zugangsdaten aus.

Einen getrennten betriebssystemverschlüsselten Zugangsdaten-Tresor verwenden,
begrenzt auf Projekt und Broker-Endpunkt. Import/Entfernen/Status ohne
Renderer-Rücklesen anbieten. Der Hauptprozess wählt und liest über seinen
Systemdialog eine begrenzte private Zugangsdaten-JSON-Datei; Benutzername und
Passwort gelangen nie in Designer oder dessen IPC-Nutzdaten. Bei nicht
verfügbarem Schutz ist ausdrückliche Sitzungsspeicherung möglich; niemals
stillschweigend herabstufen. Projektöffnen darf jetzt Broker mit ausdrücklicher
lokaler Freigabe verbinden. Diese Präferenzen sind an Projekt und
Broker-Endpunkt gebunden und getrennt von portablem Projekt und Tresor
gespeichert. Der Modus mit gespeicherten Zugangsdaten verlangt verfügbare
Zugangsdaten; anonymer Modus wird ausdrücklich gewählt. Jeder Broker wird
einmal je erfolgreichem Öffnen versucht. Lesen, Zugangsdatenänderungen und
Projektwiederherstellung starten keinen automatischen Versuch.

Unter Electron 45 nutzt geschützter Linux-Speicher synchrone Verfügbarkeit,
erkanntes Schlüsselbund-Backend und Verschlüsselungs-/Entschlüsselungs-APIs.
Die neuere asynchrone Verfügbarkeits-API kann selbst bei Ersatzanbieter einen
initialisierten Verschlüsseler melden und genügt deshalb nicht als alleinige
Linux-Schutzprüfung. Windows verwendet die asynchrone API. Linux-Adapter vor
Upgrade auf Electron 46 neu bewerten; feste Abhängigkeit und aktuelle
Absicherung dürfen nicht stillschweigend umgangen werden.

<a id="consequences"></a>

## Folgen

Entwürfe lassen sich ohne verbundene Systeme sicher öffnen. D2 unterstützt
Projekt- und Entwurfsverwaltung; Laufzeit-Schema-/Fähigkeitsprüfung und
vollständige Bearbeitung bleiben spätere Meilensteine. Betriebssystemdialoge
und nativer Linux-Schlüsselbund benötigen zusätzlich zu synthetischen
Diensttests eine Plattformabnahme. Eine Projektsicherung ist private Benutzerdaten
und gehört nicht in Repositories oder Diagnose.
