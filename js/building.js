/* ============================================================
   Dukaan Dreams — building.js
   Shop/furniture build, upgrade, sell logic + their modals.
   ============================================================ */
window.DD = window.DD || {};

DD.onShopPlotClick = function (index) {
  const si = DD.runtime.shopInstances[index];
  if (!si) DD.openShopPickerModal(index);
  else DD.openShopManageModal(index);
};

DD.onDecoPlotClick = function (index) {
  const di = DD.runtime.decoInstances[index];
  if (!di) DD.openDecoPickerModal(index);
  else DD.openDecoManageModal(index);
};

// ---------------------------------------------------------------
// Shop picker / build
// ---------------------------------------------------------------
DD.openShopPickerModal = function (index) {
  const cityDef = DD.currentCityDef();
  const rows = cityDef.shops.map(id => {
    const def = DD.shopById(id);
    const t1 = def.tiers[0];
    const afford = DD.state.money >= def.baseCost;
    return '<div class="pick-row ' + (afford ? '' : 'disabled') + '" data-shop="' + id + '">' +
      '<img src="' + def.icon + '" class="pick-icon" alt="" />' +
      '<div class="pick-info"><strong>' + def.name + (def.holding ? ' <span class="tag-holding">HOLDING</span>' : '') + '</strong>' +
      '<span>' + t1.cap + ' capacity · ' + t1.dwell + 's visit · ' + DD.fmtMoney(t1.price) + '/customer</span></div>' +
      '<div class="pick-cost">' + DD.fmtMoney(def.baseCost) + '</div></div>';
  }).join('');

  DD.showModal(
    '<h2>Build a Shop</h2><p class="muted">Choose what to open on this plot.</p>' +
    '<div class="pick-list">' + rows + '</div>',
    {
      extraClass: 'wide',
      onRender: root => {
        root.querySelectorAll('.pick-row').forEach(rowEl => {
          rowEl.addEventListener('click', () => {
            const id = rowEl.dataset.shop;
            const def = DD.shopById(id);
            if (DD.state.money < def.baseCost) { DD.Sound.play('error'); DD.toast('Not enough money for ' + def.name, 'error'); return; }
            DD.buildShop(index, id);
            DD.closeModal();
          });
        });
      }
    }
  );
};

DD.buildShop = function (index, shopId) {
  const def = DD.shopById(shopId);
  if (DD.state.money < def.baseCost) { DD.Sound.play('error'); DD.toast('Not enough money for ' + def.name, 'error'); return; }
  if (DD.runtime.shopInstances[index]) return; // plot already has a shop
  DD.state.money -= def.baseCost;
  const inst = { typeId: shopId, tier: 0, occupants: [], queue: [], streak: 0 };
  DD.runtime.shopInstances[index] = inst;
  DD.currentCitySave().shopSlots[index] = { typeId: shopId, tier: 0 };
  DD.state.stats.shopsBuilt++;
  DD.unlockAchievement('first_shop');
  DD.Sound.play('build');
  DD.toast('Built ' + def.name + '!', 'success');
  DD.saveState();
  DD.refreshShopPlot(index);
  DD.renderHUD();
};

