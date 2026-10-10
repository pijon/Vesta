import {
  Apple, Banana, Bean, Beef, Beer, CakeSlice, Candy, Carrot, Cherry, Citrus, Coffee, Cookie, CookingPot,
  Croissant, CupSoda, Donut, Drumstick, EggFried, Fish, GlassWater, Grape, Ham, Hamburger, IceCreamCone,
  LeafyGreen, Martini, Milk, Nut, Pizza, Popcorn, Salad, Sandwich, Shrimp, Soup, UtensilsCrossed, Wheat, Wine,
  type LucideIcon,
} from 'lucide-react';
import { Recipe } from '../types';
import { compileIconRules, matchIcon, type IconRule } from './iconMatch';

export interface MealVisual {
  label: string;
  Icon: LucideIcon;
  /** Tile tint + text classes, used when the meal has no photo */
  tint: string;
}

type FoodRule = IconRule<LucideIcon>;

/**
 * Food-type icons, matched against whole words in a recipe or logged item's name (English and common Swedish).
 * Dish shape comes first (a chicken salad is drawn as a salad), then the main ingredient.
 * See iconMatch.ts for plurals and the '-' compound markers.
 */
const DISH_RULES: FoodRule[] = [
  // Drinks first, so "coffee with milk" is a coffee and "orange juice" a drink
  [Coffee, ['coffee', 'latte', 'cappuccino', 'espresso', 'americano', 'flat white', 'mocha', 'tea', 'chai', 'matcha', 'kaffe', 'te']],
  [Wine, ['wine', 'prosecco', 'champagne', 'cava', 'rosé', 'vin', '-vin']],
  [Beer, ['beer', 'lager', 'ale', 'ipa', 'stout', 'cider', 'öl', '-öl']],
  [Martini, ['cocktail', 'gin', 'vodka', 'whisky', 'whiskey', 'rum', 'spritz', 'margarita', 'mojito']],
  [CupSoda, ['juice', 'soda', 'cola', 'coke', 'lemonade', 'kombucha', 'energy drink', 'squash', 'läsk', '-juice', 'saft']],
  [GlassWater, ['water', 'sparkling water', 'vatten', '-vatten']],
  [Milk, ['yoghurt', 'yogurt', 'smoothie', 'shake', 'protein shake', 'kefir', 'skyr', 'quark', 'kvarg', 'filmjölk', 'milk', '-mjölk', 'mjölk']],
  // Dishes
  [Soup, ['soup', 'broth', 'ramen', 'pho', 'chowder', 'bisque', 'gazpacho', 'minestrone', 'miso', '-soppa', '-buljong']],
  [Salad, ['salad', 'slaw', 'coleslaw', 'tabbouleh', 'poke', '-sallad']],
  [Hamburger, ['burger', 'hamburgare']],
  [Pizza, ['pizza', 'flatbread', 'calzone']],
  [Sandwich, ['sandwich', 'wrap', 'toastie', 'panini', 'burrito', 'quesadilla', 'taco', 'pitta', 'pita', 'toast', 'smörgås', 'macka', '-macka']],
  [CookingPot, ['stew', 'curry', 'chilli', 'chili', 'casserole', 'tagine', 'dal', 'dhal', 'daal', 'risotto', 'paella', 'pasta', 'spaghetti', 'noodle', 'lasagne', 'lasagna', 'penne', 'gnocchi', 'stir fry', 'stir-fry', '-gryta', '-grytan', 'wok']],
  [Wheat, ['porridge', 'oats', 'oatmeal', 'granola', 'muesli', 'bircher', 'cereal', 'cornflakes', 'crispbread', 'cracker', 'rice cake', '-gröt', 'havregryn', 'knäckebröd', 'knäcke']],
  [Donut, ['donut', 'doughnut', 'cinnamon bun', 'cinnamon roll', 'bun', 'pastry', 'danish', '-bulle', 'bulle', 'kanelbulle', 'semla']],
  [Croissant, ['pancake', 'waffle', 'crepe', 'croissant', 'muffin', 'bagel', 'bread', 'scone', 'brioche', '-pannkakor', '-pannkaka', '-våfflor', 'bröd', '-bröd']],
  [IceCreamCone, ['ice cream', 'sorbet', 'frozen yoghurt', 'gelato']],
  [Cookie, ['cookie', 'biscuit', 'flapjack', 'digestive', 'kaka', 'kakor', '-kaka', '-kakor']],
  [CakeSlice, ['cake', 'brownie', 'cheesecake', 'mousse', 'pudding', 'tart', 'crumble', 'dessert', '-tårta']],
  [Candy, ['chocolate', 'sweets', 'candy', 'fudge', 'choklad', '-choklad', 'godis']],
  [Popcorn, ['popcorn', 'crisps', 'chips', 'pretzel']],
];

