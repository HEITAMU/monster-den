import {installPreviewEffects} from './engine-effects.js';

/** Start the real Cocos runtime. createScene receives the imported cc namespace. */
export async function startCocos(createScene, options = {}) {
  const cc = await System.import('cc');
  globalThis.cc = cc;
  if (cc.VERSION !== '3.8.8') throw new Error(`Unexpected Cocos engine ${cc.VERSION}`);
  cc.game.onPostSubsystemInitDelegate.add(() => installPreviewEffects(cc));
  await cc.game.init({overrideSettings: {
    screen: {designResolution: {width: options.width || 720, height: options.height || 1280, policy: cc.ResolutionPolicy.FIXED_WIDTH}, orientation: 'portrait', frameRate: 60},
    rendering: {renderMode: 2, customPipeline: false},
    splashScreen: {totalTime: 0}, profiling: {showFPS: false},
    assets: {preloadBundles: [], preloadAssets: []}
  }});
  const scene = await createScene(cc);
  if (!(scene instanceof cc.Scene)) throw new Error('createScene must return a Cocos Scene.');
  cc.director.runSceneImmediate(scene);
  cc.game.run();
  return cc;
}
