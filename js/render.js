/* ============================================================
   Dukaan Dreams — render.js
   All DOM creation & update logic. Reads DD.state / DD.runtime
   and writes to the page; never mutates game logic itself.
   ============================================================ */
window.DD = window.DD || {};

DD.el = {}; // cached DOM references, filled by main.js on boot

DD.fmtMoney = n => '₹' + Math.round(n).toLocaleString('en-IN');

// ---------------------------------------------------------------
// HUD
// ---------------------------------------------------------------
DD.renderHUD = function () {
  const s = DD.state;
  const cityDef = DD.currentCityDef();
  const citySave = DD.currentCitySave();
  DD.el.hudMoney.textContent = DD.fmtMoney(s.money);
  DD.el.hudRep.textContent = Math.round(s.reputation).toLocaleString('en-IN');
  DD.el.hudDay.textContent = 'Day ' + citySave.day + ' / ' + cityDef.days;
  DD.el.hudCityName.textContent = cityDef.name;
  const pct = Math.min(100, (citySave.cumulative / cityDef.target) * 100);
  DD.el.hudTargetFill.style.width = pct + '%';
  DD.el.hudTargetLabel.textContent = DD.fmtMoney(citySave.cumulative) + ' / ' + DD.fmtMoney(cityDef.target);

  const rt = DD.runtime;
  const happyPct = rt.dayCustomersTotal ? Math.round((rt.dayCustomersHappy / rt.dayCustomersTotal) * 100) : 100;
  DD.el.hudHappy.textContent = happyPct + '%';
  DD.el.hudHappy.className = 'hud-happy ' + (happyPct >= 90 ? 'good' : happyPct >= 60 ? 'ok' : 'bad');

  if (rt.dayActive) {
    const remain = Math.max(0, rt.dayTimeRemaining);
    DD.el.hudTimer.textContent = Math.ceil(remain) + 's';
  } else {
    DD.el.hudTimer.textContent = '—';
  }

  DD.el.pauseBtn.textContent = rt.paused ? '▶ Resume' : '⏸ Pause';
  DD.el.pauseBtn.disabled = !rt.dayActive;
  DD.el.ffBtn.textContent = s.settings.speed + 'x';
  DD.el.soundBtn.textContent = s.settings.muted ? '🔇' : '🔊';
};

// ---------------------------------------------------------------
// Street scene
// ---------------------------------------------------------------
DD.buildStreetScene = function () {
  const cityDef = DD.currentCityDef();
  const plots = cityDef.plots;
  const width = plots * DD.PLOT_WIDTH + 60;
  DD.runtime.streetWidth = width;
  DD.runtime.plotX = [];
  for (let i = 0; i < plots; i++) {
    DD.runtime.plotX.push(30 + i * DD.PLOT_WIDTH + DD.PLOT_WIDTH / 2);
  }

  const scene = DD.el.streetScene;
  scene.innerHTML = '';
  scene.style.width = width + 'px';

  const skyline = document.createElement('div');
  skyline.className = 'skyline-layer';
  skyline.style.backgroundImage = 'url(' + cityDef.skyline + ')';
  scene.appendChild(skyline);

  const road = document.createElement('div');
  road.className = 'road-layer';
  road.id = 'road-layer';
  scene.appendChild(road);
  DD.el.roadLayer = road;

  const footpath = document.createElement('div');
  footpath.className = 'footpath-layer';
  footpath.id = 'footpath-layer';
  scene.appendChild(footpath);
  DD.el.footpathLayer = footpath;

  const walk = document.createElement('div');
  walk.className = 'walk-layer';
  walk.id = 'walk-layer';
  scene.appendChild(walk);
  DD.el.walkLayer = walk;

  const shops = document.createElement('div');
  shops.className = 'shops-layer';
  shops.id = 'shops-layer';
  scene.appendChild(shops);
  DD.el.shopsLayer = shops;

  for (let i = 0; i < plots; i++) {
    footpath.appendChild(DD.buildDecoPlotEl(i));
    shops.appendChild(DD.buildShopPlotEl(i));
  }

  DD.spawnAmbientTraffic();
  DD.refreshAllPlots();
};

