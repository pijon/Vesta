import { describe, expect, it } from 'vitest';
import { ingredientsInStep, timersIn } from './cookSteps';

describe('timersIn', () => {
    it('finds a time and uses the upper bound of a range', () => {
        expect(timersIn('Bake for 25–30 minutes until golden.')).toEqual([{ label: '25–30 minutes', seconds: 1800 }]);
        expect(timersIn('Simmer 1,5 timmar.')).toEqual([{ label: '1,5 timmar', seconds: 5400 }]);
    });

    it('offers the alternative after "or" with the same unit', () => {
        expect(timersIn('Bake them for 15 minutes for a soft yolk or 20 for a hard yolk.')).toEqual([
            { label: '15 minutes', seconds: 900 },
            { label: '20 minutes', seconds: 1200 },
        ]);
        expect(timersIn('Koka 8 minuter eller 10 för hårdkokt.').map(t => t.seconds)).toEqual([480, 600]);
    });

    it("doesn't read a weight, size or temperature after 'or' as a time", () => {
        expect(timersIn('Cook 5 minutes, or 200 g if using frozen.')).toHaveLength(1);
        expect(timersIn('Roast 20 minutes or 180°C fan.')).toHaveLength(1);
        expect(timersIn('Rest 10 minutes. Serve 2 or 3 per plate.')).toHaveLength(1);
    });

    it('lists each length once', () => {
        expect(timersIn('Fry 5 min, turn, then fry another 5 min.')).toHaveLength(1);
    });
});

describe('ingredientsInStep', () => {
    const ingredients = ['4 rashers of streaky bacon', '4 eggs', '10g Parmesan, grated', 'freshly ground black pepper', '200 g peas'];

    it('matches the food words, ignoring amounts and preparation', () => {
        expect(ingredientsInStep('Crack 1 egg into each hole.', ingredients)).toEqual([1]);
        expect(ingredientsInStep('Sprinkle the Parmesan on top, along with some freshly ground black pepper.', ingredients)).toEqual([2, 3]);
        expect(ingredientsInStep('Line each hole with a rasher of bacon.', ingredients)).toEqual([0]);
    });

    it('needs a whole word for short stems', () => {
        expect(ingredientsInStep('Slice the peach.', ingredients)).toEqual([]);
        expect(ingredientsInStep('Stir in the pea.', ingredients)).toEqual([4]);
    });

    it('matches Swedish forms', () => {
        expect(ingredientsInStep('Knäck äggen i formen.', ['4 ägg', '2 msk smör'])).toEqual([0]);
    });
});
