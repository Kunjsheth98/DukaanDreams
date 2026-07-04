/* ============================================================
   Dukaan Dreams — data.js
   Static game data: shop types, furniture, cities, festivals,
   achievements, customer archetypes. No logic/state lives here.
   ============================================================ */
window.DD = window.DD || {};

DD.SHOP_TYPES = [
  { id: 'chai', name: 'Chai Tapri', icon: 'assets/shops/chai.png', baseCost: 40,
    tiers: [
      { img: 'assets/shops/chai.png',    cap: 2, dwell: 2.0, price: 8,  upgradeCost: 0 },
      { img: 'assets/shops/chai-t2.png', cap: 3, dwell: 1.6, price: 14, upgradeCost: 80 },
      { img: 'assets/shops/chai-t3.png', cap: 4, dwell: 1.3, price: 22, upgradeCost: 200 }
    ] },
  { id: 'vadapav', name: 'Vada Pav Cart', icon: 'assets/shops/vadapav.png', baseCost: 70,
    tiers: [
      { img: 'assets/shops/vadapav.png',    cap: 2, dwell: 2.5, price: 14, upgradeCost: 0 },
      { img: 'assets/shops/vadapav-t2.png', cap: 3, dwell: 2.0, price: 24, upgradeCost: 140 },
      { img: 'assets/shops/vadapav-t3.png', cap: 4, dwell: 1.6, price: 38, upgradeCost: 320 }
    ] },
  { id: 'chaat', name: 'Chaat Corner', icon: 'assets/shops/chaat.png', baseCost: 100, holding: true,
    tiers: [
      { img: 'assets/shops/chaat.png',    cap: 4, dwell: 3.2, price: 16, upgradeCost: 0 },
      { img: 'assets/shops/chaat-t2.png', cap: 6, dwell: 2.8, price: 26, upgradeCost: 180 },
      { img: 'assets/shops/chaat-t3.png', cap: 8, dwell: 2.4, price: 40, upgradeCost: 380 }
    ] },
  { id: 'kulfi', name: 'Kulfi Cart', icon: 'assets/shops/kulfi.png', baseCost: 90,
    tiers: [
      { img: 'assets/shops/kulfi.png',    cap: 2, dwell: 2.2, price: 12, upgradeCost: 0 },
      { img: 'assets/shops/kulfi-t2.png', cap: 3, dwell: 1.8, price: 20, upgradeCost: 160 },
      { img: 'assets/shops/kulfi-t3.png', cap: 4, dwell: 1.5, price: 32, upgradeCost: 340 }
    ] },
  { id: 'mithai', name: 'Mithai Shop', icon: 'assets/shops/mithai.png', baseCost: 220,
    tiers: [
      { img: 'assets/shops/mithai.png',    cap: 3, dwell: 3.5, price: 35, upgradeCost: 0 },
      { img: 'assets/shops/mithai-t2.png', cap: 4, dwell: 3.0, price: 60, upgradeCost: 400 },
      { img: 'assets/shops/mithai-t3.png', cap: 5, dwell: 2.5, price: 95, upgradeCost: 800 }
    ] },
  { id: 'saree', name: 'Saree Boutique', icon: 'assets/shops/saree.png', baseCost: 350,
    tiers: [
      { img: 'assets/shops/saree.png',    cap: 2, dwell: 5.0, price: 70,  upgradeCost: 0 },
      { img: 'assets/shops/saree-t2.png', cap: 3, dwell: 4.2, price: 120, upgradeCost: 650 },
      { img: 'assets/shops/saree-t3.png', cap: 4, dwell: 3.5, price: 190, upgradeCost: 1300 }
    ] },
  { id: 'jewel', name: 'Johari Jewellery', icon: 'assets/shops/jewel.png', baseCost: 600,
    tiers: [
      { img: 'assets/shops/jewel.png',    cap: 2, dwell: 6.0, price: 130, upgradeCost: 0 },
      { img: 'assets/shops/jewel-t2.png', cap: 3, dwell: 5.0, price: 220, upgradeCost: 1100 },
      { img: 'assets/shops/jewel-t3.png', cap: 3, dwell: 4.0, price: 340, upgradeCost: 2200 }
    ] },
  { id: 'spice', name: 'Spice Stall', icon: 'assets/shops/spice.png', baseCost: 160,
    tiers: [
      { img: 'assets/shops/spice.png',    cap: 2, dwell: 2.8, price: 22, upgradeCost: 0 },
      { img: 'assets/shops/spice-t2.png', cap: 3, dwell: 2.3, price: 36, upgradeCost: 300 },
      { img: 'assets/shops/spice-t3.png', cap: 4, dwell: 1.9, price: 56, upgradeCost: 600 }
    ] },
  { id: 'handicraft', name: 'Handicraft Shop', icon: 'assets/shops/handicraft.png', baseCost: 300,
    tiers: [
      { img: 'assets/shops/handicraft.png',    cap: 2, dwell: 4.0, price: 45,  upgradeCost: 0 },
      { img: 'assets/shops/handicraft-t2.png', cap: 3, dwell: 3.3, price: 75,  upgradeCost: 550 },
      { img: 'assets/shops/handicraft-t3.png', cap: 4, dwell: 2.8, price: 115, upgradeCost: 1100 }
    ] },
  { id: 'book', name: 'Bookstall', icon: 'assets/shops/book.png', baseCost: 150,
    tiers: [
      { img: 'assets/shops/book.png',    cap: 2, dwell: 3.2, price: 20, upgradeCost: 0 },
      { img: 'assets/shops/book-t2.png', cap: 3, dwell: 2.6, price: 34, upgradeCost: 280 },
      { img: 'assets/shops/book-t3.png', cap: 4, dwell: 2.2, price: 54, upgradeCost: 560 }
    ] }
];

