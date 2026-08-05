import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const landingUrl = new URL('../../site/index.html', import.meta.url);
const readLanding = () => readFile(landingUrl, 'utf8');

test('phone navigation uses an accessible hamburger drawer and compact hero', async () => {
  const html = await readLanding();

  assert.match(
    html,
    /<button class="menu-toggle" type="button" id="menuToggle" aria-label="Abrir menú" aria-controls="mobileMenu" aria-expanded="false">/,
  );
  assert.match(html, /<div class="mobile-menu" id="mobileMenu" role="navigation" aria-label="Navegación móvil" hidden>/);
  assert.match(html, /<ul class="desktop-nav">/);
  assert.match(html, /\.menu-toggle\{display:inline-flex;/);
  assert.match(html, /\.desktop-nav\{display:none;\}/);
  assert.match(html, /html\[data-platform="android"\] #hero\{min-height:auto;\}\n  #hero \.ticker-wrap\{width:auto;margin:0 -1\.5rem 2rem;\}/);
  assert.doesNotMatch(html, /\.logo>div\{display:none;\}/);
  assert.match(html, /menuToggle\.setAttribute\('aria-expanded',String\(open\)\)/);
  assert.match(html, /if\(event\.key==='Escape'\)setMenu\(false\)/);
  assert.match(html, /backgroundElements\.forEach\(\(element\)=>\{element\.inert=open;\}\)/);
  assert.match(html, /if\(event\.key==='Tab'&&menuToggle\.getAttribute\('aria-expanded'\)==='true'\)/);
  assert.match(html, /returnFocus\?\.focus\(\)/);
});

test('narrow phone layout collapses dense grids and product actions to one column', async () => {
  const html = await readLanding();

  assert.match(html, /#bgc\{position:fixed;inset:0;z-index:0;width:100%;height:100%;\}/);
  assert.match(
    html,
    /\.hero-strip,\.srv-grid,\.types-grid,\.kpi-row,\.stats-row\{grid-template-columns:1fr;\}/,
  );
  assert.match(html, /\.prod-card-foot\{flex-direction:column;align-items:stretch;\}/);
  assert.match(
    html,
    /\.prod-card-foot \.prod-cta\{width:100%;white-space:normal;text-align:center;\}/,
  );
  assert.match(html, /\.demo-topbar\{flex-wrap:wrap;\}/);
});

test('mobile controls use readable text, semantic buttons and 44px or larger targets', async () => {
  const html = await readLanding();

  assert.match(html, /\.theme-toggle\{width:44px;height:44px;flex:0 0 44px;\}/);
  assert.match(html, /\.demo-chip\{min-height:44px;\}/);
  assert.match(html, /\.demo-send\{width:48px;height:48px;\}/);
  assert.match(html, /\.demo-chat,\.demo-input\{min-width:0;\}/);
  assert.match(
    html,
    /\.demo-input,\.contact-input,\.contact-textarea\{font-size:16px;\}/,
  );
  assert.match(
    html,
    /html\[data-platform="android"\] \.demo-input,html\[data-platform="android"\] \.contact-input,html\[data-platform="android"\] \.contact-textarea\{font-size:16px;\}/,
  );
  assert.doesNotMatch(html, /<div class="demo-chip[^\"]*" onclick=/);
  assert.equal(
    (html.match(/<button type="button" class="demo-chip/g) || []).length,
    5,
  );
});

test('large-phone landscape and desktop-mode viewports keep mobile behavior through 1024px', async () => {
  const html = await readLanding();

  assert.match(
    html,
    /@media\(max-width:1024px\)\{\n  nav\{padding-top:calc\(1rem \+ env\(safe-area-inset-top\)\);padding-right:calc\(1\.5rem \+ env\(safe-area-inset-right\)\);padding-bottom:1rem;padding-left:calc\(1\.5rem \+ env\(safe-area-inset-left\)\);\}/,
  );
  assert.match(
    html,
    /\.menu-toggle\{display:inline-flex;flex:0 0 48px;\}\n  \.theme-toggle\{width:44px;height:44px;flex:0 0 44px;\}/,
  );
  assert.match(
    html,
    /\.demo-chip\{min-height:44px;\}\n  \.demo-input,\.contact-input,\.contact-textarea\{font-size:16px;\}\n  \.demo-send\{width:48px;height:48px;\}/,
  );
  assert.match(
    html,
    /@media\(max-width:600px\)\{[\s\S]*?#hero\{padding-top:calc\(7\.4rem \+ env\(safe-area-inset-top\)\);\}/,
  );
  assert.match(html, /@supports\(min-height:100dvh\)\{@media\(min-width:1025px\)\{#hero\{min-height:100dvh;\}\}\}/);
  assert.match(html, /window\.innerWidth>1024/);
  assert.doesNotMatch(html, /max-width:900px|min-width:901px|innerWidth>900/);
});

test('iOS and Android layout respects safe areas, dynamic viewport and reduced motion', async () => {
  const html = await readLanding();

  assert.match(
    html,
    /nav\{padding-top:calc\(\.9rem \+ env\(safe-area-inset-top\)\);padding-right:calc\(1rem \+ env\(safe-area-inset-right\)\);padding-left:calc\(1rem \+ env\(safe-area-inset-left\)\);\}/,
  );
  assert.match(html, /section\[id\]\{scroll-margin-top:calc\(6rem \+ env\(safe-area-inset-top\)\);\}/);
  assert.match(html, /@supports\(min-height:100dvh\)\{@media\(min-width:1025px\)\{#hero\{min-height:100dvh;\}\}\}/);
  assert.match(html, /#hero \.ticker-wrap\{width:auto;margin:0 -1\.5rem 2rem;\}/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html, /\.ticker\{animation:none!important;transform:none!important;\}/);
});
