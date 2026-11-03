/**
 * hud.js — DOM-based HUD overlay on top of canvas.
 * @module hud
 */

/**
 * Create a HUD manager.
 * @param {HTMLElement} mountEl - the game mount element
 * @returns {HUDManager}
 */
export function createHUDManager(mountEl) {
  const container = document.createElement('div');
  container.id = '__game-hud';
  container.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;z-index:100;';

  // Make mount relative for absolute positioning
  const mountStyle = getComputedStyle(mountEl);
  if (mountStyle.position === 'static') {
    mountEl.style.position = 'relative';
  }
  mountEl.appendChild(container);

  const texts = new Map();
  const buttons = new Map();
  const panels = new Map();

  return {
    /**
     * Set a text element.
     * @param {string} id
     * @param {string|number} value
     * @param {object} [opts]
     * @param {string} [opts.position='top-left']
     * @param {string} [opts.style] - additional CSS
     */
    setText(id, value, opts = {}) {
      let el = texts.get(id);
      if (!el) {
        el = document.createElement('div');
        el.style.cssText = 'position:absolute;padding:6px 12px;font-size:16px;font-weight:bold;text-shadow:1px 1px 2px rgba(0,0,0,.8);';
        container.appendChild(el);
        texts.set(id, el);
      }
      el.textContent = String(value);
      const pos = opts.position ?? 'top-left';
      applyPosition(el, pos, opts.offset);
      if (opts.style) el.style.cssText += ';' + opts.style;
    },

    /** Remove a text element */
    removeText(id) {
      const el = texts.get(id);
      if (el) { el.remove(); texts.delete(id); }
    },

    /**
     * Add a button.
     * @param {string} id
     * @param {string} label
     * @param {function} onClick
     * @param {object} [opts]
     */
    button(id, label, onClick, opts = {}) {
      let el = buttons.get(id);
      if (!el) {
        el = document.createElement('button');
        el.style.cssText = 'position:absolute;padding:8px 16px;font-size:14px;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:6px;cursor:pointer;pointer-events:auto;backdrop-filter:blur(4px);';
        el.addEventListener('click', onClick);
        container.appendChild(el);
        buttons.set(id, el);
      }
      el.textContent = label;
      const pos = opts.position ?? 'top-right';
      applyPosition(el, pos, opts.offset);
    },

    /** Remove a button */
    removeButton(id) {
      const el = buttons.get(id);
      if (el) { el.remove(); buttons.delete(id); }
    },

    /**
     * Create a panel with rows.
     * @param {string} id
     * @param {object} opts
     * @param {string} [opts.position='top-left']
     * @param {Array<{label:string,value:string}>} [opts.rows]
     */
    panel(id, opts = {}) {
      let el = panels.get(id);
      if (!el) {
        el = document.createElement('div');
        el.style.cssText = 'position:absolute;padding:10px 14px;background:rgba(0,0,0,.5);border-radius:8px;font-size:13px;line-height:1.6;backdrop-filter:blur(4px);';
        container.appendChild(el);
        panels.set(id, el);
      }
      const pos = opts.position ?? 'top-left';
      applyPosition(el, pos, opts.offset);

      if (opts.rows) {
        el.innerHTML = opts.rows.map(r =>
          `<div><span style="opacity:.6">${r.label}:</span> <span class="hud-val" data-key="${r.label}">${r.value}</span></div>`
        ).join('');
      }
      return el;
    },

    /** Update a panel row value */
    updatePanelRow(panelId, label, value) {
      const el = panels.get(panelId);
      if (!el) return;
      const span = el.querySelector(`[data-key="${label}"]`);
      if (span) span.textContent = String(value);
    },

    /** Remove a panel */
    removePanel(id) {
      const el = panels.get(id);
      if (el) { el.remove(); panels.delete(id); }
    },

    /** Show/hide entire HUD */
    setVisible(v) {
      container.style.display = v ? '' : 'none';
    },

    /** Clear everything */
    clear() {
      for (const [, el] of texts) el.remove();
      for (const [, el] of buttons) el.remove();
      for (const [, el] of panels) el.remove();
      texts.clear(); buttons.clear(); panels.clear();
    },

    destroy() {
      this.clear();
      container.remove();
    },
  };
}

function applyPosition(el, position, offset = {}) {
  const o = offset || {};
  const pad = o.pad ?? 10;
  el.style.top = ''; el.style.bottom = ''; el.style.left = ''; el.style.right = '';
  switch (position) {
    case 'top-left': el.style.top = pad + 'px'; el.style.left = pad + 'px'; break;
    case 'top-right': el.style.top = pad + 'px'; el.style.right = pad + 'px'; break;
    case 'top-center': el.style.top = pad + 'px'; el.style.left = '50%'; el.style.transform = 'translateX(-50%)'; break;
    case 'bottom-left': el.style.bottom = pad + 'px'; el.style.left = pad + 'px'; break;
    case 'bottom-right': el.style.bottom = pad + 'px'; el.style.right = pad + 'px'; break;
    case 'bottom-center': el.style.bottom = pad + 'px'; el.style.left = '50%'; el.style.transform = 'translateX(-50%)'; break;
    case 'center': el.style.top = '50%'; el.style.left = '50%'; el.style.transform = 'translate(-50%,-50%)'; break;
  }
}
