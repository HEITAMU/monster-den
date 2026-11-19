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


def material(name, color, roughness=.68, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return m


M = {
    'stone': material('Warm weathered limestone', (.46, .36, .25)),
    'stoneLight': material('Cut sandstone edges', (.66, .55, .38)),
    'stoneDark': material('Stone crevices', (.245, .23, .17)),
    'mortar': material('Recessed old mortar', (.18, .20, .13)),
    'wood': material('Old honey chestnut', (.36, .185, .075)),
    'woodLight': material('Polished carved chestnut edges', (.54, .30, .115)),
    'woodDark': material('Carved wood recess', (.18, .078, .035)),
    'endgrain': material('Fresh split wood fibres', (.67, .43, .19)),
    'copper': material('Warm aged brass', (.56, .32, .12), .34, .58),
    'gold': material('Polished brass lip', (.79, .54, .20), .30, .65),
    'iron': material('Blackened workshop iron', (.12, .135, .105), .42, .5),
    'moss': material('Soft moss', (.23, .34, .09)),
    'leaf': material('Emerald leaf', (.11, .31, .105), .55),
    'leafLight': material('Fern new growth', (.30, .49, .12), .60),
    'leafDark': material('Fern underside', (.075, .205, .075)),
    'terracotta': material('Russet ceramic', (.55, .22, .095)),
    'cap': material('Vermilion mushroom velvet', (.68, .25, .08), .8),
    'capLight': material('Mushroom cap rim', (.87, .48, .18), .8),
    'cream': material('Warm ivory', (.83, .71, .42)),
    'amber': material('Lantern warm glass', (1.0, .57, .15), .25),
    'jade': material('Living jade seed', (.20, .63, .31), .28),
}
FLOOR_MATS = [material(f'Sandstone tile tone {i}', (.42 + i*.025, .34 + i*.021, .235 + i*.016)) for i in range(7)]


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

# A continuous, irregularly worn flagstone floor, with real recessed joints.
floor=root('floor');prefabs['floor']=floor
box('Deep old foundation',(0,0,-.23),(10,14,.42),M['mortar'],floor,.14,3)
for row in range(10):
    y=-6.3+row*1.4
    stagger=.70 if row%2 else 0
    for col in range(8):
        left=-5+col*1.42-stagger
        right=left+1.39
        left=max(-4.98,left);right=min(4.98,right)
        if right-left<.20:continue
        stone(f'Worn flagstone {row:02d} {col:02d}',((left+right)/2,y,-.04),(right-left,1.365,.09),random.choice(FLOOR_MATS),floor,.017)
        if random.random()<.28:
            xx=(left+right)/2;yy=y+random.uniform(-.5,.5)
            tube('Fine worn chip',[(xx-.16,yy,.057),(xx-.03,yy+.05,.057),(xx+.12,yy+.035,.057)],.009,M['stoneDark'],floor,4)
for i in range(18):
    x=random.choice([-1,1])*random.uniform(3.7,4.8);y=random.uniform(-6.7,6.7)
    lathe('Low joint moss',[(.08,0),(.14,.02),(.10,.035),(.025,.04)],M['moss'],floor,(x,y,.04),8,.17,(1.5,.6,1))

# The cabinet is one mobile piece: carved carcass, copper corners, raised drawers, castors.
cabinet=root('cabinet');prefabs['cabinet']=cabinet
box('Cabinet dark carcass',(0,0,.84),(1.56,1.43,1.18),M['woodDark'],cabinet,.11,3)
for side in (-1,1):
    for plank in range(4):
        box('Side chestnut panel',(side*.777,-.51+plank*.34,.86),(.09,.327,1.03),M['wood'],cabinet,.025,2)
    box('Side inset brass border',(side*.833,0,.87),(.028,1.16,.79),M['copper'],cabinet,.025)
    box('Recessed side carving',(side*.852,0,.87),(.025,1.045,.67),M['woodLight'],cabinet,.055)
    for y in (-.51,.51):
        box('Corner copper strap',(side*.798,y, .87),(.10,.14,1.24),M['copper'],cabinet,.038)
        for z in (.37,1.37):rivet('Strap rivet',(side*.858,y,z),cabinet,.036,facing='side')
    # A leaf-shaped side relief makes the silhouette readable in the high camera.
    path=[(side*.882,-.33,.62),(side*.887,-.15,.78),(side*.884,.11,.93),(side*.88,.33,1.14)]
    tube('Carved side vine',path,.018,M['woodDark'],cabinet)
for row,z in enumerate((.65,1.14)):
    box('Raised drawer front',(0,-.747,z),(1.37,.16,.41),M['woodLight'],cabinet,.055,3)
    box('Carved drawer recess',(0,-.837,z),(1.18,.025,.27),M['wood'],cabinet,.042)
    for side in (-1,1):rivet('Drawer pull anchor',(side*.23,-.868,z+.03),cabinet,.05)
    tube('Curved brass drawer pull',[(-.23,-.89,z+.03),(-.21,-1.0,z-.065),(0,-1.035,z-.105),(.21,-1.0,z-.065),(.23,-.89,z+.03)],.035,M['gold'],cabinet,8)
    for side in (-1,1):
        tube('Drawer botanical incise',[(side*.38,-.856,z-.055),(side*.47,-.858,z),(side*.43,-.856,z+.08)],.010,M['woodDark'],cabinet,5)
box('Lower cabinet cornice',(0,0,.32),(1.69,1.55,.16),M['copper'],cabinet,.055,3)
box('Upper cabinet cornice',(0,0,1.48),(1.73,1.61,.14),M['copper'],cabinet,.06,3)
box('Solid chestnut top',(0,0,1.56),(1.66,1.54,.115),M['woodLight'],cabinet,.055,3)
for x in (-.43,.1):tube('Top board seam',[(x,-.68,1.622),(x+.015,0,1.622),(x-.01,.68,1.622)],.009,M['woodDark'],cabinet,4)
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

# Unit wall section. Scale x/z in the renderer to match each logical rectangle.
wall=root('wall');prefabs['wall']=wall
for row in range(3):
    pieces=2 if row%2==0 else 3
    for col in range(pieces):
        width=1/pieces
        stone('Coursed wall stone',(-.5+(col+.5)*width,0,row*.29),(width-.018,.98,.30),M['stone'] if row!=2 else M['stoneLight'],wall,.012)
box('Wall worn coping',(0,0,.91),(1.02,1.04,.14),M['stoneLight'],wall,.07,3)
tube('Wall small moss seam',[(-.47,-.48,.58),(-.12,-.51,.56),(.17,-.49,.59)],.025,M['moss'],wall,5)

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

# Perimeter trim remains separate from gameplay obstacles.
trim=root('trim');prefabs['trim']=trim
for side in (-1,1):
    for j in range(10):
        stone('Side courtyard curb',(side*5.12,-6.3+j*1.4,-.06),(.30,1.34,.28),M['stoneDark'],trim,.02)
    for j in range(7):
        stone('End courtyard curb',(-4.3+j*1.43,side*7.12,-.06),(1.36,.30,.28),M['stoneDark'],trim,.02)
for x in (-5.08,5.08):
    for y in (-7.08,7.08):
        stone('Courtyard corner plinth',(x,y,-.08),(.56,.56,.42),M['stone'],trim,.03)
        lathe('Corner copper botanical finial',[(.16,0),(.18,.08),(.10,.18),(.035,.27)],M['copper'],trim,(x,y,.33),12,.03)

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
scene.cycles.samples=48
scene.cycles.use_denoising=False
scene.world.color=(.23,.26,.21)
world=scene.world
world.use_nodes=True
world.node_tree.nodes.get('Background').inputs[0].default_value=(.20,.24,.20,1)
world.node_tree.nodes.get('Background').inputs[1].default_value=.45
for name,loc,color,power,size in [
    ('Warm skylight',(-4,-5,11),(1.0,.82,.59),1600,8),
    ('Soft workshop fill',(6,1,8),(.69,.82,1.0),1000,7),
    ('Golden exit rim',(-2,8,7),(1.0,.63,.28),1000,5),
]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Environment review camera')
camera=bpy.data.objects.new('Environment review camera',camera_data);bpy.context.collection.objects.link(camera)
camera.location=(11,-15,17)
camera.rotation_euler=(Vector((0,.6,.1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO';camera_data.ortho_scale=18.4
scene.camera=camera
scene.render.resolution_x=1100;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
preview=ROOT.parent/'art-preview';preview.mkdir(parents=True,exist_ok=True)
scene.render.filepath=str(preview/'environment-review.png')
(ROOT/'art-source').mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art-source/environment.blend'),compress=True)
bpy.ops.render.render(write_still=True)
print('Environment source and preview complete.')