DD.buildShopPlotEl = function (index) {
  const div = document.createElement('div');
  div.className = 'plot shop-plot';
  div.dataset.index = index;
  div.style.left = (30 + index * DD.PLOT_WIDTH) + 'px';
  div.style.width = DD.PLOT_WIDTH + 'px';
  div.addEventListener('click', () => DD.onShopPlotClick(index));
  return div;
};

DD.buildDecoPlotEl = function (index) {
  const div = document.createElement('div');
  div.className = 'plot deco-plot';
  div.dataset.index = index;
  div.style.left = (30 + index * DD.PLOT_WIDTH) + 'px';
  div.style.width = DD.PLOT_WIDTH + 'px';
  div.addEventListener('click', () => DD.onDecoPlotClick(index));
  return div;
};

DD.refreshAllPlots = function () {
  const cityDef = DD.currentCityDef();
  for (let i = 0; i < cityDef.plots; i++) {
    DD.refreshShopPlot(i);
    DD.refreshDecoPlot(i);
  }
};

DD.refreshShopPlot = function (index) {
  const div = DD.el.shopsLayer.querySelector('.shop-plot[data-index="' + index + '"]');
  if (!div) return;
  const si = DD.runtime.shopInstances[index];
  div.innerHTML = '';
  if (!si) {
    div.dataset.shopKey = '';
    div.classList.add('empty');
    div.classList.remove('occupied-lock');
    div.innerHTML =
      '<div class="for-sale">' +
      '<svg viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" rx="10" fill="var(--card)" stroke="var(--accent)" stroke-width="4" stroke-dasharray="8 6"/>' +
      '<text x="50" y="46" text-anchor="middle" font-size="15" fill="var(--accent-dark)" font-family="inherit" font-weight="700">FOR</text>' +
      '<text x="50" y="66" text-anchor="middle" font-size="15" fill="var(--accent-dark)" font-family="inherit" font-weight="700">SALE</text></svg>' +
      '</div>';
    return;
  }
  div.classList.remove('empty');
  const def = DD.shopById(si.typeId);
  const tier = def.tiers[si.tier];
  const occupied = si.occupants.length > 0;
  div.classList.toggle('occupied-lock', occupied);
  div.dataset.shopKey = si.typeId + '|' + si.tier;

  const stars = '★'.repeat(si.tier + 1);
  const card = document.createElement('div');
  card.className = 'plot-content tier-' + (si.tier + 1);
  card.innerHTML =
    '<div class="ground-shadow"></div>' +
    '<img src="' + tier.img + '" alt="' + def.name + '" class="shop-img" />' +
    '<div class="tier-badge" title="Tier ' + (si.tier + 1) + '">' + stars + '</div>' +
    '<div class="lock-badge" style="display:' + (occupied ? '' : 'none') + '" title="Occupied — cannot upgrade or sell">🔒</div>' +
    '<div class="streak-badge" style="display:' + (si.streak >= 3 ? '' : 'none') + '">🔥</div>' +
    '<div class="queue-badge" style="display:' + (si.queue.length ? '' : 'none') + '">⏳ <span class="queue-count">' + si.queue.length + '</span></div>' +
    '<div class="info-row">' +
    '<div class="name-pill">' + def.name + '</div>' +
    '<div class="cap-bar-mini"><div class="cap-fill" style="width:' + (si.occupants.length / tier.cap * 100) + '%"></div></div>' +
    '<div class="cap-text-mini">' + si.occupants.length + '/' + tier.cap + '</div>' +
    '</div>';
  div.appendChild(card);
};

/**
 * Lightweight update for occupancy/queue/streak changes — called very
 * frequently (every customer entry/exit/queue event). Patches only the
 * small dynamic bits instead of tearing down and rebuilding the whole
 * plot (which was forcing the browser to re-decode the shop image and
 * re-run its drop-shadow filter on every single customer, causing real
 * frame stutters once several shops were busy at once).
 */
