(function () {
  'use strict';

  const TRIGGER_SELECTOR = [
    'button[aria-label="Action menu"]',
    'button[aria-label="More actions"]',
    'button[aria-label*="more actions" i]',
    'button[aria-label*="action menu" i]',
    'ytd-menu-renderer yt-icon-button',
    'ytd-menu-renderer button',
    'yt-icon-button.dropdown-trigger',
    'yt-button-shape button[aria-haspopup="true"]',
    'button[aria-haspopup="menu"]',
    'button[aria-haspopup="true"]'
  ].join(', ');

  const MENU_ROOT_SELECTORS = [
    'ytd-menu-popup-renderer',
    'tp-yt-iron-dropdown',
    'yt-sheet-view-model'
  ];

  let lastTrigger = null;
  let pollTimer = null;

  function svg(paths, viewBox) {
    const ns = 'http://www.w3.org/2000/svg';
    const node = document.createElementNS(ns, 'svg');
    node.setAttribute('viewBox', viewBox || '0 0 24 24');
    node.setAttribute('focusable', 'false');
    node.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      node.appendChild(path);
    }
    return node;
  }

  const ICON_BLOCK = function () {
    return svg([
      'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.41 0 8 3.59 8 8 0 1.85-.63 3.55-1.69 4.9z'
    ]);
  };

  const ICON_UNBLOCK = function () {
    return svg([
      'M12 4c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8zm-1 11.5l-3.5-3.5 1.41-1.41L11 12.67l4.59-4.59L17 9.5 11 15.5z'
    ]);
  };

  const EXCLUDED_CONTENT = [
    'ytd-add-to-playlist-renderer',
    'ytd-playlist-add-to-option-renderer',
    'ytd-report-form-renderer',
    'ytd-multi-page-menu-renderer',
    'ytd-account-settings',
    'ytd-notification-multi-action-renderer',
    'tp-yt-paper-dialog'
  ].join(', ');

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const dropdown = el.closest('tp-yt-iron-dropdown');
    if (dropdown && dropdown.getAttribute('aria-hidden') === 'true') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  function findItemsContainer(menu) {
    if (!menu) return null;

    const listItem = menu.querySelector('yt-list-item-view-model, toggleable-list-item-view-model');
    if (listItem && listItem.parentElement) return listItem.parentElement;

    const listbox = menu.querySelector('tp-yt-paper-listbox');
    if (listbox && listbox.querySelector('tp-yt-paper-item, ytd-menu-service-item-renderer')) return listbox;

    const serviceItem = menu.querySelector('ytd-menu-service-item-renderer');
    if (serviceItem && serviceItem.parentElement) return serviceItem.parentElement;

    const paperItem = menu.querySelector('tp-yt-paper-item');
    if (paperItem && paperItem.parentElement) return paperItem.parentElement;

    return null;
  }

  function findOpenMenu() {
    const root = document.querySelector('ytd-popup-container') || document.body;
    if (!root) return null;

    for (const selector of MENU_ROOT_SELECTORS) {
      const nodes = root.querySelectorAll(selector);
      for (const node of nodes) {
        if (node.querySelector(EXCLUDED_CONTENT)) continue;
        if (!isVisible(node)) continue;
        if (findItemsContainer(node)) return node;
      }
    }
    return null;
  }

  function copyStyles(row, label, container) {
    const labelRef = container.querySelector('.ytListItemViewModelTitle, yt-formatted-string, .yt-core-attributed-string');
    if (labelRef) {
      const style = getComputedStyle(labelRef);
      row.style.color = style.color;
      label.style.fontFamily = style.fontFamily;
      label.style.fontSize = style.fontSize;
      label.style.fontWeight = style.fontWeight;
      label.style.color = style.color;
      label.style.lineHeight = style.lineHeight;
    }
    const itemRef = container.querySelector('tp-yt-paper-item, yt-list-item-view-model, toggleable-list-item-view-model');
    if (itemRef) {
      const style = getComputedStyle(itemRef);
      if (style.paddingLeft && style.paddingLeft !== '0px') row.style.paddingLeft = style.paddingLeft;
      if (style.paddingRight && style.paddingRight !== '0px') row.style.paddingRight = style.paddingRight;
      const height = parseFloat(style.height);
      if (height && height >= 24 && height <= 80) row.style.minHeight = style.height;
    }
  }

  function buildRow(label, kind, context, blockedEntry) {
    const row = document.createElement('div');
    row.className = 'ytb-menu-item';
    row.setAttribute('data-ytb-item', '');
    row.setAttribute('role', 'menuitem');
    row.setAttribute('tabindex', '0');

    const iconWrap = document.createElement('span');
    iconWrap.className = 'ytb-menu-item-icon';
    iconWrap.appendChild(blockedEntry ? ICON_UNBLOCK() : ICON_BLOCK());

    const text = document.createElement('span');
    text.className = 'ytb-menu-item-label';
    text.textContent = label;

    row.appendChild(iconWrap);
    row.appendChild(text);

    const activate = function (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (kind === 'channel') handleChannel(context.channel, blockedEntry);
      else handleVideo(context, blockedEntry);
      closeMenu();
    };

    row.addEventListener('click', activate, true);
    row.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') activate(event);
    });

    return row;
  }

  function closeMenu() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true })
    );
    setTimeout(function () {
      const menu = findOpenMenu();
      if (!menu) return;
      const dropdown = menu.closest('tp-yt-iron-dropdown') || menu;
      dropdown.style.opacity = '0';
      dropdown.style.pointerEvents = 'none';
      setTimeout(function () {
        dropdown.style.opacity = '';
        dropdown.style.pointerEvents = '';
      }, 250);
    }, 120);
  }

  function toast(message) {
    if (!globalThis.YTBState.get().settings.showFeedback) return;
    const existing = document.getElementById('ytb-toast');
    if (existing) existing.remove();
    const node = document.createElement('div');
    node.id = 'ytb-toast';
    node.textContent = message;
    document.documentElement.appendChild(node);
    setTimeout(function () {
      node.classList.add('ytb-toast-hide');
      setTimeout(function () { node.remove(); }, 300);
    }, 2400);
  }

  async function handleChannel(channel, blockedEntry) {
    if (!channel) return;
    if (blockedEntry) {
      await globalThis.YTBState.removeChannel(blockedEntry);
      toast('Channel unblocked');
    } else {
      await globalThis.YTBState.addChannel(channel);
      const name = channel.name || channel.handle || channel.id || 'channel';
      toast('Blocked channel: ' + name);
    }
    globalThis.YTBFilter.schedule();
  }

  async function handleVideo(context, blockedEntry) {
    if (!context || !context.videoId) return;
    if (blockedEntry) {
      await globalThis.YTBState.removeVideo(context.videoId);
      toast('Video unblocked');
    } else {
      await globalThis.YTBState.addVideo({
        videoId: context.videoId,
        title: context.title,
        channelName: context.channel ? context.channel.name : null
      });
      toast('Blocked video');
    }
    globalThis.YTBFilter.schedule();
  }

  function injectMenu(menu) {
    const container = findItemsContainer(menu);
    if (!container) return;

    container.querySelectorAll('[data-ytb-item]').forEach(function (node) {
      node.remove();
    });

    const card = lastTrigger ? globalThis.YTBCard.findContextCard(lastTrigger) : null;
    const context = card ? globalThis.YTBCard.extract(card) : null;
    if (!context) return;

    const channel = context.channel;
    const hasChannel = !!(channel && (channel.id || channel.handle || channel.name));
    const hasVideo = !!context.videoId;

    if (!hasChannel && !hasVideo) return;

    if (hasChannel) {
      const blocked = globalThis.YTBState.findBlockedChannel(channel);
      const row = buildRow(blocked ? 'Unblock Channel' : 'Block Channel', 'channel', context, blocked);
      container.appendChild(row);
      copyStyles(row, row.querySelector('.ytb-menu-item-label'), container);
    }

    if (hasVideo) {
      const blocked = globalThis.YTBState.findBlockedVideo(context.videoId);
      const row = buildRow(blocked ? 'Unblock Video' : 'Block Video', 'video', context, blocked);
      container.appendChild(row);
      copyStyles(row, row.querySelector('.ytb-menu-item-label'), container);
    }
  }

  function scheduleInject() {
    const started = Date.now();
    clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      const menu = findOpenMenu();
      if (menu) {
        clearInterval(pollTimer);
        injectMenu(menu);
        return;
      }
      if (Date.now() - started > 1500) clearInterval(pollTimer);
    }, 40);
  }

  function onDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest(TRIGGER_SELECTOR);
    if (!trigger) return;
    lastTrigger = trigger;
    scheduleInject();
  }

  function start() {
    document.addEventListener('click', onDocumentClick, true);
  }

  globalThis.YTBMenu = {
    start,
    scheduleInject,
    findOpenMenu,
    findItemsContainer,
    injectMenu
  };
})();
