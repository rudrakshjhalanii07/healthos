/**
 * Offline food database. Values are typical kcal and macros (protein, carbs, fat in grams)
 * per 100 g (or 100 ml) plus a common serving size, so estimates are ballpark by design —
 * the user can always log manually.
 */
export type Tag =
  | 'meat'
  | 'beef'
  | 'pork'
  | 'fish'
  | 'shellfish'
  | 'egg'
  | 'dairy'
  | 'lactose'
  | 'gluten'
  | 'nuts'
  | 'peanut'
  | 'soy'
  | 'alcohol';

export type Food = {
  name: string;
  aliases?: string[];
  per100: number;
  /** Protein, carbs, fat in grams per 100 g. */
  m: [p: number, c: number, f: number];
  t?: Tag[];
  serving: [label: string, grams: number];
  /** Grams in one cup / bowl when it differs from the generic defaults. */
  cup?: number;
  bowl?: number;
};

// prettier-ignore
const FOODS: Food[] = [
  // Eggs & dairy
  { name: 'boiled egg', aliases: ['egg', 'eggs', 'hard boiled egg'], per100: 155, m: [13, 1.1, 11], t: ['egg'], serving: ['egg', 50] },
  { name: 'omelette', aliases: ['omelet', 'egg omelette'], per100: 154, m: [11, 1, 12], t: ['egg'], serving: ['omelette (2 eggs)', 120] },
  { name: 'scrambled eggs', aliases: ['egg bhurji', 'bhurji'], per100: 149, m: [10, 2, 11], t: ['egg'], serving: ['serving', 110] },
  { name: 'egg white', aliases: ['egg whites'], per100: 52, m: [11, 0.7, 0.2], t: ['egg'], serving: ['egg white', 33] },
  { name: 'milk', aliases: ['whole milk', 'full cream milk', 'toned milk'], per100: 61, m: [3.2, 4.8, 3.3], t: ['dairy', 'lactose'], serving: ['glass', 250], cup: 240 },
  { name: 'skim milk', aliases: ['skimmed milk', 'low fat milk'], per100: 34, m: [3.4, 5, 0.1], t: ['dairy', 'lactose'], serving: ['glass', 250], cup: 240 },
  { name: 'yogurt', aliases: ['curd', 'dahi', 'plain yogurt'], per100: 61, m: [3.5, 4.7, 3.3], t: ['dairy', 'lactose'], serving: ['bowl', 150], bowl: 150 },
  { name: 'greek yogurt', per100: 97, m: [9, 4, 5], t: ['dairy', 'lactose'], serving: ['cup', 170], cup: 170 },
  { name: 'raita', per100: 70, m: [3, 5, 4], t: ['dairy', 'lactose'], serving: ['bowl', 150], bowl: 150 },
  { name: 'paneer', aliases: ['cottage cheese indian'], per100: 265, m: [18, 3.5, 20], t: ['dairy', 'lactose'], serving: ['serving', 100] },
  { name: 'cheddar cheese', aliases: ['cheese', 'cheese slice'], per100: 403, m: [25, 1.3, 33], t: ['dairy'], serving: ['slice', 21] },
  { name: 'mozzarella', per100: 280, m: [28, 3, 17], t: ['dairy', 'lactose'], serving: ['serving', 30] },
  { name: 'cottage cheese', per100: 98, m: [11, 3.4, 4.3], t: ['dairy', 'lactose'], serving: ['cup', 225], cup: 225 },
  { name: 'butter', per100: 717, m: [0.9, 0.1, 81], t: ['dairy'], serving: ['tbsp', 14] },
  { name: 'ghee', per100: 900, m: [0, 0, 100], t: ['dairy'], serving: ['tsp', 5] },
  { name: 'lassi', aliases: ['sweet lassi'], per100: 90, m: [3, 14, 2.5], t: ['dairy', 'lactose'], serving: ['glass', 250] },
  { name: 'buttermilk', aliases: ['chaas', 'chhaas'], per100: 25, m: [1.5, 2.5, 1], t: ['dairy', 'lactose'], serving: ['glass', 250] },

  // Dairy alternatives
  { name: 'lactose-free milk', aliases: ['lactose free milk', 'lactofree milk'], per100: 50, m: [3.3, 4.8, 1.5], t: ['dairy'], serving: ['glass', 250], cup: 240 },
  { name: 'soy milk', aliases: ['soya milk'], per100: 43, m: [3.3, 3, 1.8], t: ['soy'], serving: ['glass', 250], cup: 240 },
  { name: 'oat milk', per100: 47, m: [1, 7, 1.5], t: ['gluten'], serving: ['glass', 250], cup: 240 },
  { name: 'almond milk', per100: 17, m: [0.6, 0.3, 1.4], t: ['nuts'], serving: ['glass', 250], cup: 240 },
  { name: 'lactose-free yogurt', aliases: ['lactose free curd', 'lactose free yogurt'], per100: 60, m: [3.5, 4.5, 3], t: ['dairy'], serving: ['bowl', 150], bowl: 150 },
  { name: 'soy yogurt', aliases: ['soya curd', 'soy curd'], per100: 66, m: [4, 5, 3], t: ['soy'], serving: ['bowl', 150], bowl: 150 },
  { name: 'coconut yogurt', aliases: ['coconut curd'], per100: 120, m: [1, 8, 10], serving: ['bowl', 125], bowl: 125 },

  // Grains & breads
  { name: 'white rice', aliases: ['rice', 'steamed rice', 'chawal', 'boiled rice'], per100: 130, m: [2.7, 28, 0.3], serving: ['cup', 158], cup: 158, bowl: 200 },
  { name: 'brown rice', per100: 112, m: [2.3, 23.5, 0.8], serving: ['cup', 195], cup: 195 },
  { name: 'jeera rice', per100: 160, m: [3, 28, 4], serving: ['cup', 160], cup: 160 },
  { name: 'fried rice', aliases: ['veg fried rice', 'chicken fried rice'], per100: 175, m: [4.5, 25, 6], t: ['soy', 'gluten'], serving: ['plate', 300] },
  { name: 'chicken biryani', aliases: ['biryani', 'mutton biryani'], per100: 180, m: [8, 22, 6.5], t: ['meat'], serving: ['plate', 300] },
  { name: 'veg biryani', aliases: ['vegetable biryani', 'pulao', 'veg pulao'], per100: 150, m: [3.5, 24, 4.5], serving: ['plate', 300] },
  { name: 'khichdi', per100: 120, m: [4.5, 20, 2.5], serving: ['bowl', 250] },
  { name: 'roti', aliases: ['chapati', 'chapathi', 'phulka', 'fulka'], per100: 297, m: [10, 55, 4], t: ['gluten'], serving: ['roti', 40] },
  { name: 'millet roti', aliases: ['jowar roti', 'bajra roti', 'ragi roti', 'bhakri', 'jowar bhakri'], per100: 280, m: [8, 58, 2], serving: ['roti', 45] },
  { name: 'paratha', aliases: ['plain paratha', 'parantha'], per100: 320, m: [7, 45, 13], t: ['gluten'], serving: ['paratha', 80] },
  { name: 'aloo paratha', aliases: ['stuffed paratha', 'gobi paratha', 'paneer paratha'], per100: 230, m: [5, 32, 9], t: ['gluten'], serving: ['paratha', 130] },
  { name: 'naan', aliases: ['butter naan', 'garlic naan'], per100: 300, m: [9, 50, 7], t: ['gluten', 'dairy', 'lactose'], serving: ['naan', 90] },
  { name: 'puri', aliases: ['poori'], per100: 400, m: [7, 45, 21], t: ['gluten'], serving: ['puri', 25] },
  { name: 'bhature', aliases: ['bhatura', 'chole bhature'], per100: 330, m: [7, 45, 13], t: ['gluten', 'dairy', 'lactose'], serving: ['bhatura', 80] },
  { name: 'white bread', aliases: ['bread', 'toast', 'bread slice'], per100: 265, m: [9, 49, 3.2], t: ['gluten'], serving: ['slice', 25] },
  { name: 'whole wheat bread', aliases: ['brown bread', 'multigrain bread'], per100: 250, m: [12, 43, 3.5], t: ['gluten'], serving: ['slice', 30] },
  { name: 'gluten-free bread', aliases: ['gluten free bread', 'gf bread'], per100: 250, m: [4, 45, 6], serving: ['slice', 30] },
  { name: 'oats', aliases: ['oatmeal', 'porridge', 'overnight oats'], per100: 71, m: [2.5, 12, 1.5], t: ['gluten'], serving: ['bowl', 234], bowl: 234 },
  { name: 'rolled oats dry', aliases: ['dry oats'], per100: 389, m: [13, 66, 7], t: ['gluten'], serving: ['cup', 80], cup: 80 },
  { name: 'cornflakes', aliases: ['cereal'], per100: 357, m: [7.5, 84, 0.4], t: ['gluten'], serving: ['bowl', 30], bowl: 30, cup: 30 },
  { name: 'muesli', per100: 370, m: [10, 66, 6], t: ['gluten', 'nuts'], serving: ['serving', 50], bowl: 50 },
  { name: 'granola', per100: 471, m: [10, 64, 20], t: ['gluten', 'nuts'], serving: ['serving', 50], cup: 110 },
  { name: 'pasta', aliases: ['cooked pasta', 'spaghetti', 'penne'], per100: 158, m: [5.8, 31, 0.9], t: ['gluten'], serving: ['cup', 140], cup: 140, bowl: 250 },
  { name: 'gluten-free pasta', aliases: ['gluten free pasta', 'gf pasta', 'rice pasta'], per100: 160, m: [3, 34, 1], serving: ['cup', 140], cup: 140, bowl: 250 },
  { name: 'lentil pasta', aliases: ['chickpea pasta', 'protein pasta'], per100: 160, m: [11, 26, 1], serving: ['cup', 140], cup: 140, bowl: 250 },
  { name: 'pasta in sauce', aliases: ['white sauce pasta', 'red sauce pasta', 'alfredo pasta', 'spaghetti bolognese'], per100: 150, m: [5, 20, 5.5], t: ['gluten', 'dairy', 'lactose'], serving: ['plate', 300] },
  { name: 'mac and cheese', aliases: ['macaroni'], per100: 164, m: [6.5, 19, 7], t: ['gluten', 'dairy', 'lactose'], serving: ['cup', 200], cup: 200 },
  { name: 'instant noodles', aliases: ['maggi', 'ramen noodles', 'cup noodles'], per100: 440, m: [9, 60, 18], t: ['gluten'], serving: ['pack', 70] },
  { name: 'hakka noodles', aliases: ['chowmein', 'chow mein', 'noodles'], per100: 150, m: [4, 23, 4.5], t: ['gluten', 'soy'], serving: ['plate', 250] },
  { name: 'rice noodles', aliases: ['vermicelli', 'rice vermicelli', 'pad thai noodles'], per100: 108, m: [1.8, 24, 0.2], serving: ['cup', 175], cup: 175 },
  { name: 'poha', per100: 130, m: [2.5, 23, 3], serving: ['plate', 200] },
  { name: 'upma', per100: 130, m: [3, 20, 4], t: ['gluten'], serving: ['bowl', 200] },
  { name: 'quinoa', per100: 120, m: [4.4, 21, 1.9], serving: ['cup', 185], cup: 185 },

  // South Indian & snacks
  { name: 'idli', per100: 146, m: [4.5, 30, 0.4], serving: ['idli', 40] },
  { name: 'dosa', aliases: ['plain dosa'], per100: 170, m: [4, 28, 4.5], serving: ['dosa', 80] },
  { name: 'masala dosa', per100: 190, m: [3.5, 27, 7.5], serving: ['dosa', 200] },
  { name: 'uttapam', per100: 160, m: [4, 26, 4.5], serving: ['uttapam', 130] },
  { name: 'moong chilla', aliases: ['chilla', 'besan chilla', 'cheela'], per100: 180, m: [10, 22, 6], serving: ['chilla', 80] },
  { name: 'medu vada', aliases: ['vada'], per100: 290, m: [9, 30, 15], serving: ['vada', 50] },
  { name: 'sambar', per100: 65, m: [3, 9, 2], serving: ['bowl', 200], bowl: 200 },
  { name: 'coconut chutney', aliases: ['chutney'], per100: 200, m: [2.5, 8, 18], serving: ['serving', 30] },
  { name: 'samosa', per100: 290, m: [5, 32, 16], t: ['gluten'], serving: ['samosa', 90] },
  { name: 'pakora', aliases: ['pakoda', 'bhajji', 'bhaji'], per100: 315, m: [7, 32, 18], serving: ['serving', 100] },
  { name: 'vada pav', per100: 195, m: [5, 30, 6], t: ['gluten'], serving: ['vada pav', 150] },
  { name: 'pav bhaji', per100: 160, m: [3.5, 21, 7], t: ['gluten', 'dairy'], serving: ['plate', 250] },
  { name: 'dhokla', per100: 160, m: [6, 25, 4], serving: ['piece', 30] },
  { name: 'kachori', per100: 400, m: [8, 45, 21], t: ['gluten'], serving: ['kachori', 60] },
  { name: 'pani puri', aliases: ['golgappa', 'puchka'], per100: 300, m: [5, 45, 11], t: ['gluten'], serving: ['piece', 12] },
  { name: 'bhel puri', aliases: ['bhel'], per100: 180, m: [4.5, 30, 5], serving: ['plate', 150] },
  { name: 'veg momos', aliases: ['momos', 'momo', 'dumplings'], per100: 140, m: [4, 22, 3.5], t: ['gluten'], serving: ['piece', 30] },
  { name: 'chicken momos', aliases: ['chicken momo'], per100: 170, m: [9, 20, 6], t: ['gluten', 'meat'], serving: ['piece', 30] },
  { name: 'spring roll', per100: 220, m: [4, 25, 11], t: ['gluten'], serving: ['roll', 60] },
  { name: 'manchurian', aliases: ['gobi manchurian', 'veg manchurian'], per100: 200, m: [4, 20, 11], t: ['gluten', 'soy'], serving: ['bowl', 200] },

  // Curries & mains
  { name: 'dal', aliases: ['dal tadka', 'dal fry', 'lentils', 'moong dal', 'toor dal', 'lentil soup'], per100: 105, m: [6, 14, 3], serving: ['bowl', 200], bowl: 200 },
  { name: 'dal makhani', per100: 160, m: [6, 15, 8.5], t: ['dairy', 'lactose'], serving: ['bowl', 200], bowl: 200 },
  { name: 'rajma', aliases: ['kidney beans', 'rajma masala'], per100: 140, m: [6.5, 18, 5], serving: ['bowl', 200], bowl: 200 },
  { name: 'chole', aliases: ['chana masala', 'chickpea curry'], per100: 160, m: [6.5, 20, 6], serving: ['bowl', 200], bowl: 200 },
  { name: 'boiled chickpeas', aliases: ['chickpeas', 'chana', 'kabuli chana'], per100: 164, m: [9, 27, 2.6], serving: ['cup', 160], cup: 160 },
  { name: 'paneer butter masala', aliases: ['shahi paneer', 'paneer makhani', 'kadai paneer', 'paneer curry'], per100: 220, m: [8, 9, 17], t: ['dairy', 'lactose'], serving: ['bowl', 200], bowl: 200 },
  { name: 'palak paneer', per100: 150, m: [7, 6, 11], t: ['dairy', 'lactose'], serving: ['bowl', 200], bowl: 200 },
  { name: 'paneer tikka', per100: 250, m: [15, 6, 18], t: ['dairy', 'lactose'], serving: ['serving', 150] },
  { name: 'aloo sabzi', aliases: ['aloo curry', 'potato curry', 'aloo gobi', 'jeera aloo'], per100: 110, m: [2, 15, 5], serving: ['bowl', 150], bowl: 150 },
  { name: 'mixed veg', aliases: ['sabzi', 'sabji', 'vegetable curry', 'bhindi', 'baingan bharta', 'stir fry veg'], per100: 90, m: [2.5, 9, 5], serving: ['bowl', 150], bowl: 150 },
  { name: 'chicken curry', aliases: ['chicken masala', 'chicken gravy'], per100: 150, m: [13, 5, 9], t: ['meat'], serving: ['bowl', 250], bowl: 250 },
  { name: 'butter chicken', aliases: ['murgh makhani', 'chicken tikka masala'], per100: 175, m: [13, 6, 11], t: ['meat', 'dairy', 'lactose'], serving: ['bowl', 250], bowl: 250 },
  { name: 'chicken tikka', aliases: ['tandoori chicken'], per100: 150, m: [24, 3, 5], t: ['meat', 'dairy'], serving: ['serving', 150] },
  { name: 'mutton curry', aliases: ['lamb curry', 'rogan josh', 'keema'], per100: 200, m: [15, 4, 14], t: ['meat'], serving: ['bowl', 200], bowl: 200 },
  { name: 'fish curry', per100: 120, m: [13, 4, 6], t: ['fish'], serving: ['bowl', 200], bowl: 200 },
  { name: 'fish fry', aliases: ['fried fish'], per100: 200, m: [18, 8, 11], t: ['fish'], serving: ['serving', 150] },
  { name: 'egg curry', per100: 140, m: [8, 5, 10], t: ['egg'], serving: ['bowl', 200], bowl: 200 },
  { name: 'shawarma', aliases: ['chicken shawarma', 'kathi roll', 'wrap', 'frankie'], per100: 220, m: [11, 22, 10], t: ['meat', 'gluten'], serving: ['wrap', 250] },

  // Proteins
  { name: 'chicken breast', aliases: ['grilled chicken', 'chicken'], per100: 165, m: [31, 0, 3.6], t: ['meat'], serving: ['serving', 150] },
  { name: 'chicken thigh', per100: 209, m: [26, 0, 11], t: ['meat'], serving: ['thigh', 110] },
  { name: 'white fish', aliases: ['basa', 'tilapia', 'cod', 'grilled fish', 'fish'], per100: 96, m: [20, 0, 1.7], t: ['fish'], serving: ['fillet', 150] },
  { name: 'salmon', per100: 208, m: [20, 0, 13], t: ['fish'], serving: ['fillet', 150] },
  { name: 'tuna', aliases: ['canned tuna'], per100: 116, m: [26, 0, 1], t: ['fish'], serving: ['can', 140] },
  { name: 'shrimp', aliases: ['prawns', 'prawn'], per100: 99, m: [24, 0.2, 0.3], t: ['shellfish'], serving: ['serving', 100] },
  { name: 'steak', aliases: ['beef', 'beef steak'], per100: 271, m: [25, 0, 19], t: ['meat', 'beef'], serving: ['steak', 200] },
  { name: 'ground beef', aliases: ['minced beef'], per100: 250, m: [26, 0, 15], t: ['meat', 'beef'], serving: ['serving', 110] },
  { name: 'bacon', per100: 541, m: [37, 1.4, 42], t: ['meat', 'pork'], serving: ['strip', 8] },
  { name: 'sausage', per100: 300, m: [12, 3, 27], t: ['meat', 'pork'], serving: ['sausage', 50] },
  { name: 'ham', per100: 145, m: [21, 1.5, 6], t: ['meat', 'pork'], serving: ['slice', 28] },
  { name: 'tofu', per100: 76, m: [8, 1.9, 4.8], t: ['soy'], serving: ['serving', 150] },
  { name: 'tempeh', per100: 192, m: [20, 7.6, 11], t: ['soy'], serving: ['serving', 100] },
  { name: 'edamame', per100: 121, m: [12, 9, 5], t: ['soy'], serving: ['cup', 155], cup: 155 },
  { name: 'seitan', per100: 120, m: [25, 4, 1], t: ['gluten'], serving: ['serving', 100] },
  { name: 'soya chunks', aliases: ['soy chunks', 'nutrela'], per100: 345, m: [52, 33, 0.5], t: ['soy'], serving: ['serving', 50] },
  { name: 'sprouts', aliases: ['moong sprouts', 'sprout salad'], per100: 30, m: [3, 6, 0.2], serving: ['cup', 100], cup: 100 },
  { name: 'hummus', per100: 166, m: [8, 14, 10], serving: ['tbsp', 30] },
  { name: 'falafel', per100: 333, m: [13, 32, 18], serving: ['piece', 17] },
  { name: 'whey protein', aliases: ['protein shake', 'whey', 'protein powder'], per100: 400, m: [80, 8, 6], t: ['dairy', 'lactose'], serving: ['scoop', 30] },
  { name: 'whey isolate', aliases: ['isolate', 'whey protein isolate'], per100: 370, m: [90, 1, 1], t: ['dairy'], serving: ['scoop', 30] },
  { name: 'plant protein', aliases: ['vegan protein', 'pea protein', 'plant protein powder'], per100: 380, m: [75, 8, 6], serving: ['scoop', 32] },
  { name: 'protein bar', per100: 350, m: [30, 35, 11], t: ['dairy'], serving: ['bar', 60] },

  // Fruit & veg
  { name: 'banana', per100: 89, m: [1.1, 23, 0.3], serving: ['banana', 118] },
  { name: 'apple', per100: 52, m: [0.3, 14, 0.2], serving: ['apple', 182] },
  { name: 'orange', per100: 47, m: [0.9, 12, 0.1], serving: ['orange', 131] },
  { name: 'mango', per100: 60, m: [0.8, 15, 0.4], serving: ['mango', 200] },
  { name: 'grapes', per100: 69, m: [0.7, 18, 0.2], serving: ['cup', 150], cup: 150 },
  { name: 'watermelon', per100: 30, m: [0.6, 7.6, 0.2], serving: ['cup', 150], cup: 150 },
  { name: 'papaya', per100: 43, m: [0.5, 11, 0.3], serving: ['cup', 145], cup: 145 },
  { name: 'pineapple', per100: 50, m: [0.5, 13, 0.1], serving: ['cup', 165], cup: 165 },
  { name: 'strawberries', aliases: ['strawberry'], per100: 32, m: [0.7, 7.7, 0.3], serving: ['cup', 150], cup: 150 },
  { name: 'blueberries', aliases: ['berries'], per100: 57, m: [0.7, 14, 0.3], serving: ['cup', 150], cup: 150 },
  { name: 'pomegranate', per100: 83, m: [1.7, 19, 1.2], serving: ['cup', 175], cup: 175 },
  { name: 'guava', per100: 68, m: [2.6, 14, 1], serving: ['guava', 55] },
  { name: 'dates', aliases: ['date', 'khajur'], per100: 282, m: [2.5, 75, 0.4], serving: ['date', 8] },
  { name: 'avocado', per100: 160, m: [2, 8.5, 15], serving: ['avocado', 150] },
  { name: 'potato', aliases: ['boiled potato', 'aloo'], per100: 87, m: [1.9, 20, 0.1], serving: ['potato', 150] },
  { name: 'sweet potato', per100: 86, m: [1.6, 20, 0.1], serving: ['potato', 150] },
  { name: 'green salad', aliases: ['salad', 'cucumber', 'veggies'], per100: 20, m: [1, 3.5, 0.2], serving: ['bowl', 150], bowl: 150 },
  { name: 'chicken salad', aliases: ['caesar salad'], per100: 130, m: [12, 4, 7], t: ['meat'], serving: ['bowl', 250], bowl: 250 },

  // Nuts & spreads
  { name: 'almonds', aliases: ['badam', 'almond'], per100: 579, m: [21, 22, 50], t: ['nuts'], serving: ['handful', 28] },
  { name: 'walnuts', aliases: ['walnut', 'akhrot'], per100: 654, m: [15, 14, 65], t: ['nuts'], serving: ['handful', 28] },
  { name: 'cashews', aliases: ['kaju', 'cashew'], per100: 553, m: [18, 30, 44], t: ['nuts'], serving: ['handful', 28] },
  { name: 'peanuts', aliases: ['peanut', 'moongphali'], per100: 567, m: [26, 16, 49], t: ['peanut'], serving: ['handful', 28] },
  { name: 'roasted chana', aliases: ['bhuna chana', 'roasted chickpeas'], per100: 370, m: [20, 58, 6], serving: ['handful', 30] },
  { name: 'mixed nuts', aliases: ['nuts', 'trail mix'], per100: 607, m: [20, 21, 54], t: ['nuts', 'peanut'], serving: ['handful', 28] },
  { name: 'peanut butter', per100: 588, m: [25, 20, 50], t: ['peanut'], serving: ['tbsp', 16] },
  { name: 'jam', per100: 250, m: [0.4, 62, 0.1], serving: ['tbsp', 20] },
  { name: 'honey', per100: 304, m: [0.3, 82, 0], serving: ['tbsp', 21] },
  { name: 'sugar', per100: 387, m: [0, 100, 0], serving: ['tsp', 4] },
  { name: 'olive oil', aliases: ['oil', 'cooking oil'], per100: 884, m: [0, 0, 100], serving: ['tbsp', 13.5] },

  // Fast food & international
  { name: 'pizza', aliases: ['pizza slice', 'cheese pizza', 'pepperoni pizza'], per100: 266, m: [11, 33, 10], t: ['gluten', 'dairy', 'lactose'], serving: ['slice', 107] },
  { name: 'burger', aliases: ['cheeseburger', 'hamburger', 'chicken burger'], per100: 260, m: [13, 24, 12], t: ['gluten', 'meat'], serving: ['burger', 200] },
  { name: 'french fries', aliases: ['fries', 'chips fries'], per100: 312, m: [3.4, 41, 15], serving: ['medium', 117] },
  { name: 'sandwich', aliases: ['veg sandwich', 'grilled sandwich', 'club sandwich', 'sub'], per100: 230, m: [9, 28, 9], t: ['gluten'], serving: ['sandwich', 150] },
  { name: 'burrito', per100: 206, m: [8, 25, 8], t: ['gluten'], serving: ['burrito', 250] },
  { name: 'taco', aliases: ['tacos'], per100: 226, m: [9, 20, 12], t: ['meat'], serving: ['taco', 80] },
  { name: 'sushi', aliases: ['sushi roll', 'maki'], per100: 150, m: [5, 28, 1.5], t: ['fish'], serving: ['piece', 25] },
  { name: 'ramen', aliases: ['ramen bowl'], per100: 90, m: [4, 11, 3], t: ['gluten', 'soy'], serving: ['bowl', 500], bowl: 500 },
  { name: 'fried chicken', aliases: ['kfc', 'chicken wings', 'wings'], per100: 290, m: [18, 11, 19], t: ['meat', 'gluten'], serving: ['piece', 120] },
  { name: 'nachos', per100: 346, m: [8, 36, 19], t: ['dairy', 'lactose'], serving: ['plate', 150] },
  { name: 'pancakes', aliases: ['pancake'], per100: 227, m: [6, 28, 10], t: ['gluten', 'egg', 'dairy', 'lactose'], serving: ['pancake', 50] },
  { name: 'waffle', aliases: ['waffles'], per100: 291, m: [8, 33, 14], t: ['gluten', 'egg', 'dairy', 'lactose'], serving: ['waffle', 75] },
  { name: 'tomato soup', aliases: ['soup', 'veg soup'], per100: 30, m: [1, 5, 0.8], serving: ['bowl', 250], bowl: 250 },
  { name: 'chicken soup', aliases: ['chicken noodle soup'], per100: 40, m: [3, 4, 1.2], t: ['meat', 'gluten'], serving: ['bowl', 250], bowl: 250 },

  // Sweets & snacks
  { name: 'gulab jamun', per100: 375, m: [5, 50, 17], t: ['gluten', 'dairy', 'lactose'], serving: ['piece', 40] },
  { name: 'rasgulla', aliases: ['rosogolla'], per100: 186, m: [4, 40, 1.5], t: ['dairy', 'lactose'], serving: ['piece', 50] },
  { name: 'jalebi', per100: 450, m: [3, 70, 18], t: ['gluten'], serving: ['serving', 50] },
  { name: 'ladoo', aliases: ['laddu', 'besan ladoo', 'motichoor ladoo'], per100: 420, m: [8, 55, 19], t: ['dairy'], serving: ['ladoo', 40] },
  { name: 'kheer', aliases: ['rice pudding', 'payasam'], per100: 140, m: [4, 20, 5], t: ['dairy', 'lactose'], serving: ['bowl', 150], bowl: 150 },
  { name: 'halwa', aliases: ['gajar halwa', 'sooji halwa'], per100: 300, m: [4, 40, 14], t: ['dairy', 'lactose'], serving: ['bowl', 100], bowl: 100 },
  { name: 'milk chocolate', aliases: ['chocolate', 'dairy milk'], per100: 535, m: [7.7, 59, 30], t: ['dairy', 'lactose'], serving: ['bar', 40] },
  { name: 'dark chocolate', per100: 598, m: [7.8, 46, 43], serving: ['square', 10] },
  { name: 'ice cream', aliases: ['icecream', 'gelato'], per100: 207, m: [3.5, 24, 11], t: ['dairy', 'lactose'], serving: ['scoop', 66] },
  { name: 'cake', aliases: ['chocolate cake', 'pastry', 'cheesecake'], per100: 370, m: [5, 50, 17], t: ['gluten', 'egg', 'dairy', 'lactose'], serving: ['slice', 80] },
  { name: 'cookie', aliases: ['cookies', 'biscuit', 'biscuits'], per100: 480, m: [6, 65, 22], t: ['gluten', 'dairy'], serving: ['cookie', 15] },
  { name: 'donut', aliases: ['doughnut'], per100: 452, m: [5, 51, 25], t: ['gluten', 'egg', 'dairy'], serving: ['donut', 60] },
  { name: 'muffin', per100: 380, m: [5.5, 52, 17], t: ['gluten', 'egg', 'dairy'], serving: ['muffin', 100] },
  { name: 'potato chips', aliases: ['chips', 'crisps', 'lays'], per100: 536, m: [7, 53, 35], serving: ['small pack', 28] },
  { name: 'popcorn', per100: 450, m: [8, 57, 22], serving: ['cup', 11], cup: 11 },
  { name: 'namkeen', aliases: ['bhujia', 'mixture'], per100: 540, m: [15, 40, 36], serving: ['serving', 30] },

  // Drinks
  { name: 'chai', aliases: ['tea', 'milk tea', 'masala chai'], per100: 47, m: [1.6, 7, 1.5], t: ['dairy', 'lactose'], serving: ['cup', 150], cup: 150 },
  { name: 'black coffee', aliases: ['americano', 'espresso', 'black tea', 'green tea'], per100: 2, m: [0.1, 0, 0], serving: ['cup', 240] },
  { name: 'latte', aliases: ['cafe latte', 'coffee', 'milk coffee', 'filter coffee'], per100: 54, m: [3, 4.5, 2.5], t: ['dairy', 'lactose'], serving: ['cup', 350], cup: 350 },
  { name: 'cappuccino', per100: 40, m: [2.2, 3.3, 2], t: ['dairy', 'lactose'], serving: ['cup', 240], cup: 240 },
  { name: 'cold coffee', aliases: ['frappe', 'iced latte'], per100: 80, m: [2.5, 12, 2.5], t: ['dairy', 'lactose'], serving: ['glass', 300] },
  { name: 'cola', aliases: ['coke', 'pepsi', 'soda', 'soft drink'], per100: 42, m: [0, 10.6, 0], serving: ['can', 330] },
  { name: 'orange juice', aliases: ['juice', 'fruit juice', 'apple juice'], per100: 45, m: [0.7, 10.4, 0.2], serving: ['glass', 250] },
  { name: 'smoothie', aliases: ['banana shake', 'milkshake', 'shake'], per100: 90, m: [2.5, 15, 2.3], t: ['dairy', 'lactose'], serving: ['glass', 300] },
  { name: 'coconut water', aliases: ['nariyal pani'], per100: 19, m: [0.7, 3.7, 0.2], serving: ['glass', 250] },
  { name: 'beer', aliases: ['lager', 'pint'], per100: 43, m: [0.5, 3.6, 0], t: ['alcohol', 'gluten'], serving: ['pint', 473] },
  { name: 'light beer', aliases: ['lite beer'], per100: 29, m: [0.2, 1.6, 0], t: ['alcohol', 'gluten'], serving: ['pint', 473] },
  { name: 'wine', aliases: ['red wine', 'white wine'], per100: 83, m: [0.1, 2.6, 0], t: ['alcohol'], serving: ['glass', 150] },
  { name: 'whiskey', aliases: ['whisky', 'vodka', 'rum', 'gin', 'spirits'], per100: 250, m: [0, 0, 0], t: ['alcohol'], serving: ['peg (30 ml)', 30] },
  { name: 'cocktail', aliases: ['margarita', 'mojito', 'rum and coke', 'gin and tonic'], per100: 110, m: [0, 12, 0], t: ['alcohol'], serving: ['glass', 200] },
];

