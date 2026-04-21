export type CuisineTag =
  | 'taiwanese' | 'japanese' | 'korean' | 'chinese'
  | 'thai' | 'vietnamese' | 'italian' | 'american'
  | 'mexican' | 'french' | 'indian' | 'dessert'
  | 'breakfast' | 'other'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Ingredient {
  name: string
  amount?: string
  unit?: string
  optional?: boolean
}

export interface Recipe {
  id: string
  title: string
  source_url?: string
  thumbnail_url?: string
  summary?: string
  cuisine_tags: CuisineTag[]
  meal_type: MealType
  equipment: string[]
  ingredients: Ingredient[]
  servings?: number
  cook_time?: string
  created_by: string
  household_id?: string
  is_shared: boolean
  created_at: string
}

export interface CookingLog {
  id: string
  recipe_id: string
  user_id: string
  cooked_at: string
  notes?: string
  photo_url?: string
  cooked_with: string[]
  rating?: number
  created_at: string
}

export interface MealPlanSlot {
  id: string
  meal_plan_id: string
  day_of_week: number  // 0=Mon … 6=Sun
  meal_type: MealType
  recipe_id: string
  recipe?: Recipe
}

export interface MealPlan {
  id: string
  user_id: string
  household_id?: string
  week_start: string   // ISO date string (Monday)
  slots: MealPlanSlot[]
}

export interface Household {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  display_name?: string
  role: 'admin' | 'member'
  joined_at: string
}

// For the extraction API response
export interface ExtractedRecipe {
  title: string
  summary: string
  cuisine_tags: CuisineTag[]
  meal_type: MealType
  equipment: string[]
  ingredients: Ingredient[]
  servings?: number
  cook_time?: string
  thumbnail_url?: string
}