DD.updateShopOccupancyVisual = function (index) {
  const div = DD.el.shopsLayer.querySelector('.shop-plot[data-index="' + index + '"]');
  const si = DD.runtime.shopInstances[index];
  if (!div || !si) return;
  const currentKey = si.typeId + '|' + si.tier;
  if (div.dataset.shopKey !== currentKey || !div.querySelector('.plot-content')) {
    DD.refreshShopPlot(index); // shop type/tier changed since last paint — needs a real rebuild
    return;
  }
  const def = DD.shopById(si.typeId);
  const tier = def.tiers[si.tier];
  const occupied = si.occupants.length > 0;
  div.classList.toggle('occupied-lock', occupied);

  const lockBadge = div.querySelector('.lock-badge');
  if (lockBadge) lockBadge.style.display = occupied ? '' : 'none';
  const streakBadge = div.querySelector('.streak-badge');
  if (streakBadge) streakBadge.style.display = si.streak >= 3 ? '' : 'none';
  const queueBadge = div.querySelector('.queue-badge');
  if (queueBadge) {
    queueBadge.style.display = si.queue.length ? '' : 'none';
    const countEl = queueBadge.querySelector('.queue-count');
    if (countEl) countEl.textContent = si.queue.length;
  }
  const capFill = div.querySelector('.cap-fill');
  if (capFill) capFill.style.width = (si.occupants.length / tier.cap * 100) + '%';
  const capText = div.querySelector('.cap-text-mini');
  if (capText) capText.textContent = si.occupants.length + '/' + tier.cap;
};

DD.refreshDecoPlot = function (index) {
  const div = DD.el.footpathLayer.querySelector('.deco-plot[data-index="' + index + '"]');
  if (!div) return;
  const di = DD.runtime.decoInstances[index];
  div.innerHTML = '';
  if (!di) {
    div.dataset.decoKey = '';
    div.classList.add('empty');
    div.innerHTML = '<div class="deco-empty">+</div>';
    return;
  }
  div.classList.remove('empty');
  const def = DD.furnitureById(di.typeId);
  const occupied = di.occupants.length > 0;
  div.dataset.decoKey = di.typeId;
  const card = document.createElement('div');
  card.className = 'plot-content deco-content';
  let capHtml = '';
  if (def.kind === 'seat') {
    capHtml = '<div class="cap-bar-mini small"><div class="cap-fill" style="width:' + (di.occupants.length / def.cap * 100) + '%"></div></div>' +
      '<div class="cap-text-mini small">' + di.occupants.length + '/' + def.cap + '</div>' +
      '<div class="queue-badge small" style="display:' + (di.queue.length ? '' : 'none') + '">⏳ <span class="queue-count">' + di.queue.length + '</span></div>';
  }
  card.innerHTML =
    '<div class="ground-shadow small"></div>' +
    '<img src="' + def.icon + '" alt="' + def.name + '" class="deco-img" />' +
    '<div class="lock-badge small" style="display:' + (occupied && def.kind === 'seat' ? '' : 'none') + '" title="In use">🔒</div>' +
    '<div class="info-row"><div class="name-pill small">' + def.name + '</div>' + capHtml + '</div>';
  div.appendChild(card);
};

/**
 * Lightweight update for furniture occupancy/queue changes — avoids
 * rebuilding the whole plot (and re-decoding the icon image) every time
 * a customer sits down or leaves a bench.
 */
