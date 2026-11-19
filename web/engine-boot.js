import {startCocos} from './engine-start.js';

const startup = document.querySelector('#startup');
const state = window.__monsterDenRuntime = {ready: false, engineReady: false, firstFrameDrawn: false, errors: [], engine: 'Cocos Creator 3.8.8', platform: 'browser preview'};
function fail(error) {
  const message = error?.stack || String(error);
  state.errors.push(message); console.error('[Monster Den]', error);
  startup.hidden = false;
  startup.textContent = error?.code === 'WEBGL_UNAVAILABLE'
    ? '当前浏览器未提供 3D 图形支持，请用支持 WebGL 的浏览器打开。'
    : '进入失败，请检查网络后重新进入';
}
addEventListener('error', event => fail(event.error || event.message));
addEventListener('unhandledrejection', event => fail(event.reason));
function compressUuid(uuid) {
  const hex = uuid.replace(/-/g, ''), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = hex.slice(0, 2);
  for (let i = 2; i < hex.length; i += 3) { const n = parseInt(hex.slice(i, i + 3), 16); output += alphabet[n >> 6] + alphabet[n & 63]; }
  return output;
}
try {
  const metadata = await (await fetch('./build-info.json')).json();
  state.version = metadata.version;
  const cc = await startCocos(async c => {
    const module = await System.import('./scripts/GameMain.js');
    const GameMain = module.GameMain || module.default;
    if (!GameMain) throw new Error('GameMain script does not export its Cocos component.');
    c.js._setClassId(compressUuid(metadata.controllerUuid), GameMain);
    const response = await fetch('./Boot.scene');
    if (!response.ok) throw new Error('Boot.scene is unavailable.');
    const asset = c.deserialize(await response.json());
    if (!asset?.scene) throw new Error('Boot.scene did not deserialize as a Cocos SceneAsset.');
    return asset.scene;
  });
  state.engineReady = true;
  state.graphicsDevice = cc.director.root.device.constructor.name;
  state.graphicsAPI = cc.director.root.device.gfxAPI;
  function observeStartup() {
    state.firstFrameDrawn = true;
    // The component displays its own Cocos loading UI while fetching models.
    // A first engine frame is not the same as a usable game scene.
    startup.hidden = true;
    if (state.errors.length || window.__MONSTER_DEN__) {
      state.ready = !state.errors.length && !!window.__MONSTER_DEN__;
      cc.director.off(cc.Director.EVENT_AFTER_DRAW, observeStartup);
    }
  }
  cc.director.on(cc.Director.EVENT_AFTER_DRAW, observeStartup);
} catch (error) { fail(error); }
