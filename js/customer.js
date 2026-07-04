/* ============================================================
   Dukaan Dreams — customer.js
   Customer entity + finite-state-machine AI. Pure logic; no DOM
   access here. render.js reads customer state to draw sprites.
   ============================================================ */
window.DD = window.DD || {};

DD._custIdSeq = 1;

DD.rand = (min, max) => min + Math.random() * (max - min);

/**
 * Create a new customer for the given city definition.
 * opts: { fromBus:boolean, startPlotIndex:number, forcedVIP:boolean }
 */
DD.createCustomer = function (cityDef, opts) {
  opts = opts || {};
  const isVIP = !!opts.forcedVIP || Math.random() < 0.05;
  const spriteIndex = 1 + Math.floor(Math.random() * DD.CUSTOMER_SPRITE_COUNT);
  const baseMoney = DD.rand(cityDef.moneyMin, cityDef.moneyMax);
  const wallet = isVIP ? baseMoney * 1.8 : baseMoney;
  const maxPatience = DD.rand(70, 100) * (DD.runtime.patienceMult || 1);

  const startPointer = opts.startPlotIndex != null ? opts.startPlotIndex : 0;
  const startX = opts.startPlotIndex != null
    ? DD.runtime.plotX[opts.startPlotIndex] - DD.PLOT_WIDTH * 0.5 - 30
    : -50;

  return {
    id: DD._custIdSeq++,
    spriteIndex,
    isVIP,
    x: startX,
    laneJitter: DD.rand(-6, 6),
    speed: DD.rand(46, 62),
    wallet,
    startingWallet: wallet,
    maxPatience,
    patience: maxPatience,
    state: 'walking',
    pointer: startPointer,
    stateTimer: 0,
    queueWaitTimer: 0,
    queueWaitLimit: 0,
    queueSlotIndex: 0,
    servedAnything: false,
    happy: false,
    fromBus: !!opts.fromBus,
    boughtFlash: 0, // timer to show a "+₹x" / bought bubble
    boughtAmount: 0,
    dancing: 0, // timer for pass-type dance reaction
    removed: false,
    everQueued: false,
    targetPlotIndex: -1,
    facing: 1
  };
};

// -- Helpers on runtime shop/deco instances -------------------------------

function shopTierDef(shopInst) {
  const def = DD.shopById(shopInst.typeId);
  return def.tiers[shopInst.tier];
}

function currentPriceMultiplier(shopTypeId) {
  let mult = 1;
  const rt = DD.runtime;
  if (!rt.activeFestivalEffects) return mult;
  rt.activeFestivalEffects.forEach(fx => {
    if (fx.priceMultAll) mult *= fx.priceMultAll;
    if (fx.affects && fx.affects.indexOf(shopTypeId) !== -1 && fx.priceMult) mult *= fx.priceMult;
  });
  return mult;
}

function refreshShop(idx) { if (DD.refreshShopPlot) DD.refreshShopPlot(idx); }
function refreshDeco(idx) { if (DD.refreshDecoPlot) DD.refreshDecoPlot(idx); }

function releaseFromAllQueuesAndSlots(cust) {
  const rt = DD.runtime;
  rt.shopInstances.forEach(si => {
    if (!si) return;
    const oi = si.occupants.indexOf(cust.id); if (oi !== -1) si.occupants.splice(oi, 1);
    const qi = si.queue.indexOf(cust.id); if (qi !== -1) si.queue.splice(qi, 1);
  });
  rt.decoInstances.forEach(di => {
    if (!di) return;
    const oi = di.occupants.indexOf(cust.id); if (oi !== -1) di.occupants.splice(oi, 1);
    const qi = di.queue.indexOf(cust.id); if (qi !== -1) di.queue.splice(qi, 1);
  });
}

function markServed(cust, amountEarned) {
  cust.servedAnything = true;
  cust.happy = true;
  cust.patience = Math.min(cust.maxPatience, cust.patience + 18);
  if (amountEarned) {
    cust.boughtFlash = 1.4;
    cust.boughtAmount = amountEarned;
  }
}

function killCustomer(cust, reason) {
  releaseFromAllQueuesAndSlots(cust);
  cust.state = 'done';
  cust.removed = true;
  cust.removeReason = reason;
}

/**
 * Advance one customer by dt seconds. Callbacks object provides
 * side-effect hooks into the wider game (money, reputation, streaks).
 */