DD.updateDecoOccupancyVisual = function (index) {
  const div = DD.el.footpathLayer.querySelector('.deco-plot[data-index="' + index + '"]');
  const di = DD.runtime.decoInstances[index];
  if (!div || !di) return;
  if (div.dataset.decoKey !== di.typeId || !div.querySelector('.plot-content')) {
    DD.refreshDecoPlot(index);
    return;
  }
  const def = DD.furnitureById(di.typeId);
  const occupied = di.occupants.length > 0;
  const lockBadge = div.querySelector('.lock-badge');
  if (lockBadge) lockBadge.style.display = (occupied && def.kind === 'seat') ? '' : 'none';
  const capFill = div.querySelector('.cap-fill');
  if (capFill && def.kind === 'seat') capFill.style.width = (di.occupants.length / def.cap * 100) + '%';
  const capText = div.querySelector('.cap-text-mini');
  if (capText && def.kind === 'seat') capText.textContent = di.occupants.length + '/' + def.cap;
  const queueBadge = div.querySelector('.queue-badge');
  if (queueBadge) {
    queueBadge.style.display = di.queue.length ? '' : 'none';
    const countEl = queueBadge.querySelector('.queue-count');
    if (countEl) countEl.textContent = di.queue.length;
  }
};

// ---------------------------------------------------------------
// Ambient traffic (purely decorative, CSS-driven)
// ---------------------------------------------------------------
DD.spawnAmbientTraffic = function () {
  const road = DD.el.roadLayer;
  road.innerHTML = '';
  const count = 3;
  const imgs = ['assets/vehicles/car.png', 'assets/vehicles/rickshaw.png'];
  for (let i = 0; i < count; i++) {
    const v = document.createElement('img');
    v.src = imgs[i % imgs.length];
    v.className = 'ambient-vehicle';
    const dur = DD.rand(9, 16);
    v.style.animationDuration = dur + 's';
    v.style.animationDelay = (-Math.random() * dur) + 's';
    v.style.top = (6 + (i % 2) * 30) + 'px';
    road.appendChild(v);
  }
};

DD.spawnBusEl = function () {
  const road = DD.el.roadLayer;
  const bus = document.createElement('img');
  bus.src = 'assets/vehicles/bus.png';
  bus.className = 'bus-vehicle';
  bus.style.animationDuration = '4.2s';
  road.appendChild(bus);
  setTimeout(() => bus.remove(), 4300);
};

// ---------------------------------------------------------------
// Customers
// ---------------------------------------------------------------
DD.customerEls = {};

DD.RIGGED_SPRITES = { 1: { hipFraction: 0.656 } }; // trial: customer-1 uses a 3-piece walk rig

DD.createCustomerEl = function (cust) {
  const div = document.createElement('div');
  const rig = DD.RIGGED_SPRITES[cust.spriteIndex];
  div.className = 'customer' + (cust.isVIP ? ' vip' : '') + (rig ? ' rigged' : '');
  div.dataset.id = cust.id;

  let spriteHtml;
  if (rig) {
    const base = 'assets/customers_rig/customer-' + cust.spriteIndex;
    spriteHtml =
      '<div class="rig-stage" style="--hip-y:' + (rig.hipFraction * 100) + '%">' +
      '<img class="rig-part rig-legL" src="' + base + '-legL.png" alt="" />' +
      '<img class="rig-part rig-legR" src="' + base + '-legR.png" alt="" />' +
      '<img class="rig-part rig-torso" src="' + base + '-torso.png" alt="" />' +
      '</div>';
  } else {
    spriteHtml = '<img class="cust-img" src="assets/customers/customer-' + cust.spriteIndex + '.png" alt="customer" />';
  }

  div.innerHTML =
    '<div class="patience-wrap"><div class="patience-fill"></div></div>' +
    (cust.isVIP ? '<div class="vip-badge">VIP</div>' : '') +
    '<div class="sprite-wrap">' + spriteHtml + '</div>' +
    '<div class="bought-bubble"></div>';

  const bobDuration = (54 / cust.speed).toFixed(2); // faster walkers move faster
  div.style.setProperty('--foot-duration', bobDuration + 's');
  if (!rig) {
    div.querySelector('.cust-img').style.animationDuration = bobDuration + 's';
  } else {
    div.querySelectorAll('.rig-part').forEach(el => { el.style.animationDuration = bobDuration + 's'; });
  }
  DD.el.walkLayer.appendChild(div);
  DD.customerEls[cust.id] = div;
  return div;
};

