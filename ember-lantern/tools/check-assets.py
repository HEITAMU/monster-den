from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
art=root/'assets/resources/art'
required=['forest.jpg','vignette.png','glow.png','blue-glow.png','shadow.png','hero-front.png','hero-back.png','hero-run-left.png','hero-run-right.png','hunter.png','mantis.png','moth.png','pulse.png','lampseed.png','portal.png','refill.png','camp.png']
for name in required:
 p=art/name
 if not p.is_file():raise AssertionError(f'Missing {name}')
 im=Image.open(p);im.verify()
scene=json.loads((root/'assets/Boot.scene').read_text())
assert scene[3]['__type__']=='02JnZCp7VAoYeo/FGbqDUs'
assert json.loads((root/'assets/scripts/LanternGame.ts.meta').read_text())['uuid']=='02267642-a7b5-40a1-87a8-fc519ba8352c'
print('PASS: 17 art assets, valid scene -> script reference, PNG/JPG integrity')
print('Art footprint:',sum((art/n).stat().st_size for n in required),'bytes')
