/* ============================================================
   Dukaan Dreams — daycycle.js
   Day start-gate, simulation tick, day-end resolution, bus &
   spawn timers, festival scheduling, city travel.
   ============================================================ */
window.DD = window.DD || {};

DD.BUSY_SERVICE_STATES = ['shop_entering', 'shop_inside', 'shop_exiting', 'furn_serve', 'furn_queue', 'shop_queue'];

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
    currentModifier: DD.DAY_MODIFIERS[0],
    busUsedToday: false,
    busTriggerTime: 0,
    lastBusCountdownShown: null
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
  // Defensive reset: guarantees no shop/furniture can ever carry a stuck
  // "phantom" occupant across days (e.g. from a previous day's abrupt cutoff).
  rt.shopInstances.forEach(si => { if (si) { si.occupants = []; si.queue = []; } });
  rt.decoInstances.forEach(di => { if (di) { di.occupants = []; di.queue = []; } });
  rt.dayTimeRemaining = DD.DAY_SECONDS;
  rt.windingDown = false;
  rt.windDownGraceRemaining = 0;
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
  rt.busUsedToday = false;
  rt.busTriggerTime = DD.rand(DD.BUS_TRIGGER_MIN_S, DD.BUS_TRIGGER_MAX_S);
  rt.lastBusCountdownShown = null;

  DD.el.streetScene.classList.remove('paused');
  if (DD.el.weatherOverlay) {
    DD.el.weatherOverlay.className = 'weather-overlay' + (modifier.id === 'rainy' ? ' weather-rain' : modifier.id === 'heat' ? ' weather-heat' : '');
  }
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
    if (cust.fromBus) { DD.state.stats.busCustomersServed++; DD.checkBusAchievement(); }
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
  DD.removeCustomerEl(cust.id, cust.servedAnything);
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

  if (!rt.windingDown) {
    rt.dayTimeRemaining -= dt;

    // spawn timer
    rt.spawnTimer += dt * 1000;
    if (rt.spawnTimer >= rt.spawnIntervalMs) {
      rt.spawnTimer -= rt.spawnIntervalMs;
      DD.spawnCustomer({});
    }

    // bus timer — fires exactly ONCE per day, at the actual bus stop's position
    const busPlotIndex = rt.decoInstances.findIndex(d => d && d.typeId === 'busstop');
    if (busPlotIndex !== -1 && !rt.busUsedToday) {
      rt.busTimer += dt;
      const remaining = Math.max(0, Math.ceil(rt.busTriggerTime - rt.busTimer));
      if (remaining !== rt.lastBusCountdownShown) {
        rt.lastBusCountdownShown = remaining;
        DD.updateBusCountdown(busPlotIndex, remaining);
      }
      if (rt.busTimer >= rt.busTriggerTime) {
        rt.busUsedToday = true;
        DD.updateBusCountdown(busPlotIndex, null);
        DD.Sound.play('bus');
        DD.spawnBusEl(DD.runtime.plotX[busPlotIndex]);
        for (let i = 0; i < DD.BUS_BATCH_SIZE; i++) DD.spawnCustomer({ fromBus: true, startPlotIndex: busPlotIndex });
      }
    }

    if (rt.dayTimeRemaining <= 0) {
      // Time's up for spawning, but let customers currently on the street
      // finish naturally (walk out of shops, finish queueing, etc.) instead
      // of vanishing mid-visit. The day only actually ends once the street
      // is clear or this grace period runs out, whichever comes first.
      rt.windingDown = true;
      rt.windDownGraceRemaining = DD.DAY_WINDDOWN_GRACE_S;
    }
  } else {
    rt.windDownGraceRemaining -= dt;
  }

  // update customers (continues normally during wind-down so they can finish)
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

  if (rt.windingDown) {
    const anyBusy = rt.customers.some(c => DD.BUSY_SERVICE_STATES.indexOf(c.state) !== -1);
    if (!anyBusy || rt.windDownGraceRemaining <= 0) {
      DD.endDay();
    }
  }
};