DD.updateCustomerEl = function (cust) {
  let div = DD.customerEls[cust.id];
  if (!div) div = DD.createCustomerEl(cust);
  div.style.transform = 'translateX(' + cust.x + 'px)';

  const visible = !(cust.state === 'shop_entering' && cust.stateTimer < 0.18) &&
    cust.state !== 'shop_inside' &&
    !(cust.state === 'shop_exiting' && cust.stateTimer > 0.17);
  div.classList.toggle('faded', !visible);
  div.classList.toggle('sitting', cust.state === 'furn_serve');
  div.classList.toggle('queuing', cust.state === 'furn_queue' || cust.state === 'shop_queue');
  div.classList.toggle('dancing', cust.dancing > 0);

  const pFill = div.querySelector('.patience-fill');
  const pct = Math.max(0, cust.patience / cust.maxPatience) * 100;
  pFill.style.width = pct + '%';
  pFill.className = 'patience-fill ' + (pct > 55 ? 'good' : pct > 25 ? 'ok' : 'bad');

  const bubble = div.querySelector('.bought-bubble');
  if (cust.boughtFlash > 0) {
    bubble.textContent = '+' + DD.fmtMoney(cust.boughtAmount);
    bubble.style.opacity = Math.min(1, cust.boughtFlash * 2);
  } else {
    bubble.style.opacity = 0;
  }
};

DD.removeCustomerEl = function (custId) {
  const div = DD.customerEls[custId];
  if (div) {
    div.classList.add('leaving-fade');
    setTimeout(() => div.remove(), 260);
    delete DD.customerEls[custId];
  }
};

DD.clearAllCustomerEls = function () {
  Object.keys(DD.customerEls).forEach(id => {
    const d = DD.customerEls[id];
    if (d) d.remove();
  });
  DD.customerEls = {};
};

// ---------------------------------------------------------------
// World map
// ---------------------------------------------------------------
DD.renderWorldMap = function () {
  const root = DD.el.worldMapGrid;
  root.innerHTML = '';
  DD.CITIES.forEach((c, i) => {
    const unlocked = DD.isCityUnlocked(i);
    const citySave = DD.state.cities[i];
    const card = document.createElement('div');
    card.className = 'city-node' + (unlocked ? ' unlocked' : ' locked') + (i === DD.state.cityIndex ? ' current' : '');
    const pct = Math.min(100, Math.round((citySave.cumulative / c.target) * 100));
    card.innerHTML =
      '<div class="city-thumb" style="background-image:url(' + c.skyline + ')"></div>' +
      '<div class="city-node-body">' +
      '<h3>' + c.name + '</h3>' +
      (unlocked
        ? '<div class="city-mini-progress"><div class="city-mini-fill" style="width:' + pct + '%"></div></div>' +
          '<p class="muted">Day ' + citySave.day + ' / ' + c.days + ' · ' + DD.fmtMoney(citySave.cumulative) + ' / ' + DD.fmtMoney(c.target) + '</p>' +
          (citySave.completed ? '<p class="tag-done">✔ Target reached</p>' : '')
        : '<p class="muted">🔒 Requires ' + c.unlockRep.toLocaleString('en-IN') + ' reputation</p>');
    card.innerHTML += '</div>';
    if (unlocked) {
      card.addEventListener('click', () => DD.travelToCity(i));
    }
    root.appendChild(card);
  });
};

