import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import storage
from tests.test_recipes import recipe


class StorageTests(unittest.TestCase):
    def setUp(self):
        runtime = storage.ROOT / '.runtime'
        runtime.mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(dir=str(runtime))
        self.location = patch.object(storage, 'DATA', Path(self.directory.name))
        self.location.start()
        storage.initialize()

    def tearDown(self):
        self.location.stop()
        self.directory.cleanup()

    def test_recipe_edit_and_plan_persist(self):
        recipe_id = storage.save_recipe(recipe())
        storage.save_recipe(recipe(title='Neue Pasta'), recipe_id)
        with storage.database() as db:
            db.execute('INSERT INTO plan VALUES (?, ?)', (recipe_id, 4))
        storage.initialize()
        self.assertEqual(storage.recipes()[0]['title'], 'Neue Pasta')
        self.assertEqual(storage.plan()[0]['servings'], 4)

    def test_delete_cascades(self):
        recipe_id = storage.save_recipe(recipe())
        with storage.database() as db:
            db.execute('INSERT INTO plan VALUES (?, ?)', (recipe_id, 4))
            db.execute('DELETE FROM recipes WHERE id=?', (recipe_id,))
        self.assertEqual(storage.plan(), [])

    def test_edit_resets_checks(self):
        recipe_id = storage.save_recipe(recipe())
        with storage.database() as db:
            db.execute('INSERT INTO checked_items VALUES (?)', ('Tomaten',))
        storage.save_recipe(recipe(), recipe_id)
        with storage.database() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM checked_items').fetchone()[0], 0)

    def test_key_file_is_private(self):
        storage.save_key('sk-test')
        self.assertEqual((storage.DATA / 'settings.json').stat().st_mode & 0o777, 0o600)
        with patch.dict('os.environ', {'OPENAI_API_KEY':''}):
            self.assertEqual(storage.settings()['api_key'], 'sk-test')


if __name__ == '__main__':
    unittest.main()
