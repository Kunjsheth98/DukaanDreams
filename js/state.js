/* ============================================================
   Dukaan Dreams — state.js
   Central game state, save/load with in-memory fallback.
   ============================================================ */
window.DD = window.DD || {};

DD.SAVE_KEY = 'dukaanDreams_save_v1';

DD._memoryFallback = null; // used if localStorage unavailable

DD.defaultState = function () {
  return {
    version: 1,
    money: 80,
    reputation: 0,
    unlockedCityIds: ['mumbai'],
    cityIndex: 0,
    // per-city persistent progress: { day, cumulative, shopSlots, decoSlots }
    cities: DD.CITIES.map(c => ({
      day: 1,
      cumulative: 0,
      shopSlots: new Array(c.plots).fill(null),
      decoSlots: new Array(c.plots).fill(null),
      perfectStreak: 0,
      completed: false,
      dayLimitNotified: false
    })),
    festivals: DD.FESTIVALS.map(f => ({ id: f.id, cooldownUntilDay: 0, active: false, daysLeft: 0, timesHosted: 0 })),
    globalDayCount: 1, // increments every day played across the whole game, used for festival unlock gating
    achievementsUnlocked: [],
    stats: {
      lifetimeEarnings: 0,
      customersServed: 0,
      customersHappy: 0,
      customersTotal: 0,
      busCustomersServed: 0,
      vipServed: 0,
      shopsBuilt: 0,
      shopsMaxed: 0,
      festivalsHosted: 0,
      bestStreak: 0
    },
    settings: {
      muted: false,
      speed: 1
    },
    seenTutorial: false
  };
};

DD.state = null;

DD.saveState = function () {
  const data = JSON.stringify(DD.state);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DD.SAVE_KEY, data);
      return;
    }
  } catch (e) { /* fall through to memory */ }
  DD._memoryFallback = data;
};

DD.loadState = function () {
  let raw = null;
  try {
    if (typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(DD.SAVE_KEY);
    }
  } catch (e) { raw = null; }
  if (!raw && DD._memoryFallback) raw = DD._memoryFallback;

  if (!raw) {
    DD.state = DD.defaultState();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    // merge with defaults to survive future additions safely
    const def = DD.defaultState();
    DD.state = Object.assign({}, def, parsed);
    DD.state.stats = Object.assign({}, def.stats, parsed.stats || {});
    DD.state.settings = Object.assign({}, def.settings, parsed.settings || {});
    if (!Array.isArray(DD.state.cities) || DD.state.cities.length !== DD.CITIES.length) {
      DD.state.cities = def.cities;
    } else {
      DD.state.cities = DD.state.cities.map((c, i) => {
        const base = def.cities[i];
        const merged = Object.assign({}, base, c);
        if (!Array.isArray(merged.shopSlots) || merged.shopSlots.length !== DD.CITIES[i].plots) merged.shopSlots = base.shopSlots.slice();
        if (!Array.isArray(merged.decoSlots) || merged.decoSlots.length !== DD.CITIES[i].plots) merged.decoSlots = base.decoSlots.slice();
        return merged;
      });
    }
    if (!Array.isArray(DD.state.festivals) || DD.state.festivals.length !== DD.FESTIVALS.length) {
      DD.state.festivals = def.festivals;
    }
    if (!Array.isArray(DD.state.unlockedCityIds) || !DD.state.unlockedCityIds.length) {
      DD.state.unlockedCityIds = def.unlockedCityIds;
    }
  } catch (e) {
    DD.state = DD.defaultState();
  }
};

DD.resetState = function () {
  DD.state = DD.defaultState();
  DD.saveState();
};

DD.currentCityDef = () => DD.CITIES[DD.state.cityIndex];
DD.currentCitySave = () => DD.state.cities[DD.state.cityIndex];

DD.isCityUnlocked = function (idx) {
  return DD.state.unlockedCityIds.indexOf(DD.CITIES[idx].id) !== -1;
};

DD.refreshCityUnlocks = function () {
  DD.CITIES.forEach((c, i) => {
    if (i === 0) return; // Mumbai is always unlocked
    const prevCompleted = DD.state.cities[i - 1] && DD.state.cities[i - 1].completed;
    if (prevCompleted && DD.state.unlockedCityIds.indexOf(c.id) === -1) {
      DD.state.unlockedCityIds.push(c.id);
    }
  });
};