const BY_KEY = new Map(FOODS.map((f) => [f.name, f]));

export function getFood(key: string): Food | undefined {
  return BY_KEY.get(key);
}

/** Macros for `servings` of a food's default serving. */
export function servingMacros(key: string, servings = 1) {
  const food = BY_KEY.get(key);
  if (!food) return null;
  return macrosFor(food, servings * food.serving[1]);
}

function macrosFor(food: Food, grams: number) {
  const k = grams / 100;
  return {
    kcal: Math.round(food.per100 * k),
    protein: round1(food.m[0] * k),
    carbs: round1(food.m[1] * k),
    fat: round1(food.m[2] * k),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Explicit units and their gram weight; functions use the food's own cup/bowl/serving size.
const UNITS: Record<string, { label: string; grams: number | ((f: Food) => number) }> = {
  g: { label: 'g', grams: 1 },
  kg: { label: 'kg', grams: 1000 },
  ml: { label: 'ml', grams: 1 },
  l: { label: 'L', grams: 1000 },
  cup: { label: 'cup', grams: (f) => f.cup ?? 200 },
  bowl: { label: 'bowl', grams: (f) => f.bowl ?? 250 },
  plate: { label: 'plate', grams: 350 },
  glass: { label: 'glass', grams: 250 },
  tbsp: { label: 'tbsp', grams: 15 },
  tsp: { label: 'tsp', grams: 5 },
  scoop: { label: 'scoop', grams: (f) => (f.serving[0] === 'scoop' ? f.serving[1] : 66) },
  serving: { label: 'serving', grams: (f) => f.serving[1] },
};

const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', gr: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
  ml: 'ml', l: 'l', litre: 'l', liter: 'l', litres: 'l', liters: 'l',
  cup: 'cup', cups: 'cup', katori: 'bowl',
  bowl: 'bowl', bowls: 'bowl',
  plate: 'plate', plates: 'plate',
  glass: 'glass', glasses: 'glass',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  scoop: 'scoop', scoops: 'scoop',
  serving: 'serving', servings: 'serving', portion: 'serving', portions: 'serving',
  piece: 'serving', pieces: 'serving', pc: 'serving', pcs: 'serving',
  slice: 'serving', slices: 'serving',
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, half: 0.5, quarter: 0.25, couple: 2, few: 3, dozen: 12,
};

export type Estimate = {
  key: string;
  name: string;
  detail: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: Tag[];
  score: number;
};

type Parsed = { qty: number | null; unit: string | null; text: string };

function parseQuantity(input: string): Parsed {
  let text = ` ${input.toLowerCase().replace(/[^a-z0-9./ ]+/g, ' ')} `;
  let qty: number | null = null;
  let unit: string | null = null;

  const unitPattern = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length).join('|');
  // "200g", "1.5 cups", "1/2 cup" anywhere in the text.
  const withUnit = new RegExp(`\\s(\\d+(?:\\.\\d+)?|\\d+/\\d+)\\s*(${unitPattern})\\s`);
  const m = text.match(withUnit);
  if (m) {
    qty = parseNumber(m[1]);
    unit = UNIT_ALIASES[m[2]];
    text = text.replace(m[0], ' ');
  } else {
    const lead = text.match(/^\s*(\d+(?:\.\d+)?|\d+\/\d+|[a-z]+)\s+/);
    if (lead) {
      const n = parseNumber(lead[1]);
      if (n !== null) {
        qty = n;
        text = text.slice(lead[0].length);
        // "2 cups rice" / "a bowl of dal"
        const u = text.match(new RegExp(`^\\s*(${unitPattern})\\s`));
        if (u) {
          unit = UNIT_ALIASES[u[1]];
          text = text.slice(u[0].length);
        }
      }
    }
  }
  text = text.replace(/\b(of|x)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return { qty, unit, text };
}

function parseNumber(token: string): number | null {
  if (token in NUMBER_WORDS) return NUMBER_WORDS[token];
  if (token.includes('/')) {
    const [a, b] = token.split('/').map(Number);
    return b ? a / b : null;
  }
  const n = Number(token);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const stem = (w: string) => (w.length > 3 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const tokens = (s: string) => s.split(/[\s-]+/).filter(Boolean).map(stem);

function matchScore(query: string, candidate: string): number {
  if (query === candidate) return 100;
  const q = tokens(query);
  const c = tokens(candidate);
  if (q.join(' ') === c.join(' ')) return 98;
  if (candidate.startsWith(query)) return 85 - Math.min(15, candidate.length - query.length);

  let hits = 0;
  for (const t of q) {
    if (c.includes(t)) hits += 1;
    else if (t.length >= 3 && c.some((ct) => ct.startsWith(t))) hits += 0.7;
  }
  if (hits === 0) return 0;
  return (hits / Math.max(q.length, c.length)) * 70 + (hits / q.length) * 10;
}

function gramsFor(food: Food, qty: number | null, unit: string | null) {
  const n = qty ?? 1;
  if (!unit) {
    return { grams: n * food.serving[1], detail: `${fmtQty(n)} × ${food.serving[0]}` };
  }
  const def = UNITS[unit];
  const per = typeof def.grams === 'function' ? def.grams(food) : def.grams;
  if (unit === 'serving') return { grams: n * per, detail: `${fmtQty(n)} × ${food.serving[0]}` };
  if (unit === 'g' || unit === 'ml') return { grams: n, detail: `${fmtQty(n)} ${def.label}` };
  return { grams: n * per, detail: `${fmtQty(n)} ${def.label}` };
}

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

/** Best guesses for a free-text food description, most likely first. */
export function estimateFood(input: string, limit = 5): Estimate[] {
  const { qty, unit, text } = parseQuantity(input);
  if (text.length < 2) return [];

  const scored = FOODS.map((food) => {
    const names = [food.name, ...(food.aliases ?? [])];
    let best = 0;
    for (const n of names) best = Math.max(best, matchScore(text, n));
    return { food, score: best };
  })
    .filter((r) => r.score >= 30)
    .sort((a, b) => b.score - a.score);
  const cutoff = (scored[0]?.score ?? 0) * 0.55;

  return scored
    .filter((r) => r.score >= cutoff)
    .slice(0, limit)
    .map(({ food, score }) => {
      const { grams, detail } = gramsFor(food, qty, unit);
      const weighed = unit === 'g' || unit === 'ml';
      return {
        key: food.name,
        name: capitalize(food.name),
        detail: weighed ? detail : `${detail} · ${Math.round(grams)} g`,
        ...macrosFor(food, grams),
        tags: food.t ?? [],
        score,
      };
    });
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
