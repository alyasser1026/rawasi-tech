import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('Optimized hero background video and WebP poster exist within web performance budgets', () => {
  const videoPath = path.join(root, 'public/brand/hero-bg.mp4');
  const posterPath = path.join(root, 'public/brand/hero-video-poster.webp');

  assert.equal(fs.existsSync(videoPath), true, 'public/brand/hero-bg.mp4 must exist');
  assert.equal(fs.existsSync(posterPath), true, 'public/brand/hero-video-poster.webp must exist');

  const videoSizeMb = fs.statSync(videoPath).size / (1024 * 1024);
  const posterSizeKb = fs.statSync(posterPath).size / 1024;

  assert.ok(videoSizeMb > 0.5 && videoSizeMb < 25, `hero-bg.mp4 size should be 0.5-25 MB (got ${videoSizeMb.toFixed(2)} MB)`);
  assert.ok(posterSizeKb > 5 && posterSizeKb < 300, `hero-video-poster.webp should be 5-300 KB (got ${posterSizeKb.toFixed(1)} KB)`);
});

test('HeroVideoBackdrop provides seamless muted autoplay, reduced-motion support, and interactive HUD controls', () => {
  const src = read('components/HeroVideoBackdrop.tsx');
  assert.match(src, /\/brand\/hero-bg\.mp4/);
  assert.match(src, /\/brand\/hero-video-poster\.webp/);
  assert.match(src, /playsInline/);
  assert.match(src, /autoPlay/);
  assert.match(src, /loop/);
  assert.match(src, /prefers-reduced-motion:\s*reduce/);
  assert.match(src, /toggleMute/);
  assert.match(src, /togglePlay/);
  assert.match(src, /@media print/);
});

test('Public site (/) and portal (/website) both mount HeroVideoBackdrop cleanly', () => {
  const phiSite = read('app/site/PhiSite.tsx');
  const websitePage = read('app/website/page.tsx');
  const siteStyles = read('app/site/site-styles.ts');

  assert.match(phiSite, /HeroVideoBackdrop/);
  assert.match(phiSite, /HeroVideoControls/);
  assert.match(phiSite, /variant="showcase-left"/);

  assert.match(websitePage, /HeroVideoBackdrop/);
  assert.match(websitePage, /tone=\{themeMode\}/);

  assert.doesNotMatch(siteStyles, /url\('\/brand\/hero-bg\.webp'\)/);
  assert.match(siteStyles, /\.pw-hero-toolbar/);
  assert.match(siteStyles, /body:has\(\.pw\)\{padding:0!important\}/);
  assert.match(siteStyles, /\.pw main#top\{padding:0!important/);
  assert.match(siteStyles, /backdrop-filter:blur\(16px\)/);
});

test('Mobile hero starts with video first and scales typography smoothly without orphan words', () => {
  const phiSite = read('app/site/PhiSite.tsx');
  const siteStyles = read('app/site/site-styles.ts');

  // Verify headline phrase grouping
  assert.match(phiSite, /pw-hero-part/);
  assert.match(phiSite, /id="hero-content"/);
  assert.match(phiSite, /pw-mobile-scroll-cue/);

  // Verify desktop typography styling
  assert.match(siteStyles, /\.pw-hero h1\{font-size:clamp\(1\.9rem/);
  assert.match(siteStyles, /\.pw-hero-part\{display:inline-block/);

  // Verify mobile video-first order and dimensions
  assert.match(siteStyles, /\.pw-hero\{display:flex;flex-direction:column/);
  assert.match(siteStyles, /\.pw-hero \.phi-hb\{[^\}]*order:0/);
  assert.match(siteStyles, /\.pw-hero \.phi-hb\{[^\}]*height:clamp\(300px/);
  assert.match(siteStyles, /\.pw-hero-grid\{[^\}]*order:2/);
  assert.match(siteStyles, /\.pw-mobile-scroll-cue/);
});

