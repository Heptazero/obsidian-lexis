import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadSource(href = 'https://www.youtube.com/watch?v=abc') {
  const context = {
    URL, location: { href }, document: { title: "Video title" },
    LexisWebDom: { parentAcross: (element) => element.parentElement },
  };
  vm.runInNewContext(await readFile("pkg/browser-extension/content-source.js", "utf8"), context);
  return context.LexisWebSource;
}
function element(attributes = {}, parentElement = null) {
  return { nodeType: 1, parentElement, hasAttribute: (name) => name in attributes, getAttribute: (name) => attributes[name] };
}

test("video timestamp links replace old time and preserve video, playlist and part", async () => {
  const source = await loadSource();
  const youtube = source.timedSource('https://www.youtube.com/watch?v=abc&list=xyz&t=9&start=10#t=1m', 'Title', 83.8);
  assert.equal(youtube.url, 'https://www.youtube.com/watch?v=abc&list=xyz&t=83');
  assert.equal(youtube.title, 'Title · 01:23');
  assert.equal(new URL(source.timedSource('https://www.bilibili.com/video/BVabc?p=3&t=9', 'Title', 4000).url).search, '?p=3&t=4000');
  assert.equal(source.timedSource('https://youtu.be/abc', 'Title', 0).url, 'https://youtu.be/abc?t=0');
  assert.equal(source.timestamp(4000), '1:06:40');
});

test("ordinary pages and invalid times remain unchanged; unknown video platforms retain a readable timestamp", async () => {
  const source = await loadSource();
  for (const time of [null, undefined, '', NaN, Infinity, -1]) {
    assert.equal(source.timedSource('https://example.com/a', 'Article', time).url, 'https://example.com/a');
    assert.equal(source.timedSource('https://example.com/a', 'Article', time).title, 'Article');
  }
  const unknown = source.timedSource('https://example.com/video?part=2', 'Video', 15);
  assert.equal(unknown.url, 'https://example.com/video?part=2');
  assert.equal(unknown.title, 'Video · 00:15');
});

test("transcript source uses cue start rather than current playback time", async () => {
  const source = await loadSource();
  const row = element({ 'data-start-ms': '12000' });
  const text = { nodeType: 3, parentElement: element({}, row) };
  assert.equal(new URL(source.capture(text).url).searchParams.get('t'), '12');
  row.getAttribute = () => '0';
  assert.equal(new URL(source.capture(text).url).searchParams.get('t'), '0');
});

test("screen source uses only its own unique player and freezes time in plain source data", async () => {
  const source = await loadSource();
  const video = { currentTime: 83 };
  const player = element();
  player.querySelectorAll = () => [video];
  const host = element({ 'data-video-marker-lab-subtitles': '' }, player);
  const saved = source.capture(element({}, host));
  video.currentTime = 150;
  assert.equal(new URL(saved.url).searchParams.get('t'), '83');
  assert.equal(new URL(source.capture(element({}, host)).url).searchParams.get('t'), '150');
  player.querySelectorAll = () => [video, { currentTime: 5 }];
  assert.equal(source.capture(element({}, host)).title, 'Video title');
});
