
import { parseRecipeText } from '../services/geminiService';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            process.env[match[1]] = match[2].trim();
        }
    });
} catch (e) {
    console.warn("Could not load .env.local", e);
}

const recipeText = `Ingredients
1 tbsp light olive oil
1 onion, roughly chopped
2 garlic cloves, finely chopped
2 level tbsp medium curry paste
2 tbsp tomato purée
200ml/7fl oz chicken or vegetable stock
200ml tin reduced fat coconut milk
1 courgette, cut into 1cm/½in cubes
400g/14oz raw tiger prawns, peeled (defrosted if frozen)
salt and freshly ground black pepper
For the pilau 'rice'
800g/1lb 12oz cauliflower florets
1 tsp light olive oil
1 tbsp pilau rice seasoning
6 tbsp chopped fresh coriander
Method
Heat the oil in a large frying pan. Add the onion and garlic and cook over a medium heat for 2–3 minutes, or until softened. Add the curry paste and fry for 30 seconds. Add the tomato purée, stock, coconut milk and courgette and simmer for 10 minutes.

Add the prawns and cook for 4–5 minutes, or until pink and cooked through. Season.

Meanwhile, to make the pilau, pulse the cauliflower in a food processor until the size of rice. Place in a large, heatproof bowl, cover with cling film, then pierce and microwave on high for 6–8 minutes.

Heat the oil in a wide frying pan over a medium heat. Fry the pilau seasoning and cauliflower ‘rice’ for 6–7 minutes, or until piping hot. Remove from the heat and stir in the coriander.

Serve the curry with the 'rice'.`;

async function main() {
    console.log("Attempting to parse recipe...");
    try {
        const result = await parseRecipeText(recipeText);
        console.log("Parsing successful:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Parsing failed:", error);
    }
}

main();
