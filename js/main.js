/* ============================================================
   Dukaan Dreams — main.js
   Boot sequence, DOM wiring, screen switching, rAF game loop.
   ============================================================ */
window.DD = window.DD || {};

DD.currentScreen = 'city';

DD.showScreen = function (name) {
  const leavingCityWithGateOpen = DD.currentScreen === 'city' && name !== 'city' &&
    DD.runtime && !DD.runtime.dayActive && DD.el.modalRoot.classList.contains('open');
  if (leavingCityWithGateOpen) DD.closeModal();

  DD.currentScreen = name;
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  document.getElementById('screen-' + name).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  if (name === 'worldmap') DD.renderWorldMap();
  if (name === 'achievements') DD.renderAchievements();
  if (name === 'stats') DD.renderStats();
  if (name === 'city' && DD.runtime && !DD.runtime.dayActive && DD.state.seenTutorial &&
      !DD.el.modalRoot.classList.contains('open')) {
    DD.openDayStartGate();
  }
};

function cacheDom() {
  DD.el.hudMoney = document.getElementById('hud-money');
  DD.el.hudRep = document.getElementById('hud-rep');
  DD.el.hudCityName = document.getElementById('hud-city-name');
  DD.el.hudDay = document.getElementById('hud-day');
  DD.el.hudTargetFill = document.getElementById('hud-target-fill');
  DD.el.hudTargetLabel = document.getElementById('hud-target-label');
  DD.el.hudHappy = document.getElementById('hud-happy');
  DD.el.hudTimer = document.getElementById('hud-timer');
  DD.el.pauseBtn = document.getElementById('pause-btn');
  DD.el.ffBtn = document.getElementById('ff-btn');
  DD.el.fullscreenBtn = document.getElementById('fullscreen-btn');
  DD.el.soundBtn = document.getElementById('sound-btn');
  DD.el.noteBtn = document.getElementById('note-btn');
  DD.el.resetBtnHeader = document.getElementById('reset-btn-header');
  DD.el.streetScene = document.getElementById('street-scene');
  DD.el.shopRefList = document.getElementById('shop-ref-list');
  DD.el.decoRefList = document.getElementById('deco-ref-list');
  DD.el.worldMapGrid = document.getElementById('world-map-grid');
  DD.el.achievementsGrid = document.getElementById('achievements-grid');
  DD.el.statsGrid = document.getElementById('stats-grid');
  DD.el.resetGameBtn = document.getElementById('reset-game-btn');
  DD.el.modalRoot = document.getElementById('modal-root');
  DD.el.toastRoot = document.getElementById('toast-root');
}

function wireHeader() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { DD.Sound.play('click'); DD.showScreen(btn.dataset.screen); });
  });

  DD.el.pauseBtn.addEventListener('click', () => {
    if (!DD.runtime.dayActive) return;
    DD.runtime.paused = !DD.runtime.paused;
    DD.el.streetScene.classList.toggle('paused', DD.runtime.paused);
    DD.Sound.play('click');
    DD.renderHUD();
  });

  DD.el.ffBtn.addEventListener('click', () => {
    const speeds = [1, 2, 3];
    const cur = speeds.indexOf(DD.state.settings.speed);
    DD.state.settings.speed = speeds[(cur + 1) % speeds.length];
    DD.saveState();
    DD.Sound.play('click');
    DD.renderHUD();
  });

  DD.el.fullscreenBtn.addEventListener('click', () => {
    const app = document.getElementById('app');
    if (!document.fullscreenElement) {
      (app.requestFullscreen || app.webkitRequestFullscreen || function () {}).call(app);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    }
  });

  DD.el.soundBtn.addEventListener('click', () => {
    DD.state.settings.muted = !DD.state.settings.muted;
    DD.saveState();
    DD.renderHUD();
    if (!DD.state.settings.muted) DD.Sound.play('click');
  });

  DD.el.noteBtn.addEventListener('click', showNote);
  DD.el.resetBtnHeader.addEventListener('click', DD.confirmResetGame);
}

