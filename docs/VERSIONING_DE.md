<a id="automatic-application-versioning"></a>

# Automatische Anwendungsversionierung

**Deutsch | [English](VERSIONING.md)**

Die eigenständige Anwendung beginnt bei `0.1.0`. Ihre maßgeblichen Metadaten
stehen in `version.json`; sie führt die Versionsfolge der Symcon-Bibliothek
nicht fort.

`Desktop verification` ruft vor dem Bau von Quellpushes oder manuellen Läufen auf
`dev` den wiederverwendbaren Workflow `Update application metadata` auf. Dieser
verwendet `Burki24/Symcon_ModuleCI/application-metadata@main`, die vorhandene
Variable `HELPER_SYNC_APP_CLIENT_ID` und das Geheimnis
`HELPER_SYNC_APP_PRIVATE_KEY`. Die GitHub App benötigt Contents-Schreibrechte
für dieses Repository. Den Schlüssel nicht in Konfiguration, Protokolle oder
Quelldateien kopieren.

- Jeder Quellcommit eines Pushs erhöht den Minor-Anteil, beispielsweise von
  `0.1.0` auf `0.2.0`; der Patch-Anteil wird auf null gesetzt. Eine manuell
  gewählte höhere Version wird niemals herabgesetzt.
- Build ist die Ganzzahl aus den ersten sieben hexadezimalen Zeichen der
  Quell-SHA. Date ist der Unix-Zeitstempel dieses Quellcommits.
- Die anfänglichen Build-/Date-Werte bleiben bis zum ersten erfolgreichen
  Workflow null.
- Bot-Commits beginnen mit `CHORE: Update application metadata`. Sie zählen
  nicht als Quelländerungen und lösen keine weitere Versionserhöhung aus.
- Wiederholungen sind idempotent; überholte Quellpushes können keine neuere
  Arbeit überschreiben.
- Projektprüfungen laufen vor der Erzeugung und erneut nach einer
  Metadatenänderung. Der Bot committet ausschließlich `version.json` und erstellt
  weder Tag noch Release oder veröffentlichtes Paket.

Die zentrale Aktion teilt die vorhandene geprüfte Implementierung der
Bibliotheksrichtlinie in ModuleCI. Sie verwendet ein ausdrückliches
Anwendungsziel mit dreiteiligen Versionen. Bibliotheksmodus und dessen
zweiteilige Versionen bleiben unverändert.

<a id="build-order-and-immutable-checkout"></a>

## Build-Reihenfolge und unveränderlicher Checkout

1. Die Voraussetzung `version` aktualisiert und prüft `version.json`, committet
   und pusht die Metadaten anschließend über die vorhandene GitHub App. Es gibt
   keinen getrennten parallelen Workflow für Metadatenpushes.
2. Nach erfolgreichem Push liefert `scripts/ci-build-ref.mjs capture` die genaue
   Metadaten-Commit-SHA und Version als Ausgaben des wiederverwendbaren Workflows.
   Eine überholte Quelle liefert leere Ausgaben und keine Paketjobs. Eine bereits
   versionierte Quelle lässt sich ohne erneute Versionserhöhung bauen.
3. Beide Plattformjobs benötigen diese Voraussetzung und checken deren
   unveränderliche SHA aus. Jeder prüft vor dem Bau HEAD, Version und einen
   sauberen Stand der versionierten Dateien. Nach der Übergabe lösen sie keinen
   veränderlichen Branchnamen mehr auf. Ein späterer Quellpush kann Windows und
   Ubuntu keine unterschiedlichen Quellen oder Versionsmetadaten geben.
4. Verifikation, Paketbau, Smoke-Tests für Quelle/Paket/Installation,
   Deinstallationsprüfungen und Artefaktuploads ausschließlich nach Erfolg
   behalten ihre Reihenfolge und Abbruchbedingungen.

RC1 verwendet dieselbe Versionsquelle. Die CI prüft vor dem Paketbau den gesamten
Abhängigkeitsbaum und erzeugt nach vorhandenen Abnahmeprüfungen und der
Designer-Übergabe Kandidatenmanifeste je Plattform. `prepare:rc` nutzt erneut
die Prüfung des unveränderlichen Checkouts und bindet Installer-/Designer-SHA-256
an diesen Commit und diese Version. Nicht versionierte Quellen, abweichende oder
unvollständige Artefakte werden abgelehnt. Das Manifest wird mit jedem nativen
Paket hochgeladen. Die RC-Bezeichnung ist eine Abnahmestufe, keine unabhängig
erhöhte Paketversion. Siehe [RC1-Vorbereitung](RC1_DE.md).

Pushes ausschließlich mit Metadaten in `version.json` starten keinen zweiten
Desktop-Lauf. Pull Requests und Builds von `main` verwenden weiterhin ihren
auslösenden Commit und die eingecheckten Metadaten, ohne den Versionsschreiber
aufzurufen oder dessen App-Zugangsdaten zu erhalten. Die Quell-SHA des
Workflow-Laufs bleibt der auslösende Quellcommit. Die ausdrücklichen Ereignisse
`CI_VERSIONED_BUILD` und `CI_VERSIONED_CHECKOUT` kennzeichnen den tatsächlich zum
Paketbau verwendeten versionierten Commit.

`tests/ci-versioning.test.mjs` prüft Workflow-Abhängigkeiten und Auslösebedingungen,
Fehler/Abbruch/Überholung, idempotente Wiederholungen und echte temporäre
Git-Checkouts für beide Plattformen, nachdem der Quellbranch weitergelaufen ist.
Der Test prüft auch den CLI-Ausgabevertrag und lehnt abweichende Commits,
Versionen und geänderte Metadaten ab. Diese lokalen Prüfungen belegen keinen
erfolgreichen GitHub-Lauf. Die neue Reihenfolge benötigt nach dem Push des
Benutzers einen eigenen CI-Nachweis.

<a id="confirmed-github-operation"></a>

## Bestätigter GitHub-Betrieb

Am 2026-11-07 bestand Verbraucherlauf 42367039704 mit
Burki24/Symcon_ModuleCI/application-metadata@main auf
f09d5053d439ef5aafcdbf7d9408994ccb294d5f. Bot-Commit
744fc251503047068bed507a6f84cd4457cf6cb8 aktualisierte ausschließlich version.json
auf 0.2.0; der folgende Bot-Lauf übersprang die Erzeugung korrekt. Der Benutzer
hat diesen Commit eingelesen.

D1-Builds lesen version.json beim Vorbereiten der Electron-Anwendung und des
gemeinsamen Designer-Pakets. Forge überschreibt die Anwendungsversion und
aktualisiert das kopierte Paketmanifest; Quell-Paketmanifeste sind keine
maßgeblichen Versionsquellen. Der Benutzer erstellt weiterhin Commits und Pushes;
es entstehen weder Tags noch Veröffentlichungen.

Die Metadaten-/Textprüfung ohne zusätzliche Abhängigkeiten bleibt:

~~~sh
node scripts/check-project.mjs
~~~

Sie ersetzt keine Laufzeit- oder Plattformabnahme.
