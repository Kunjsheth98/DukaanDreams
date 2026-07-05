/* ============================================================
   Dukaan Dreams — achievements.js
   ============================================================ */
window.DD = window.DD || {};

DD.unlockAchievement = function (id) {
  if (DD.state.achievementsUnlocked.indexOf(id) !== -1) return;
  DD.state.achievementsUnlocked.push(id);
  const def = DD.ACHIEVEMENTS.find(a => a.id === id);
  DD.Sound.play('achievement');
  DD.toast('🏆 Achievement: ' + (def ? def.name : id), 'achievement');
  DD.saveState();
  if (DD.el.achievementsGrid && !DD.el.achievementsGrid.closest('.hidden')) DD.renderAchievements();
};

DD.checkMoneyAchievements = function () {
  const s = DD.state.stats.lifetimeEarnings;
  if (s >= 1000) DD.unlockAchievement('earn_1000');
  if (s >= 10000) DD.unlockAchievement('earn_10000');
  if (s >= 50000) DD.unlockAchievement('earn_50000');
};

DD.checkRepAchievements = function () {
  const r = DD.state.reputation;
  if (r >= 1000) DD.unlockAchievement('rep_1000');
  if (r >= 5000) DD.unlockAchievement('rep_5000');
};

DD.checkCityAchievements = function () {
  if (DD.state.unlockedCityIds.length >= DD.CITIES.length) DD.unlockAchievement('all_cities');
};

DD.checkBusAchievement = function () {
  if (DD.state.stats.busCustomersServed >= 50) DD.unlockAchievement('bus_master');
};
