(function () {
  'use strict';

  const CARD_SELECTORS = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-playlist-panel-video-renderer',
    'ytd-reel-item-renderer',
    'ytd-reel-video-renderer',
    'ytd-end-screen-video-renderer',
    'ytd-movie-renderer',
    'ytd-compact-movie-renderer',
    'ytd-post-renderer',
    'yt-lockup-view-model',
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',
    'ytd-watch-metadata'
  ];

  const CARD_SELECTOR = CARD_SELECTORS.join(', ');

  const HIDE_ANCESTORS = [
    'ytd-rich-item-renderer',
    'ytd-rich-grid-media',
    'ytd-rich-grid-slim-media'
  ];

  const CHANNEL_HEADER_SELECTORS = [
    'ytd-c4-tabbed-header-renderer',
    'ytd-interactive-tabbed-header-renderer',
    'ytd-channel-header-renderer',
    'yt-page-header-renderer',
    'yt-page-header-view-model'
  ];

  const CHANNEL_HEADER_SELECTOR = CHANNEL_HEADER_SELECTORS.join(', ');

  const CHANNEL_LINK_SELECTORS = [
    '#owner #channel-name a',
    'ytd-video-owner-renderer #channel-name a',
    'ytd-video-owner-renderer a[href^="/channel/"]',
    '#channel-name a',
    'ytd-channel-name a',
    '#channel-info a',
    '.yt-content-metadata-view-model__metadata-row a[href^="/@"]',
    'yt-content-metadata-view-model a[href^="/@"]',
    '.shortsLockupViewModelHostMetadataSubhead a',
    '.shortsLockupViewModelHostMetadataTitle a',
    '#header #channel-name a',
    'yt-page-header-view-model a[href^="/@"]',
    'a#avatar-link',
    'a#owner'
  ];

  const VIDEO_HREF_RE = /(?:[?&]v=|\/shorts\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{11})/;

  function cleanName(text) {
    return (text || '')
      .replace(/\s+/g, ' ')
      .replace(/^(go to channel|visit channel|channel)\s*/i, '')
      .trim();
  }

  function channelFromAnchor(anchor) {
    if (!anchor) return null;
    const href = anchor.getAttribute('href') || '';
    let id = null;
    let handle = null;

    if (href.startsWith('/channel/')) {
      id = href.slice('/channel/'.length).split(/[/?#]/)[0] || null;
    } else if (href.startsWith('/@')) {
      handle = href.slice(1).split(/[/?#]/)[0] || null;
    } else if (href.startsWith('/c/') || href.startsWith('/user/')) {
      const raw = href.split('/')[2] || '';
      handle = raw ? '@' + raw : null;
    } else {
      return null;
    }

    const name = cleanName(anchor.getAttribute('aria-label') || anchor.textContent);
    if (!id && !handle) return null;
    return { id, handle: handle ? globalThis.YTBState.normalizeHandle(handle) : null, name: name || null };
  }

  function extractChannel(card) {
    const candidates = [];
    for (const selector of CHANNEL_LINK_SELECTORS) {
      const nodes = card.querySelectorAll(selector);
      for (const node of nodes) {
        const info = channelFromAnchor(node);
        if (info) candidates.push(info);
      }
      if (candidates.some(function (c) { return c.name && (c.id || c.handle); })) break;
      if (candidates.length >= 4) break;
    }

    if (!candidates.length) {
      const anchors = card.querySelectorAll('a[href^="/@"], a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]');
      for (const anchor of anchors) {
        const info = channelFromAnchor(anchor);
        if (info) candidates.push(info);
        if (candidates.length >= 4) break;
      }
    }

    if (!candidates.length) return null;

    const merged = { id: null, handle: null, name: null };
    for (const candidate of candidates) {
      if (!merged.id && candidate.id) merged.id = candidate.id;
      if (!merged.handle && candidate.handle) merged.handle = candidate.handle;
      if (!merged.name && candidate.name) merged.name = candidate.name;
    }
    return merged;
  }

  function extractVideoId(card) {
    const anchors = card.querySelectorAll('a[href*="/watch"], a[href*="/shorts/"], a[href*="/live/"], a[href*="/embed/"]');
    for (const anchor of anchors) {
      const match = (anchor.getAttribute('href') || '').match(VIDEO_HREF_RE);
      if (match) return match[1];
    }
    return null;
  }

  function extractTitle(card) {
    const node = card.querySelector(
      '#video-title, a#video-title-link, yt-formatted-string#video-title, ytd-watch-metadata h1 yt-formatted-string, h1.ytd-watch-metadata, .yt-lockup-metadata-view-model__title, h3 a, .shortsLockupViewModelHostMetadataTitle'
    );
    if (!node) return null;
    const text = (node.getAttribute('title') || node.textContent || '').replace(/\s+/g, ' ').trim();
    return text || null;
  }

  function watchVideoId() {
    if (location.pathname === '/watch') {
      return new URLSearchParams(location.search).get('v');
    }
    const shorts = location.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
    if (shorts) return shorts[1];
    return null;
  }

  function findContextCard(trigger) {
    if (!trigger || !trigger.closest) return null;
    const card = trigger.closest(CARD_SELECTOR);
    if (card) return card;
    const header = trigger.closest(CHANNEL_HEADER_SELECTOR);
    if (header) return header;
    return null;
  }

  function extract(card) {
    if (!card) return null;
    const isWatch = card.localName === 'ytd-watch-metadata';
    let videoId = isWatch ? watchVideoId() : null;
    if (!videoId) videoId = extractVideoId(card);
    return {
      videoId: videoId || null,
      title: extractTitle(card),
      channel: extractChannel(card),
      isWatch,
      isHeader: CHANNEL_HEADER_SELECTORS.indexOf(card.localName) >= 0
    };
  }

  function hideTarget(card) {
    if (!card) return null;
    for (const selector of HIDE_ANCESTORS) {
      const ancestor = card.closest(selector);
      if (ancestor) return ancestor;
    }
    return card;
  }

  function isNested(card) {
    if (!card.parentElement) return false;
    return !!card.parentElement.closest(CARD_SELECTOR);
  }

  globalThis.YTBCard = {
    CARD_SELECTORS,
    CARD_SELECTOR,
    CHANNEL_HEADER_SELECTOR,
    findContextCard,
    extract,
    extractChannel,
    extractVideoId,
    extractTitle,
    hideTarget,
    isNested,
    watchVideoId
  };
})();
