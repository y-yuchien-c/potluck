import Anthropic from '@anthropic-ai/sdk'
import { ExtractedRecipe } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const RECIPE_JSON_SHAPE = `{
  "title": "Keep in original language, add English in brackets if helpful: 紅燒肉 (Red Braised Pork)",
  "summary": "2-3 sentences in English describing the dish and how it's made",
  "cuisine_tags": [],   // 1-3 values from: taiwanese, japanese, korean, chinese, thai, vietnamese, italian, american, mexican, french, indian, dessert, breakfast, other
  "meal_type": "dinner", // one of: breakfast, lunch, dinner, snack
  "equipment": [],      // in English, e.g. ["wok", "air fryer", "instant pot"]
  "ingredients": [      // keep names in original language with English in brackets if helpful
    { "name": "蒜頭 (garlic)", "amount": "3", "unit": "瓣" },
    { "name": "醬油 (soy sauce)", "amount": "2", "unit": "tbsp" },
    { "name": "蔥 (green onion)", "optional": true }
  ],
  "servings": 2,
  "cook_time": "25 mins",
  "thumbnail_url": null
}`

const RECIPE_RULES = `Rules:
- cuisine_tags must only use values from the list above
- Content is likely Chinese/Taiwanese — lean towards those tags when relevant
- If information is missing, make a reasonable guess from context
- Return ONLY the JSON object — no markdown, no explanation`

const SYSTEM_PROMPT = 'You extract structured recipe data from social media content. You are fluent in Chinese (Traditional and Simplified), Japanese, Korean, and English. Always respond with valid JSON only.'

export async function extractRecipeFromUrl(
  url: string,
  pageContent?: string
): Promise<ExtractedRecipe> {
  const prompt = `You are a cooking assistant that extracts recipe information from social media posts (Instagram, TikTok, YouTube Shorts).
The content may be in any language — Chinese (Traditional or Simplified), Japanese, Korean, English, etc.

URL: ${url}
${pageContent ? `\nPage content / caption:\n${pageContent}\n` : ''}

Extract the recipe and return ONLY a JSON object with this exact shape:
${RECIPE_JSON_SHAPE}

${RECIPE_RULES}`

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  // Strip any accidental markdown code fences
  const json = content.text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(json) as ExtractedRecipe
}

export async function extractRecipeFromImage(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  url?: string
): Promise<ExtractedRecipe> {
  const prompt = `You are a cooking assistant. The user has shared a screenshot of a cooking reel or recipe post.
${url ? `Original URL: ${url}\n` : ''}
Read all text visible in the screenshot — including any caption, ingredient list, or on-screen text — and extract the recipe.
The content may be in Chinese, Japanese, Korean, English, or any other language.

Return ONLY a JSON object with this exact shape:
${RECIPE_JSON_SHAPE}

${RECIPE_RULES}`

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        { type: 'text', text: prompt },
      ],
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

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