// ---------------------------------------------------------------
// Build side panel (reference only)
// ---------------------------------------------------------------
DD.renderBuildPanel = function () {
  const cityDef = DD.currentCityDef();
  const shopList = DD.el.shopRefList;
  shopList.innerHTML = '';
  cityDef.shops.forEach(shopId => {
    const def = DD.shopById(shopId);
    const t1 = def.tiers[0];
    const row = document.createElement('div');
    row.className = 'ref-row';
    row.innerHTML =
      '<img src="' + def.icon + '" class="ref-icon" alt="" />' +
      '<div class="ref-info"><strong>' + def.name + '</strong>' +
      '<span>Build: ' + DD.fmtMoney(def.baseCost) + '</span>' +
      '<span class="muted">' + t1.cap + ' cap · ' + t1.dwell + 's · ' + DD.fmtMoney(t1.price) + '</span></div>';
    row.addEventListener('click', () => DD.highlightEmptyShopPlots());
    shopList.appendChild(row);
  });

  const decoList = DD.el.decoRefList;
  decoList.innerHTML = '';
  DD.FURNITURE_TYPES.forEach(def => {
    const row = document.createElement('div');
    row.className = 'ref-row';
    row.innerHTML =
      '<img src="' + def.icon + '" class="ref-icon" alt="" />' +
      '<div class="ref-info"><strong>' + def.name + '</strong>' +
      '<span>Build: ' + DD.fmtMoney(def.cost) + '</span>' +
      '<span class="muted">' + def.blurb + '</span></div>';
    row.addEventListener('click', () => DD.highlightEmptyDecoPlots());
    decoList.appendChild(row);
  });
};

DD.highlightEmptyShopPlots = function () {
  document.querySelectorAll('.shop-plot.empty').forEach(el => {
    el.classList.add('pulse-hint');
    setTimeout(() => el.classList.remove('pulse-hint'), 1400);
  });
};
DD.highlightEmptyDecoPlots = function () {
  document.querySelectorAll('.deco-plot.empty').forEach(el => {
    el.classList.add('pulse-hint');
    setTimeout(() => el.classList.remove('pulse-hint'), 1400);
  });
};

// ---------------------------------------------------------------
// Achievements & Stats screens
// ---------------------------------------------------------------
DD.renderAchievements = function () {
  const root = DD.el.achievementsGrid;
  root.innerHTML = '';
  DD.ACHIEVEMENTS.forEach(a => {
    const unlocked = DD.state.achievementsUnlocked.indexOf(a.id) !== -1;
    const card = document.createElement('div');
    card.className = 'ach-card' + (unlocked ? ' unlocked' : '');
    card.innerHTML =
      '<div class="ach-icon">' + (unlocked ? '🏆' : '🔒') + '</div>' +
      '<div><strong>' + a.name + '</strong><p>' + a.desc + '</p></div>';
    root.appendChild(card);
  });
};

DD.renderStats = function () {
  const root = DD.el.statsGrid;
  const s = DD.state.stats;
  root.innerHTML = [
    ['Lifetime Earnings', DD.fmtMoney(s.lifetimeEarnings)],
    ['Reputation', Math.round(DD.state.reputation).toLocaleString('en-IN')],
    ['Customers Served', s.customersServed.toLocaleString('en-IN')],
    ['Customers Happy', s.customersHappy.toLocaleString('en-IN')],
    ['Total Customers Seen', s.customersTotal.toLocaleString('en-IN')],
    ['Served From Buses', s.busCustomersServed.toLocaleString('en-IN')],
    ['VIPs Served', s.vipServed.toLocaleString('en-IN')],
    ['Shops Built', s.shopsBuilt.toLocaleString('en-IN')],
    ['Shops Maxed to Tier 3', s.shopsMaxed.toLocaleString('en-IN')],
    ['Festivals Hosted', s.festivalsHosted.toLocaleString('en-IN')],
    ['Best Happiness Streak (days)', s.bestStreak.toLocaleString('en-IN')],
    ['Cities Unlocked', DD.state.unlockedCityIds.length + ' / ' + DD.CITIES.length]
  ].map(([label, val]) => '<div class="stat-card"><span class="stat-val">' + val + '</span><span class="stat-label">' + label + '</span></div>').join('');

  if (DD.el.resetGameBtn) {
    DD.el.resetGameBtn.onclick = DD.confirmResetGame;
  }
};

// ---------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------
DD.toast = function (text, cls) {
  const t = document.createElement('div');
  t.className = 'toast ' + (cls || '');
  t.textContent = text;
  DD.el.toastRoot.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3200);
};
