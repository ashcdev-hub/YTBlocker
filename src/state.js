(function () {
  'use strict';

  const KEY_CHANNELS = 'ytb_channels';
  const KEY_VIDEOS = 'ytb_videos';
  const KEY_SETTINGS = 'ytb_settings';

  const DEFAULT_SETTINGS = {
    hideBlocked: true,
    blockWatchPage: true,
    showFeedback: true
  };

  const state = {
    channels: [],
    videos: [],
    settings: { ...DEFAULT_SETTINGS }
  };

  const listeners = new Set();

  function normName(value) {
    return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function normHandle(value) {
    if (!value) return null;
    let text = String(value).trim().toLowerCase();
    text = text.replace(/^https?:\/\/(www\.)?youtube\.com/i, '');
    text = text.split(/[?#]/)[0];
    const match = text.match(/@([a-z0-9._-]+)/i);
    return match ? '@' + match[1].toLowerCase() : null;
  }

  function channelKey(entry) {
    if (!entry) return null;
    if (entry.id) return 'id:' + entry.id;
    if (entry.handle) return 'handle:' + entry.handle;
    if (entry.name) return 'name:' + normName(entry.name);
    return null;
  }

  function emit() {
    listeners.forEach(function (fn) {
      try {
        fn(state);
      } catch (err) {
        console.error('[YTBlocker] listener failed', err);
      }
    });
  }

  async function load() {
    const data = await chrome.storage.local.get({
      [KEY_CHANNELS]: [],
      [KEY_VIDEOS]: [],
      [KEY_SETTINGS]: { ...DEFAULT_SETTINGS }
    });
    state.channels = Array.isArray(data[KEY_CHANNELS]) ? data[KEY_CHANNELS] : [];
    state.videos = Array.isArray(data[KEY_VIDEOS]) ? data[KEY_VIDEOS] : [];
    state.settings = { ...DEFAULT_SETTINGS, ...(data[KEY_SETTINGS] || {}) };
    emit();
    return state;
  }

  function on(fn) {
    listeners.add(fn);
    return function () {
      listeners.delete(fn);
    };
  }

  function get() {
    return state;
  }

  async function addChannel(info) {
    if (!info) return null;
    const id = info.id || null;
    const handle = normHandle(info.handle);
    const name = info.name ? String(info.name).trim() : null;
    if (!id && !handle && !name) return null;

    let entry = state.channels.find(function (c) {
      return (
        (id && c.id === id) ||
        (handle && normHandle(c.handle) === handle) ||
        (name && c.name && normName(c.name) === normName(name))
      );
    });

    if (entry) {
      if (id && !entry.id) entry.id = id;
      if (handle && !entry.handle) entry.handle = handle;
      if (name && !entry.name) entry.name = name;
    } else {
      entry = { id, handle, name, addedAt: Date.now() };
      state.channels.push(entry);
    }
    entry.key = channelKey(entry);
    entry.addedAt = entry.addedAt || Date.now();

    await chrome.storage.local.set({ [KEY_CHANNELS]: state.channels });
    emit();
    return entry;
  }

  async function removeChannel(entry) {
    if (!entry) return;
    const key = entry.key || channelKey(entry);
    const index = state.channels.findIndex(function (c) {
      if (key && (c.key === key || channelKey(c) === key)) return true;
      return c === entry;
    });
    if (index >= 0) state.channels.splice(index, 1);
    await chrome.storage.local.set({ [KEY_CHANNELS]: state.channels });
    emit();
  }

  async function addVideo(info) {
    if (!info || !info.videoId) return null;
    let entry = state.videos.find(function (v) {
      return v.videoId === info.videoId;
    });
    if (entry) {
      if (info.title && !entry.title) entry.title = info.title;
      if (info.channelName && !entry.channelName) entry.channelName = info.channelName;
    } else {
      entry = {
        videoId: info.videoId,
        title: info.title || null,
        channelName: info.channelName || null,
        addedAt: Date.now()
      };
      state.videos.push(entry);
    }
    await chrome.storage.local.set({ [KEY_VIDEOS]: state.videos });
    emit();
    return entry;
  }

  async function removeVideo(videoId) {
    const index = state.videos.findIndex(function (v) {
      return v.videoId === videoId;
    });
    if (index >= 0) state.videos.splice(index, 1);
    await chrome.storage.local.set({ [KEY_VIDEOS]: state.videos });
    emit();
  }

  function findBlockedChannel(info) {
    if (!info) return null;
    const id = info.id || null;
    const handle = normHandle(info.handle);
    const name = info.name ? normName(info.name) : null;

    if (id) {
      const byId = state.channels.find(function (c) {
        return c.id === id;
      });
      if (byId) return byId;
    }
    if (handle) {
      const byHandle = state.channels.find(function (c) {
        return normHandle(c.handle) === handle;
      });
      if (byHandle) return byHandle;
    }
    if (name) {
      const byName = state.channels.find(function (c) {
        return c.name && normName(c.name) === name;
      });
      if (byName) return byName;
    }
    return null;
  }

  function findBlockedVideo(videoId) {
    if (!videoId) return null;
    return (
      state.videos.find(function (v) {
        return v.videoId === videoId;
      }) || null
    );
  }

  async function setSettings(partial) {
    state.settings = { ...state.settings, ...partial };
    await chrome.storage.local.set({ [KEY_SETTINGS]: state.settings });
    emit();
  }

  async function importData(payload) {
    if (!payload || typeof payload !== 'object') return false;
    const channels = Array.isArray(payload.channels) ? payload.channels : [];
    const videos = Array.isArray(payload.videos) ? payload.videos : [];
    state.channels = channels
      .map(function (c) {
        return {
          id: c.id || null,
          handle: normHandle(c.handle),
          name: c.name || null,
          addedAt: c.addedAt || Date.now()
        };
      })
      .filter(function (c) {
        return c.id || c.handle || c.name;
      });
    state.channels.forEach(function (c) {
      c.key = channelKey(c);
    });
    state.videos = videos
      .map(function (v) {
        return {
          videoId: v.videoId,
          title: v.title || null,
          channelName: v.channelName || null,
          addedAt: v.addedAt || Date.now()
        };
      })
      .filter(function (v) {
        return !!v.videoId;
      });
    await chrome.storage.local.set({
      [KEY_CHANNELS]: state.channels,
      [KEY_VIDEOS]: state.videos
    });
    emit();
    return true;
  }

  async function clearAll() {
    state.channels = [];
    state.videos = [];
    await chrome.storage.local.set({
      [KEY_CHANNELS]: [],
      [KEY_VIDEOS]: []
    });
    emit();
  }

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      let changed = false;
      if (changes[KEY_CHANNELS]) {
        state.channels = changes[KEY_CHANNELS].newValue || [];
        changed = true;
      }
      if (changes[KEY_VIDEOS]) {
        state.videos = changes[KEY_VIDEOS].newValue || [];
        changed = true;
      }
      if (changes[KEY_SETTINGS]) {
        state.settings = { ...DEFAULT_SETTINGS, ...(changes[KEY_SETTINGS].newValue || {}) };
        changed = true;
      }
      if (changed) emit();
    });
  }

  globalThis.YTBState = {
    DEFAULT_SETTINGS,
    load,
    on,
    get,
    addChannel,
    removeChannel,
    addVideo,
    removeVideo,
    findBlockedChannel,
    findBlockedVideo,
    setSettings,
    importData,
    clearAll,
    normalizeHandle: normHandle,
    normalizeName: normName
  };
})();