DD.openShopManageModal = function (index) {
  const si = DD.runtime.shopInstances[index];
  const def = DD.shopById(si.typeId);
  const tier = def.tiers[si.tier];
  const occupied = si.occupants.length > 0;
  const maxed = si.tier >= def.tiers.length - 1;
  const next = maxed ? null : def.tiers[si.tier + 1];
  const invested = def.baseCost + (si.tier >= 1 ? def.tiers[1].upgradeCost : 0) + (si.tier >= 2 ? def.tiers[2].upgradeCost : 0);
  const refund = Math.round(invested * 0.5);

  let body = '<h2>' + def.name + ' <span class="tag-tier">Tier ' + (si.tier + 1) + '</span></h2>';
  if (occupied) body += '<p class="lock-note">🔒 Occupied right now — upgrade and sell are disabled until it clears.</p>';
  body += '<img src="' + tier.img + '" class="manage-img" alt="" />';
  body += '<div class="stat-row"><span>Capacity</span><strong>' + tier.cap + '</strong></div>';
  body += '<div class="stat-row"><span>Visit time</span><strong>' + tier.dwell + 's</strong></div>';
  body += '<div class="stat-row"><span>Price per customer</span><strong>' + DD.fmtMoney(tier.price) + '</strong></div>';

  if (next) {
    body += '<hr/><h3>Upgrade to Tier ' + (si.tier + 2) + '</h3>';
    body += '<div class="stat-row"><span>Capacity</span><strong>' + tier.cap + ' → ' + next.cap + '</strong></div>';
    body += '<div class="stat-row"><span>Visit time</span><strong>' + tier.dwell + 's → ' + next.dwell + 's</strong></div>';
    body += '<div class="stat-row"><span>Price</span><strong>' + DD.fmtMoney(tier.price) + ' → ' + DD.fmtMoney(next.price) + '</strong></div>';
    body += '<div class="stat-row"><span>Cost</span><strong>' + DD.fmtMoney(next.upgradeCost) + '</strong></div>';
  } else {
    body += '<hr/><p class="muted">This shop is already at its maximum tier. 🏆</p>';
  }

  body += '<div class="modal-actions">';
  body += '<button class="btn btn-primary" id="mgmt-upgrade" ' + (occupied || maxed || DD.state.money < (next ? next.upgradeCost : 0) ? 'disabled' : '') + '>' +
    (maxed ? 'Maxed Out' : 'Upgrade — ' + (next ? DD.fmtMoney(next.upgradeCost) : '')) + '</button>';
  body += '<button class="btn btn-danger" id="mgmt-sell" ' + (occupied ? 'disabled' : '') + '>Sell — refund ' + DD.fmtMoney(refund) + '</button>';
  body += '</div>';

  DD.showModal(body, {
    onRender: root => {
      const up = root.querySelector('#mgmt-upgrade');
      const sell = root.querySelector('#mgmt-sell');
      if (up) up.addEventListener('click', () => { DD.upgradeShop(index); DD.closeModal(); });
      if (sell) sell.addEventListener('click', () => { DD.sellShop(index); DD.closeModal(); });
    }
  });
};

DD.upgradeShop = function (index) {
  const si = DD.runtime.shopInstances[index];
  if (!si || si.occupants.length > 0) return;
  const def = DD.shopById(si.typeId);
  if (si.tier >= def.tiers.length - 1) return;
  const next = def.tiers[si.tier + 1];
  if (DD.state.money < next.upgradeCost) { DD.Sound.play('error'); DD.toast('Not enough money to upgrade', 'error'); return; }
  DD.state.money -= next.upgradeCost;
  si.tier += 1;
  DD.currentCitySave().shopSlots[index].tier = si.tier;
  if (si.tier === def.tiers.length - 1) {
    DD.state.stats.shopsMaxed++;
    DD.unlockAchievement('shop_maxed');
  }
  DD.Sound.play('upgrade');
  DD.toast(def.name + ' upgraded to Tier ' + (si.tier + 1) + '!', 'success');
  DD.saveState();
  DD.refreshShopPlot(index);
  DD.renderHUD();
};

DD.sellShop = function (index) {
  const si = DD.runtime.shopInstances[index];
  if (!si || si.occupants.length > 0) return;
  const def = DD.shopById(si.typeId);
  const invested = def.baseCost + (si.tier >= 1 ? def.tiers[1].upgradeCost : 0) + (si.tier >= 2 ? def.tiers[2].upgradeCost : 0);
  const refund = Math.round(invested * 0.5);
  DD.state.money += refund;
  DD.runtime.shopInstances[index] = null;
  DD.currentCitySave().shopSlots[index] = null;
  DD.Sound.play('sell');
  DD.toast('Sold ' + def.name + ' for ' + DD.fmtMoney(refund), 'info');
  DD.saveState();
  DD.refreshShopPlot(index);
  DD.renderHUD();
};