// ---------------------------------------------------------------
// End of day
// ---------------------------------------------------------------
DD.endDay = function () {
  const rt = DD.runtime;
  rt.dayActive = false;

  // force-finalize any customers still on the street (should be rare now that
  // the day gracefully winds down instead of cutting off abruptly — this is
  // a safety net for the odd customer still stuck queueing when the grace
  // period itself runs out)
  rt.customers.forEach(cust => {
    rt.dayCustomersResolved++;
    if (cust.servedAnything) { rt.dayCustomersHappy++; DD.state.stats.customersHappy++; }
    releaseFromAllQueuesAndSlots(cust);
    DD.removeCustomerEl(cust.id, cust.servedAnything);
  });
  rt.customers = [];
  rt.windingDown = false;

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

  const alreadyCompleted = citySave.completed;
  const targetHitNow = !alreadyCompleted && citySave.cumulative >= cityDef.target;
  if (targetHitNow) {
    citySave.completed = true;
    if (citySave.bestCompletionDay == null || citySave.day < citySave.bestCompletionDay) {
      citySave.bestCompletionDay = citySave.day;
    }
    DD.refreshCityUnlocks();
  }

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

  const dayJustFinished = citySave.day;
  citySave.day += 1;
  DD.state.globalDayCount += 1;

  DD.checkRepAchievements();
  DD.checkCityAchievements();
  DD.saveState();
  DD.Sound.play('dayend');

  const summary = { totalSpawned, happyPct, isPerfect, bonus, repGain, earningsToday: rt.earningsToday, cityDef, citySave };

  if (targetHitNow) {
    const nextIndex = DD.state.cityIndex + 1;
    const hasNext = nextIndex < DD.CITIES.length;
    DD.showCityCompleteModal(Object.assign({}, summary, { dayUsed: dayJustFinished, hasNext, nextCityName: hasNext ? DD.CITIES[nextIndex].name : null }));
  } else if (!citySave.completed && dayJustFinished >= cityDef.days) {
    DD.showCityFailedModal(summary);
  } else {
    DD.showDayEndModal(summary);
  }

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
  body += '<p class="muted">City progress: ' + DD.fmtMoney(r.citySave.cumulative) + ' / ' + DD.fmtMoney(r.cityDef.target) +
    (r.citySave.completed ? ' <strong>(target already reached — bonus days)</strong>' : ' · Day ' + (r.citySave.day - 1) + ' of ' + r.cityDef.days) + '</p>';
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

DD.showCityCompleteModal = function (r) {
  let body = '<h2>🎉 Target Reached!</h2>';
  body += '<p class="gate-day">' + r.cityDef.name + ' complete — done in ' + r.dayUsed + ' of ' + r.cityDef.days + ' days.</p>';
  if (r.citySave.bestCompletionDay === r.dayUsed) body += '<p class="tag-done">🏆 New personal best for this city!</p>';
  body += '<div class="dayend-grid">';
  body += '<div class="stat-card"><span class="stat-val">' + DD.fmtMoney(r.citySave.cumulative) + '</span><span class="stat-label">Total Earned</span></div>';
  body += '<div class="stat-card"><span class="stat-val">' + DD.fmtMoney(r.cityDef.target) + '</span><span class="stat-label">Target</span></div>';
  body += '</div>';
  if (r.isPerfect) body += '<div class="perfect-banner">🌟 Perfect final day! Bonus ' + DD.fmtMoney(r.bonus) + ' awarded.</div>';
  if (r.hasNext) {
    body += '<p>🔓 <strong>' + r.nextCityName + '</strong> is now unlocked!</p>';
    body += '<div class="modal-actions">' +
      '<button class="btn btn-ghost" id="keep-playing-btn">Keep Playing ' + r.cityDef.name.split(' — ')[0] + '</button>' +
      '<button class="btn btn-primary btn-large" id="goto-map-btn">Continue to World Map →</button>' +
      '</div>';
  } else {
    body += '<div class="perfect-banner">🏆 You\'ve completed every city in Dukaan Dreams!</div>';
    body += '<div class="modal-actions"><button class="btn btn-primary btn-large" id="keep-playing-btn">Keep Playing</button></div>';
  }

  DD.showModal(body, {
    dismissible: false,
    extraClass: 'wide',
    onRender: root => {
      const keepBtn = root.querySelector('#keep-playing-btn');
      if (keepBtn) keepBtn.addEventListener('click', () => { DD.closeModal(); DD.openDayStartGate(); });
      const mapBtn = root.querySelector('#goto-map-btn');
      if (mapBtn) mapBtn.addEventListener('click', () => { DD.closeModal(); DD.showScreen('worldmap'); });
    }
  });
};

DD.showCityFailedModal = function (r) {
  let body = '<h2>⏳ Day ' + r.cityDef.days + ' Used Up</h2>';
  body += '<p class="gate-day">Target not reached in time.</p>';
  body += '<div class="dayend-grid">';
  body += '<div class="stat-card"><span class="stat-val">' + DD.fmtMoney(r.citySave.cumulative) + '</span><span class="stat-label">Reached</span></div>';
  body += '<div class="stat-card"><span class="stat-val">' + DD.fmtMoney(r.cityDef.target) + '</span><span class="stat-label">Target</span></div>';
  body += '</div>';
  body += '<p class="muted">This level didn\'t hit its target in time. Restarting refunds half the value of everything you built, then gives you a fresh empty street to try again.</p>';
  body += '<div class="modal-actions"><button class="btn btn-danger btn-large" id="restart-city-btn">🔄 Restart ' + r.cityDef.name.split(' — ')[0] + '</button></div>';

  DD.showModal(body, {
    dismissible: false,
    extraClass: 'wide',
    onRender: root => {
      root.querySelector('#restart-city-btn').addEventListener('click', () => {
        DD.closeModal();
        DD.restartCurrentCity();
      });
    }
  });
};

DD.restartCurrentCity = function () {
  const cityDef = DD.currentCityDef();
  const citySave = DD.currentCitySave();

  let refund = 0;
  citySave.shopSlots.forEach(slot => {
    if (!slot) return;
    const def = DD.shopById(slot.typeId);
    const invested = def.baseCost + (slot.tier >= 1 ? def.tiers[1].upgradeCost : 0) + (slot.tier >= 2 ? def.tiers[2].upgradeCost : 0);
    refund += Math.round(invested * 0.5);
  });
  citySave.decoSlots.forEach(slot => {
    if (!slot) return;
    const def = DD.furnitureById(slot.typeId);
    refund += Math.round(def.cost * 0.5);
  });
  DD.state.money += refund;

  citySave.day = 1;
  citySave.cumulative = 0;
  citySave.perfectStreak = 0;
  citySave.completed = false;
  citySave.shopSlots = new Array(cityDef.plots).fill(null);
  citySave.decoSlots = new Array(cityDef.plots).fill(null);
  DD.saveState();
  DD.toast('Restarted ' + cityDef.name + ' — refunded ' + DD.fmtMoney(refund), 'info');
  DD.enterCityScreen();
};
