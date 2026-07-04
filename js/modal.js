/* ============================================================
   Dukaan Dreams — modal.js
   Generic modal overlay. One at a time; content is passed as
   an HTML string plus optional post-render wiring callback.
   ============================================================ */
window.DD = window.DD || {};

DD._modalClearTimeout = null;

DD.showModal = function (html, opts) {
  opts = opts || {};
  if (DD._modalClearTimeout) { clearTimeout(DD._modalClearTimeout); DD._modalClearTimeout = null; }
  const root = DD.el.modalRoot;
  root.innerHTML =
    '<div class="modal-backdrop">' +
    '<div class="modal-box ' + (opts.extraClass || '') + '">' +
    (opts.dismissible !== false ? '<button class="modal-close" aria-label="Close">✕</button>' : '') +
    html +
    '</div></div>';
  root.classList.add('open');
  const closeBtn = root.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', DD.closeModal);
  if (opts.dismissible !== false) {
    root.querySelector('.modal-backdrop').addEventListener('click', e => {
      if (e.target.classList.contains('modal-backdrop')) DD.closeModal();
    });
  }
  if (opts.onRender) opts.onRender(root);
};

DD.closeModal = function () {
  const root = DD.el.modalRoot;
  root.classList.remove('open');
  DD._modalClearTimeout = setTimeout(() => {
    if (!root.classList.contains('open')) root.innerHTML = '';
    DD._modalClearTimeout = null;
  }, 200);
};