DD.shopById = id => DD.SHOP_TYPES.find(s => s.id === id);

DD.FURNITURE_TYPES = [
  { id: 'bench',     name: 'Street Bench', icon: 'assets/decorations/bench.png',     cost: 70,  kind: 'seat', cap: 2, dwell: 3.0, charge: 0,
    blurb: 'Free rest stop. Pure happiness, no income.' },
  { id: 'newsstand', name: 'Newsstand',    icon: 'assets/decorations/newsstand.png', cost: 90,  kind: 'seat', cap: 1, dwell: 2.5, charge: 5,
    blurb: 'Charges ₹5 for a quick read. Small steady income.' },
  { id: 'music',     name: 'Music Ads',    icon: 'assets/decorations/music.png',     cost: 150, kind: 'pass', cap: 99, dwell: 0, charge: 0,
    blurb: 'Customers dance past without stopping. Happiness only.' },
  { id: 'rangoli',   name: 'Rangoli Mat',  icon: 'assets/decorations/rangoli.png',   cost: 80,  kind: 'pass', cap: 99, dwell: 0, charge: 0,
    blurb: 'A colourful mat that lifts spirits as people pass.' },
  { id: 'diya',      name: 'Diya Lights',  icon: 'assets/decorations/diya.png',      cost: 120, kind: 'pass', cap: 99, dwell: 0, charge: 0,
    blurb: 'Warm festive glow. Happiness only.' },
  { id: 'busstop',   name: 'Bus Stop',     icon: 'assets/decorations/busstop.png',   cost: 300, kind: 'bus',  cap: 99, dwell: 0, charge: 0,
    blurb: 'A bus drops off 3 new customers here every 13 seconds.' }
];

DD.furnitureById = id => DD.FURNITURE_TYPES.find(f => f.id === id);

DD.CITIES = [
  { id: 'mumbai',  name: 'Mumbai — Chowpatty Lane',   unlockRep: 0,    plots: 7,  days: 10, target: 500,
    shops: ['chai', 'vadapav', 'chaat', 'kulfi'], moneyMin: 40, moneyMax: 90,
    skyline: 'assets/skylines/mumbai.jpg' },
  { id: 'delhi',   name: 'Delhi — Chandni Chowk',     unlockRep: 600,  plots: 8,  days: 13, target: 1400,
    shops: ['saree', 'jewel', 'mithai', 'spice', 'chai'], moneyMin: 56, moneyMax: 124,
    skyline: 'assets/skylines/delhi.jpg' },
  { id: 'jaipur',  name: 'Jaipur — Johari Bazaar',    unlockRep: 1500, plots: 8,  days: 16, target: 2300,
    shops: ['jewel', 'handicraft', 'saree', 'chai'], moneyMin: 72, moneyMax: 158,
    skyline: 'assets/skylines/jaipur.jpg' },
  { id: 'kolkata', name: 'Kolkata — College Street',  unlockRep: 2800, plots: 8,  days: 19, target: 3200,
    shops: ['book', 'mithai', 'chai', 'chaat'], moneyMin: 88, moneyMax: 192,
    skyline: 'assets/skylines/kolkata.jpg' },
  { id: 'kochi',   name: 'Kochi — Spice Market',      unlockRep: 4500, plots: 9,  days: 23, target: 4100,
    shops: ['spice', 'handicraft', 'kulfi', 'vadapav'], moneyMin: 104, moneyMax: 226,
    skyline: 'assets/skylines/kochi.jpg' },
  { id: 'goa',     name: 'Goa — Night Market',        unlockRep: 7000, plots: 10, days: 28, target: 5000,
    shops: ['chai', 'vadapav', 'chaat', 'kulfi', 'mithai', 'saree', 'jewel', 'spice', 'handicraft', 'book'],
    moneyMin: 120, moneyMax: 260, skyline: 'assets/skylines/goa.jpg' }
];

