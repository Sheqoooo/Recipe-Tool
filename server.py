#!/usr/bin/env python3
"""Local-only recipe app. Python 3.9+, standard library only."""
import json
import mimetypes
import os
import secrets
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from app import storage
from app.importer import read_source, prepare_recipe
from app.recipes import number, shopping_list, validate_recipe

TOKEN = secrets.token_urlsafe(32)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # No recipe contents, URLs or credentials in access logs.

    def respond(self, status, payload, content_type='application/json; charset=utf-8'):
        body = json.dumps(payload, ensure_ascii=False).encode() if isinstance(payload, (dict, list)) else payload
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        self.end_headers()
        self.wfile.write(body)

    def allowed_host(self):
        return self.headers.get('Host') in self.server.allowed_hosts

    def do_GET(self):
        if not self.allowed_host():
            return self.respond(403, {'error': 'Ungültiger Host.'})
        path = urlsplit(self.path).path
        if path == '/api/state':
            config = storage.settings()
            entries = storage.plan()
            with storage.database() as db:
                checked = [row['key'] for row in db.execute('SELECT key FROM checked_items')]
            return self.respond(200, {'recipes': storage.recipes(), 'plan': entries,
                                     'shopping': shopping_list(entries), 'checked': checked,
                                     'has_key': bool(config['api_key']),
                                     'env_key': bool(os.environ.get('OPENAI_API_KEY')), 'token': TOKEN})
        files = {'/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css'}
        if path not in files:
            return self.respond(404, {'error': 'Nicht gefunden.'})
        target = storage.ROOT / 'static' / files[path]
        content_type = mimetypes.guess_type(str(target))[0] or 'text/plain'
        return self.respond(200, target.read_bytes(), content_type + '; charset=utf-8')

    def do_POST(self):
        if not self.allowed_host() or not secrets.compare_digest(self.headers.get('X-Rezeptwerk-Token', ''), TOKEN):
            return self.respond(403, {'error': 'Bitte die Anwendung neu laden.'})
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''):
            return self.respond(403, {'error': 'Ungültiger Ursprung.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 300000:
                raise ValueError('Die Eingabe ist leer oder zu groß.')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Ungültige Eingabe.')
            path = urlsplit(self.path).path
            if path == '/api/import':
                source = read_source(str(data.get('kind', '')), str(data.get('value', '')).strip())
                result = prepare_recipe(source, storage.settings()['api_key'])
                return self.respond(200, result)
            if path == '/api/recipes/save':
                recipe_id = data.get('id')
                if recipe_id is not None:
                    recipe_id = int(recipe_id)
                result = storage.save_recipe(validate_recipe(data), recipe_id)
                return self.respond(200, {'id': result})
            if path == '/api/recipes/delete':
                with storage.database() as db:
                    db.execute('DELETE FROM recipes WHERE id=?', (int(data['id']),))
                    db.execute('DELETE FROM checked_items')
                return self.respond(200, {'ok': True})
            if path == '/api/plan':
                recipe_id = int(data['recipe_id'])
                with storage.database() as db:
                    if data.get('remove'):
                        db.execute('DELETE FROM plan WHERE recipe_id=?', (recipe_id,))
                    else:
                        servings = number(data['servings'])
                        if not 0 < servings <= 1000:
                            raise ValueError('Bitte eine Portionenzahl zwischen 0 und 1.000 eingeben.')
                        if not db.execute('SELECT id FROM recipes WHERE id=?', (recipe_id,)).fetchone():
                            raise ValueError('Das Rezept wurde nicht gefunden.')
                        db.execute('INSERT INTO plan VALUES (?, ?) ON CONFLICT(recipe_id) DO UPDATE SET servings=excluded.servings', (recipe_id, servings))
                    db.execute('DELETE FROM checked_items')
                return self.respond(200, {'ok': True})
            if path == '/api/shopping/check':
                with storage.database() as db:
                    key = str(data['key'])[:2000]
                    if data.get('checked'):
                        db.execute('INSERT OR IGNORE INTO checked_items VALUES (?)', (key,))
                    else:
                        db.execute('DELETE FROM checked_items WHERE key=?', (key,))
                return self.respond(200, {'ok': True})
            if path == '/api/settings':
                key = str(data.get('api_key', '')).strip()
                if key and (not key.startswith('sk-') or len(key) > 500 or any(c.isspace() for c in key)):
                    raise ValueError('Bitte einen gültigen OpenAI-API-Key eingeben.')
                storage.save_key(key)
                return self.respond(200, {'ok': True})
            return self.respond(404, {'error': 'Nicht gefunden.'})
        except (ValueError, KeyError, TypeError, OverflowError) as error:
            return self.respond(400, {'error': str(error) if isinstance(error, ValueError) else 'Bitte die Eingabe prüfen.'})
        except (OSError, socket.timeout):
            return self.respond(502, {'error': 'Verbindung oder Speicherung fehlgeschlagen. Bitte erneut versuchen.'})
        except Exception:
            return self.respond(500, {'error': 'Ein unerwarteter Fehler ist aufgetreten.'})


def main():
    storage.initialize()
    port = int(os.environ.get('PORT', '8765'))
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    actual_port = server.server_address[1]
    server.allowed_hosts = {'127.0.0.1:%d' % actual_port, 'localhost:%d' % actual_port}
    print('Rezeptwerk läuft unter http://127.0.0.1:%d – Beenden mit Strg+C' % actual_port, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
