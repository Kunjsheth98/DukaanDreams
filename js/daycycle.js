/* ============================================================
   Dukaan Dreams — daycycle.js
   Day start-gate, simulation tick, day-end resolution, bus &
   spawn timers, festival scheduling, city travel.
   ============================================================ */
window.DD = window.DD || {};

DD.initRuntime = function () {
  DD.runtime = {
    shopInstances: [],
    decoInstances: [],
    customers: [],
    plotX: [],
    streetWidth: 0,
    dayActive: false,
    paused: false,
    dayTimeRemaining: 0,
    spawnTimer: 0,
    busTimer: 0,
    spawnIntervalMs: DD.BASE_SPAWN_MS,
    patienceMult: 1,
    dayCustomersSpawned: 0,
    dayCustomersResolved: 0,
    dayCustomersHappy: 0,
    dayCustomersTotal: 0, // mirrors spawned, used by HUD live pct against resolved
    earningsToday: 0,
    activeFestivalEffects: [],
    currentModifier: DD.DAY_MODIFIERS[0]
  };
};

// ---------------------------------------------------------------
// City travel
// ---------------------------------------------------------------
DD.travelToCity = function (index) {
  if (!DD.isCityUnlocked(index)) return;
  DD.state.cityIndex = index;
  DD.saveState();
  DD.enterCityScreen();
  DD.showScreen('city');
};

DD.preloadCityAssets = function () {
  const cityDef = DD.currentCityDef();
  cityDef.shops.forEach(shopId => {
    const def = DD.shopById(shopId);
    def.tiers.forEach(tier => { const img = new Image(); img.src = tier.img; });
  });
  DD.FURNITURE_TYPES.forEach(def => { const img = new Image(); img.src = def.icon; });
  for (let i = 1; i <= DD.CUSTOMER_SPRITE_COUNT; i++) { const img = new Image(); img.src = 'assets/customers/customer-' + i + '.png'; }
};

DD.enterCityScreen = function () {
  const cityDef = DD.currentCityDef();
  const citySave = DD.currentCitySave();
  DD.runtime.dayActive = false;
  DD.runtime.paused = false;
  DD.runtime.customers = [];
  DD.clearAllCustomerEls();

  DD.runtime.shopInstances = citySave.shopSlots.map(slot => slot ? { typeId: slot.typeId, tier: slot.tier, occupants: [], queue: [], streak: 0 } : null);
  DD.runtime.decoInstances = citySave.decoSlots.map(slot => slot ? { typeId: slot.typeId, occupants: [], queue: [] } : null);

  DD.buildStreetScene();
  DD.renderBuildPanel();
  DD.renderHUD();
  DD.preloadCityAssets();
  DD.maybeShowTutorialThenGate();
};

// ---------------------------------------------------------------
// Day start gate
// ---------------------------------------------------------------
DD.openDayStartGate = function () {
  const cityDef = DD.currentCityDef();
  const citySave = DD.currentCitySave();
  const modifier = DD.runtime.pendingModifier || DD.pickDayModifier();
  DD.runtime.pendingModifier = modifier;

  const anyActive = DD.state.festivals.some(f => f.active);
  let festivalHtml = '';
  if (!anyActive) {
    const eligible = DD.FESTIVALS.filter(fdef => {
      const save = DD.state.festivals.find(f => f.id === fdef.id);
      return DD.state.globalDayCount >= fdef.unlockDay && DD.state.globalDayCount >= save.cooldownUntilDay;
    });
    if (eligible.length) {
      festivalHtml = '<div class="festival-offer"><h3>🎉 Festival Available</h3>' +
        eligible.map(f => '<div class="festival-card" data-fest="' + f.id + '"><strong>' + f.name + '</strong><p>' + f.blurb + '</p><button class="btn btn-accent" data-fest-start="' + f.id + '">Host ' + f.name + '</button></div>').join('') +
        '</div>';
    }
  } else {
    const active = DD.state.festivals.find(f => f.active);
    const fdef = DD.FESTIVALS.find(f => f.id === active.id);
    festivalHtml = '<div class="festival-active-banner">🎉 <strong>' + fdef.name + '</strong> is active — ' + active.daysLeft + ' day(s) left</div>';
  }

  const pct = Math.min(100, Math.round((citySave.cumulative / cityDef.target) * 100));
  const body =
    '<h2>' + cityDef.name + '</h2>' +
    '<p class="gate-day">Day ' + citySave.day + ' of ' + cityDef.days + '</p>' +
    '<div class="city-mini-progress"><div class="city-mini-fill" style="width:' + pct + '%"></div></div>' +
    '<p class="muted">City Target: ' + DD.fmtMoney(citySave.cumulative) + ' / ' + DD.fmtMoney(cityDef.target) + '</p>' +
    '<div class="modifier-card"><strong>' + modifier.label + '</strong><p>' + modifier.desc + '</p></div>' +
    festivalHtml +
    '<div class="modal-actions"><button class="btn btn-primary btn-large" id="start-day-btn">▶ Start Day ' + citySave.day + '</button></div>';

  DD.showModal(body, {
    dismissible: false,
    extraClass: 'wide',
    onRender: root => {
      root.querySelectorAll('[data-fest-start]').forEach(btn => {
        btn.addEventListener('click', () => {
          DD.activateFestival(btn.dataset.festStart);
          DD.closeModal();
          DD.openDayStartGate();
        });
      });
      root.querySelector('#start-day-btn').addEventListener('click', () => {
        DD.closeModal();
        DD.actuallyStartDay(modifier);
      });
    }
  });
};