const INGREDIENT_RULES: FoodRule[] = [
  [Shrimp, ['prawn', 'shrimp', 'scampi', 'räk-']],
  [Fish, ['fish', 'salmon', 'cod', 'tuna', 'mackerel', 'haddock', 'trout', 'sardine', 'hake', 'sea bass', 'lax-', 'torsk-', 'fisk-', '-fisk', 'tonfisk-', 'makrill-', 'sill']],
  [Drumstick, ['chicken', 'turkey', 'duck', 'kyckling-', 'kalkon-']],
  [Beef, ['beef', 'steak', 'mince', 'lamb', 'meatball', 'bolognese', 'köttfärs-', 'köttbullar', 'biff', 'lamm-', 'nötfärs-']],
  [Ham, ['pork', 'ham', 'bacon', 'chorizo', 'sausage', 'gammon', 'salami', 'fläsk-', 'skinka', 'korv-', '-korv']],
  [EggFried, ['egg', 'omelette', 'omelet', 'frittata', 'shakshuka', 'ägg', '-ägg', 'omelett']],
  [Bean, ['bean', 'lentil', 'chickpea', 'hummus', 'falafel', 'tofu', 'tempeh', 'edamame', 'bönor', 'linser', 'kikärtor']],
  [Nut, ['nut', 'almond', 'peanut', 'cashew', 'walnut', 'pistachio', 'trail mix', 'nötter', 'mandlar', 'jordnötter']],
  [Wheat, ['rice', 'quinoa', 'couscous', 'bulgur', 'ris']],
  [Banana, ['banana', 'banan', 'bananer']],
  [Grape, ['grape', 'raisin', 'vindruvor', 'russin']],
  [Cherry, ['berry', 'berries', 'strawberry', 'strawberries', 'raspberry', 'raspberries', 'blueberry', 'blueberries', 'cherry', 'cherries', 'bär', '-bär', 'hallon', 'jordgubbar']],
  [Citrus, ['orange', 'lemon', 'lime', 'grapefruit', 'clementine', 'satsuma', 'mandarin', 'citrus', 'citron', 'apelsin']],
  [Apple, ['apple', 'pear', 'peach', 'plum', 'nectarine', 'mango', 'kiwi', 'melon', 'pineapple', 'fruit', 'äpple', 'äpplen', 'päron', 'frukt']],
  [LeafyGreen, ['spinach', 'kale', 'greens', 'broccoli', 'asparagus', 'courgette', 'zucchini', 'avocado', 'cucumber', 'spenat', 'grönkål', 'gurka']],
  [Carrot, ['carrot', 'vegetable', 'veg', 'veggie', 'veggies', 'crudités', 'potato', 'sweet potato', 'tomato', 'tomatoes', 'pepper', 'morot', 'morötter', 'grönsaker', 'potatis']],
];

const DISH_PATTERNS = compileIconRules(DISH_RULES);
const INGREDIENT_PATTERNS = compileIconRules(INGREDIENT_RULES);

/** Icon for what the dish is: name first, then the first few ingredients for the main protein. */
export const foodIconFor = (meal: Partial<Pick<Recipe, 'name' | 'ingredients'>>): LucideIcon | undefined => {
  const name = meal.name || '';
  const fromName = matchIcon(name, DISH_PATTERNS) || matchIcon(name, INGREDIENT_PATTERNS);
  if (fromName) return fromName;
  const leadIngredients = (meal.ingredients || []).slice(0, 3).join(' · ');
  return leadIngredients ? matchIcon(leadIngredients, INGREDIENT_PATTERNS) : undefined;
};

/** Meal-type label and tint, with an icon for the food itself when the name tells us what it is. */
export const mealVisualFor = (meal: Pick<Recipe, 'tags'> & Partial<Pick<Recipe, 'name' | 'ingredients'>>): MealVisual => {
  const tags = (meal.tags || []).map(t => t.toLowerCase());
  const food = foodIconFor(meal);
  const visual = (label: string, Icon: LucideIcon, tint: string): MealVisual => ({ label, Icon: food || Icon, tint });

  if (tags.includes('breakfast')) return visual('Breakfast', Coffee, 'bg-fasting-bg text-fasting-text');
  if (tags.includes('lunch')) return visual('Lunch', Salad, 'bg-weight-bg text-weight-text');
  if (tags.includes('dinner') || tags.includes('main meal')) return visual('Main meal', UtensilsCrossed, 'bg-weight-bg text-weight-text');
  if (tags.includes('snack')) return visual('Snack', Cookie, 'bg-workout-bg text-workout-text');
  if (tags.includes('light meal')) return visual('Light meal', Soup, 'bg-water-bg text-water-text');
  const first = meal.tags?.[0];
  return visual(first ? first.charAt(0).toUpperCase() + first.slice(1) : 'Meal', UtensilsCrossed, 'bg-surface-sunken text-muted');
};
