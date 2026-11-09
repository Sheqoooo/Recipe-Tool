"""Recipe validation, ingredient parsing and deterministic shopping arithmetic."""
import math
import re
import unicodedata
from fractions import Fraction

UNITS = {
    'g': ('g', 1), 'gramm': ('g', 1), 'grams': ('g', 1),
    'kg': ('g', 1000), 'kilogramm': ('g', 1000),
    'ml': ('ml', 1), 'milliliter': ('ml', 1), 'l': ('ml', 1000), 'liter': ('ml', 1000),
    'oz': ('g', 28.349523125), 'ounce': ('g', 28.349523125), 'ounces': ('g', 28.349523125),
    'lb': ('g', 453.59237), 'lbs': ('g', 453.59237),
    'el': ('EL', 1), 'tbsp': ('EL', 1), 'tl': ('TL', 1), 'tsp': ('TL', 1),
    'stück': ('Stück', 1), 'stk': ('Stück', 1),
}
FRACTIONS = {'½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8'}


def number(value):
    if isinstance(value, bool):
        raise ValueError('Bitte eine gültige Menge eingeben.')
    result = float(value)
    if not math.isfinite(result) or result < 0 or result > 1000000:
        raise ValueError('Mengen müssen zwischen 0 und 1.000.000 liegen.')
    return result


def parse_ingredient(line):
    original = str(line).strip()
    text = original
    for char, replacement in FRACTIONS.items():
        text = text.replace(char, ' ' + replacement)
    match = re.match(r'^\s*(\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)\s*(.*)$', text)
    if not match:
        return {'name': original, 'amount': None, 'unit': '', 'note': ''}
    try:
        amount = sum(float(Fraction(part.replace(',', '.'))) for part in match[1].split())
    except (ValueError, ZeroDivisionError):
        return {'name': original, 'amount': None, 'unit': '', 'note': 'Menge bitte prüfen'}
    rest = match[2].strip()
    # Ranges must stay intact rather than becoming a misleading exact amount.
    if re.match(r'^(?:[-–]|bis\b)', rest):
        return {'name': original, 'amount': None, 'unit': '', 'note': 'Mengenbereich bitte prüfen'}
    parts = rest.split(maxsplit=1)
    unit = ''
    if parts and parts[0].lower().rstrip('.') in UNITS:
        unit, multiplier = UNITS[parts[0].lower().rstrip('.')]
        amount *= multiplier
        rest = parts[1] if len(parts) > 1 else ''
    elif parts and parts[0].lower() in ('cup', 'cups', 'fl', 'fluid'):
        return {'name': original, 'amount': None, 'unit': '', 'note': 'US-Volumenmaß bitte prüfen'}
    return {'name': rest or original, 'amount': round(amount, 6), 'unit': unit, 'note': ''}


def validate_recipe(data):
    if not isinstance(data, dict):
        raise ValueError('Ungültiges Rezept.')
    title = str(data.get('title', '')).strip()[:200]
    if not title:
        raise ValueError('Bitte einen Rezeptnamen eingeben.')
    servings = number(data.get('servings', 2))
    if not 0 < servings <= 1000:
        raise ValueError('Die Portionenzahl muss zwischen 0 und 1.000 liegen.')
    ingredients = []
    for item in data.get('ingredients', [])[:200]:
        if not isinstance(item, dict):
            raise ValueError('Ungültige Zutat.')
        name = str(item.get('name', '')).strip()[:300]
        if not name:
            continue
        amount = item.get('amount')
        unit = str(item.get('unit', '')).strip()[:30]
        if amount is not None and amount != '':
            amount = number(amount)
            if unit.lower() in UNITS:
                unit, multiplier = UNITS[unit.lower()]
                amount *= multiplier
        else:
            amount = None
        ingredients.append({'name': name, 'amount': amount, 'unit': unit,
                            'note': str(item.get('note', '')).strip()[:300]})
    steps = [str(s).strip()[:3000] for s in data.get('steps', [])[:100] if str(s).strip()]
    if not ingredients or not steps:
        raise ValueError('Bitte mindestens eine Zutat und einen Zubereitungsschritt ergänzen.')
    warnings = [str(w)[:500] for w in data.get('warnings', [])[:20]]
    return {'title': title, 'servings': servings, 'ingredients': ingredients, 'steps': steps,
            'description': str(data.get('description', ''))[:1500],
            'source_url': str(data.get('source_url', ''))[:2000],
            'source_kind': str(data.get('source_kind', 'manual'))[:30],
            'original_text': str(data.get('original_text', ''))[:40000], 'warnings': warnings}


def shopping_list(entries):
    groups = {}
    for entry in entries:
        recipe = entry['recipe']
        factor = entry['servings'] / recipe['servings']
        for ingredient in recipe['ingredients']:
            name = ingredient['name']
            normalized = unicodedata.normalize('NFKC', name).casefold().strip()
            unit = ingredient['unit']
            note = ingredient.get('note', '')
            # Keep alternatives, preparation notes and unknown amounts separate.
            key = (normalized, unit.casefold(), note, ingredient['amount'] is None)
            if key not in groups:
                groups[key] = {'name': name, 'unit': unit, 'amount': None if ingredient['amount'] is None else 0,
                               'note': note, 'recipes': []}
            item = groups[key]
            if ingredient['amount'] is not None:
                item['amount'] += ingredient['amount'] * factor
            if recipe['title'] not in item['recipes']:
                item['recipes'].append(recipe['title'])
    result = []
    for key, item in sorted(groups.items()):
        item['key'] = '\u241f'.join(map(str, key))
        if item['amount'] is not None:
            item['amount'] = round(item['amount'], 3)
        result.append(item)
    return result
