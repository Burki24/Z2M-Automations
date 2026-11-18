# Privacy notice for Z2M-Automations

**English | [Deutsch](PRIVACY_DE.md)**

## Scope and contact

This notice covers the Z2M-Automations desktop application for Windows and
Linux. Burkhard Kneiseler is responsible for the data processing described here
that is carried out by the publisher.

Postal address: Am Espenpfuhl 55a, 12355 Berlin, Germany

Privacy email: [datenschutz@kneiseler.de](mailto:datenschutz@kneiseler.de)

## Data processed by the application

Z2M-Automations uses the MQTT brokers you configure to read data from your
Zigbee2MQTT systems and to manage automations. Depending on your project, it
processes broker addresses and topics, MQTT credentials, device and channel
names and identifiers, available properties, rule configurations, and status
and execution messages. Sunrise and sunset rules can include coordinates you
enter yourself. Device names, rule contents, or coordinates can reveal details
about a household or its occupants.

The app sends MQTT credentials to the broker you configure when it authenticates.
The app exchanges catalogs, automation configurations, and requests with your
Zigbee2MQTT systems via that broker. Select TLS for connections that need
encryption in transit. If you use an external broker or MQTT bridge, its
operator may handle the messages and connection data according to its own
configuration and privacy terms. Rules transferred to Zigbee2MQTT are stored
and run there. Z2M-Automations does not require a publisher account or send
app analytics or diagnostics to the publisher automatically.

## Local storage and your choices

Projects, drafts, backups, and exports are stored as local files. They can
contain connection settings, device references, configured values, and
automation rules. Project and draft exports exclude broker credentials managed
by the app. If you choose protected credential storage, the app encrypts MQTT
credentials using operating-system facilities and keeps them separately from
the project. Session-only credentials are held in memory until the app closes.

You can configure or disconnect a broker and remove stored credentials in
**Set up broker**. You can inspect, export, or delete your project and draft
files and any copies you made. Deleting local files leaves data stored in
Zigbee2MQTT, the broker, and their backups under the control of the respective
system operators. Local diagnostics start when you enable them and record
bounded technical events. They are available locally for troubleshooting.

## Contact and external services

If you contact the publisher by email, the publisher uses your email address,
message, and any files you choose to send to respond and handle follow-up
questions. This is based on the legitimate interest in answering and resolving
requests under Article 6(1)(f) GDPR. The publisher retains this information as
long as it is needed to resolve the request or meet applicable legal retention
obligations. The mail provider processes connection and message data to
deliver the correspondence.

When you visit this notice or the project on GitHub, GitHub handles web access
data, such as IP addresses, according to its own privacy notice. GitHub Issues
is public. Use the privacy email for requests involving personal information.
[GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

## Your privacy rights

Where the GDPR applies, you may have rights to access, rectification, erasure,
restriction of processing, and data portability. You can object to processing
based on legitimate interests under the applicable conditions. You can also
lodge a complaint with a data protection supervisory authority. Use the contact
details above to exercise your rights in relation to data held by the publisher.
