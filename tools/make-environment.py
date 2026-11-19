"""Rebuild Monster Den's sculpted workshop environment in Blender 4.3+.

blender -b --python tools/make-environment.py
The game uses the exported meshes, never this script's preview renders.
"""
import bpy
import math
import random
import sys
import json
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from export_mesh_library import export_library
from pack_mesh_library import pack_library

random.seed(619)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):
    bpy.data.materials.remove(data)


def linear_hex(value):
    rgb=[int(value[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)


def material(name, color, roughness=.68, metallic=0):
    if isinstance(color,str):color=linear_hex(color)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return m


M = {
    'stone': material('Blue slate weathered face', '#485f6b'),
    'stoneLight': material('Slate worn upper arris', '#738389'),
    'stoneDark': material('Deep blue stone strata', '#253b47'),
    'mortar': material('Fine recessed slate joints', '#445b62'),
    'wood': material('Old honey chestnut', '#89502e'),
    'woodLight': material('Polished carved chestnut edges', '#b77a42'),
    'woodDark': material('Carved wood recess', '#49382b'),
    'endgrain': material('Fresh split wood fibres', '#d1a267'),
    'copper': material('Warm aged copper', '#a57749', .39, .58),
    'gold': material('Polished amber brass lip', '#deb56a', .32, .65),
    'iron': material('Blackened workshop iron', '#243d46', .42, .5),
    'moss': material('Deep cushion moss', '#487447'),
    'mossLight': material('Damp moss upper tips', '#789151'),
    'leaf': material('Emerald leaf', '#457d56', .65),
    'leafLight': material('Fern new growth', '#8aaf68', .65),
    'leafDark': material('Fern underside', '#244b43'),
    'terracotta': material('Russet ceramic', '#9c583c'),
    'cap': material('Teal luminous cave fungus', '#459995', .76),
    'capLight': material('Mint phosphorescent cap rim', '#9ce0bd', .72),
    'cream': material('Warm ivory', '#d7cfad'),
    'amber': material('Lantern warm glass', '#ffd087', .32),
    'jade': material('Living jade seed', '#91e6c1', .32),
    'root': material('Ancient grey oak root', '#6f624b'),
    'rootLight': material('Exposed root grain', '#9b8660'),
    'soil': material('Island peat underside', '#1d3238'),
    'patina': material('Oxidised copper inlay', '#4a8c82', .65, .2),
    'paint': material('Faded jade cabinet lacquer', '#37645f'),
    'etched': material('Almost worn-away copper floor engraving', '#547670', .74, .12),
}
FLOOR_MATS = [material(f'Large quiet slate tone {i}', color) for i,color in enumerate(
    ['#596e76','#5b7178','#5d7077','#586d75','#60747a','#5d7079','#5a7078'])]


def root(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def mesh(name, verts, faces, mats, parent, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    if not isinstance(mats, list): mats = [mats]
    for m in mats: data.materials.append(m)
    for p in data.polygons: p.use_smooth = smooth
    return obj


def box(name, centre, size, mat, parent, bevel=.045, segments=2, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation: obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    obj.parent = parent
    if bevel:
        b = obj.modifiers.new('Soft worn edges', 'BEVEL')
        b.width = min(bevel, min(size) * .42)
        b.segments = segments
        b.affect = 'EDGES'
        b.profile = .55
        n = obj.modifiers.new('Weighted crafted normals', 'WEIGHTED_NORMAL')
        n.keep_sharp = True
    return obj


def lathe(name, profile, mat, parent, centre=(0, 0, 0), count=16, wobble=0, scale=(1, 1, 1)):
    verts, faces = [], []
    for ring, (r, z) in enumerate(profile):
        for i in range(count):
            a = 2 * math.pi * i / count
            rr = r * (1 + wobble * math.sin(a*3 + ring*.71))
            verts.append((centre[0] + rr*math.cos(a)*scale[0], centre[1] + rr*math.sin(a)*scale[1], centre[2] + z*scale[2]))
    for row in range(len(profile)-1):
        for i in range(count):
            j = (i+1) % count
            faces.append((row*count+i, row*count+j, (row+1)*count+j, (row+1)*count+i))
    faces.append(tuple(reversed(range(count))))
    faces.append(tuple((len(profile)-1)*count+i for i in range(count)))
    return mesh(name, verts, faces, mat, parent, True)


def tube(name, points, radius, mat, parent, sides=6):
    points = [Vector(p) for p in points]
    verts, faces = [], []
    for i, point in enumerate(points):
        tangent = (points[min(i+1,len(points)-1)] - points[max(0,i-1)]).normalized()
        reference = Vector((0,0,1)) if abs(tangent.z) < .9 else Vector((1,0,0))
        right = tangent.cross(reference).normalized()
        up = tangent.cross(right).normalized()
        r = radius[i] if isinstance(radius, list) else radius
        for j in range(sides):
            a = j*math.tau/sides
            v = point + r*(math.cos(a)*right + math.sin(a)*up)
            verts.append(tuple(v))
        if i:
            for j in range(sides):
                k = (j+1) % sides
                faces.append(((i-1)*sides+j,(i-1)*sides+k,i*sides+k,i*sides+j))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(points)-1)*sides+j for j in range(sides)))
    return mesh(name, verts, faces, mat, parent, True)


def leaf(name, start, end, width, mat, parent, curl=.09, ribs=5):
    a, b = Vector(start), Vector(end)
    d = b-a
    side = Vector((-d.y, d.x, 0))
    if side.length < .01: side = Vector((1,0,0))
    side.normalize()
    verts, faces = [], []
    for i in range(ribs):
        t = i/(ribs-1)
        centre = a + d*t + Vector((0,0,curl*math.sin(math.pi*t)))
        w = width * math.sin(math.pi*t)**.8 * .5
        for across in (-1,0,1):
            p = centre + side*w*across
            if across == 0: p.z += width*.11*math.sin(math.pi*t)
            verts.append(tuple(p))
        if i:
            for j in range(2): faces.append(((i-1)*3+j,(i-1)*3+j+1,i*3+j+1,i*3+j))
    obj = mesh(name, verts, faces, [mat,M['leafDark']], parent, True)
    solid = obj.modifiers.new('Leaf thickness', 'SOLIDIFY')
    solid.thickness = .012
    solid.material_offset = 1
    return obj


def stone(name, centre, size, mat, parent, chips=.035):
    x,y,z = centre; w,d,h = size
    cut = min(w,d)*.16
    outline = [(-w/2+cut,-d/2),(w/2-cut,-d/2),(w/2,-d/2+cut),(w/2,d/2-cut),
               (w/2-cut,d/2),(-w/2+cut,d/2),(-w/2,d/2-cut),(-w/2,-d/2+cut)]
    outline = [(u+random.uniform(-chips,chips),v+random.uniform(-chips,chips)) for u,v in outline]
    verts=[]
    for scale, height in [(0.96,0),(1,min(.07,h*.28)),(1,h*.78),(.94,h)]:
        for u,v in outline: verts.append((x+u*scale,y+v*scale,z+height))
    faces=[tuple(reversed(range(8)))]
    for row in range(3):
        for i in range(8): faces.append((row*8+i,row*8+(i+1)%8,(row+1)*8+(i+1)%8,(row+1)*8+i))
    faces.append(tuple(24+i for i in range(8)))
    obj=mesh(name,verts,faces,[mat,M['stoneDark']],parent)
    obj.data.polygons[0].material_index=1
    return obj


def rivet(name, at, parent, radius=.035, mat=None, facing='front'):
    obj = lathe(name, [(radius*.72,0),(radius,.014),(radius*.68,.037),(0,.045)], mat or M['gold'], parent, count=8)
    if facing=='front': obj.rotation_euler[0]=math.pi/2
    elif facing=='side': obj.rotation_euler[1]=math.pi/2
    obj.location=at
    return obj


prefabs={}

# Polygon clipping makes broad irregular stonework rather than a tiled board.
def clip_half_plane(poly,nx,ny,d):
    output=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        fa=nx*a[0]+ny*a[1]-d;fb=nx*b[0]+ny*b[1]-d
        if fa<=0:output.append(a)
        if (fa<=0)!=(fb<=0):
            t=fa/(fa-fb)
            output.append((a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))
    return output


def slab(name,outline,top,mat,parent):
    cx=sum(p[0] for p in outline)/len(outline);cy=sum(p[1] for p in outline)/len(outline)
    # Each shared straight edge is lightly hand-chipped into a silhouette; the
    # deviations point inward, so adjacent slabs cannot intersect each other.
    chipped=[]
    for a,b in zip(outline,outline[1:]+outline[:1]):
        chipped.append(a)
        length=math.hypot(b[0]-a[0],b[1]-a[1])
        if length>1.2:
            for t in (.31,.68):
                x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t
                delta=Vector((cx-x,cy-y));delta.normalize()
                notch=random.uniform(.004,.024)
                chipped.append((x+delta.x*notch,y+delta.y*notch))
    outline=chipped
    n=len(outline);verts=[]
    for inset,z in ((.020,-.055),(.014,top-.025),(.045,top)):
        for x,y in outline:
            delta=Vector((cx-x,cy-y));delta.normalize()
            verts.append((x+delta.x*inset,y+delta.y*inset,z))
    faces=[tuple(reversed(range(n)))]
    for row in range(2):
        for i in range(n):faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
    faces.append(tuple(2*n+i for i in range(n)))
    obj=mesh(name,verts,faces,[mat,M['mortar']],parent)
    for face in obj.data.polygons[:-1]:face.material_index=1
    return obj


def island_body(parent):
    outline=[]
    outline.extend([(-4.94+i*.988,-7.12) for i in range(11)])
    outline.extend([(5.12,-6.45+i*1.29) for i in range(11)])
    outline.extend([(4.94-i*.988,7.12) for i in range(11)])
    outline.extend([(-5.12,6.45-i*1.29) for i in range(11)])
    n=len(outline);verts=[]
    for row,(scale,z) in enumerate(((.94,-1.15),(1.025,-.77),(1.015,-.35),(1,-.035))):
        for i,(x,y) in enumerate(outline):
            radial=Vector((x/5.12,y/7.12));radial.normalize()
            ledge=(.055 if row==3 else .13)*math.sin(i*1.9+row*.7)
            ledge+=random.uniform(-.035,.035)
            verts.append((x*scale+radial.x*ledge,y*scale+radial.y*ledge,z+random.uniform(-.07,.07)))
    faces=[]
    for row in range(3):
        for i in range(n):faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
    faces.append(tuple(3*n+i for i in range(n)))
    obj=mesh('Broken rock strata below the treasury',verts,faces,[M['soil'],M['stoneDark'],M['stone'],M['mortar']],parent)
    for p in obj.data.polygons:p.material_index=3 if p.index==len(faces)-1 else (1 if p.index//n==0 else 2 if p.index%5==0 else 1)


def rugged_rock(name,centre,size,parent):
    cx,cy,cz=centre;w,d,h=size;n=9;verts=[]
    radii=[random.uniform(.83,1.12) for _ in range(n)]
    for row,(scale,z) in enumerate(((.58,0),(1,.22),(.94,.70),(.52,1))):
        for i in range(n):
            a=i*math.tau/n+.08*row
            verts.append((cx+math.cos(a)*w*.5*radii[i]*scale,cy+math.sin(a)*d*.5*radii[i]*scale,cz+h*(z+random.uniform(-.025,.025))))
    faces=[tuple(reversed(range(n)))]
    for row in range(3):
        for i in range(n):faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
    faces.append(tuple(3*n+i for i in range(n)))
    obj=mesh(name,verts,faces,[M['stoneDark'],M['stone'],M['soil']],parent)
    for p in obj.data.polygons:p.material_index=1 if p.index>n*2 else 2 if p.index%7==0 else 0


# Full walkable rectangle remains flat; only low-contrast physical seams cross it.
floor=root('floor');prefabs['floor']=floor
island_body(floor)
seeds=[(-4+col*2+random.uniform(-.62,.62),-6+row*2+random.uniform(-.58,.58)) for row in range(7) for col in range(5)]
for index,(sx,sy) in enumerate(seeds):
    polygon=[(-5,-7),(5,-7),(5,7),(-5,7)]
    for tx,ty in seeds:
        if (tx,ty)==(sx,sy):continue
        nx=tx-sx;ny=ty-sy
        polygon=clip_half_plane(polygon,nx,ny,(tx*tx+ty*ty-sx*sx-sy*sy)/2)
        if not polygon:break
    if len(polygon)>=3:
        slab(f'Broad hand-cut vault flagstone {index:02d}',polygon,.044+random.uniform(-.002,.002),random.choice(FLOOR_MATS),floor)
        if index%4==0:
            xx,yy=polygon[0]
            dx=(sx-xx)*.26;dy=(sy-yy)*.26
            tube('Worn hairline stone fracture',[(xx+dx*.10,yy+dy*.10,.047),(xx+dx*.55,yy+dy*.50,.047),(xx+dx,yy+dy,.047)],.007,M['mortar'],floor,4)
for i in range(24):
    x=random.choice([-1,1])*random.uniform(4.68,4.94);y=random.uniform(-6.85,6.85)
    lathe('Soft moss caught in edge joint',[(.05,0),(.13,.012),(.09,.026),(.015,.030)],M['moss'],floor,(x,y,.044),7,.22,(1.4,.65,1))
# Faint broken botanical inlays remain confined to edge zones. They read as
# worn architecture, not route markers, collectible halos or a gameplay grid.
for cx,cy,flip in ((-4.15,-3.9,1),(4.15,1.65,-1),(-4.12,4.7,1),(4.12,-5.8,-1)):
    for start,end,radius in ((.12,1.9,.46),(2.7,4.05,.46),(.5,2.1,.30)):
        pts=[(cx+math.cos(a)*radius,cy+math.sin(a)*radius,.049) for a in [start+(end-start)*j/12 for j in range(13)]]
        tube('Worn broken copper vine inlay',pts,.013,M['etched'],floor,4)
    tube('Worn inlay leaf stem',[(cx-.15*flip,cy-.19,.049),(cx,cy,.049),(cx+.12*flip,cy+.21,.049)],.014,M['etched'],floor,4)

# The cabinet is one mobile piece: carved carcass, copper corners, raised drawers, castors.
cabinet=root('cabinet');prefabs['cabinet']=cabinet
box('Cabinet dark carcass',(0,0,.84),(1.56,1.43,1.18),M['woodDark'],cabinet,.11,3)
for side in (-1,1):
    for plank in range(4):
        box('Side chestnut panel',(side*.777,-.51+plank*.34,.86),(.09,.327,1.03),M['wood'],cabinet,.025,2)
    box('Side inset brass border',(side*.833,0,.87),(.028,1.16,.79),M['copper'],cabinet,.025)
    box('Recessed jade lacquer side carving',(side*.852,0,.87),(.025,1.045,.67),M['paint'],cabinet,.055)
    for y in (-.51,.51):
        box('Corner copper strap',(side*.798,y, .87),(.10,.14,1.24),M['copper'],cabinet,.038)
        for z in (.37,1.37):rivet('Strap rivet',(side*.858,y,z),cabinet,.036,facing='side')
    # A leaf-shaped side relief makes the silhouette readable in the high camera.
    path=[(side*.882,-.33,.62),(side*.887,-.15,.78),(side*.884,.11,.93),(side*.88,.33,1.14)]
    tube('Carved side vine',path,.018,M['woodDark'],cabinet)
for row,z in enumerate((.65,1.14)):
    box('Raised drawer front',(0,-.747,z),(1.37,.16,.41),M['woodLight'],cabinet,.055,3)
    box('Carved jade lacquer drawer recess',(0,-.837,z),(1.18,.025,.27),M['paint'],cabinet,.042)
    for side in (-1,1):rivet('Drawer pull anchor',(side*.23,-.868,z+.03),cabinet,.05)
    tube('Curved brass drawer pull',[(-.23,-.89,z+.03),(-.21,-1.0,z-.065),(0,-1.035,z-.105),(.21,-1.0,z-.065),(.23,-.89,z+.03)],.035,M['gold'],cabinet,8)
    for side in (-1,1):
        tube('Drawer botanical incise',[(side*.38,-.856,z-.055),(side*.47,-.858,z),(side*.43,-.856,z+.08)],.010,M['woodDark'],cabinet,5)
box('Lower cabinet cornice',(0,0,.32),(1.69,1.55,.16),M['copper'],cabinet,.055,3)
box('Upper cabinet cornice',(0,0,1.48),(1.73,1.61,.14),M['copper'],cabinet,.06,3)
box('Solid chestnut top',(0,0,1.56),(1.66,1.54,.115),M['woodLight'],cabinet,.055,3)
for x in (-.43,.1):tube('Top board seam',[(x,-.68,1.622),(x+.015,0,1.622),(x-.01,.68,1.622)],.009,M['woodDark'],cabinet,4)
for x in (-.63,.63):
    box('Cabinet top worn copper brace',(x,0,1.63),(.105,1.42,.032),M['copper'],cabinet,.012,2)
    for y in (-.55,.55):rivet('Top strap sunk rivet',(x,y,1.648),cabinet,.025,M['gold'],facing='top')
box('Cabinet top relief badge',(0,.14,1.642),(.29,.38,.035),M['paint'],cabinet,.06,3)
leaf('Cabinet carved badge frond',(0,.02,1.665),(0,.29,1.67),.15,M['gold'],cabinet,.025,5)
for x in (-.61,.61):
    for y in (-.52,.52):
        box('Castor mounting',(x,y,.23),(.20,.24,.13),M['iron'],cabinet,.035)
        wheel=lathe('Grooved copper castor',[(.13,0),(.15,.025),(.15,.09),(.12,.115)],M['iron'],cabinet,count=16)
        wheel.rotation_euler[1]=math.pi/2;wheel.location=(x-.06,y,.15)
        rivet('Wheel axle',(x+.07,y,.15),cabinet,.052,M['copper'],'side')

# Thick splintered wood screen. Uneven end-grain is modelled, not painted onto a rectangle.
board=root('board');prefabs['board']=board
for side in (-1,1):
    box('Split screen upright',(side*.85,0,.37),(.17,.25,.73),M['woodDark'],board,.035,2, (0,side*.065,0))
for j,(z,tilt) in enumerate(((.22,-.06),(.51,.04))):
    outline=[(-.98,-.11),(-.88,.10),(-.40,.10),(.17,.11),(.79,.08),(.98,.02),(.87,-.04),(.97,-.11)]
    verts=[(x,-.13,z+zz+x*tilt) for x,zz in outline]+[(x,.12,z+zz+x*tilt) for x,zz in outline]
    faces=[tuple(reversed(range(8))),tuple(8+i for i in range(8))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    plank=mesh('Broken chestnut plank',verts,faces,[M['woodLight'],M['endgrain']],board)
    for polygon in list(plank.data.polygons)[2:]:polygon.material_index=1
    for q in range(3):
        tube('Long wood grain',[(-.76,-.139,z-.065+q*.055),(-.22,-.144,z-.07+q*.06),(.45,-.14,z-.035+q*.05)],.008,M['woodDark'],board,4)
    for x in (-.83,.83):rivet('Old screen nail',(x,-.16,z+x*tilt),board,.025,M['iron'])

# Botanically carved sandstone pillar with a flared foot, ribs and a mossy cap.
pillar=root('pillar');prefabs['pillar']=pillar
stone('Pillar foot',(0,0,0),(1.08,1.08,.23),M['stoneDark'],pillar,.025)
stone('Pillar lower bevel',(0,0,.20),(.94,.94,.19),M['stoneLight'],pillar,.022)
lathe('Octagonal pillar shaft',[(.40,.33),(.36,.42),(.335,1.28),(.405,1.36)],M['stone'],pillar,count=8)
for i in range(8):
    a=i*math.tau/8+math.pi/8
    x,y=.346*math.cos(a),.346*math.sin(a)
    tube('Inset pillar flute',[(x,y,.48),(x*.97,y*.97,.90),(x*1.03,y*1.03,1.22)],.019,M['stoneDark'],pillar,5)
stone('Pillar carved capital',(0,0,1.31),(.96,.96,.22),M['stoneLight'],pillar,.025)
stone('Pillar moss cap',(0,0,1.51),(1.08,1.08,.15),M['stone'],pillar,.035)
for i in range(9):
    a=i*.83;r=.40
    lathe('Moss on capital',[(.07,0),(.12,.035),(.04,.065)],M['moss'],pillar,(math.cos(a)*r,math.sin(a)*r,1.63),7,.2)
tube('Trailing pillar vine',[(.43,-.1,1.66),(.45,-.23,1.36),(.39,-.29,1.02),(.41,-.25,.78)],.022,M['leafDark'],pillar)
for z in (.90,1.15,1.40):leaf('Pillar vine leaf',(.40,-.25,z),(.58,-.35,z+.14),.14,M['leaf'],pillar,.03,4)
for a in (0,math.pi/2,math.pi,math.pi*1.5):
    x,y=.347*math.cos(a),.347*math.sin(a)
    tube('Pillar oxidised copper inlay',[(x,y,.49),(x*1.01,y*1.01,.67),(x,y,.88)],.012,M['patina'],pillar,5)
for i in range(3):
    lathe('Small pale cave fungus on moss cap',[(.018,0),(.042,.025),(.032,.046),(0,.052)],M['capLight'],pillar,(-.31+i*.11,-.18,1.67),8,.08)

# Unit wall section. Scale x/z in the renderer to match each logical rectangle.
wall=root('wall');prefabs['wall']=wall
for row in range(3):
    pieces=2 if row%2==0 else 3
    for col in range(pieces):
        width=1/pieces
        stone('Coursed wall stone',(-.5+(col+.5)*width,0,row*.29),(width-.018,.98,.30),M['stone'] if row!=2 else M['stoneLight'],wall,.012)
box('Wall worn coping',(0,0,.91),(1.02,1.04,.14),M['stone'],wall,.07,3)
tube('Wall small moss seam',[(-.47,-.48,.58),(-.12,-.51,.56),(.17,-.49,.59)],.025,M['moss'],wall,5)
for x in (-.33,.04,.31):
    lathe('Wall cap cushion moss',[(.045,0),(.095,.015),(.07,.033),(0,.04)],M['mossLight'],wall,(x,.32,1.055),8,.18,(1.2,.55,1))

# Treasure chest, open curved lid and a living amber seed on folded velvet.
treasure=root('treasure');prefabs['treasure']=treasure
box('Treasure chest foot',(0,0,.13),(1.15,.79,.22),M['woodDark'],treasure,.075,3)
box('Treasure chest body',(0,0,.39),(1.2,.82,.42),M['wood'],treasure,.065,3)
box('Treasure chest gold lip',(0,0,.61),(1.26,.88,.075),M['gold'],treasure,.035,2)
box('Velvet treasure inset',(0,0,.656),(1.03,.66,.035),M['leafDark'],treasure,.09,3)
for x in (-.42,.42):
    box('Treasure vertical band',(x,-.43,.39),(.10,.055,.43),M['copper'],treasure,.022)
    for z in (.24,.52):rivet('Treasure band rivet',(x,-.472,z),treasure,.029)
box('Treasure lock plate',(0,-.47,.44),(.20,.065,.24),M['gold'],treasure,.06,3)
lock=lathe('Lock inset',[(.045,0),(.045,.012)],M['woodDark'],treasure,count=12)
lock.rotation_euler[0]=math.pi/2;lock.location=(0,-.51,.46)
lid=root('treasure_lid');lid.parent=treasure;lid.location=(0,.40,.65);lid['md_joint']=True
segments=14;verts=[]
for x in (-.62,.62):
    for i in range(segments+1):
        a=math.pi*i/segments
        verts.append((x,-.40+.43*math.cos(a),.06+.36*math.sin(a)))
faces=[]
for i in range(segments):faces.append((i,i+1,segments+2+i,segments+1+i))
faces += [tuple(reversed(range(segments+1))),tuple(segments+1+i for i in range(segments+1))]
mesh('Curved wooden chest lid',verts,faces,M['woodLight'],lid,True)
for x in (-.43,.43):
    points=[(x,-.40+.445*math.cos(math.pi*i/14),.07+.375*math.sin(math.pi*i/14)) for i in range(15)]
    tube('Lid arched brass band',points,.035,M['gold'],lid,8)
lid.rotation_euler[0]=-math.radians(58)
lathe('Treasured living amber seed',[(.11,0),(.22,.12),(.25,.28),(.17,.45),(.035,.57),(0,.59)],M['amber'],treasure,(0,-.08,.67),20,.035,(.80,1,1))
for side in (-1,1):
    leaf('Jade seed sheath',(0,-.04,.70),(side*.35,-.06,1.16),.20,M['jade'],treasure,.10,6)
    tube('Treasure seed filigree',[(side*.08,-.26,.76),(side*.12,-.28,.95),(side*.05,-.20,1.17)],.015,M['gold'],treasure,6)
for i,(x,y) in enumerate(((-.33,-.24),(.35,-.19),(-.34,.07),(.30,.14),(.05,-.25),(-.14,.15))):
    for layer in range(1+i%3):
        lathe('Scattered warm brass treasure coins',[(.062,0),(.068,.009),(.068,.026),(.059,.033)],M['gold'],treasure,(x,y,.68+layer*.026),10,.015,(1,1,1))

# Real arched doorway: separate shaped voussoirs, worn jambs and a botanical crest.
exit_root=root('exit');prefabs['exit']=exit_root
stone('Portal threshold',(0,0,0),(2.10,1.06,.16),M['stoneDark'],exit_root,.025)
stone('Portal threshold upper',(0,-.10,.14),(1.67,.91,.11),M['stoneLight'],exit_root,.018)
for side in (-1,1):
    for row in range(4):
        stone('Portal jamb stone',(side*.86,.07,.20+row*.32),(.43,.58,.34),M['stoneLight'] if row%2 else M['stone'],exit_root,.018)
    box('Portal copper jamb inlay',(side*.65,-.252,.86),(.038,.030,1.18),M['gold'],exit_root,.012)
for i in range(9):
    a0=i*math.pi/9+.016;a1=(i+1)*math.pi/9-.016
    ring=[]
    for y in (-.25,.38):
        for r,a in ((.65,a0),(1.08,a0),(1.08,a1),(.65,a1)):
            ring.append((r*math.cos(a),y,1.44+r*math.sin(a)))
    obj=mesh('Sculpted portal arch stone',ring,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],M['stoneLight'] if i%3 else M['stone'],exit_root)
    b=obj.modifiers.new('Worn arch edges','BEVEL');b.width=.024;b.segments=2
    obj.modifiers.new('Weighted arch normals','WEIGHTED_NORMAL')
tube('Portal fine copper arch',[(.65*math.cos(math.pi*i/20),-.285,1.44+.65*math.sin(math.pi*i/20)) for i in range(21)],.022,M['gold'],exit_root,6)
for side in (-1,1):
    tube('Portal climbing vine',[(side*1.02,-.28,.32),(side*1.12,-.27,.85),(side*.97,-.30,1.35),(side*.82,-.30,1.92),(side*.4,-.32,2.28)],.034,M['leafDark'],exit_root,7)
    for j in range(5):
        z=.60+j*.34;x=side*(1.04-max(0,z-1.2)*.43)
        leaf('Portal leaf relief',(x,-.31,z),(x+side*.22,-.33,z+.16),.19,M['leaf'],exit_root,.055,5)
leaf('Portal jade crest',(0,-.34,2.20),(0,-.35,2.71),.36,M['jade'],exit_root,.10,7)
for side in (-1,1):leaf('Portal crest side leaf',(0,-.34,2.25),(side*.32,-.34,2.47),.19,M['gold'],exit_root,.07,5)
lathe('Portal weathered guardian medallion',[(.19,0),(.23,.025),(.19,.065),(.10,.085)],M['copper'],exit_root,(0,-.33,2.24),14,.025,(1,.32,1))
for side in (-1,1):
    # The two carved eyes and pointed ears make the treasury gate a distinct motif.
    leaf('Portal guardian crest ear',(side*.14,-.35,2.27),(side*.33,-.34,2.60),.15,M['stoneLight'],exit_root,.02,5)
    stone('Portal guardian brow',(side*.105,-.39,2.32),(.13,.055,.07),M['gold'],exit_root,.003)
    tube('Portal suspended copper lamp bracket',[(side*.96,.02,1.26),(side*1.12,-.05,1.44),(side*1.13,-.18,1.54)],.023,M['copper'],exit_root,6)
    lathe('Portal tiny warm lamp core',[(.065,0),(.088,.045),(.075,.15),(.025,.19)],M['amber'],exit_root,(side*1.13,-.18,1.20),10,.035)
    lathe('Portal tiny lamp hood',[(.10,0),(.12,.032),(.04,.10)],M['copper'],exit_root,(side*1.13,-.18,1.37),10,.035)

# A full fern in a handmade ribbed terracotta planter.
fern=root('fern');prefabs['fern']=fern
lathe('Hand-thrown planter',[(.24,0),(.29,.06),(.34,.44),(.38,.48),(.38,.55),(.31,.57)],M['terracotta'],fern,count=18,wobble=.025)
lathe('Planter lip brass',[(.365,.47),(.385,.49),(.385,.52),(.363,.54)],M['copper'],fern,count=18)
lathe('Planter soil',[(.305,0),(.305,.04)],M['woodDark'],fern,(0,0,.52),18)
for i in range(12):
    a=i*math.tau/12
    tube('Planter sculpted rib',[(.275*math.cos(a),.275*math.sin(a),.10),(.31*math.cos(a),.31*math.sin(a),.33),(.335*math.cos(a),.335*math.sin(a),.45)],.012,M['capLight'],fern,5)
for i in range(7):
    a=i*math.tau/7+.2; reach=.63+random.uniform(-.09,.18)
    points=[]
    for j in range(7):
        t=j/6
        points.append((math.cos(a)*reach*t,math.sin(a)*reach*t,.55+.82*math.sin(t*math.pi*.70)))
    tube('Arched fern rachis',points,[.025-.003*j for j in range(7)],M['leafLight'],fern,5)
    for j in range(1,6):
        t=j/6;start=Vector(points[j]);spread=.27*(1-t*.55)
        for side in (-1,1):
            direction=Vector((math.cos(a+side*1.0),math.sin(a+side*1.0),.10))
            end=start+direction*spread
            leaf('Fern pinna',start,end,.10*(1-t*.35),M['leafLight'] if j>3 else M['leaf'],fern,.035,4)

# Twisting mushrooms with modelled gills and irregular pigment islands.
mushroom=root('mushroom');prefabs['mushroom']=mushroom
for j,(cx,cy,scale) in enumerate(((-.20,.04,1.0),(.26,-.10,.64),(.15,.32,.45))):
    stem=lathe('Twisted ivory mushroom stem',[(.105,0),(.085,.15),(.075,.42),(.11,.55)],M['cream'],mushroom,(cx,cy,0),12,.09,(scale,scale,scale))
    cap_z=.53*scale
    cap=lathe('Sculpted mushroom cap',[(.09,0),(.41,.04),(.45,.10),(.39,.23),(.24,.36),(.07,.41),(0,.42)],M['cap'],mushroom,(cx,cy,cap_z),24,.035,(scale,scale,scale))
    lathe('Ivory cap lip',[(.40,.035),(.447,.07),(.445,.10)],M['capLight'],mushroom,(cx,cy,cap_z),24,.025,(scale,scale,scale))
    for k in range(14):
        a=k*math.tau/14
        points=[(cx+math.cos(a)*r*scale,cy+math.sin(a)*r*scale,cap_z+z*scale) for r,z in ((.09,.015),(.24,.028),(.39,.048))]
        tube('Fine mushroom gill',points,.009*scale,M['cream'],mushroom,4)
    for k in range(5):
        a=k*1.71;r=.22*scale
        lathe('Mushroom ivory fleck',[(.035,0),(.045,.006),(.025,.015)],M['cream'],mushroom,(cx+math.cos(a)*r,cy+math.sin(a)*r,cap_z+.374*scale),7,.22,(scale,scale,scale))

# Curved copper wall-lantern, real cage bars and an amber inner core.
lantern=root('lantern');prefabs['lantern']=lantern
stone('Lantern small plinth',(0,0,0),(.48,.48,.15),M['stoneDark'],lantern,.015)
lathe('Lantern lower rim',[(.20,.12),(.25,.18),(.25,.23),(.21,.27)],M['copper'],lantern,count=16)
lathe('Lantern amber glass',[(.16,.25),(.18,.34),(.18,.66),(.14,.75)],M['amber'],lantern,count=16)
lathe('Lantern scalloped hood',[(.26,.71),(.28,.75),(.17,.89),(.07,.96)],M['copper'],lantern,count=16,wobble=.035)
for i in range(6):
    a=i*math.tau/6
    tube('Lantern carved cage bar',[(.21*math.cos(a),.21*math.sin(a),.25),(.225*math.cos(a),.225*math.sin(a),.45),(.20*math.cos(a),.20*math.sin(a),.72)],.019,M['gold'],lantern,6)
tube('Lantern hanging ring',[(.10*math.cos(i*math.pi/12),0,1.0+.13*math.sin(i*math.pi/12)) for i in range(25)],.022,M['iron'],lantern,6)

# The ruin edge is a designed miniature silhouette, separate from all collisions.
# Raised decoration starts outside x +/-5 or y +/-7; the central route stays legible.
trim=root('trim');prefabs['trim']=trim
for side in (-1,1):
    cursor=-6.96
    for j,length in enumerate((1.30,1.69,1.04,1.57,1.35,1.63,1.13,1.66,1.50,1.11)):
        y=cursor+length*.5;cursor+=length
        if y>6.8:break
        stone('Broken slate boundary foundation',(side*5.17,y,-.06),(.30,length-.045,.29+random.uniform(-.04,.04)),M['stoneDark'],trim,.022)
        stone('Soft grey stone edge coping',(side*5.17,y,.20),(.34,length-.08,.09),M['stone'],trim,.022)
        if j in (0,3,6,8):
            # Short root-covered buttresses give depth without hiding the playing field.
            stone('Exterior ruin buttress',(side*5.38,y-.14,-.40),(.34,.58,.83),M['stoneDark'],trim,.028)
            stone('Exterior buttress crown',(side*5.38,y-.14,.40),(.39,.63,.13),M['stone'],trim,.025)
            box('Buttress weathered copper seam',(side*5.39,y-.45,.10),(.19,.025,.38),M['patina'],trim,.02,2)
    for j in range(7):
        x=-4.30+j*1.43
        stone('Irregular end foundation stone',(x,side*7.16,-.10),(1.39,.34,.34),M['stoneDark'],trim,.028)
        stone('Irregular end stone coping',(x,side*7.16,.20),(1.34,.37,.10),M['stone'],trim,.025)
    # Large organic root arcs travel along the exterior; their forks never cross the walkway.
    for j,y in enumerate((-5.7,-2.3,1.6,5.3)):
        points=[(side*5.47,y-.63,-.57),(side*5.51,y-.42,-.12),(side*5.38,y-.16,.26),(side*5.20,y+.10,.36),(side*5.30,y+.47,.24),(side*5.54,y+.72,-.06)]
        tube('Old branching oak root on ruin side',points,[.055,.09,.115,.13,.09,.025],M['root'],trim,7)
        tube('Fine root raised grain',[(x+side*.04,yy-.035,z+.055) for x,yy,z in points[1:-1]],.012,M['rootLight'],trim,5)
        for k in range(2):
            start=points[2+k]
            tube('Forked exterior root', [start,(side*5.51,y+.18+k*.18,.06),(side*5.58,y+.32+k*.27,-.28)], [.055,.033,.008],M['root'],trim,6)
    for j in range(15):
        y=-6.62+j*.94+random.uniform(-.17,.17);x=side*(5.20+random.uniform(.0,.23))
        for k in range(2):
            lathe('Sculpted moss cushion on ruined parapet',[(.045,0),(.12,.025),(.135,.065),(.072,.10),(0,.11)],M['moss'] if k==0 else M['mossLight'],trim,(x,y+k*.13,.25),9,.17,(.85,1.6,.70))
        if j%3==0:
            for k in range(3):
                xx=side*(5.31+k*.075);yy=y+k*.17
                tube('Tiny crooked luminous fungus stem',[(xx,yy,.31),(xx+side*.02,yy,.42),(xx+side*.04,yy+.02,.49+k*.04)], [.023,.018,.014],M['leafDark'],trim,6)
                lathe('Tiny luminous mint fungus crown',[(.035,0),(.10,.015),(.12,.05),(.08,.09),(0,.11)],M['capLight'] if k%2 else M['cap'],trim,(xx+side*.04,yy+.02,.48+k*.04),10,.08,(1,.75,.75))
        if j%4==1:
            for k in range(3):
                start=(side*5.25,y,.32);end=(side*(5.45+k*.035),y-.22+k*.20,.48+k*.07)
                leaf('Ruin fern accent frond',start,end,.12,M['leafLight'] if k==2 else M['leaf'],trim,.05,5)
    for j in range(11):
        y=-6.7+j*1.27;stone('Fallen small edge shale',(side*5.45,y,-.38),(.32,.54,.17),M['stone'],trim,.04)
    for y in (-4.1,.8,4.7):
        # Small broken masonry and broad root leaves make clustered transitions
        # instead of outlining the whole courtyard with identical ornaments.
        for k in range(4):
            x=side*random.uniform(5.28,5.48);yy=y+random.uniform(-.35,.35)
            stone('Broken masonry flake in root bed',(x,yy,.10),(.15+random.random()*.10,.19+random.random()*.15,.07),M['stone'] if k%2 else M['stoneDark'],trim,.021)
        for k in range(4):
            x=side*5.25;yy=y+random.uniform(-.25,.25)
            leaf('Large sculpted exterior root leaf',(x,yy,.29),(side*(5.51+random.uniform(-.05,.02)),yy+random.uniform(-.33,.33),.38+random.uniform(0,.17)),.18,M['leaf'] if k%2 else M['leafLight'],trim,.08,6)

for x in (-5.17,5.17):
    for y in (-7.13,7.13):
        stone('Ruin corner layered foot',(x,y,-.40),(.53,.55,.50),M['stoneDark'],trim,.035)
        stone('Ruin corner broken capital',(x,y,.05),(.46,.48,.43),M['stone'],trim,.035)
        stone('Ruin corner broad arris',(x,y,.44),(.51,.52,.10),M['stoneLight'],trim,.028)
        lathe('Corner copper botanical finial',[(.115,0),(.15,.06),(.13,.15),(.055,.23),(.02,.27)],M['copper'],trim,(x,y,.54),12,.04)
        lathe('Finial amber seed glint',[(.035,0),(.062,.055),(.025,.12),(0,.13)],M['amber'],trim,(x,y,.77),10,.02)
        sx=1 if x>0 else -1;sy=1 if y>0 else -1
        rugged_rock('Broken corner bedrock below foundation',(sx*5.15,sy*7.13,-.97),(.91,1.03,.76),trim)
        rugged_rock('Detached small corner crag',(sx*5.43,sy*6.73,-.86),(.38,.62,.55),trim)
        tube('Old corner root holding broken masonry',[(sx*5.1,sy*6.68,.22),(sx*5.25,sy*6.88,.37),(sx*5.4,sy*7.08,.21),(sx*5.5,sy*7.22,-.19),(sx*5.31,sy*7.39,-.63)], [.065,.14,.13,.09,.018],M['root'],trim,7)
        for k in range(5):
            xx=sx*(5.12+random.uniform(-.06,.21));yy=sy*(6.65+random.uniform(-.09,.27))
            lathe('Dense corner velvet moss tuft',[(.045,0),(.13,.03),(.14,.065),(.07,.105),(0,.12)],M['mossLight'] if k%3==0 else M['moss'],trim,(xx,yy,.28),9,.19,(1.1,.8,.8))
        for k in range(3):
            xx=sx*(5.32+random.uniform(-.06,.06));yy=sy*(6.48+k*.16)
            tube('Corner pale fungal stem',[(xx,yy,.24),(xx+.01,yy,.35),(xx+.025,yy,.44)], [.025,.02,.014],M['cream'],trim,6)
            lathe('Corner stacked mint fungus shelf',[(.04,0),(.12,.025),(.14,.06),(.08,.12),(0,.13)],M['capLight'] if k==1 else M['cap'],trim,(xx+.025,yy,.41),10,.07,(1,.75,1))

for side in (-1,1):
    for j,y in enumerate((-4.5,-1.05,2.95,5.38)):
        rugged_rock('Asymmetric exposed side rock shelf',(side*(5.25+.05*(j%2)),y,-.83),(.72,.96,.61),trim)
    for x in (-3.9,-1.55,1.20,3.65):
        rugged_rock('Broken front and back rock ledge',(x,side*7.18,-.89),(.93,.64,.69),trim)

# Two taller back-edge remnants imply a larger building without obscuring routes.
for side in (-1,1):
    for row in range(3):
        stone('Far corner old wall stump',(side*4.43,7.28,.30+row*.31),(.75,.38,.31),M['stone'],trim,.03)
    stone('Far corner old coping',(side*4.43,7.28,1.21),(.83,.44,.14),M['stoneLight'],trim,.035)
    tube('Far-wall loose copper winding',[(side*4.1,7.04,.50),(side*4.35,7.02,.67),(side*4.61,7.04,.86)],.022,M['copper'],trim,6)
    for k in range(4):
        lathe('Moss on rear ruin silhouette',[(.07,0),(.13,.035),(.08,.06),(0,.08)],M['moss'],trim,(side*(4.14+k*.16),7.25,1.35),8,.18,(1,.7,1))

# An editable showcase arrangement in the source .blend. Exporter removes root transforms.
positions={
    'floor':(0,0,0),'trim':(0,0,0),'cabinet':(-2.0,-2.5,.05),'board':(.2,-.7,.05),
    'pillar':(3,1.1,.05),'wall':(-3.3,2.6,.05),'treasure':(.1,4.2,.05),
    'exit':(0,6.1,.05),'fern':(-4.1,4.5,.05),'mushroom':(4.1,-3.7,.05),'lantern':(4.1,4.8,.05),
}
for name,obj in prefabs.items():obj.location=positions[name]
bpy.context.view_layer.update()

raw_output=ROOT/'.build/raw-models/environment.json'
result=export_library(prefabs, str(raw_output))
output=ROOT/'assets/models/environment.json'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(pack_library(result),separators=(',',':')),encoding='utf-8')
print('Packed q16-n8-c8-v1',output,output.stat().st_size,'bytes; all exported triangles and joints retained')

# Lighting and cameras are source-preview only, not part of the game asset library.
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=False
scene.world.color=(.09,.13,.16)
world=scene.world
world.use_nodes=True
world.node_tree.nodes.get('Background').inputs[0].default_value=(.10,.15,.19,1)
world.node_tree.nodes.get('Background').inputs[1].default_value=.40
for name,loc,color,power,size in [
    ('Warm skylight',(-4,-5,11),(1.0,.89,.73),1500,8),
    ('Cool vault fill',(6,1,8),(.60,.79,1.0),1100,7),
    ('Golden exit rim',(-2,8,7),(1.0,.69,.38),1000,5),
]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Environment review camera')
camera=bpy.data.objects.new('Environment review camera',camera_data);bpy.context.collection.objects.link(camera)
camera.location=(10,-15,18)
camera.rotation_euler=(Vector((0,.6,.1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO';camera_data.ortho_scale=22.5
scene.camera=camera
scene.render.resolution_x=1000;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
preview=ROOT.parent/'art-preview';preview.mkdir(parents=True,exist_ok=True)
scene.render.filepath=str(preview/'environment-review.png')
(ROOT/'art-source').mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art-source/environment.blend'),compress=True)
bpy.ops.render.render(write_still=True)
# Same tilt and field width as the current game, without UI or gameplay shadows.
camera.location=(0,-10,24)
camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.ortho_scale=11.7/(720/1280)
scene.render.resolution_x=840;scene.render.resolution_y=1200
camera_data.ortho_scale=11.7/(840/1200)
scene.render.filepath=str(preview/'environment-game-angle.png')
bpy.ops.render.render(write_still=True)
print('Environment source and preview complete.')
