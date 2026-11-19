"""Original articulated character sculpts for Monster Den.

Run: blender --background --python tools/make-characters.py -- --hero-only
All visible forms are authored meshes/curves, not camera-facing artwork.
The model library uses the shared exporter and mobile-scale triangle budgets.
"""
import bpy
import math
import sys
import json
from pathlib import Path
from mathutils import Vector

PROJECT = Path(__file__).resolve().parents[1]
PREVIEW = PROJECT.parent / 'art-preview'
PREVIEW.mkdir(exist_ok=True, parents=True)
sys.path.insert(0, str(PROJECT / 'tools'))
from export_mesh_library import export_library

HERO_ONLY = '--hero-only' in sys.argv
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)

def linear(x):
    return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4

def material(name, color, rough=0.7, metal=0):
    color = color.lstrip('#')
    rgba = tuple(linear(int(color[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return mat

M = {
    'fur': material('Badger | warm slate fur', '#776B60'),
    'darkfur': material('Badger | espresso mask', '#342B29'),
    'cream': material('Badger | warm ivory face', '#E6D9BA'),
    'creamshade': material('Badger | warm underside', '#B3A181'),
    'nose': material('Nose | satin charcoal', '#211B1B', 0.42),
    'eye': material('Eyes | ivory', '#EFE3BD', 0.37),
    'iris': material('Eyes | honey amber', '#AC6F22', 0.37),
    'pupil': material('Eyes | near black', '#161B19', 0.3),
    'highlight': material('Eyes | glint', '#FFF3D5', 0.25),
    'ear': material('Ears | muted clay', '#B7826E'),
    'leather': material('Gear | worn chestnut leather', '#6B422E'),
    'leatheredge': material('Gear | ochre leather stitching', '#B78A55'),
    'boot': material('Boots | charcoal leather', '#383832'),
    'brass': material('Gear | aged brass', '#C3944B', 0.5, 0.18),
    'brassdark': material('Gear | patinated brass edge', '#73572F', 0.62, 0.12),
    'scarf': material('Scarf | burnt vermilion wool', '#BB553E'),
    'scarfshade': material('Scarf | shaded folds', '#773B30'),
    'claw': material('Claws | old ivory', '#CDBD97'),
    'green': material('Guard | moss green coat', '#617544'),
    'greendark': material('Guard | forest shadow', '#344B34'),
    'fungus': material('Guard | chestnut mushroom cap', '#B2643D'),
    'funguslight': material('Guard | orange cap edge', '#DA9652'),
    'fungusspot': material('Guard | mushroom cream spots', '#E1BC7D'),
    'gills': material('Guard | mushroom gills', '#A88D65'),
    'lizard': material('Archer | sage scales', '#769665'),
    'lizarddark': material('Archer | forest scales', '#3C6547'),
    'lizardlight': material('Archer | pale throat', '#CFBD82'),
    'shell': material('Boss | burnt bronze shell', '#756044'),
    'shelledge': material('Boss | copper raised plates', '#B08B4D'),
    'bossflesh': material('Boss | deep teal hide', '#3F6862'),
    'bosslight': material('Boss | sage skin fold', '#739284'),
}

def parent_keep(obj, parent):
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix
    return obj

def pivot(name, parent, location):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    if parent:
        parent_keep(obj, parent)
        obj['md_joint'] = True
    return obj

def mesh_obj(name, verts, faces, mat, parent, smooth=True):
    mesh = bpy.data.meshes.new(name + '.mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    if parent:
        parent_keep(obj, parent)
    return obj

def ellipsoid(name, center, radii, mat, parent, segments=16, rings=10, rotation=None):
    # Explicit profile mesh, with smooth normals and optional swept/tapered proportions.
    verts = [(0, 0, radii[2])]
    for ring in range(1, rings):
        a = math.pi * ring / rings
        for segment in range(segments):
            b = 2 * math.pi * segment / segments
            verts.append((radii[0]*math.sin(a)*math.cos(b), radii[1]*math.sin(a)*math.sin(b), radii[2]*math.cos(a)))
    verts.append((0, 0, -radii[2]))
    bottom = len(verts) - 1
    faces = []
    for s in range(segments):
        faces.append((0, 1+s, 1+(s+1)%segments))
    for r in range(rings-2):
        for s in range(segments):
            a = 1+r*segments+s; b = 1+r*segments+(s+1)%segments
            faces.append((a, a+segments, b+segments, b))
    for s in range(segments):
        faces.append((bottom, 1+(rings-2)*segments+(s+1)%segments, 1+(rings-2)*segments+s))
    obj = mesh_obj(name, verts, faces, mat, None)
    obj.location = center
    if rotation:
        obj.rotation_euler = rotation
    if parent:
        parent_keep(obj, parent)
    return obj

def loft(name, rows, mat, parent, segments=24, deform=None):
    # Rows: center x/y/z and radius x/y, one continuous shaped skin.
    verts=[]
    for ri, (x,y,z,rx,ry) in enumerate(rows):
        for s in range(segments):
            angle=2*math.pi*s/segments
            point=(x+rx*math.cos(angle), y+ry*math.sin(angle), z)
            verts.append(deform(point, angle, ri) if deform else point)
    faces=[]
    for r in range(len(rows)-1):
        for s in range(segments):
            a=r*segments+s; b=r*segments+(s+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.append(tuple(range(segments-1,-1,-1)))
    faces.append(tuple((len(rows)-1)*segments+s for s in range(segments)))
    return mesh_obj(name, verts, faces, mat, parent)

def tube(name, points, widths, mat, parent, sides=10, flatten=1):
    verts=[]
    previous_a=None
    for i,p in enumerate(points):
        p=Vector(p)
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        tangent.normalize()
        if previous_a is None:
            up=Vector((0,0,1)) if abs(tangent.z)<0.9 else Vector((0,1,0))
            a=tangent.cross(up).normalized()
        else:
            a=(previous_a-tangent*previous_a.dot(tangent)).normalized()
        b=tangent.cross(a).normalized();previous_a=a
        for s in range(sides):
            angle=2*math.pi*s/sides
            v=p+a*math.cos(angle)*widths[i]+b*math.sin(angle)*widths[i]*flatten
            verts.append(tuple(v))
    faces=[]
    for r in range(len(points)-1):
        for s in range(sides):
            a=r*sides+s; b=r*sides+(s+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(range(sides-1,-1,-1)))
    faces.append(tuple((len(points)-1)*sides+s for s in range(sides)))
    return mesh_obj(name,verts,faces,mat,parent)

def stroke(name, points, radius, mat, parent, sides=5, resolution=5):
    curve=bpy.data.curves.new(name+'.curve','CURVE')
    curve.dimensions='3D'; curve.resolution_u=resolution
    curve.bevel_depth=radius; curve.bevel_resolution=0
    spline=curve.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for v,p in zip(spline.bezier_points,points):
        v.co=p;v.handle_left_type='AUTO';v.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)
    for poly in obj.data.polygons:poly.use_smooth=True
    if parent:parent_keep(obj,parent)
    return obj

def box(name, center, scale, mat, parent, bevel=0.03, segments=2, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=2, location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rotation:obj.rotation_euler=rotation
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('rounded sewn edge','BEVEL');mod.width=bevel;mod.segments=segments
        norm=obj.modifiers.new('weighted soft normals','WEIGHTED_NORMAL')
        norm.keep_sharp=True
    parent_keep(obj,parent)
    obj.select_set(False)
    return obj

def horn(name, base, tip, width, mat, parent, bend=None, sides=8):
    b=Vector(base);t=Vector(tip)
    mid=b.lerp(t,.58)
    if bend:mid+=Vector(bend)
    return tube(name,[tuple(b),tuple(b.lerp(mid,.5)),tuple(mid),tuple(t)],[width,width*.78,width*.42,.002],mat,parent,sides)

def face_patch(name, profile, mat, parent, steps=16):
    # Profile is a set of 3D cross-strip pairs; a raised curved skin marking.
    verts=[]
    for left,right in profile:verts.extend([left,right])
    faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(profile)-1)]
    return mesh_obj(name,verts,faces,mat,parent)

def eye(prefix, x, y, z, parent, scale=1, angry=False):
    s=scale
    ellipsoid(prefix+'.socket',(x,y+.012*s,z),(.123*s,.044*s,.104*s),M['darkfur'],parent,16,8)
    ellipsoid(prefix+'.white',(x,y-.013*s,z),(.099*s,.045*s,.078*s),M['eye'],parent,16,8)
    ellipsoid(prefix+'.iris',(x+.008*s,y-.052*s,z-.005*s),(.045*s,.014*s,.058*s),M['iris'],parent,12,8)
    ellipsoid(prefix+'.pupil',(x+.008*s,y-.064*s,z-.004*s),(.023*s,.009*s,.045*s),M['pupil'],parent,10,6)
    ellipsoid(prefix+'.spark',(x-.009*s,y-.073*s,z+.021*s),(.014*s,.006*s,.014*s),M['highlight'],parent,8,5)
    direction=-1 if x<0 else 1
    inner_z=z+.055*s if angry else z+.078*s
    outer_z=z+.083*s if angry else z+.067*s
    stroke(prefix+'.upperlid',[(x-direction*.095*s,y-.036*s,outer_z),(x,y-.065*s,z+.085*s),(x+direction*.09*s,y-.035*s,inner_z)],.014*s,M['darkfur'],parent,resolution=4)
    stroke(prefix+'.lowerlid',[(x-.082*s,y-.028*s,z-.042*s),(x,y-.055*s,z-.078*s),(x+.085*s,y-.03*s,z-.039*s)],.009*s,M['creamshade'],parent,resolution=4)

def make_hero():
    root=pivot('hero',None,(0,0,0))
    head=pivot('hero.head',root,(0,0,1.15))
    armL=pivot('hero.arm.L',root,(-.34,.005,.94));armR=pivot('hero.arm.R',root,(.34,.005,.94))
    legL=pivot('hero.leg.L',root,(-.17,.015,.37));legR=pivot('hero.leg.R',root,(.17,.015,.37))
    tail=pivot('hero.tail',root,(0,.21,.51))
    scarf=pivot('hero.scarf',root,(.06,.20,1.03))

    body_rows=[(0,.035,.30,.12,.12),(0,.025,.35,.245,.18),(0,.03,.46,.31,.225),(0,.035,.64,.335,.235),
               (0,.03,.81,.315,.23),(0,.025,.97,.28,.20),(0,.015,1.09,.20,.155),(0,.015,1.17,.13,.12)]
    loft('hero.continuous-torso',body_rows,M['fur'],root,24)
    ellipsoid('hero.belly-panel',(0,-.171,.70),(.245,.069,.28),M['creamshade'],root,20,12)
    # Sculpted head: a broad cheek volume tapering through the skull into the jaw.
    head_rows=[(0,-.028,1.04,.10,.11),(0,-.045,1.10,.22,.18),(0,-.055,1.19,.33,.235),
               (0,-.055,1.31,.405,.282),(0,-.045,1.43,.435,.294),(0,-.012,1.57,.406,.277),
               (0,.015,1.69,.345,.239),(0,.024,1.79,.23,.173),(0,.024,1.835,.075,.07)]
    def head_deform(point,angle,ri):
        x,y,z=point
        forward=max(0,-math.sin(angle))
        y-=.055*math.exp(-((z-1.32)/.13)**2)*forward**5
        return (x,y,z)
    loft('hero.sculpted-cheeks-and-skull',head_rows,M['cream'],head,32,head_deform)
    # Dark badger markings track the curved face, rather than floating image planes.
    def front_surface(x,z):
        for i in range(len(head_rows)-1):
            a,b=head_rows[i],head_rows[i+1]
            if a[2]<=z<=b[2]:
                f=(z-a[2])/(b[2]-a[2]);rx=a[3]*(1-f)+b[3]*f;ry=a[4]*(1-f)+b[4]*f;cy=a[1]*(1-f)+b[1]*f
                k=math.sqrt(max(.015,1-(x/rx)**2))
                return cy-ry*k-.055*math.exp(-((z-1.32)/.13)**2)*k**5-.018
        return -.1
    for side in (-1,1):
        path=[(1.13,.135,.075),(1.22,.19,.10),(1.32,.22,.115),(1.43,.235,.123),
              (1.55,.23,.112),(1.66,.217,.085),(1.74,.18,.054),(1.785,.132,.033)]
        strip_verts=[];strip_faces=[];dense=[]
        for i in range(len(path)-1):
            for frac in(0,.5):
                dense.append(tuple(path[i][j]*(1-frac)+path[i+1][j]*frac for j in range(3)))
        dense.append(path[-1])
        columns=7
        for z,x,w in dense:
            for col in range(columns):
                xx=side*(x-w+2*w*col/(columns-1))
                strip_verts.append((xx,front_surface(xx,z),z))
        for row in range(len(dense)-1):
            for col in range(columns-1):
                a=row*columns+col
                strip_faces.append((a,a+1,a+1+columns,a+columns))
        mesh_obj(f'hero.face-mask.{side}',strip_verts,strip_faces,M['darkfur'],head)
        # Tapered ears with inset cups and slight asymmetry in angle.
        ellipsoid(f'hero.ear.{side}',(side*.315,.012,1.745),(.135,.093,.165),M['darkfur'],head,16,10,rotation=(0,side*.27,side*.08))
        ellipsoid(f'hero.ear-inner.{side}',(side*.324,-.066,1.758),(.082,.018,.104),M['creamshade'],head,12,8,rotation=(0,side*.27,0))
        ellipsoid(f'hero.ear-warmth.{side}',(side*.325,-.082,1.754),(.047,.008,.065),M['ear'],head,10,6)
        # Small cheek wedges extend the real silhouette.
        for i in range(3):
            base=(side*(.32+i*.013),.022-i*.029,1.30-i*.055)
            tip=(side*(.47-i*.016),-.01-i*.02,1.30-i*.063)
            horn(f'hero.cheek-tuft.{side}.{i}',base,tip,.079-i*.012,M['fur'] if i>0 else M['cream'],head,bend=(0,-.02,.018),sides=7)
        eye(f'hero.eye.{side}',side*.207,-.306,1.466,head,.90,True)
        stroke(f'hero.brow.{side}',[(side*.115,-.313,1.58),(side*.22,-.299,1.613),(side*.312,-.239,1.588)],.027,M['cream'],head,resolution=4)

    # Low, broad muzzle and triangular satin nose establish a badger rather than a sphere mascot.
    ellipsoid('hero.muzzle',(0,-.315,1.304),(.226,.172,.129),M['cream'],head,20,10)
    ellipsoid('hero.muzzle-lower',(0,-.364,1.243),(.159,.085,.061),M['creamshade'],head,16,8)
    nose_verts=[(-.122,-.457,1.335),(.122,-.457,1.335),(0,-.522,1.246),(-.098,-.498,1.338),(.098,-.498,1.338),(0,-.539,1.276),(0,-.483,1.36)]
    nose_faces=[(0,1,6),(0,3,4,1),(3,5,4),(0,2,5,3),(1,4,5,2),(0,6,1,2)]
    nose=mesh_obj('hero.triangular-nose',nose_verts,nose_faces,M['nose'],head)
    bevel=nose.modifiers.new('soft nose corners','BEVEL');bevel.width=.02;bevel.segments=2
    nose.modifiers.new('nose normals','WEIGHTED_NORMAL')
    stroke('hero.mouth-smirk',[(-.147,-.436,1.249),(-.069,-.465,1.226),(0,-.47,1.228),(.11,-.437,1.246)],.009,M['darkfur'],head,resolution=5)
    stroke('hero.nose-to-lip',[(0,-.49,1.28),(0,-.486,1.245),(0,-.47,1.228)],.007,M['darkfur'],head,resolution=3)
    for side in(-1,1):
        for i in range(2):
            ellipsoid(f'hero.whisker-dimple.{side}.{i}',(side*(.10+i*.04),-.449+i*.015,1.29+i*.012),(.009,.004,.009),M['creamshade'],head,6,4)

    # Short scarf: folded collar with cloth tails, not a flat cape.
    collar=[(-.20,-.01,1.06),(-.15,-.17,1.045),(0,-.205,1.02),(.18,-.16,1.055),(.21,.025,1.075),(.10,.18,1.085),(-.10,.18,1.08),(-.20,-.01,1.06)]
    stroke('hero.scarf-collar',collar,.063,M['scarf'],root,resolution=4)
    stroke('hero.scarf-fold',[(-.12,-.212,1.04),(0,-.235,1.025),(.14,-.199,1.062)],.012,M['scarfshade'],root,resolution=4)
    cloth_verts=[(-.035,.18,1.08),(.11,.18,1.08),(.15,.31,.98),(.045,.37,.89),(-.01,.29,.83),(-.10,.28,.96)]
    cloth_faces=[(0,1,2,3,4,5)]
    cloth=mesh_obj('hero.scarf-tail',cloth_verts,cloth_faces,M['scarf'],scarf)
    mod=cloth.modifiers.new('wool thickness','SOLIDIFY');mod.thickness=.023
    mod=cloth.modifiers.new('rounded cloth','BEVEL');mod.width=.018;mod.segments=2
    stroke('hero.scarf-tail-fold',[(.02,.20,1.07),(.045,.28,.98),(.012,.31,.88)],.008,M['scarfshade'],scarf,resolution=4)

    # Cross-body leather strap and brass clasp.
    strap=[(-.255,-.105,1.025),(-.19,-.21,.94),(-.07,-.244,.80),(.06,-.245,.68),(.195,-.19,.53),(.275,-.08,.46)]
    stroke('hero.crossbody-strap',strap,.032,M['leather'],root,resolution=5)
    stroke('hero.strap-stitch',[(-.18,-.241,.94),(-.06,-.278,.80),(.067,-.277,.68),(.18,-.226,.55)],.004,M['leatheredge'],root,resolution=4)
    box('hero.strap-buckle',(-.079,-.275,.82),(.055,.018,.057),M['brass'],root,.009,2,rotation=(0,-.65,0))
    box('hero.strap-buckle-inset',(-.079,-.296,.82),(.032,.006,.035),M['leather'],root,.005,2,rotation=(0,-.65,0))
    # A rounded, stitched satchel with a curved flap and visible brass button.
    box('hero.pouch',( .281,-.115,.49),(.105,.085,.118),M['leather'],root,.05,3,rotation=(0,-.12,-.13))
    box('hero.pouch-flap',(.281,-.198,.547),(.099,.018,.060),M['leatheredge'],root,.025,3,rotation=(.1,-.12,-.13))
    ellipsoid('hero.pouch-button',(.285,-.219,.52),(.020,.010,.020),M['brass'],root,10,6)
    stroke('hero.pouch-seam',[(.205,-.201,.51),(.211,-.204,.421),(.285,-.211,.398),(.355,-.189,.429)],.005,M['leatheredge'],root,resolution=3)

    for side,joint in [(-1,armL),(1,armR)]:
        tube(f'hero.arm.{side}.skin',[(side*.28,.005,.99),(side*.355,.015,.89),(side*.412,-.005,.76),(side*.425,-.072,.64),(side*.402,-.115,.57)], [.12,.13,.105,.093,.085],M['fur'],joint,12,1.02)
        # Cap-shaped shoulder plate, organically convex and trimmed.
        armor=ellipsoid(f'hero.pauldron.{side}',(side*.343,-.005,.974),(.169,.174,.12),M['brass'],joint,16,8)
        stroke(f'hero.pauldron-rim.{side}',[(side*.22,-.14,.948),(side*.36,-.179,.932),(side*.491,-.10,.934),(side*.48,.11,.952)],.014,M['brassdark'],joint,resolution=4)
        for z in(.963,.925):
            ellipsoid(f'hero.rivet.{side}.{z}',(side*.396,-.167,z),(.012,.008,.012),M['brassdark'],joint,8,5)
        tube(f'hero.wrist-cuff.{side}',[(side*.423,-.080,.66),(side*.416,-.103,.616)], [.106,.102],M['leather'],joint,12)
        ellipsoid(f'hero.paw.{side}',(side*.405,-.132,.548),(.103,.085,.102),M['darkfur'],joint,14,8)
        ellipsoid(f'hero.thumb.{side}',(side*.332,-.145,.559),(.044,.052,.054),M['darkfur'],joint,10,6)
        for i in range(3):
            x=side*.405+(i-1)*.047
            horn(f'hero.hand-claw.{side}.{i}',(x,-.192,.527),(x,-.237,.483),.017,M['claw'],joint,bend=(0,-.012,.008),sides=7)

    for side,joint in [(-1,legL),(1,legR)]:
        tube(f'hero.leg.{side}.skin',[(side*.165,.03,.40),(side*.19,.027,.30),(side*.185,-.012,.16)], [.125,.12,.092],M['darkfur'],joint,12,1.05)
        ellipsoid(f'hero.boot.{side}',(side*.19,-.095,.115),(.143,.215,.109),M['boot'],joint,16,8)
        stroke(f'hero.boot-sole.{side}',[(side*.19-.11,-.23,.058),(side*.19,-.292,.048),(side*.19+.11,-.23,.058)],.014,M['leather'],joint,resolution=4)
        for i in range(3):
            x=side*.19+(i-1)*.061
            horn(f'hero.toe.{side}.{i}',(x,-.265,.105),(x,-.334,.059),.026,M['claw'],joint,bend=(0,-.005,.01),sides=7)
        box(f'hero.boot-tab.{side}',(side*.19,-.206,.19),(.048,.014,.025),M['leather'],joint,.01,2)
        ellipsoid(f'hero.boot-stud.{side}',(side*.19,-.224,.19),(.014,.009,.014),M['brass'],joint,8,5)

    tube('hero.fluffy-tail',[(0,.20,.52),(0,.34,.52),(.03,.47,.59),(.05,.55,.72),(.045,.54,.82)], [.12,.15,.13,.095,.015],M['fur'],tail,12,1)
    for i in range(3):
        horn(f'hero.tail-tip.{i}',(-.05+i*.05,.49,.73),(-.07+i*.065,.55,.87),.05,M['creamshade'],tail,sides=7)
    root['description']='Original badger raider: sculpted face mask, eyelids, clawed paws, brass shoulder plates, stitched satchel and wool scarf.'
    return root

def carved_plate(name, outline, thickness, mat, parent, bevel=.018):
    """A thick carved silhouette in the X/Z plane, facing -Y."""
    front=[tuple(p) for p in outline]
    back=[(p[0],p[1]+thickness,p[2]) for p in outline]
    n=len(front)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    obj=mesh_obj(name,front+back,faces,mat,parent)
    if bevel:
        mod=obj.modifiers.new('softly carved edge','BEVEL');mod.width=bevel;mod.segments=2
        obj.modifiers.new('carved normals','WEIGHTED_NORMAL')
    return obj

def make_guard():
    root=pivot('guard',None,(0,0,0))
    head=pivot('guard.head',root,(0,0,1.03))
    left=pivot('guard.arm.L',root,(-.255,.01,.85));right=pivot('guard.arm.R',root,(.255,.01,.85))
    legL=pivot('guard.leg.L',root,(-.15,.02,.30));legR=pivot('guard.leg.R',root,(.15,.02,.30))
    loft('guard.fungal-stalk',[(0,.035,.28,.13,.12),(0,.025,.38,.255,.20),(0,.028,.64,.29,.225),
         (0,.02,.86,.26,.20),(0,.015,.97,.19,.15),(0,.01,1.05,.14,.12)],M['green'],root,24)
    loft('guard.face-stalk',[(0,0,.91,.12,.10),(0,-.01,1.02,.20,.16),(0,-.01,1.16,.263,.21),
         (0,.01,1.31,.283,.225),(0,.02,1.45,.255,.19),(0,.02,1.50,.19,.15)],M['creamshade'],head,24)
    # Sculpted cap, rolled irregular lip and a radial underside.
    caprows=[(0,.05,1.42,.055,.045),(0,.04,1.405,.28,.22),(0,.045,1.44,.49,.365),
             (0,.05,1.49,.585,.43),(0,.055,1.55,.595,.44),(0,.07,1.65,.51,.38),
             (0,.085,1.76,.36,.27),(0,.10,1.83,.18,.14),(0,.10,1.853,.03,.025)]
    def capshape(p,a,r):
        x,y,z=p; wave=(.014*math.sin(a*3+.7)+.013*math.cos(a*5))*(.4+abs(x))
        return (x*(1+.025*math.sin(a*2)),y,z+wave)
    cap=loft('guard.continuous-mushroom-cap',caprows,M['fungus'],head,32,capshape)
    cap.data.materials.append(M['gills']);cap.data.materials.append(M['funguslight'])
    for poly in cap.data.polygons:
        if poly.center.z<1.47:poly.material_index=1
        elif poly.center.z<1.56:poly.material_index=2
    for s in range(14):
        angle=s*2*math.pi/14
        stroke(f'guard.cap-gill.{s}',[(.18*math.cos(angle),.04+.14*math.sin(angle),1.413),
               (.34*math.cos(angle),.045+.25*math.sin(angle),1.408),
               (.53*math.cos(angle),.05+.385*math.sin(angle),1.455)],.009,M['gills'],head,resolution=3)
    spots=[(-.28,-.20,1.70,.085,.055),(.17,-.24,1.74,.072,.05),(.40,-.06,1.66,.065,.05),
           (-.38,.13,1.65,.08,.054),(.025,.03,1.852,.079,.06),(.22,.27,1.73,.067,.045),(-.14,.32,1.75,.055,.035)]
    for i,(x,y,z,sx,sy) in enumerate(spots):
        spot=ellipsoid(f'guard.cap-spot.{i}',(x,y,z), (sx,sy,.014),M['fungusspot'],head,12,7)
        normal=Vector((x*.8,(y-.07)*1.1,max(.2,z-1.4))).normalized()
        spot.rotation_euler=normal.to_track_quat('Z','Y').to_euler()
    eye('guard.eye.L',-.123,-.218,1.23,head,.72,True)
    eye('guard.eye.R',.123,-.218,1.23,head,.72,True)
    ellipsoid('guard.bulb-nose',(0,-.255,1.16),(.065,.071,.061),M['cream'],head,12,8)
    stroke('guard.grumbling-mouth',[(-.083,-.218,1.065),(0,-.239,1.08),(.087,-.217,1.065)],.011,M['darkfur'],head,resolution=4)
    for side in(-1,1):
        stroke(f'guard.brow.{side}',[(side*.047,-.242,1.31),(side*.13,-.244,1.337),(side*.21,-.186,1.34)],.022,M['gills'],head,resolution=4)
    # Overlapping leaf-cut tabard panels and riveted straps.
    for i in range(3):
        x=(i-1)*.155
        carved_plate(f'guard.leaf-tabard.{i}',[(x-.07,-.207,.83),(x+.05,-.216,.83),(x+.09,-.239,.62),(x,-.248,.41),(x-.09,-.227,.62)],.025,M['greendark'] if i==1 else M['green'],root,.018)
        stroke(f'guard.leaf-vein.{i}',[(x,-.24,.78),(x+.005,-.27,.64),(x,-.27,.48)],.008,M['fungusspot'],root,resolution=3)
    stroke('guard.chest-belt',[(-.255,-.08,.73),(-.15,-.239,.70),(0,-.275,.68),(.18,-.211,.70),(.26,-.045,.75)],.033,M['leather'],root,resolution=4)
    box('guard.belt-clasp',(.02,-.303,.68),(.052,.018,.041),M['brass'],root,.012,2)
    for side,joint in[(-1,left),(1,right)]:
        tube(f'guard.arm.{side}.stalk',[(side*.23,.01,.88),(side*.32,-.01,.77),(side*.35,-.07,.62),(side*.34,-.11,.54)], [.11,.105,.085,.07],M['creamshade'],joint,12)
        ellipsoid(f'guard.hand.{side}',(side*.34,-.12,.53),(.083,.071,.085),M['gills'],joint,12,8)
        for i in range(3):
            tube(f'guard.finger.{side}.{i}',[(side*.34+(i-1)*.037,-.16,.54),(side*.34+(i-1)*.036,-.185,.49)], [.022,.018],M['gills'],joint,7)
    # A leaf-shaped seedpod shield and a crooked wooden baton.
    shieldpoints=[(-.34,-.22,1.02),(-.19,-.24,.90),(-.16,-.25,.67),(-.25,-.25,.47),(-.37,-.26,.41),(-.52,-.23,.60),(-.54,-.20,.85),(-.44,-.20,.99)]
    carved_plate('guard.carved-seedpod-shield',shieldpoints,.066,M['leather'],left,.032)
    stroke('guard.shield-ridge',[(-.35,-.265,.97),(-.32,-.292,.77),(-.36,-.30,.49)],.025,M['leatheredge'],left,resolution=5)
    stroke('guard.shield-leaf-vein.L',[(-.35,-.293,.76),(-.46,-.274,.87)],.012,M['brassdark'],left,resolution=3)
    stroke('guard.shield-leaf-vein.R',[(-.34,-.294,.72),(-.23,-.278,.82)],.012,M['brassdark'],left,resolution=3)
    ellipsoid('guard.shield-boss',(-.34,-.307,.75),(.058,.022,.065),M['brass'],left,12,8)
    tube('guard.crooked-baton',[(.36,-.115,.45),(.39,-.10,.67),(.45,-.08,.88),(.49,-.075,1.06)], [.035,.045,.067,.08],M['leather'],right,10)
    horn('guard.baton-knot',(.46,-.08,.94),(.59,-.06,1.02),.057,M['leatheredge'],right,sides=8)
    for i in range(3):
        stroke(f'guard.baton-wrap.{i}',[(.354,-.146,.52+i*.035),(.397,-.143,.535+i*.035),(.421,-.096,.53+i*.035)],.012,M['fungusspot'],right,resolution=3)
    for side,joint in[(-1,legL),(1,legR)]:
        tube(f'guard.leg.{side}',[(side*.14,.02,.34),(side*.16,.01,.20),(side*.17,-.03,.12)],[.103,.093,.08],M['creamshade'],joint,10)
        ellipsoid(f'guard.root-foot.{side}',(side*.17,-.092,.09),(.13,.18,.089),M['greendark'],joint,14,8)
        for i in range(2):
            horn(f'guard.root-toe.{side}.{i}',(side*.17+(i-.5)*.077,-.22,.08),(side*.17+(i-.5)*.10,-.29,.028),.038,M['green'],joint,sides=7)
    root['description']='A living mushroom watchman with sculpted gills, a seedpod shield and a crooked wooden baton.'
    return root

def make_archer():
    root=pivot('archer',None,(0,0,0))
    head=pivot('archer.head',root,(0,0,1.08))
    left=pivot('archer.arm.L',root,(-.21,0,.94));right=pivot('archer.arm.R',root,(.21,0,.94))
    legL=pivot('archer.leg.L',root,(-.14,.025,.40));legR=pivot('archer.leg.R',root,(.14,.025,.40))
    tail=pivot('archer.tail',root,(0,.17,.48))
    weapon=pivot('archer.weapon',right,(0,-.37,.81))
    loft('archer.flexible-torso',[(0,.035,.35,.13,.12),(0,.03,.48,.205,.17),(0,.025,.66,.22,.18),
         (0,.015,.85,.21,.175),(0,.01,1.00,.185,.15),(0,.01,1.14,.125,.12)],M['lizard'],root,24)
    ellipsoid('archer.pale-throat',(0,-.133,.86),(.142,.057,.26),M['lizardlight'],root,18,10)
    ellipsoid('archer.cheek-skull',(0,-.008,1.34),(.27,.265,.262),M['lizard'],head,22,14)
    tube('archer.long-snout',[(0,-.12,1.35),(0,-.29,1.315),(0,-.46,1.29),(0,-.60,1.27),(0,-.65,1.26)],
         [.19,.178,.128,.085,.065],M['lizard'],head,16,.62)
    tube('archer.lower-jaw',[(0,-.22,1.21),(0,-.40,1.205),(0,-.58,1.22)], [.14,.108,.058],M['lizardlight'],head,12,.45)
    for side in(-1,1):
        eye(f'archer.eye.{side}',side*.181,-.20,1.447,head,.78,True)
        stroke(f'archer.brow.{side}',[(side*.10,-.22,1.52),(side*.19,-.21,1.55),(side*.26,-.12,1.52)],.025,M['lizarddark'],head,resolution=4)
        ellipsoid(f'archer.nostril.{side}',(side*.066,-.584,1.304),(.019,.025,.013),M['lizarddark'],head,10,6)
        stroke(f'archer.mouth.{side}',[(side*.05,-.624,1.234),(side*.10,-.47,1.227),(side*.15,-.32,1.231),(side*.18,-.19,1.254)],.008,M['lizarddark'],head,resolution=4)
        horn(f'archer.little-fang.{side}',(side*.13,-.37,1.235),(side*.132,-.377,1.195),.015,M['claw'],head,sides=6)
    for i in range(4):
        y=-.02+i*.085;z=1.59-i*.022
        horn(f'archer.head-crest.{i}',(0,y,z),(0,y+.055,z+.12-i*.009),.055-i*.005,M['funguslight'],head,bend=(0,.015,.025),sides=7)
    # Light leather harness, small scale skirts and a usable crossbow.
    stroke('archer.shoulder-strap',[(-.16,-.06,1.04),(-.11,-.17,.93),(.03,-.195,.72),(.15,-.12,.49)],.027,M['leather'],root,resolution=5)
    box('archer.strap-clasp',(-.04,-.214,.82),(.04,.015,.045),M['brass'],root,.009,2)
    for i in range(3):
        x=(i-1)*.12
        carved_plate(f'archer.scaled-hem.{i}',[(x-.065,-.151,.60),(x+.06,-.151,.60),(x+.064,-.18,.45),(x,-.20,.39),(x-.07,-.18,.45)],.027,M['lizarddark'],root,.012)
    for side,joint in[(-1,left),(1,right)]:
        tube(f'archer.arm.{side}',[(side*.19,.01,.96),(side*.28,-.06,.85),(side*.24,-.22,.75),(side*.13,-.34,.79)],
             [.08,.075,.064,.047],M['lizard'],joint,10)
        ellipsoid(f'archer.hand.{side}',(side*.12,-.355,.79),(.062,.06,.058),M['lizardlight'],joint,12,7)
        for i in range(2):
            tube(f'archer.finger.{side}.{i}',[(side*.12+(i-.5)*.035,-.393,.81),(side*.12+(i-.5)*.035,-.418,.77)], [.017,.011],M['lizard'],joint,6)
    box('archer.crossbow-stock',(0,-.40,.78),(.043,.18,.035),M['leather'],weapon,.018,2)
    stroke('archer.carved-crossbow-limb',[(-.335,-.385,.80),(-.22,-.493,.82),(0,-.53,.82),(.22,-.493,.82),(.335,-.385,.80)],.027,M['leatheredge'],weapon,resolution=5)
    stroke('archer.bowstring',[(-.335,-.385,.80),(0,-.30,.815),(.335,-.385,.80)],.006,M['claw'],weapon,resolution=3)
    tube('archer.loaded-bolt',[(0,-.31,.836),(0,-.62,.836)],[.009,.008],M['brassdark'],weapon,6)
    horn('archer.arrowhead',(0,-.60,.836),(0,-.695,.836),.024,M['brass'],weapon,sides=6)
    box('archer.crossbow-guide',(0,-.47,.815),(.055,.038,.025),M['brass'],weapon,.009,2)
    # Tail is a continuous curved skin; the tip curls out to remain readable from above.
    tailpoints=[(0,.17,.48),(.045,.31,.42),(.14,.48,.31),(.27,.60,.23),(.43,.64,.27),(.54,.55,.37),(.53,.45,.43)]
    tube('archer.long-curled-tail',tailpoints,[.115,.11,.09,.068,.05,.027,.003],M['lizard'],tail,12,.8)
    for i in range(3):
        p=tailpoints[i+1]
        horn(f'archer.tail-ridge.{i}',(p[0],p[1],p[2]+.065),(p[0],p[1]+.045,p[2]+.145-i*.018),.035,M['lizarddark'],tail,sides=7)
    tube('archer.back-quiver',[(.15,.15,.65),(.18,.18,.95)], [.086,.10],M['leather'],root,12,.85)
    for i in range(3):
        x=.13+i*.044
        tube(f'archer.spare-arrow.{i}',[(x,.19,.88),(x-.025,.20,1.22+i*.035)], [.008,.007],M['leatheredge'],root,6)
        horn(f'archer.arrow-fletch.{i}',(x-.025,.20,1.15+i*.035),(x-.062,.20,1.245+i*.035),.029,M['scarf'],root,sides=6)
    for side,joint in[(-1,legL),(1,legR)]:
        tube(f'archer.bent-leg.{side}',[(side*.13,.03,.43),(side*.21,-.04,.29),(side*.18,.04,.16),(side*.18,-.04,.08)], [.098,.083,.049,.05],M['lizarddark'],joint,10)
        ellipsoid(f'archer.foot.{side}',(side*.18,-.095,.063),(.092,.14,.059),M['lizard'],joint,12,8)
        for i in range(3):
            x=side*.18+(i-1)*.05
            horn(f'archer.toe.{side}.{i}',(x,-.18,.064),(x+(i-1)*.02,-.265,.018),.022,M['claw'],joint,sides=6)
    root['description']='A long-muzzled lizard bolt-keeper with folded limbs, expressive eyelids, a crafted crossbow and a curling tail.'
    return root

def make_boss():
    root=pivot('boss',None,(0,0,0))
    head=pivot('boss.head',root,(0,-.25,1.05))
    left=pivot('boss.arm.L',root,(-.49,.005,1.04));right=pivot('boss.arm.R',root,(.49,.005,1.04))
    legL=pivot('boss.leg.L',root,(-.30,.05,.38));legR=pivot('boss.leg.R',root,(.30,.05,.38))
    shell=pivot('boss.shell',root,(0,.20,.87))
    loft('boss.heavy-continuous-body',[(0,.08,.29,.22,.19),(0,.07,.40,.44,.32),(0,.06,.65,.55,.39),
         (0,.06,.93,.58,.39),(0,.055,1.15,.51,.345),(0,.06,1.32,.35,.25),(0,.07,1.41,.18,.14)],M['bossflesh'],root,28)
    ellipsoid('boss.belly',(0,-.268,.74),(.375,.104,.34),M['bosslight'],root,22,12)
    # Continuous convex shell with raised, curved armored ribs.
    ellipsoid('boss.carapace',(0,.18,1.035),(.625,.435,.61),M['shell'],shell,28,16)
    for i,z in enumerate([.64,.87,1.10,1.32]):
        t=(z-1.035)/.61;r=math.sqrt(max(.02,1-t*t));rx=.625*r;ry=.435*r
        pts=[]
        for j in range(11):
            angle=math.pi*j/10
            pts.append((rx*math.cos(angle),.18+ry*math.sin(angle)+.014,z+.015*math.sin(angle)))
        stroke(f'boss.shell-rib.{i}',pts,.026,M['shelledge'],shell,resolution=3)
    stroke('boss.shell-keel',[(0,.35,1.59),(0,.52,1.45),(0,.605,1.15),(0,.61,.9),(0,.49,.58)],.035,M['brassdark'],shell,resolution=4)
    for side in(-1,1):
        horn(f'boss.shell-spike.{side}',(side*.39,.28,1.39),(side*.58,.40,1.59),.102,M['shelledge'],shell,bend=(0,-.015,.055),sides=9)
    # A beaked beetle face with armored brow and curved mandibles.
    ellipsoid('boss.face',(0,-.295,1.21),(.39,.30,.29),M['bossflesh'],head,24,14)
    ellipsoid('boss.brow-helmet',(0,-.255,1.434),(.402,.285,.147),M['shell'],head,22,12)
    stroke('boss.helmet-rim',[(-.34,-.40,1.42),(-.20,-.53,1.40),(0,-.56,1.41),(.20,-.53,1.40),(.34,-.40,1.42)],.023,M['shelledge'],head,resolution=4)
    for side in(-1,1):
        eye(f'boss.eye.{side}',side*.205,-.536,1.30,head,.95,True)
        stroke(f'boss.angry-brow.{side}',[(side*.10,-.564,1.36),(side*.21,-.565,1.40),(side*.30,-.48,1.42)],.035,M['brassdark'],head,resolution=4)
        tube(f'boss.mandible.{side}',[(side*.255,-.47,1.14),(side*.35,-.57,1.09),(side*.31,-.70,1.10),(side*.19,-.742,1.17),(side*.15,-.70,1.23)],
             [.085,.084,.063,.036,.003],M['claw'],head,10,.78)
        tube(f'boss.curled-horn.{side}',[(side*.26,-.16,1.51),(side*.35,-.12,1.67),(side*.44,-.19,1.81),(side*.46,-.30,1.84),(side*.39,-.35,1.79)],
             [.09,.08,.058,.035,.004],M['shelledge'],head,10,.85)
        ellipsoid(f'boss.cheek-ridge.{side}',(side*.34,-.40,1.15),(.085,.14,.11),M['bosslight'],head,12,8)
    ellipsoid('boss.beak',(0,-.572,1.15),(.15,.14,.128),M['brassdark'],head,16,10)
    stroke('boss.mouth', [(-.11,-.652,1.115),(0,-.69,1.09),(.11,-.652,1.115)],.012,M['darkfur'],head,resolution=4)
    for i in range(3):
        z=.61+i*.15
        stroke(f'boss.belly-fold.{i}',[(-.23,-.34,z),(-.10,-.39,z-.01),(0,-.402,z-.012),(.1,-.39,z-.01),(.23,-.34,z)],.012,M['bossflesh'],root,resolution=3)
    for side,joint in[(-1,left),(1,right)]:
        tube(f'boss.massive-arm.{side}',[(side*.45,.0,1.10),(side*.59,-.01,.98),(side*.68,-.10,.81),(side*.65,-.24,.60)],
             [.19,.20,.155,.125],M['bossflesh'],joint,14,1.05)
        ellipsoid(f'boss.shoulder-carapace.{side}',(side*.54,-.015,1.10),(.23,.23,.18),M['shell'],joint,16,10)
        stroke(f'boss.shoulder-rim.{side}',[(side*.38,-.19,1.055),(side*.56,-.25,1.04),(side*.75,-.14,1.07)],.024,M['shelledge'],joint,resolution=4)
        tube(f'boss.forearm-plate.{side}',[(side*.68,-.11,.82),(side*.66,-.22,.68)], [.175,.155],M['shell'],joint,12)
        ellipsoid(f'boss.claw-palm.{side}',(side*.65,-.28,.535),(.17,.14,.15),M['bosslight'],joint,14,10)
        for i in range(3):
            x=side*.65+(i-1)*.085
            horn(f'boss.hand-talon.{side}.{i}',(x,-.37,.53),(x+(i-1)*.025,-.48,.39),.038,M['claw'],joint,bend=(0,-.015,.03),sides=8)
    for side,joint in[(-1,legL),(1,legR)]:
        tube(f'boss.stout-leg.{side}',[(side*.30,.06,.43),(side*.35,.03,.28),(side*.34,-.04,.14)], [.18,.17,.14],M['bossflesh'],joint,12)
        ellipsoid(f'boss.foot-armor.{side}',(side*.34,-.115,.14),(.22,.29,.135),M['shell'],joint,18,10)
        stroke(f'boss.foot-rim.{side}',[(side*.34-.17,-.29,.11),(side*.34,-.39,.09),(side*.34+.17,-.29,.11)],.02,M['shelledge'],joint,resolution=4)
        for i in range(3):
            x=side*.34+(i-1)*.10
            horn(f'boss.foot-talon.{side}.{i}',(x,-.32,.105),(x,-.46,.026),.035,M['claw'],joint,bend=(0,-.018,.02),sides=8)
    root['description']='A broad plated vault-beast: continuous shell, teal hide, sculpted mandibles, curled horns and thick clawed limbs.'
    return root

def camera_at(location, target, scale):
    bpy.ops.object.camera_add(location=location)
    camera=bpy.context.object;camera.name='preview-camera';camera.data.type='ORTHO';camera.data.ortho_scale=scale
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.camera=camera
    return camera

def lighting():
    world=bpy.data.worlds.new('warm studio') if not bpy.data.worlds else bpy.data.worlds[0]
    bpy.context.scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.16,.17,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45
    for name,loc,energy,color,size in [
        ('large warm key',(-3,-4,5),650,(1,.86,.68),4),
        ('cool face fill',(3,-2,3),430,(.68,.84,1),3),
        ('gold rim',(2,3,4),900,(1,.70,.38),3),
    ]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        lamp=bpy.context.object;lamp.name=name;lamp.data.energy=energy;lamp.data.color=color;lamp.data.shape='DISK';lamp.data.size=size
        lamp.rotation_euler=(Vector((0,0,.9))-lamp.location).to_track_quat('-Z','Y').to_euler()

def configure_render():
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=40
    scene.cycles.use_denoising=False
    scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.35
    scene.render.image_settings.color_mode='RGBA'

hero=make_hero()
actors={'hero':hero}
if not HERO_ONLY:
    actors.update({'guard':make_guard(),'archer':make_archer(),'boss':make_boss()})
for key,root in actors.items():
    for obj in root.children_recursive:
        if obj.type=='MESH' and len(obj.data.polygons)>40 and 'face-mask' not in obj.name:
            mod=obj.modifiers.new('mobile silhouette-preserving reduction','DECIMATE')
            mod.ratio=.61 if key=='hero' else .67
            mod.use_collapse_triangulate=True
bpy.context.view_layer.update()
output=PROJECT/'assets/resources/models/characters.json'
result=export_library(actors,output)

# Real model preview: studio lighting and camera are not exported into gameplay assets.
ground=material('Preview only | desaturated moss floor','#394941',.9)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012))
plane=bpy.context.object;plane.name='preview-ground';plane.data.materials.append(ground)
lighting();configure_render()
camera_at((3.5,-6,3.0),(0,-.02,.96),2.5)
bpy.context.scene.render.filepath=str(PREVIEW/'hero-preview.png')
for key,root in actors.items():
    if key!='hero':
        for obj in root.children_recursive:obj.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=str(PROJECT/'art-source/characters.blend'))
bpy.ops.render.render(write_still=True)
print('CHARACTER_PREVIEW',PREVIEW/'hero-preview.png')
if not HERO_ONLY:
    for key,root in actors.items():
        for obj in root.children_recursive:obj.hide_render=False
    positions={'hero':-2.65,'guard':-.85,'archer':.95,'boss':2.95}
    for key,root in actors.items():root.location.x=positions[key]
    camera=bpy.context.scene.camera
    camera.location=(4,-11,4.3)
    camera.rotation_euler=(Vector((.15,0,.95))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=7.85
    bpy.context.scene.render.resolution_x=1600;bpy.context.scene.render.resolution_y=800
    bpy.context.scene.render.filepath=str(PREVIEW/'character-lineup.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(PROJECT/'art-source/characters.blend'))
    bpy.ops.render.render(write_still=True)
    print('CHARACTER_LINEUP',PREVIEW/'character-lineup.png')