DD.BASE_SPAWN_MS = 5000;
DD.DAY_SECONDS = 45;
DD.BUS_INTERVAL_S = 13;
DD.PLOT_WIDTH = 172;

DD.spawnIntervalFor = cityIndex => DD.BASE_SPAWN_MS / (1 + cityIndex * 0.15);

DD.FESTIVALS = [
  { id: 'diwali', name: 'Diwali Dhamaka', unlockDay: 5, duration: 3, cooldown: 10,
    affects: ['mithai', 'jewel'], priceMult: 2.0,
    blurb: 'Doubles prices on Mithai Shops and Jewellery for 3 days.' },
  { id: 'holi', name: 'Holi Rang Utsav', unlockDay: 8, duration: 3, cooldown: 10,
    spawnMult: 0.7, priceMultAll: 1.2,
    blurb: 'A colourful crowd surge — more customers and +20% prices, all shops, for 3 days.' },
  { id: 'wedding', name: 'Wedding Season', unlockDay: 12, duration: 4, cooldown: 14,
    affects: ['saree', 'jewel', 'mithai'], priceMult: 2.0,
    blurb: 'Doubles prices on Saree, Jewellery and Mithai for 4 days.' }
];

DD.ACHIEVEMENTS = [
  { id: 'first_shop',      name: 'First Stall',      desc: 'Build your very first shop.' },
  { id: 'first_100_happy', name: 'Everyone Smiled',  desc: 'End a day with 100% customer happiness.' },
  { id: 'earn_1000',       name: 'Small Change',     desc: 'Earn ₹1,000 lifetime.' },
  { id: 'earn_10000',      name: 'Steady Hands',     desc: 'Earn ₹10,000 lifetime.' },
  { id: 'earn_50000',      name: 'Bazaar Baron',     desc: 'Earn ₹50,000 lifetime.' },
  { id: 'rep_1000',        name: 'Known on the Street', desc: 'Reach 1,000 reputation.' },
  { id: 'rep_5000',        name: 'Bazaar Legend',    desc: 'Reach 5,000 reputation.' },
  { id: 'first_festival',  name: 'Festive Spirit',   desc: 'Host your first festival.' },
  { id: 'all_cities',      name: 'Across India',     desc: 'Unlock all six cities.' },
  { id: 'perfect_streak_3',name: 'Unstoppable',      desc: 'Three perfect-happiness days in a row.' },
  { id: 'shop_maxed',      name: 'Top of the Trade', desc: 'Upgrade a shop to Tier 3.' },
  { id: 'bus_master',      name: 'Full Busload',     desc: 'Serve 100 customers dropped off by buses.' },
  { id: 'vip_served',      name: 'VIP Treatment',    desc: 'Serve your first VIP customer.' }
];

DD.CUSTOMER_SPRITE_COUNT = 7;

DD.DAY_MODIFIERS = [
  { id: 'clear',   label: 'Clear Day',        weight: 55, spawnMult: 1,    patienceMult: 1,    desc: 'A calm, ordinary day on the street.' },
  { id: 'rainy',   label: 'Rainy Day',        weight: 15, spawnMult: 1.4,  patienceMult: 1.25, desc: 'Fewer customers venture out, but those who do linger longer.' },
  { id: 'cricket', label: 'Cricket Match Buzz', weight: 15, spawnMult: 0.7, patienceMult: 0.85, desc: 'A big match has the street buzzing — more footfall, less patience.' },
  { id: 'heat',    label: 'Heatwave',         weight: 15, spawnMult: 1.1,  patienceMult: 0.8,  desc: 'The heat is making everyone a little short-tempered.' }
];

DD.pickDayModifier = function () {
  const total = DD.DAY_MODIFIERS.reduce((a, m) => a + m.weight, 0);
  let r = Math.random() * total;
  for (const m of DD.DAY_MODIFIERS) {
    if (r < m.weight) return m;
    r -= m.weight;
  }
  return DD.DAY_MODIFIERS[0];
};