// ---------------------------------------------------------------
// Furniture picker / build
// ---------------------------------------------------------------
DD.openDecoPickerModal = function (index) {
  const rows = DD.FURNITURE_TYPES.map(def => {
    const afford = DD.state.money >= def.cost;
    return '<div class="pick-row ' + (afford ? '' : 'disabled') + '" data-deco="' + def.id + '">' +
      '<img src="' + def.icon + '" class="pick-icon" alt="" />' +
      '<div class="pick-info"><strong>' + def.name + '</strong><span class="muted">' + def.blurb + '</span></div>' +
      '<div class="pick-cost">' + DD.fmtMoney(def.cost) + '</div></div>';
  }).join('');

  DD.showModal(
    '<h2>Add Street Furniture</h2><p class="muted">Furniture never blocks a shop — they share the same spot.</p>' +
    '<div class="pick-list">' + rows + '</div>',
    {
      extraClass: 'wide',
      onRender: root => {
        root.querySelectorAll('.pick-row').forEach(rowEl => {
          rowEl.addEventListener('click', () => {
            const id = rowEl.dataset.deco;
            const def = DD.furnitureById(id);
            if (DD.state.money < def.cost) { DD.Sound.play('error'); DD.toast('Not enough money for ' + def.name, 'error'); return; }
            DD.buildDeco(index, id);
            DD.closeModal();
          });
        });
      }
    }
  );
};

DD.buildDeco = function (index, decoId) {
  const def = DD.furnitureById(decoId);
  if (DD.state.money < def.cost) { DD.Sound.play('error'); DD.toast('Not enough money for ' + def.name, 'error'); return; }
  if (DD.runtime.decoInstances[index]) return; // plot already has furniture
  DD.state.money -= def.cost;
  const inst = { typeId: decoId, occupants: [], queue: [] };
  DD.runtime.decoInstances[index] = inst;
  DD.currentCitySave().decoSlots[index] = { typeId: decoId };
  DD.Sound.play('build');
  DD.toast('Placed ' + def.name + '!', 'success');
  DD.saveState();
  DD.refreshDecoPlot(index);
  DD.renderHUD();
};

DD.openDecoManageModal = function (index) {
  const di = DD.runtime.decoInstances[index];
  const def = DD.furnitureById(di.typeId);
  const occupied = di.occupants.length > 0 && def.kind === 'seat';
  const refund = Math.round(def.cost * 0.5);

  let body = '<h2>' + def.name + '</h2>';
  if (occupied) body += '<p class="lock-note">🔒 In use right now — remove disabled until free.</p>';
  body += '<img src="' + def.icon + '" class="manage-img small" alt="" />';
  body += '<p class="muted">' + def.blurb + '</p>';
  if (def.kind === 'bus') body += '<p class="muted">Spawns 3 customers every ' + DD.BUS_INTERVAL_S + 's while a day is active.</p>';
  body += '<div class="modal-actions"><button class="btn btn-danger" id="mgmt-remove" ' + (occupied ? 'disabled' : '') + '>Remove — refund ' + DD.fmtMoney(refund) + '</button></div>';

  DD.showModal(body, {
    onRender: root => {
      const rem = root.querySelector('#mgmt-remove');
      if (rem) rem.addEventListener('click', () => { DD.removeDeco(index); DD.closeModal(); });
    }
  });
};

DD.removeDeco = function (index) {
  const di = DD.runtime.decoInstances[index];
  if (!di) return;
  const def = DD.furnitureById(di.typeId);
  if (di.occupants.length > 0 && def.kind === 'seat') return;
  const refund = Math.round(def.cost * 0.5);
  DD.state.money += refund;
  DD.runtime.decoInstances[index] = null;
  DD.currentCitySave().decoSlots[index] = null;
  DD.Sound.play('sell');
  DD.toast('Removed ' + def.name + ' for ' + DD.fmtMoney(refund), 'info');
  DD.saveState();
  DD.refreshDecoPlot(index);
  DD.renderHUD();
};
