(function () {
  'use strict';

  let button = null;

  function ensureButton() {
    if (button && button.isConnected) return button;
    button = document.createElement('button');
    button.id = 'ytb-channel-btn';
    button.type = 'button';
    button.addEventListener('click', onClick, true);
    (document.body || document.documentElement).appendChild(button);
    return button;
  }

  function removeButton() {
    if (!button) return;
    button.remove();
    button = null;
  }

  async function onClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const channel = globalThis.YTBCard.channelFromPage();
    if (!channel) return;

    const blocked = globalThis.YTBState.findBlockedChannel(channel);
    if (blocked) {
      await globalThis.YTBState.removeChannel(blocked);
      globalThis.YTBMenu.toast('Channel unblocked');
    } else {
      await globalThis.YTBState.addChannel(channel);
      const name = channel.name || channel.handle || channel.id || 'channel';
      globalThis.YTBMenu.toast('Blocked channel: ' + name);
    }
    globalThis.YTBFilter.schedule();
    update();
  }

  function update() {
    const enabled = globalThis.YTBState.get().settings.showChannelButton;
    const channel = enabled ? globalThis.YTBCard.channelFromPage() : null;
    if (!channel) {
      removeButton();
      return;
    }

    const el = ensureButton();
    const blocked = globalThis.YTBState.findBlockedChannel(channel);
    el.textContent = blocked ? 'Unblock channel' : 'Block channel';
    el.classList.toggle('ytb-channel-btn-blocked', !!blocked);
    el.title = channel.name || channel.handle || channel.id || '';
  }

  function start() {
    update();
    globalThis.YTBState.on(update);
    document.addEventListener('yt-navigate-finish', update);
    document.addEventListener('yt-page-data-updated', update);
    window.addEventListener('popstate', update);
    setInterval(update, 2000);
  }

  globalThis.YTBChannelButton = { start, update };
})();