DD.updateCustomer = function (cust, dt, plots, callbacks) {
  if (cust.removed) return;

  if (cust.boughtFlash > 0) cust.boughtFlash = Math.max(0, cust.boughtFlash - dt);
  if (cust.dancing > 0) cust.dancing = Math.max(0, cust.dancing - dt);

  const drains = (cust.state === 'walking' || cust.state === 'furn_queue' || cust.state === 'shop_queue');
  if (drains) {
    cust.patience -= dt * (100 / 30); // full bar depletes in ~30s of active walking/queueing
    if (cust.patience <= 0) {
      cust.patience = 0;
      killCustomer(cust, 'patience');
      callbacks.onCustomerLeftEarly && callbacks.onCustomerLeftEarly(cust);
      return;
    }
  }

  switch (cust.state) {
    case 'walking': {
      cust.x += cust.speed * dt;
      if (cust.pointer >= plots.length) {
        cust.state = 'leaving_done';
        return;
      }
      const plotEdgeX = DD.runtime.plotX[cust.pointer] - DD.PLOT_WIDTH * 0.5;
      if (cust.x >= plotEdgeX) {
        tryInteractAtPlot(cust, cust.pointer, callbacks);
      }
      break;
    }
    case 'furn_queue': {
      cust.queueWaitTimer += dt;
      const di = DD.runtime.decoInstances[cust.targetPlotIndex];
      const def = di ? DD.furnitureById(di.typeId) : null;
      if (di && def && di.occupants.length < def.cap && di.queue[0] === cust.id) {
        di.queue.shift();
        enterFurniture(cust, cust.targetPlotIndex, callbacks);
      } else if (cust.queueWaitTimer >= cust.queueWaitLimit) {
        // give up this furniture, proceed to shop check at same plot
        if (di) { const qi = di.queue.indexOf(cust.id); if (qi !== -1) di.queue.splice(qi, 1); }
        refreshDeco(cust.targetPlotIndex);
        proceedToShopCheck(cust, cust.targetPlotIndex, callbacks);
      }
      break;
    }
    case 'shop_queue': {
      cust.queueWaitTimer += dt;
      const si = DD.runtime.shopInstances[cust.targetPlotIndex];
      const tdef = si ? shopTierDef(si) : null;
      if (si && tdef && si.occupants.length < tdef.cap && si.queue[0] === cust.id) {
        si.queue.shift();
        enterShop(cust, cust.targetPlotIndex, callbacks);
        refreshShop(cust.targetPlotIndex);
      } else if (cust.queueWaitTimer >= cust.queueWaitLimit) {
        if (si) { const qi = si.queue.indexOf(cust.id); if (qi !== -1) si.queue.splice(qi, 1); }
        if (DD.resetStreakIfAbandoned) DD.resetStreakIfAbandoned(cust.targetPlotIndex);
        refreshShop(cust.targetPlotIndex);
        advancePointerAndResume(cust);
      }
      break;
    }
    case 'furn_serve': {
      cust.stateTimer -= dt;
      if (cust.stateTimer <= 0) {
        const di = DD.runtime.decoInstances[cust.targetPlotIndex];
        if (di) { const oi = di.occupants.indexOf(cust.id); if (oi !== -1) di.occupants.splice(oi, 1); }
        refreshDeco(cust.targetPlotIndex);
        proceedToShopCheck(cust, cust.targetPlotIndex, callbacks);
      }
      break;
    }
    case 'shop_entering': {
      cust.stateTimer -= dt;
      if (cust.stateTimer <= 0) {
        cust.state = 'shop_inside';
        const si = DD.runtime.shopInstances[cust.targetPlotIndex];
        const tdef = shopTierDef(si);
        cust.stateTimer = tdef.dwell;
      }
      break;
    }
    case 'shop_inside': {
      cust.stateTimer -= dt;
      if (cust.stateTimer <= 0) {
        const si = DD.runtime.shopInstances[cust.targetPlotIndex];
        const tdef = shopTierDef(si);
        const shopDef = DD.shopById(si.typeId);
        const price = +(tdef.price * currentPriceMultiplier(si.typeId) * (cust.isVIP ? 2 : 1)).toFixed(2);
        cust.wallet -= price;
        markServed(cust, price);
        callbacks.onSale && callbacks.onSale(cust, shopDef, si, price);
        cust.state = 'shop_exiting';
        cust.stateTimer = 0.35;
      }
      break;
    }
    case 'shop_exiting': {
      cust.stateTimer -= dt;
      if (cust.stateTimer <= 0) {
        const si = DD.runtime.shopInstances[cust.targetPlotIndex];
        if (si) { const oi = si.occupants.indexOf(cust.id); if (oi !== -1) si.occupants.splice(oi, 1); }
        refreshShop(cust.targetPlotIndex);
        advancePointerAndResume(cust);
      }
      break;
    }
    case 'leaving_done': {
      cust.x += cust.speed * dt;
      if (cust.x > DD.runtime.streetWidth + 80) {
        killCustomer(cust, 'finished');
        callbacks.onCustomerFinished && callbacks.onCustomerFinished(cust);
      }
      break;
    }
    default: break;
  }
};