function showNote() {
  DD.showModal(
    '<div class="note-card">' +
    '<img src="assets/ui/diya.png" class="note-diya" alt="" />' +
    '<h2>For Khushi</h2>' +
    '<p>Every stall on this street was built the way I hope our life together turns out — a little messy while it\'s being built, a lot of warmth once the lights come on.</p>' +
    '<p>Run your bazaar, chase your reputation across every city, and know that this whole thing exists because you make ordinary days feel festive.</p>' +
    '<p class="note-signoff">— Kunj</p>' +
    '</div>',
    { extraClass: 'note-modal' }
  );
}

DD.confirmResetGame = function () {
  DD.showModal(
    '<h2>⚠️ Reset Everything?</h2>' +
    '<p>This permanently deletes all money, shops, furniture, reputation, city progress and achievements, and starts fresh from Mumbai, Day 1.</p>' +
    '<p><strong>This cannot be undone.</strong></p>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" id="reset-cancel">Cancel</button>' +
    '<button class="btn btn-danger" id="reset-confirm">Yes, reset everything</button>' +
    '</div>',
    {
      extraClass: 'wide',
      onRender: root => {
        root.querySelector('#reset-cancel').addEventListener('click', DD.closeModal);
        root.querySelector('#reset-confirm').addEventListener('click', () => {
          DD.resetState();
          DD.closeModal();
          location.reload();
        });
      }
    }
  );
};

DD.maybeShowTutorialThenGate = function () {
  if (DD.state.seenTutorial) { DD.openDayStartGate(); return; }
  showTutorialIfNeeded(DD.openDayStartGate);
};

function showTutorialIfNeeded(onDone) {
  DD.showModal(
    '<h2>Welcome to Dukaan Dreams 🪔</h2>' +
    '<p>Build shops on the <strong>upper row</strong> and street furniture on the <strong>lower footpath</strong> — they never block each other.</p>' +
    '<p>Customers walk in from the left with a patience bar. Serve them before it runs out, and keep a shop capacity free so lines don\'t form.</p>' +
    '<p>A <strong>Bus Stop</strong> triggers once each day and drops a batch of fresh customers right at its spot — a one-time daily crowd boost, not a repeating spawn. A high-capacity <strong>Chaat Corner</strong> (the HOLDING shop) placed nearby can soak up that whole crowd and release it gradually.</p>' +
    '<p>Each city has a money target and a strict day limit. Hit the target in time and the next city unlocks — miss it and you\'ll restart that city fresh (with half your building costs refunded). Nothing moves until you press <strong>Start Day</strong>.</p>' +
    '<div class="modal-actions"><button class="btn btn-primary btn-large" id="tut-ok">Got it, let\'s trade!</button></div>',
    {
      dismissible: false,
      extraClass: 'wide',
      onRender: root => {
        root.querySelector('#tut-ok').addEventListener('click', () => {
          DD.state.seenTutorial = true;
          DD.saveState();
          DD.closeModal();
          if (onDone) onDone();
        });
      }
    }
  );
}

// ---------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------
let lastTs = null;
function loop(ts) {
  if (lastTs == null) lastTs = ts;
  let rawDt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (rawDt > 0.1) rawDt = 0.1; // clamp huge jumps (tab backgrounded etc.)

  const speed = (DD.state && DD.state.settings) ? DD.state.settings.speed : 1;
  const dt = (DD.runtime && !DD.runtime.paused) ? rawDt * speed : 0;

  if (DD.currentScreen === 'city' && dt > 0) {
    DD.tick(dt);
  }

  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
function boot() {
  cacheDom();
  DD.loadState();
  DD.initRuntime();
  DD.refreshCityUnlocks();
  wireHeader();
  DD.showScreen('city');
  DD.enterCityScreen();
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', boot);
