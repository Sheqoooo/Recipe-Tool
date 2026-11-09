import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app import storage
from server import Handler, TOKEN
from tests.test_recipes import recipe


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        runtime = storage.ROOT / '.runtime'
        runtime.mkdir(exist_ok=True)
        cls.directory = tempfile.TemporaryDirectory(dir=str(runtime))
        cls.location = patch.object(storage, 'DATA', Path(cls.directory.name))
        cls.location.start()
        storage.initialize()
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.host = '127.0.0.1:%s' % cls.server.server_address[1]
        cls.server.allowed_hosts = {cls.host}
        cls.url = 'http://' + cls.host
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.location.stop()
        cls.directory.cleanup()

    def setUp(self):
        with storage.database() as db:
            db.execute('DELETE FROM recipes')
            db.execute('DELETE FROM checked_items')

    def request(self, path, data=None, **headers):
        body = json.dumps(data).encode() if data is not None else None
        request = Request(self.url + path, data=body,
                          headers={'Content-Type':'application/json', **headers})
        with urlopen(request, timeout=5) as response:
            return json.load(response)

    def post(self, path, data):
        return self.request(path, data, **{'X-Rezeptwerk-Token':TOKEN})

    def test_full_save_plan_scale_check_edit_delete_workflow(self):
        saved = self.post('/api/recipes/save', recipe())
        self.post('/api/plan', {'recipe_id':saved['id'], 'servings':4})
        state = self.request('/api/state')
        self.assertEqual(state['shopping'][0]['amount'], 400)
        self.post('/api/shopping/check', {'key':state['shopping'][0]['key'], 'checked':True})
        self.assertEqual(len(self.request('/api/state')['checked']), 1)
        self.post('/api/plan', {'recipe_id':saved['id'], 'servings':6})
        state = self.request('/api/state')
        self.assertEqual(state['shopping'][0]['amount'], 600)
        self.assertEqual(state['checked'], [])
        self.assertEqual(len(state['plan']), 1)
        self.post('/api/recipes/delete', {'id':saved['id']})
        self.assertEqual(self.request('/api/state')['shopping'], [])

    def test_mutation_without_token_blocked(self):
        with self.assertRaises(HTTPError) as error:
            self.request('/api/recipes/save', recipe())
        self.assertEqual(error.exception.code, 403)

    def test_foreign_host_and_origin_blocked(self):
        with self.assertRaises(HTTPError) as error:
            self.request('/api/state', **{'Host':'evil.example'})
        self.assertEqual(error.exception.code, 403)
        with self.assertRaises(HTTPError) as error:
            self.request('/api/recipes/save', recipe(), **{'X-Rezeptwerk-Token':TOKEN, 'Origin':'https://evil.example'})
        self.assertEqual(error.exception.code, 403)

    def test_secret_never_returned(self):
        with patch.dict('os.environ', {'OPENAI_API_KEY':'sk-private-test'}):
            state = self.request('/api/state')
        self.assertTrue(state['has_key'])
        self.assertNotIn('sk-private-test', json.dumps(state))

    def test_text_import_without_key(self):
        with patch.dict('os.environ', {'OPENAI_API_KEY':''}):
            draft = self.post('/api/import', {'kind':'text', 'value':'Meine Zutaten und Anleitung'})
        self.assertEqual(draft['original_text'], 'Meine Zutaten und Anleitung')
        self.assertEqual(self.request('/api/state')['recipes'], [])

    def test_static_security_headers_and_no_traversal(self):
        with urlopen(self.url) as response:
            self.assertIn(b'Rezeptwerk', response.read())
            self.assertIn("frame-ancestors 'none'", response.headers['Content-Security-Policy'])
        with self.assertRaises(HTTPError) as error:
            urlopen(self.url + '/data/settings.json')
        self.assertEqual(error.exception.code, 404)


if __name__ == '__main__':
    unittest.main()
