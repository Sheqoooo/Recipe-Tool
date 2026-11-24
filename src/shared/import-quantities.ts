import type { RecipeData } from './types.js';

const usCup = /^(?:cups?|us[- ]cups?)$/i;
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function cupMeasure(name: string, note: string): { unit: string; perCup: number } | undefined {
  const ingredient = name.trim().toLowerCase();
  const description = (name + ' ' + note).toLowerCase();
  // USDA FoodData Central SR Legacy 170000 (chopped raw onions) and 168877 (raw white long-grain rice).
  if (/^(?:(?:gehackte|gewürfelte|rohe|gelbe|rote|weiße) )*zwiebeln?$/.test(ingredient) &&
      /gehackt|gewürfelt/.test(description) && !/gegart|gebraten|gekocht|getrocknet|gefroren/.test(description))
    return { unit: 'g', perCup: 160 };
  if (/^(?:(?:roher|ungekochter|weißer) )*langkornreis$/.test(ingredient) &&
      /\bweiß\w*/.test(description) && /\b(?:roh\w*|ungekocht\w*)\b/.test(description) &&
      !/\b(?:gekocht\w*|gegart\w*|vorgegart\w*|parboiled)\b/.test(description))
    return { unit: 'g', perCup: 185 };
  if (/^(?:wasser|(?:gemüse|hühner|rinder|fleisch)?brühe|(?:gemüse|hühner|rinder)?fond)$/.test(ingredient))
    return { unit: 'ml', perCup: 236.5882365 };
}

/** Normalize explicit US cups in imported data before ordinary unit validation. */
export function normalizeImportQuantities(recipe: RecipeData): void {
  for (const [index, item] of recipe.ingredients.entries()) {
    if (!usCup.test(item.unit.trim())) continue;
    const measure = cupMeasure(item.name, item.note);
    const amount = item.amount;
    const raw = measure && amount !== null ? amount * measure.perCup : null;
    const increment = raw !== null && raw >= 500 ? 25 : raw !== null && raw >= 100 ? (measure?.unit === 'ml' ? 10 : 5) : raw !== null && raw >= 20 ? 1 : 0;
    item.unit = 'US-Tasse';
    if (raw !== null && increment && measure) {
      item.amount = Math.round(raw / increment) * increment;
      item.unit = measure.unit;
      item.note = ['Ca.-Menge aus US-Cup umgerechnet.', item.note].filter(Boolean).join(' ').slice(0, 300);
    }
    if (amount === null || recipe.ingredients.filter(other => other.name.trim().toLowerCase() === item.name.trim().toLowerCase()).length !== 1) continue;
    const label = item.unit === 'US-Tasse' ? amount === 1 ? 'US-Tasse' : 'US-Tassen' : item.unit;
    const rendered = (item.unit === 'US-Tasse' ? '' : 'ca. ') + String(item.amount).replace('.', ',') + ' ' + label;
    // Only replace an explicit full amount next to the named ingredient. Leave other shares and timings alone.
    const pattern = new RegExp('(^|[^\\p{L}\\p{N}])(' + escapeRegex(item.name.trim()) + '\\s*\\()([0-9]+(?:[.,][0-9]+|/[0-9]+)?)\\s+(?:US[- ]?)?cups?\\)', 'giu');
    for (const step of recipe.steps) {
      if (!step.ingredient_indices.includes(index)) continue;
      step.text = step.text.replace(pattern, (match, boundary: string, prefix: string, value: string) => {
        const [numerator, denominator] = value.replace(',', '.').split('/').map(Number);
        return numerator / (denominator ?? 1) === amount ? boundary + prefix + rendered + ')' : match;
      });
    }
  }
}
