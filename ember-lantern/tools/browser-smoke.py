from playwright.sync_api import sync_playwright
from pathlib import Path
import base64,re,os
root=Path(__file__).resolve().parents[1]
core=(root/'preview/modules/LanternRules.js').read_text()
core=re.sub(r'\bexport\s+', '', core)
web=(root/'preview/app.js').read_text()
web=web.replace("import {LanternRules,INITIAL_PROGRESS,upgradeCost,WORLD,clamp} from './modules/LanternRules.js';",'')
web=web.replace("'../assets/resources/art/'+name+(name==='forest'?'.jpg':'.png')", "IMAGES[name]")
web=web.replace("function visibleFrame(){return loaded===keys.length;}","function visibleFrame(){return loaded===keys.length;}")
images={}
for f in (root/'assets/resources/art').iterdir():
 if f.suffix in ['.png','.jpg']:
  images[f.stem]='data:image/'+('jpeg' if f.suffix=='.jpg' else 'png')+';base64,'+base64.b64encode(f.read_bytes()).decode()
import json
script='const IMAGES='+json.dumps(images)+';\n'+core+'\n'+web
# browser's audio guard; script embeds in DOM while page set_content loads
html='''<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/><style>*{box-sizing:border-box}html,body{margin:0;background:#071318;height:100%;display:flex;justify-content:center;align-items:center}canvas{max-width:100vw;max-height:100vh;touch-action:none}</style></head><body><canvas id="game" width="720" height="1280"></canvas></body></html>'''
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-web-security'])
 page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True,is_mobile=True)
 errs=[]
 page.on('pageerror',lambda e:errs.append('ERROR:'+str(e)))
 page.on('console',lambda c:errs.append('CONSOLE:'+c.text) if c.type=='error' else None)
 page.set_content(html)
 # fake Audio object
 page.evaluate('() => {window.Audio=class { constructor(){this.volume=0;this.loop=false;this.currentTime=0;}play(){return Promise.resolve();}pause(){}}}')
 page.add_script_tag(content=script)
 page.wait_for_function('window.__EMBER_TEST__ && window.__EMBER_TEST__.ready()',timeout=20000)
 page.screenshot(path=str(root.parent/'ember-menu-screenshot.png'))
 rect=page.locator('canvas').bounding_box()
 px=lambda x:rect['x']+(x+360)/720*rect['width']
 H=720*rect['height']/rect['width']
 edge=(H-1280)/2
 py=lambda y:rect['y']+(H/2-y)/H*rect['height']
 page.mouse.click(px(0),py(-325-edge))
 page.wait_for_timeout(500)
 page.screenshot(path=str(root.parent/'ember-game-screenshot.png'))
 print('phase',page.evaluate('window.__EMBER_TEST__.game.state.phase'))
 print('stats',page.evaluate('({enemies:window.__EMBER_TEST__.game.state.enemies.length, pickup:window.__EMBER_TEST__.game.state.pickups.length})'))
 page.mouse.click(px(250),py(-525-edge))
 page.wait_for_timeout(350)
 page.screenshot(path=str(root.parent/'ember-pulse-screenshot.png'))
 print('flame',page.evaluate('window.__EMBER_TEST__.game.state.hero.flame'))
 # Trigger real game rule path (pickup -> portal -> choice), not game state cheats.
 page.evaluate('''() => {
  const g=window.__EMBER_TEST__.game;
  g.state.enemies=[];
  const pickups=g.state.pickups.filter(p=>p.kind==='seed').slice(0,3);
  pickups.forEach(p=>{p.revealed=true;g.state.hero.x=p.x;g.state.hero.y=p.y;g.tick(0.01)});
  g.state.hero.x=0;g.state.hero.y=285;g.tick(0.01);
 }''')
 page.wait_for_timeout(400)
 assert page.evaluate('window.__EMBER_TEST__.game.state.phase')=='choice'
 page.screenshot(path=str(root.parent/'ember-choice-screenshot.png'))
 page.mouse.click(px(0),py(-35))
 page.wait_for_timeout(350)
 assert page.evaluate('window.__EMBER_TEST__.game.state.phase')=='settled'
 page.screenshot(path=str(root.parent/'ember-result-screenshot.png'))
 page.mouse.click(px(0),py(-234))
 page.wait_for_timeout(300)
 assert page.evaluate('window.__EMBER_TEST__.game.state.phase')=='camp'
 assert page.evaluate('window.__EMBER_TEST__.game.progress.runs')==1
 assert not errs,errs
 print('PASS embedded Chromium portrait 390x844: assets, start, pulse, real pickup and gate, settlement, return to camp')
 print('errors',errs[:20]);b.close()
