from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from pathlib import Path
root=Path(__file__).parents[1]/'assets/resources/art'
root.mkdir(parents=True,exist_ok=True)
# Alpha vignette, center barely dark / edges night-blue, poster-friendly tone
w,h=720,1280
Y,X=np.mgrid[0:h,0:w].astype(np.float32)
r=((X-w/2)/(w*.54))**2+((Y-h/2)/(h*.58))**2
alpha=np.clip((r-.18)*88,0,150).astype('uint8')
img=np.zeros((h,w,4),dtype='uint8'); img[:,:,0]=4;img[:,:,1]=14;img[:,:,2]=28;img[:,:,3]=alpha
Image.fromarray(img,'RGBA').save(root/'vignette.png',optimize=True)
for name,rgb,sz in [('glow',(255,165,45),256),('blue-glow',(74,211,234),256),('shadow',(5,7,14),144)]:
 y,x=np.mgrid[0:sz,0:sz].astype(float);d=((x-sz/2)/(sz/2))**2+((y-sz/2)/(sz/2))**2
 if name=='shadow':d=((x-sz/2)/(sz*.48))**2+((y-sz/2)/(sz*.24))**2
 a=(np.exp(-d*4.0)* (165 if name=='shadow' else 194)).clip(0,255).astype('uint8')
 ar=np.zeros((sz,sz,4),dtype='uint8');ar[:,:,0:3]=rgb;ar[:,:,3]=a
 Image.fromarray(ar,'RGBA').save(root/(name+'.png'),optimize=True)
