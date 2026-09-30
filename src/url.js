(function () {
  'use strict';

  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const HANDLE_RE = /^@[A-Za-z0-9._-]+$/;
  const BARE_ID_RE = /^UC[A-Za-z0-9_-]{20,}$/;

  function video(id) {
    return id && VIDEO_ID_RE.test(id) ? { type: 'video', videoId: id } : null;
  }

  function parseBare(text) {
    if (BARE_ID_RE.test(text)) return { type: 'channel', id: text, handle: null, name: null };
    if (HANDLE_RE.test(text)) return { type: 'channel', id: null, handle: text, name: null };
    const asVideo = video(text);
    return asVideo;
  }

  function parse(input) {
    const text = String(input || '').trim();
    if (!text) return null;

    let url;
    try {
      url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text);
    } catch (err) {
      return parseBare(text);
    }

    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'youtu.be') {
      return video(url.pathname.slice(1).split('/')[0]);
    }
    if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'music.youtube.com') {
      return parseBare(text);
    }

    const fromQuery = video(url.searchParams.get('v'));
    if (fromQuery) return fromQuery;

    let match = url.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})/);
    if (match) return { type: 'video', videoId: match[1] };

    match = url.pathname.match(/^\/channel\/([A-Za-z0-9_-]+)/);
    if (match) return { type: 'channel', id: match[1], handle: null, name: null };

    match = url.pathname.match(/^\/(?:c|user)\/([^/]+)/);
    if (match) return { type: 'channel', id: null, handle: '@' + decodeURIComponent(match[1]), name: null };

    match = url.pathname.match(/^\/@([^/]+)/);
    if (match) return { type: 'channel', id: null, handle: '@' + decodeURIComponent(match[1]), name: null };

    return null;
  }

  globalThis.YTBUrl = { parse };
})();