DD.activateFestival = function (festId) {
  const save = DD.state.festivals.find(f => f.id === festId);
  const def = DD.FESTIVALS.find(f => f.id === festId);
  save.active = true;
  save.daysLeft = def.duration;
  save.timesHosted += 1;
  DD.state.stats.festivalsHosted++;
  DD.unlockAchievement('first_festival');
  DD.toast('🎉 ' + def.name + ' has begun!', 'success');
  DD.saveState();
};

// ---------------------------------------------------------------
// Start / run / end day
// ---------------------------------------------------------------
DD.actuallyStartDay = function (modifier) {
  const cityDef = DD.currentCityDef();
  const rt = DD.runtime;

  rt.activeFestivalEffects = DD.state.festivals.filter(f => f.active).map(save => {
    const def = DD.FESTIVALS.find(f => f.id === save.id);
    return def;
  });

  let spawnMult = modifier.spawnMult;
  rt.activeFestivalEffects.forEach(fx => { if (fx.spawnMult) spawnMult *= fx.spawnMult; });

  rt.dayActive = true;
  rt.paused = false;
  rt.customers = [];
  DD.clearAllCustomerEls();
  rt.dayTimeRemaining = DD.DAY_SECONDS;
  rt.spawnTimer = 0;
  rt.busTimer = 0;
  rt.spawnIntervalMs = DD.spawnIntervalFor(DD.state.cityIndex) * spawnMult;
  rt.patienceMult = modifier.patienceMult;
  rt.currentModifier = modifier;
  rt.dayCustomersSpawned = 0;
  rt.dayCustomersResolved = 0;
  rt.dayCustomersHappy = 0;
  rt.dayCustomersTotal = 0;
  rt.earningsToday = 0;
  rt.pendingModifier = null;

  DD.el.streetScene.classList.remove('paused');
  DD.renderHUD();
};

DD.spawnCustomer = function (opts) {
  const cityDef = DD.currentCityDef();
  const cust = DD.createCustomer(cityDef, opts);
  DD.runtime.customers.push(cust);
  DD.runtime.dayCustomersSpawned++;
  DD.runtime.dayCustomersTotal++;
  DD.state.stats.customersTotal++;
  DD.createCustomerEl(cust);
  return cust;
};