function tryInteractAtPlot(cust, plotIndex, callbacks) {
  const di = DD.runtime.decoInstances[plotIndex];
  if (di) {
    const def = DD.furnitureById(di.typeId);
    if (def.kind === 'pass') {
      cust.dancing = 0.6;
      markServed(cust, 0);
      callbacks.onPassInteraction && callbacks.onPassInteraction(cust, def, di);
      proceedToShopCheck(cust, plotIndex, callbacks);
      return;
    }
    if (def.kind === 'seat') {
      if (cust.wallet < def.charge) {
        proceedToShopCheck(cust, plotIndex, callbacks);
        return;
      }
      if (di.occupants.length < def.cap) {
        enterFurniture(cust, plotIndex, callbacks);
        return;
      }
      // queue for furniture
      cust.targetPlotIndex = plotIndex;
      cust.state = 'furn_queue';
      cust.queueWaitTimer = 0;
      cust.queueWaitLimit = DD.rand(3.5, 6.5);
      cust.queueSlotIndex = di.queue.length;
      cust.everQueued = true;
      di.queue.push(cust.id);
      refreshDeco(plotIndex);
      return;
    }
    // bus-stop furniture: no direct interaction, fall through to shop check
  }
  proceedToShopCheck(cust, plotIndex, callbacks);
}

function enterFurniture(cust, plotIndex, callbacks) {
  const di = DD.runtime.decoInstances[plotIndex];
  const def = DD.furnitureById(di.typeId);
  di.occupants.push(cust.id);
  cust.wallet -= def.charge;
  if (def.charge > 0 && callbacks.onFurnitureCharge) callbacks.onFurnitureCharge(cust, def, di, def.charge);
  refreshDeco(plotIndex);
  cust.targetPlotIndex = plotIndex;
  cust.state = 'furn_serve';
  cust.stateTimer = def.dwell;
}

function proceedToShopCheck(cust, plotIndex, callbacks) {
  const si = DD.runtime.shopInstances[plotIndex];
  if (!si) { advancePointerAndResume(cust); return; }
  const tdef = shopTierDef(si);
  const shopDef = DD.shopById(si.typeId);
  const price = tdef.price * currentPriceMultiplier(si.typeId) * (cust.isVIP ? 2 : 1);
  if (cust.wallet < price) { advancePointerAndResume(cust); return; }
  if (si.occupants.length < tdef.cap) {
    cust.targetPlotIndex = plotIndex;
    cust.state = 'shop_entering';
    cust.stateTimer = 0.35;
    si.occupants.push(cust.id);
    refreshShop(plotIndex);
    return;
  }
  // queue for shop
  cust.targetPlotIndex = plotIndex;
  cust.state = 'shop_queue';
  cust.queueWaitTimer = 0;
  cust.queueWaitLimit = DD.rand(3.5, 6.5);
  cust.queueSlotIndex = si.queue.length;
  cust.everQueued = true;
  si.queue.push(cust.id);
  refreshShop(plotIndex);
}

function enterShop(cust, plotIndex, callbacks) {
  const si = DD.runtime.shopInstances[plotIndex];
  si.occupants.push(cust.id);
  cust.targetPlotIndex = plotIndex;
  cust.state = 'shop_entering';
  cust.stateTimer = 0.35;
}

function advancePointerAndResume(cust) {
  cust.pointer += 1;
  cust.state = 'walking';
  cust.targetPlotIndex = -1;
}
