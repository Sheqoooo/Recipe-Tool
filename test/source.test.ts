import { it,expect,vi } from 'vitest';
import { normalizeUrl,publicAddress,extractSource,readWeb,transcriptSource,checkAllowed,checkDns } from '../src/worker/source.js';
import { localEnv } from './fixtures.js';
it.each(['http://recipes.example/','file:///etc/passwd','https://user:pass@recipes.example/','https://127.0.0.1/','https://[::1]/','https://recipes.example:444/','https://recipes.example/?token=private'])('weist unsichere URL ab: %s',url=>expect(()=>normalizeUrl(url)).toThrow());
it.each(['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])('sperrt private/reservierte IP %s',ip=>expect(publicAddress(ip)).toBe(false));
it('erlaubt nur exakte Hosts, nicht ähnlich benannte Subdomains',()=>{
  const env=localEnv({} as D1Database);expect(()=>checkAllowed(normalizeUrl('https://recipes.example.evil.test'),env)).toThrow();
  expect(()=>checkAllowed(normalizeUrl('https://recipes.example'),env)).not.toThrow();
});
it('erlaubt ohne optionale Hostliste unterschiedliche öffentliche Rezeptanbieter',()=>{
  const env={...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:''};
  for(const value of ['https://new-recipes.example/soup','https://another.example/pasta','https://recipes.account.workers.dev/cake'])expect(()=>checkAllowed(normalizeUrl(value),env)).not.toThrow();
});
it.each(['https://recipes.local/','https://host.internal/','https://host.home.arpa/','https://test.cloudflareaccess.com/','https://app.example/'])('sperrt lokale, eigene und Anmeldeziele auch ohne Hostliste: %s',value=>{
  expect(()=>checkAllowed(normalizeUrl(value),{...localEnv({} as D1Database),RECIPE_ALLOWED_HOSTS:'',APP_ORIGIN:'https://app.example'})).toThrow();
});
it('folgt öffentlichen Redirects zu neuen Anbietern ohne vorherige Freigabe',async()=>{
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input);
    if(url.includes('dns-query'))return Response.js…9665 tokens truncated… laufen deterministisch.

## D1-Schema

Die versionierte Migration `migrations/0001_shared_cookbook.sql` enthält folgende Tabellen; `0002_recipe_listing_index.sql` ergänzt einen Index auf `recipes(created_at DESC,id DESC)`:

| Tabelle | Zweck |
| --- | --- |
| `members` | E-Mail-Einladung, gebundene Access-Subject-ID, Rolle, Aktivstatus |
| `recipes` | Besitzer, Titel, Beschreibung, Portionen, Zeiten, Quelle, Warnungen, Revision, Zeitstempel |
| `ingredients` | Strukturierte Zutaten in fester Reihenfolge |
| `steps` | Schritte mit Referenzen auf Zutatenpositionen |
| `plan` | Gemeinsam ausgewählte Gerichte und Zielportionen |
| `checked_items` | Gemeinsam abgehakte Einkaufspositionen |
| `imports` | Besitzer, Status, Fehlercode, Lease, Kostenreservierung, Tokenverbrauch und Kostenschätzung |

SQL-Zugriffe verwenden gebundene Parameter. D1-Batches bilden Transaktionen. Rezeptänderungen verwenden Revision und ein internes Mutationstoken, damit eine veraltete Korrektur keine Zutaten eines neueren Stands überschreibt. Tabellenname/ID aus der früheren privaten SQLite-Datei werden nicht automatisch importiert; eine spätere Datenübernahme benötigt einen gesonderten, geprüften Datenmigrationsschritt.

## Rechte

Alle aktiven Mitglieder sehen dieselbe Sammlung und Planung. Alle dürfen importieren. Ein Mitglied darf eigene Rezepte korrigieren, ein Admin alle. Löschen und Mitgliederverwaltung sind Adminaktionen. Eigene Mitgliedschaft/Rolle kann nicht selbst gesperrt/geändert werden; dadurch bleibt beim Verwalten anderer Nutzer ein aktiver Administrator bestehen. Die Cloudflare-Access-Richtlinie und die D1-Mitgliederliste müssen beide Zugang erlauben. Die UI blendet Aktionen passend aus; maßgeblich ist immer die Serverprüfung.

## Video-/Transkriptpfad

YouTube-Links werden erkannt. Ohne bereitgestelltes Transkript wird `TRANSCRIPT_REQUIRED` ausgegeben; es findet kein Videoabruf statt. Der implementierte Adapter akzeptiert nach ausdrücklicher Nutzungsbestätigung ein Transkript bis 20 KB und eine angegebene Videolänge bis 20 Minuten. Die Länge ist Nutzermetadatum, keine unabhängig verifizierte Videoanalyse. Der harte Kosten-/Eingabegrenzwert bleibt die Textgröße.

`Source` trennt Quellengewinnung von Generierung und Speicherung. Ein späterer Audio-/Bildadapter kann dieselbe Pipeline nutzen, benötigt aber eigene Medienvalidierung und Kostenreservierung. Audio- und Frame-Uploads, FFmpeg und automatische YouTube-Untertitel sind in dieser Version **nicht implementiert**. Details und offizielle API-Grenzen: [docs/OPENAI-VIDEO.md](docs/OPENAI-VIDEO.md).

## Begrenzungen

Die Sammlung liefert derzeit maximal 500 Rezepte je Zustandsantwort. Rezeptauswahl, Zutaten und Schritte werden in einem D1-Batch aus derselben begrenzten Auswahl gelesen; Detailtabellen verwenden ihre Rezept-ID-Indizes statt sämtliche Details zurückzugeben. Die Zuordnung im Worker erfolgt einmal über Maps statt wiederholter Vollfilter. Der Listenindex unterstützt die sortierte Auswahl. Eine paginierte Suche ist weiterhin offen; Planung und Häkchen sind gemeinsam. Keine Favoriten/Tags, keine automatische Synonym-/Packungsgrößenauflösung und kein JSON-Reimport. Die Preview ist standardmäßig authentifiziert und ohne DB/Secret schreibgeschützt; produktionsnahe Preview-Daten sind absichtlich nicht vorbereitet.

## Schutz der Quell-URLs

Gemeinsame URL-Validierung in `src/shared/source-url.ts`: bekannte Zugangsschlüssel-Namen, case-/trennzeichen-/kodierungsvarianten und verschachtelte URL-Parameter werden abgewiesen. Sie greift vor dem Abruf, bei Redirects, nach Quellenadaptern sowie direkt im Repository vor Reservierung/Speicherung. API-Sammlung und Importhistorie blenden unzulässige historische Quell-URLs aus, ohne DB-Werte eigenständig zu ändern. Nicht sensible Rezeptparameter bleiben erhalten. Grenzen der heuristischen Erkennung stehen in SECURITY.md.

Live-Nachweis: [manuelle Checkliste](docs/SMOKE-TEST.md), noch nicht ausgeführt. Der automatische YouTube-Videoimport bleibt ein langfristiges Produktziel; Transkriptverarbeitung ist nur ein Zwischenstand.