DD.customerCallbacks = {
  onSale: function (cust, shopDef, si, price) {
    DD.state.money += price;
    DD.state.stats.lifetimeEarnings += price;
    DD.state.stats.customersServed += 1;
    DD.runtime.earningsToday += price;
    si.streak = (si.streak || 0) + 1;
    if (cust.isVIP) { DD.state.stats.vipServed++; DD.unlockAchievement('vip_served'); DD.Sound.play('vip'); }
    else DD.Sound.play('coin');
    if (cust.fromBus) DD.state.stats.busCustomersServed++;
    DD.checkMoneyAchievements();
    DD.updateShopOccupancyVisual(cust.targetPlotIndex);
    DD.renderHUD();
  },
  onFurnitureCharge: function (cust, def, di, amount) {
    DD.state.money += amount;
    DD.state.stats.lifetimeEarnings += amount;
    DD.runtime.earningsToday += amount;
    DD.Sound.play('coin');
    DD.checkMoneyAchievements();
    DD.updateDecoOccupancyVisual(cust.targetPlotIndex);
    DD.renderHUD();
  },
  onPassInteraction: function (cust, def, di) {
    // purely cosmetic happiness tick, resolved at customer completion
  },
  onCustomerLeftEarly: function (cust) {
    resolveCustomer(cust);
  },
  onCustomerFinished: function (cust) {
    resolveCustomer(cust);
  }
};

function resolveCustomer(cust) {
  const rt = DD.runtime;
  rt.dayCustomersResolved++;
  if (cust.servedAnything) {
    rt.dayCustomersHappy++;
    DD.state.stats.customersHappy++;
  }
  // reset streak on shops where this customer gave up in queue without buying
  DD.removeCustomerEl(cust.id);
  DD.renderHUD();
}

DD.resetStreakIfAbandoned = function (plotIndex) {
  const si = DD.runtime.shopInstances[plotIndex];
  if (si) { si.streak = 0; DD.updateShopOccupancyVisual(plotIndex); }
};

// ---------------------------------------------------------------
// Main tick — called every animation frame from main.js
// ---------------------------------------------------------------
DD.tick = function (dt) {
  const rt = DD.runtime;
  if (!rt.dayActive || rt.paused) return;

  rt.dayTimeRemaining -= dt;

  // spawn timer
  rt.spawnTimer += dt * 1000;
  if (rt.spawnTimer >= rt.spawnIntervalMs) {
    rt.spawnTimer -= rt.spawnIntervalMs;
    DD.spawnCustomer({});
  }

  // bus timer (only if a bus stop exists on the street)
  const busPlotIndex = rt.decoInstances.findIndex(d => d && d.typeId === 'busstop');
  if (busPlotIndex !== -1) {
    rt.busTimer += dt;
    if (rt.busTimer >= DD.BUS_INTERVAL_S) {
      rt.busTimer -= DD.BUS_INTERVAL_S;
      DD.Sound.play('bus');
      DD.spawnBusEl();
      for (let i = 0; i < 3; i++) DD.spawnCustomer({ fromBus: true, startPlotIndex: busPlotIndex });
    }
  }

  // update customers
  const plots = rt.plotX;
  for (let i = rt.customers.length - 1; i >= 0; i--) {
    const cust = rt.customers[i];
    DD.updateCustomer(cust, dt, plots, DD.customerCallbacks);
    if (cust.removed) {
      rt.customers.splice(i, 1);
    } else {
      DD.updateCustomerEl(cust);
    }
  }

  DD.renderHUD();

  if (rt.dayTimeRemaining <= 0) {
    DD.endDay();
  }
};

