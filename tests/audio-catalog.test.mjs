import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the real catalog and bundle loader while replacing only the Cocos
// asset service. No renderer/editor success is inferred from this adapter test.
const catalogUrl = new URL('../assets/scripts/AudioCatalog.ts', import.meta.url).href;
const bundleUrl = new URL('../assets/scripts/ResourceBundles.ts', import.meta.url).href;
const fixture = { requests: [], failed: new Set(), held: new Map(), hold: false };
const bundle = name => ({ name, getInfoWithPath: path => ({ uuid: `${name}/${path}` }) });
globalThis.__monsterDenAudioCatalogTest = {
  getBundle: () => null,
  loadBundle(name, callback) {
    fixture.requests.push(name);
    if (fixture.hold) { fixture.held.set(name, callback); return; }
    queueMicrotask(() => callback(fixture.failed.has(name) ? new Error(`missing ${name}`) : null, bundle(name)));
  },
  utils: { getUrlWithUuid: uuid => `/native/${uuid}.mp3` },
};
const mockUrl = 'data:text/javascript,' + encodeURIComponent('export const assetManager = globalThis.__monsterDenAudioCatalogTest; export class AssetManager {}');
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cc' && [catalogUrl, bundleUrl].includes(context.parentURL)) return { url: mockUrl, shortCircuit: true };
    if (specifier === './ResourceBundles' && context.parentURL === catalogUrl) return { url: bundleUrl, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { loadAudioCatalog } = await import(catalogUrl);
const { loadGameBundle } = await import(bundleUrl);
hooks.deregister();

function reset() { fixture.requests.length = 0; fixture.failed.clear(); fixture.held.clear(); fixture.hold = false; }

test('catalog loads only short sounds up front; long music bundles resolve on demand', async () => {
  reset();
  const catalog = await loadAudioCatalog();
  assert.deepEqual(fixture.requests, ['sound']);
  assert.equal(catalog.assetUrls.stone_hit.length, 3);
  assert.equal(await catalog.resolveMusicUrl('camp'), '/native/music-camp/music-camp.mp3');
  assert.deepEqual(fixture.requests, ['sound', 'music-camp']);
  assert.equal(fixture.requests.includes('music-boss'), false);
});

test('missing sound bundle reports a specific audio warning but still returns a usable music catalog', async () => {
  reset(); fixture.failed.add('sound'); const warnings = [];
  const catalog = await loadAudioCatalog(message => warnings.push(message));
  assert.deepEqual(catalog.assetUrls, {});
  assert.ok(warnings.some(message => message.includes('动作音效分包') && message.includes('missing sound')));
  assert.equal(await catalog.resolveMusicUrl('camp'), '/native/music-camp/music-camp.mp3');
});

test('unavailable boss music is deferred until requested and does not invalidate short sounds', async () => {
  reset(); fixture.failed.add('music-boss');
  const catalog = await loadAudioCatalog();
  assert.deepEqual(fixture.requests, ['sound']);
  assert.ok(catalog.assetUrls.click.length > 0);
  await assert.rejects(catalog.resolveMusicUrl('boss'), /missing music-boss/);
  assert.ok(catalog.assetUrls.click.length > 0);
});

test('a stuck Cocos bundle callback times out, releases shared request state and permits retry', async () => {
  reset(); fixture.hold = true;
  const first = loadGameBundle('held-audio', 100), shared = loadGameBundle('held-audio', 100);
  assert.equal(first, shared);
  const late = fixture.held.get('held-audio');
  await assert.rejects(first, /held-audio.*超时/);
  fixture.hold = false;
  const second = await loadGameBundle('held-audio', 100);
  assert.equal(second.name, 'held-audio');
  late(null, bundle('late-old-bundle'));
  assert.deepEqual(fixture.requests, ['held-audio', 'held-audio']);
});
