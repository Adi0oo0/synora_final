// Offline nutrition table. The BFF replaces this with a VLM estimate when a
// meal photo comes in — same shape either way.
export const FOODS = [
  { id: 'avocado-toast', name: 'Avocado toast, one slice sourdough', kcal: 320, carbs: 30, protein: 9, fat: 19, fibre: 7, gi: 52, sodium: 480, tags: ['fatty'], portion: '1 slice' },
  { id: 'instant-ramen', name: 'Instant ramen, whole packet with broth', kcal: 480, carbs: 62, protein: 10, fat: 20, fibre: 2, gi: 73, sodium: 1720, tags: ['fatty', 'spicy'], portion: '1 packet' },
  { id: 'miso-soup', name: 'Miso soup', kcal: 84, carbs: 8, protein: 6, fat: 3, fibre: 1, gi: 30, sodium: 900, tags: [], portion: '1 bowl' },
  { id: 'grilled-salmon', name: 'Grilled salmon with brown rice', kcal: 520, carbs: 48, protein: 38, fat: 18, fibre: 5, gi: 55, sodium: 260, tags: [], portion: '1 plate' },
  { id: 'white-rice', name: 'White rice', kcal: 240, carbs: 53, protein: 4, fat: 1, fibre: 1, gi: 73, sodium: 2, tags: [], portion: '1 bowl' },
  { id: 'edamame', name: 'Edamame', kcal: 190, carbs: 14, protein: 17, fat: 8, fibre: 8, gi: 18, sodium: 9, tags: [], portion: '1 cup' },
  { id: 'matcha-latte', name: 'Matcha latte, sweetened', kcal: 210, carbs: 32, protein: 7, fat: 6, fibre: 1, gi: 60, sodium: 105, tags: ['caffeine'], portion: 'medium' },
  { id: 'banana', name: 'Banana, ripe', kcal: 105, carbs: 27, protein: 1, fat: 0, fibre: 3, gi: 62, sodium: 1, tags: [], portion: '1 medium' },
  { id: 'tonkatsu', name: 'Tonkatsu set with rice and cabbage', kcal: 780, carbs: 82, protein: 34, fat: 34, fibre: 6, gi: 70, sodium: 1450, tags: ['fatty', 'fried'], portion: '1 set' },
  { id: 'bento', name: 'Mixed bento: salmon, rice, pickles, tamagoyaki', kcal: 610, carbs: 71, protein: 29, fat: 22, fibre: 5, gi: 64, sodium: 1180, tags: ['fatty'], portion: '1 box' },
  { id: 'natto-rice', name: 'Natto over rice', kcal: 340, carbs: 58, protein: 18, fat: 6, fibre: 6, gi: 62, sodium: 640, tags: [], portion: '1 bowl' },
  { id: 'greek-yoghurt', name: 'Greek yoghurt with berries', kcal: 180, carbs: 18, protein: 17, fat: 5, fibre: 3, gi: 28, sodium: 65, tags: ['acidic'], portion: '1 cup' },
  { id: 'black-coffee', name: 'Black coffee', kcal: 3, carbs: 0, protein: 0, fat: 0, fibre: 0, gi: 0, sodium: 5, tags: ['caffeine', 'acidic'], portion: '1 cup' },
  { id: 'udon', name: 'Kake udon with broth', kcal: 430, carbs: 85, protein: 13, fat: 3, fibre: 4, gi: 62, sodium: 1580, tags: [], portion: '1 bowl' },
];

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export const SEED_MEALS = [
  { id: 'm1', foodId: 'greek-yoghurt', at: '07:20', label: 'Breakfast' },
  { id: 'm2', foodId: 'black-coffee', at: '07:25', label: 'Breakfast' },
  { id: 'm3', foodId: 'udon', at: '12:40', label: 'Lunch' },
];
