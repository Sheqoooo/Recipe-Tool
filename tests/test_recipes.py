import json
import unittest
from unittest.mock import patch

from app.recipes import parse_ingredient, validate_recipe, shopping_list
from app.importer import PageParser, find_recipe, draft_from_schema, read_source, prepare_recipe, fetch_public_page, Source


def recipe(**overrides):
    data = {'title': 'Tomatenpasta', 'servings': 2, 'ingredients': [
        {'name': 'Tomaten', 'amount': 200, 'unit': 'g', 'note': ''}], 'steps': ['Alles kochen.']}
    data.update(overrides)
    return validate_recipe(data)


class RecipeTests(unittest.TestCase):
    def test_fraction_and_unit_conversion(self):
        self.assertEqual(parse_ingredient('1½ kg Tomaten')['amount'], 1500)
        self.assertEqual(parse_ingredient('1,5 l Milch')['amount'], 1500)
        self.assertEqual(parse_ingredient('½ TL Salz')['amount'], 0.5)
        self.assertAlmostEqual(parse_ingredient('2 oz Butter')['amount'], 56.699046)

    def test_unknown_and_ranges_not_guessed(self):
        for line in ['Salz nach Geschmack', '1-2 Zwiebeln', '1 bis 2 Zwiebeln', '1 cup Mehl', '1/0 TL Salz']:
            with self.subTest(line=line):
                self.assertIsNone(parse_ingredient(line)['amount'])

    def test_validation_rejects_invalid_amounts(self):
        for value in [float('nan'), float('inf'), -1, True]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                recipe(servings=value)

    def test_validation_requires_complete_recipe(self):
        for values in [{'title': ''}, {'ingredients': []}, {'steps': []}, {'servings': 0}]:
            with self.assertRaises(ValueError):
                recipe(**values)

    def test_shopping_scales_and_combines_units(self):
        first = recipe()
        second = recipe(title='Salat', ingredients=[{'name': 'tomaten', 'amount': .3, 'unit': 'kg'}])
        items = shopping_list([{'recipe': first, 'servings': 4}, {'recipe': second, 'servings': 2}])
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['amount'], 700)
        self.assertEqual(items[0]['recipes'], ['Tomatenpasta', 'Salat'])

    def test_shopping_preserves_variants_unknown_and_notes(self):
        ingredients = [{'name':'Tomaten', 'amount':100, 'unit':'g'},
                       {'name':'Dosentomaten', 'amount':100, 'unit':'g'},
                       {'name':'Tomaten', 'amount':None, 'unit':'g'},
                       {'name':'Tomaten', 'amount':100, 'unit':'g', 'note':'optional'},
                       {'name':'Tomaten', 'amount':2, 'unit':'Stück'}]
        self.assertEqual(len(shopping_list([{'recipe':recipe(ingredients=ingredients), 'servings':2}])), 5)


class ImportTests(unittest.TestCase):
    def test_nested_recipe_and_sections(self):
        schema = {'@type':['Thing','Recipe'], 'name':'Pasta &amp; mehr', 'recipeYield':'4 servings',
                  'recipeIngredient':['200 g Tomaten'], 'recipeInstructions':[{'@type':'HowToSection',
                  'itemListElement':[{'@type':'HowToStep', 'text':'<b>Kochen</b> und essen.'}]}]}
        wrapper = {'@graph':[{'@type':'WebSite'}, schema]}
        page = PageParser()
        page.feed('<script type="application/ld+json">' + json.dumps(wrapper) + '</script><style>hidden</style><p>Hallo</p>')
        found = find_recipe(json.loads(page.json_blocks[0]))
        draft = draft_from_schema(found)
        self.assertEqual(draft['steps'], ['Kochen und essen.'])
        self.assertEqual(draft['servings'], 4)
        self.assertEqual(draft['title'], 'Pasta & mehr')
        self.assertEqual(page.text, ['Hallo'])

    def test_text_without_key_retains_source(self):
        draft = prepare_recipe(Source('text','Originalrezept'), '')
        self.assertEqual(draft['original_text'], 'Originalrezept')
        self.assertTrue(draft['warnings'])
        self.assertEqual(draft['ingredients'], [])

    def test_instagram_and_video_have_actionable_fallback(self):
        for kind, value in [('url','https://www.instagram.com/reel/abc'), ('video','clip.mp4')]:
            with self.assertRaisesRegex(ValueError, 'Text'):
                read_source(kind, value)

    def test_private_addresses_blocked(self):
        for address in ['127.0.0.1', '10.1.2.3', '169.254.169.254', '::1']:
            with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', (address, 80))]):
                with self.assertRaisesRegex(ValueError, 'interne'):
                    fetch_public_page('http://example.com')

    def test_invalid_protocol_and_credentials_blocked(self):
        for url in ['file:///etc/passwd','https://user:pass@example.com','http://example.com:9999']:
            with self.assertRaises(ValueError):
                fetch_public_page(url)

    def test_api_request_uses_strict_schema_and_does_not_store(self):
        from io import BytesIO
        document = {'title':'Suppe','description':'','servings':2,'ingredients':[], 'steps':[], 'warnings':[]}
        response = BytesIO(json.dumps({'choices':[{'finish_reason':'stop', 'message':{'content':json.dumps(document)}}]}).encode())
        with patch('app.importer.urlopen', return_value=response) as call:
            result = prepare_recipe(Source('text','Originalrezept'), 'sk-test')
        payload = json.loads(call.call_args[0][0].data)
        self.assertFalse(payload['store'])
        self.assertTrue(payload['response_format']['json_schema']['strict'])
        self.assertEqual(result['title'], 'Suppe')


if __name__ == '__main__':
    unittest.main()
