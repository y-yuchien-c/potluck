import Anthropic from '@anthropic-ai/sdk'
import { ExtractedRecipe } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function extractRecipeFromUrl(
  url: string,
  pageContent?: string
): Promise<ExtractedRecipe> {
  const prompt = `You are a cooking assistant that extracts recipe information from social media posts (Instagram, TikTok, YouTube Shorts).

URL: ${url}
${pageContent ? `\nPage content / caption:\n${pageContent}\n` : ''}

Extract the recipe and return ONLY a JSON object with this exact shape:
{
  "title": "Dish name",
  "summary": "2-3 sentence overview of the dish and how it's made",
  "cuisine_tags": [],   // 1-3 values from: taiwanese, japanese, korean, chinese, thai, vietnamese, italian, american, mexican, french, indian, dessert, breakfast, other
  "meal_type": "dinner", // one of: breakfast, lunch, dinner, snack
  "equipment": [],      // e.g. ["wok", "air fryer", "instant pot"]
  "ingredients": [      // always include name; amount/unit/optional are optional fields
    { "name": "garlic", "amount": "3", "unit": "cloves" },
    { "name": "soy sauce", "amount": "2", "unit": "tbsp" },
    { "name": "green onion", "optional": true }
  ],
  "servings": 2,        // number or null
  "cook_time": "25 mins", // string or null
  "thumbnail_url": null
}

Rules:
- cuisine_tags must only use values from the list above
- If information is missing or unclear, make a reasonable guess based on the dish name/description
- Return ONLY the JSON object — no markdown, no explanation`

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: 'You extract structured recipe data from social media content. Always respond with valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  // Strip any accidental markdown code fences
  const json = content.text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(json) as ExtractedRecipe
}

export async function suggestRecipesByIngredients(
  ingredients: string[],
  savedRecipes: { id: string; title: string; ingredients: { name: string }[] }[]
): Promise<string[]> {
  if (savedRecipes.length === 0) return []

  const recipeList = savedRecipes
    .map(r => `- ${r.title} (id: ${r.id}): ${r.ingredients.map(i => i.name).join(', ')}`)
    .join('\n')

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `I have these ingredients: ${ingredients.join(', ')}.

From my saved recipes:
${recipeList}

Return a JSON array of recipe IDs that I can make (fully or mostly) with my ingredients. Example: ["id1", "id2"]
Return ONLY the JSON array.`,
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return []
  const json = content.text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(json) as string[]
}
