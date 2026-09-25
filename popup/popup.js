(function () {
  'use strict';

  const listEl = document.getElementById('list');
  const countsEl = document.getElementById('counts');
  const searchEl = document.getElementById('search');
  const tabs = Array.from(document.querySelectorAll('.tab'));

  let activeTab = 'channels';
  let query = '';

  function ellipsis(text, max) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function channelLabel(entry) {
    return entry.name || entry.handle || entry.id || 'Unknown channel';
  }

  function channelSub(entry) {
    const parts = [];
    if (entry.handle && entry.name) parts.push(entry.handle);
    if (entry.id) parts.push(entry.id);
    return parts.join(' · ') || 'Blocked by name';
  }

  function renderRow(title, sub, onRemove) {
    const row = document.createElement('div');
    row.className = 'row';

    const main = document.createElement('div');
    main.className = 'row-main';

    const titleEl = document.createElement('div');
    titleEl.className = 'row-title';
    titleEl.textContent = title;
    titleEl.title = title;

    const subEl = document.createElement('div');
    subEl.className = 'row-sub';
    subEl.textContent = sub;
    subEl.title = sub;

    main.appendChild(titleEl);
    main.appendChild(subEl);

    const remove = document.createElement('button');
    remove.className = 'row-remove';
    remove.textContent = 'Remove';
    remove.addEventListener('click', onRemove);

    row.appendChild(main);
    row.appendChild(remove);
    return row;
  }

  function renderEmpty(message) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = message;
    listEl.appendChild(empty);
  }

  function render() {
    const state = globalThis.YTBState.get();
    const needle = query.trim().toLowerCase();

    countsEl.textContent = state.channels.length + ' channels · ' + state.videos.length + ' videos';
    listEl.textContent = '';

    if (activeTab === 'channels') {
      const items = state.channels.filter(function (c) {
        if (!needle) return true;
        return [c.name, c.handle, c.id].filter(Boolean).join(' ').toLowerCase().includes(needle);
      });
      if (!items.length) {
        renderEmpty(state.channels.length ? 'No channels match your search.' : 'No blocked channels yet. Use the ⋮ menu on any video to block one.');
        return;
      }
      items.forEach(function (entry) {
        listEl.appendChild(
          renderRow(ellipsis(channelLabel(entry), 46), ellipsis(channelSub(entry), 60), async function () {
            await globalThis.YTBState.removeChannel(entry);
          })
        );
      });
      return;
    }

    const videos = state.videos.filter(function (v) {
      if (!needle) return true;
      return [v.title, v.channelName, v.videoId].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
    if (!videos.length) {
      renderEmpty(state.videos.length ? 'No videos match your search.' : 'No blocked videos yet. Use the ⋮ menu on any video to block one.');
      return;
    }
    videos.forEach(function (entry) {
      const title = entry.title || 'Video ' + entry.videoId;
      const sub = [entry.channelName, entry.videoId].filter(Boolean).join(' · ');
      listEl.appendChild(
        renderRow(ellipsis(title, 46), ellipsis(sub, 60), async function () {
          await globalThis.YTBState.removeVideo(entry.videoId);
        })
      );
    });
  }

  function bindTabs() {
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activeTab = tab.dataset.tab;
        tabs.forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
        });
        render();
      });
    });
  }

  function bindSettings() {
    const hide = document.getElementById('opt-hide');
    const watch = document.getElementById('opt-watch');
    const feedback = document.getElementById('opt-feedback');

    hide.addEventListener('change', function () {
      globalThis.YTBState.setSettings({ hideBlocked: hide.checked });
    });
    watch.addEventListener('change', function () {
      globalThis.YTBState.setSettings({ blockWatchPage: watch.checked });
    });
    feedback.addEventListener('change', function () {
      globalThis.YTBState.setSettings({ showFeedback: feedback.checked });
    });
  }

  function syncSettings() {
    const settings = globalThis.YTBState.get().settings;
    document.getElementById('opt-hide').checked = settings.hideBlocked;
    document.getElementById('opt-watch').checked = settings.blockWatchPage;
    document.getElementById('opt-feedback').checked = settings.showFeedback;
  }

  function bindFooter() {
    document.getElementById('btn-export').addEventListener('click', function () {
      const state = globalThis.YTBState.get();
      const payload = JSON.stringify(
        { version: 1, channels: state.channels, videos: state.videos },
        null,
        2
      );
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ytblocker-blocklist.json';
      link.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
    });

    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-import').addEventListener('click', function () {
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function () {
        try {
          const payload = JSON.parse(String(reader.result));
          await globalThis.YTBState.importData(payload);
        } catch (err) {
          console.error('[YTBlocker] import failed', err);
        }
        fileInput.value = '';
      };
      reader.readAsText(file);
    });

    document.getElementById('btn-clear').addEventListener('click', async function () {
      if (!window.confirm('Remove every blocked channel and video?')) return;
      await globalThis.YTBState.clearAll();
    });
  }

  async function init() {
    bindTabs();
    bindSettings();
    bindFooter();
    searchEl.addEventListener('input', function () {
      query = searchEl.value;
      render();
    });
    globalThis.YTBState.on(function () {
      render();
    });
    await globalThis.YTBState.load();
    syncSettings();
    render();
  }

  init();
})();