// ---------------------------------------------------------------
// End of day
// ---------------------------------------------------------------
DD.endDay = function () {
  const rt = DD.runtime;
  rt.dayActive = false;

  // force-finalize any customers still on the street
  rt.customers.forEach(cust => {
    rt.dayCustomersResolved++;
    if (cust.servedAnything) { rt.dayCustomersHappy++; DD.state.stats.customersHappy++; }
    DD.removeCustomerEl(cust.id);
  });
  rt.customers = [];

  const cityDef = DD.currentCityDef();
  const citySave = DD.currentCitySave();

  const totalSpawned = rt.dayCustomersSpawned;
  const happyPct = totalSpawned ? Math.round((rt.dayCustomersHappy / totalSpawned) * 100) : 100;
  const isPerfect = totalSpawned > 0 && happyPct === 100;

  let repGain = Math.round(rt.earningsToday * 0.25);
  let bonus = 0;
  if (isPerfect) {
    bonus = Math.round(50 + citySave.day * 15);
    repGain += 100;
    DD.state.money += bonus;
    DD.unlockAchievement('first_100_happy');
    citySave.perfectStreak = (citySave.perfectStreak || 0) + 1;
  } else {
    citySave.perfectStreak = 0;
  }
  DD.state.stats.bestStreak = Math.max(DD.state.stats.bestStreak, citySave.perfectStreak);
  if (citySave.perfectStreak >= 3) DD.unlockAchievement('perfect_streak_3');

  DD.state.reputation += repGain;
  citySave.cumulative += rt.earningsToday;

  const justCompleted = !citySave.completed && citySave.cumulative >= cityDef.target;
  if (justCompleted) citySave.completed = true;

  const wasFinalScheduledDay = citySave.day === cityDef.days;
  const showDayLimitNotice = wasFinalScheduledDay && !citySave.dayLimitNotified;
  if (showDayLimitNotice) citySave.dayLimitNotified = true;

  // festival day countdown
  DD.state.festivals.forEach(f => {
    if (f.active) {
      f.daysLeft -= 1;
      if (f.daysLeft <= 0) {
        f.active = false;
        const def = DD.FESTIVALS.find(fd => fd.id === f.id);
        f.cooldownUntilDay = DD.state.globalDayCount + 1 + def.cooldown;
      }
    }
  });

  citySave.day += 1;
  DD.state.globalDayCount += 1;

  DD.refreshCityUnlocks();
  DD.checkRepAchievements();
  DD.checkCityAchievements();
  DD.saveState();

  DD.Sound.play('dayend');
  DD.showDayEndModal({ totalSpawned, happyPct, isPerfect, bonus, repGain, earningsToday: rt.earningsToday, justCompleted, showDayLimitNotice, cityDef, citySave });
  DD.renderHUD();
};

DD.showDayEndModal = function (r) {
  let body = '<h2>Day Complete!</h2>';
  body += '<div class="dayend-grid">';
  body += '<div class="stat-card"><span class="stat-val">' + DD.fmtMoney(r.earningsToday) + '</span><span class="stat-label">Earned Today</span></div>';
  body += '<div class="stat-card"><span class="stat-val">' + r.totalSpawned + '</span><span class="stat-label">Customers</span></div>';
  body += '<div class="stat-card"><span class="stat-val">' + r.happyPct + '%</span><span class="stat-label">Happiness</span></div>';
  body += '<div class="stat-card"><span class="stat-val">+' + Math.round(r.repGain) + '</span><span class="stat-label">Reputation</span></div>';
  body += '</div>';
  if (r.isPerfect) body += '<div class="perfect-banner">🌟 Perfect Day! Bonus ' + DD.fmtMoney(r.bonus) + ' awarded.</div>';
  if (r.justCompleted) body += '<div class="perfect-banner">🏁 City target reached! ' + r.cityDef.name + ' complete — keep playing or explore the World Map.</div>';
  if (r.showDayLimitNotice) {
    const hit = r.citySave.cumulative >= r.cityDef.target;
    body += '<div class="daylimit-banner ' + (hit ? 'hit' : 'miss') + '">' +
      '<strong>' + (hit ? '✅ Target achieved within ' + r.cityDef.days + ' days!' : '⏳ Day ' + r.cityDef.days + ' used up — target not reached yet.') + '</strong>' +
      '<p>' + (hit
        ? 'Great run! You can keep playing extra days here to build up more before moving on, or head to the World Map.'
        : 'No penalty — you can keep playing as many extra days as you need (Day ' + (r.cityDef.days + 1) + ', ' + (r.cityDef.days + 2) + '...) until you reach ' + DD.fmtMoney(r.cityDef.target) + '.') +
      '</p></div>';
  }
  body += '<p class="muted">City progress: ' + DD.fmtMoney(r.citySave.cumulative) + ' / ' + DD.fmtMoney(r.cityDef.target) + '</p>';
  body += '<div class="modal-actions"><button class="btn btn-primary btn-large" id="next-day-btn">Continue to Day ' + r.citySave.day + '</button></div>';

  DD.showModal(body, {
    dismissible: false,
    extraClass: 'wide',
    onRender: root => {
      root.querySelector('#next-day-btn').addEventListener('click', () => {
        DD.closeModal();
        DD.openDayStartGate();
      });
    }
  });
};
