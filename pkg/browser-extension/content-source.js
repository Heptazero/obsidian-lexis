"use strict";

globalThis.LexisWebSource = (() => {
  function seconds(value) {
    const number = Number(value);
    return value != null && value !== "" && Number.isFinite(number) && number >= 0 ? number : null;
  }
  function timestamp(value) {
    const total = Math.floor(value);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total % 3600 / 60);
    const last = String(total % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${last}` : `${String(minutes).padStart(2, "0")}:${last}`;
  }
  function timedSource(href, title, time) {
    const value = seconds(time);
    if (value === null) return { url: href, title };
    const url = new URL(href);
    const youtube = /(^|\.)youtube\.com$/.test(url.hostname) || url.hostname === "youtu.be";
    const bilibili = /(^|\.)bilibili\.com$/.test(url.hostname);
    if (youtube || bilibili) {
      // Preserve video identity, playlist and Bilibili part; replace only the old time.
      url.searchParams.delete("start");
      if (/^#t=/.test(url.hash)) url.hash = "";
      url.searchParams.set("t", String(Math.floor(value)));
    }
    return { url: url.href, title: `${title || href} · ${timestamp(value)}` };
  }
  function capture(node) {
    let time = null, subtitleHost = null;
    let element = node?.nodeType === 1 ? node : node?.parentElement;
    while (element) {
      if (time === null && element.hasAttribute("data-start-ms")) {
        const start = seconds(element.getAttribute("data-start-ms"));
        if (start !== null) time = start / 1000;
      }
      if (element.hasAttribute("data-video-marker-lab-subtitles")) subtitleHost = element;
      element = LexisWebDom.parentAcross(element);
    }
    if (time === null && subtitleHost) {
      // Use this overlay's player, not the first video elsewhere on the page.
      let container = subtitleHost.parentElement;
      while (container) {
        const videos = container.querySelectorAll("video");
        if (videos.length === 1) { time = seconds(videos[0].currentTime); break; }
        if (videos.length > 1) break;
        container = container.parentElement;
      }
    }
    return timedSource(location.href, document.title, time);
  }
  return { capture, timedSource, timestamp };
})();
