(function () {
  'use strict';

  let scheduled = false;
  let lastOverlayKey = null;

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      run();
    }, 90);
  }

  function clearHidden() {
    document.querySelectorAll('[data-ytb-hidden]').forEach(function (node) {
      node.removeAttribute('data-ytb-hidden');
      node.removeAttribute('data-ytb-sig');
    });
  }

  function isBlocked(context) {
    if (!context) return false;
    if (context.videoId && globalThis.YTBState.findBlockedVideo(context.videoId)) return true;
    return !!globalThis.YTBState.findBlockedChannel(context.channel);
  }

  function outermost(card) {
    let current = card;
    while (current.parentElement) {
      const ancestor = current.parentElement.closest(globalThis.YTBCard.CARD_SELECTOR);
      if (!ancestor) break;
      current = ancestor;
    }
    return current;
  }

  function signatureOf(context) {
    if (!context) return null;
    const channel = context.channel || {};
    const key = channel.id || channel.handle || channel.name || '';
    if (!context.videoId && !key) return null;
    return (context.videoId || '') + '|' + key;
  }

  function evaluateCard(card, useCache) {
    if (!card || card.localName === 'ytd-watch-metadata') return;
    const target = globalThis.YTBCard.hideTarget(card);
    if (!target) return;
    if (!globalThis.YTBState.get().settings.hideBlocked) {
      target.removeAttribute('data-ytb-hidden');
      target.removeAttribute('data-ytb-sig');
      return;
    }
    const context = globalThis.YTBCard.extract(card);
    const signature = signatureOf(context);
    if (useCache && signature && target.getAttribute('data-ytb-sig') === signature) return;
    if (signature) target.setAttribute('data-ytb-sig', signature);
    else target.removeAttribute('data-ytb-sig');
    if (isBlocked(context)) target.setAttribute('data-ytb-hidden', '');
    else target.removeAttribute('data-ytb-hidden');
  }

  function cardsIn(node) {
    const targets = new Set();
    if (!node || node.nodeType !== 1) return targets;
    if (node.matches && node.matches(globalThis.YTBCard.CARD_SELECTOR)) targets.add(outermost(node));
    if (node.closest) {
      const ancestor = node.closest(globalThis.YTBCard.CARD_SELECTOR);
      if (ancestor) targets.add(outermost(ancestor));
    }
    if (node.querySelectorAll) {
      node.querySelectorAll(globalThis.YTBCard.CARD_SELECTOR).forEach(function (child) {
        targets.add(outermost(child));
      });
    }
    return targets;
  }

  function processNode(node) {
    try {
      cardsIn(node).forEach(function (card) {
        evaluateCard(card, true);
      });
    } catch (err) {
      console.error('[YTBlocker] filter failed', err);
    }
  }

  function runListing() {
    if (!globalThis.YTBState.get().settings.hideBlocked) {
      clearHidden();
      return;
    }
    const targets = new Set();
    document.querySelectorAll(globalThis.YTBCard.CARD_SELECTOR).forEach(function (card) {
      targets.add(outermost(card));
    });
    targets.forEach(function (card) {
      evaluateCard(card, false);
    });
  }

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'ytb-overlay';

    const card = document.createElement('div');
    card.className = 'ytb-overlay-card';

    const title = document.createElement('h1');
    title.className = 'ytb-overlay-title';
    title.id = 'ytb-overlay-title';

    const message = document.createElement('p');
    message.className = 'ytb-overlay-message';
    message.id = 'ytb-overlay-message';

    const actions = document.createElement('div');
    actions.className = 'ytb-overlay-actions';

    const homeBtn = document.createElement('button');
    homeBtn.className = 'ytb-overlay-btn';
    homeBtn.textContent = 'Back to home';
    homeBtn.addEventListener('click', function () {
      location.href = 'https://www.youtube.com/';
    });

    const unblockBtn = document.createElement('button');
    unblockBtn.className = 'ytb-overlay-btn ytb-overlay-btn-primary';
    unblockBtn.textContent = 'Unblock';
    unblockBtn.addEventListener('click', async function () {
      const info = overlay.__ytbInfo;
      if (!info) return;
      if (info.videoId) await globalThis.YTBState.removeVideo(info.videoId);
      else if (info.channel) await globalThis.YTBState.removeChannel(info.blockedChannel);
      run();
    });

    actions.appendChild(homeBtn);
    actions.appendChild(unblockBtn);
    card.appendChild(title);
    card.appendChild(message);
    card.appendChild(actions);
    overlay.appendChild(card);
    return overlay;
  }

  function getOverlay() {
    let overlay = document.getElementById('ytb-overlay');
    if (!overlay) {
      overlay = buildOverlay();
      (document.body || document.documentElement).appendChild(overlay);
    }
    return overlay;
  }

  function removeOverlay() {
    const overlay = document.getElementById('ytb-overlay');
    if (overlay) overlay.remove();
    lastOverlayKey = null;
  }

  function channelFromPlayerContext() {
    const metadata = document.querySelector('ytd-watch-metadata');
    if (metadata) return globalThis.YTBCard.extractChannel(metadata);

    const activeReel =
      document.querySelector('ytd-reel-video-renderer[is-active]') ||
      document.querySelector('ytd-reel-video-renderer[active]') ||
      document.querySelector('ytd-shorts ytd-reel-video-renderer:not([hidden])');
    if (activeReel) {
      const info = globalThis.YTBCard.extractChannel(activeReel);
      if (info) return info;
    }

    const header = document.querySelector('ytd-reel-player-header-renderer');
    if (header) return globalThis.YTBCard.extractChannel(header);

    return null;
  }

  function runOverlay() {
    const settings = globalThis.YTBState.get().settings;
    const path = location.pathname;

    let videoId = null;
    if (path === '/watch') videoId = new URLSearchParams(location.search).get('v');
    else {
      const shorts = path.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
      if (shorts) videoId = shorts[1];
    }

    if (!settings.blockWatchPage || !videoId) {
      removeOverlay();
      return;
    }

    const blockedVideo = globalThis.YTBState.findBlockedVideo(videoId);
    const channel = channelFromPlayerContext();
    const blockedChannel = globalThis.YTBState.findBlockedChannel(channel);

    if (!blockedVideo && !blockedChannel) {
      removeOverlay();
      return;
    }

    const overlay = getOverlay();
    const key = (blockedVideo ? 'v:' + videoId : '') + (blockedChannel ? 'c:' + (blockedChannel.key || '') : '');
    if (key !== lastOverlayKey) {
      lastOverlayKey = key;
      overlay.__ytbInfo = {
        videoId: blockedVideo ? videoId : null,
        channel,
        blockedChannel
      };
      overlay.querySelector('#ytb-overlay-title').textContent = blockedVideo ? 'Video blocked' : 'Channel blocked';
      overlay.querySelector('#ytb-overlay-message').textContent = blockedVideo
        ? 'You blocked this video in YTBlocker.'
        : 'You blocked this channel in YTBlocker.';
      const unblock = overlay.querySelector('.ytb-overlay-btn-primary');
      unblock.textContent = blockedVideo ? 'Unblock video' : 'Unblock channel';
    }

    overlay.style.display = 'flex';
    const player = document.querySelector('video');
    if (player && !player.paused) player.pause();
  }

  function run() {
    runListing();
    runOverlay();
  }

  globalThis.YTBFilter = {
    schedule,
    run,
    processNode
  };
})();
