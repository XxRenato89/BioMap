"""
Quibar en Blender: aligera el modelo y crea sus animaciones de pausa.

Uso (desde la raíz del repositorio):
  blender -b -P apps/web/scripts/quibar.blender.py -- <quibar-original.glb> <carpeta-salida> <walk.glb>

Deja en la carpeta de salida:
  quibar.glb      el mismo personaje y esqueleto, con menos triángulos y textura de 1024 px
  idle.glb, look.glb, wave.glb, clapping.glb, sit.glb   un clip cada uno, sin malla

Los huesos originales no se tocan (misma pose de reposo), así que walk.glb y
run.glb siguen sirviendo; solo se agregan tres huesos para la cola. Las poses se arman apuntando cada hueso hacia una
dirección del mundo (x = izquierda del personaje, -y = su frente, z = arriba).
"""

import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

source, out_dir, walk_path = sys.argv[sys.argv.index("--") + 1 :][:3]
out = Path(out_dir)
out.mkdir(parents=True, exist_ok=True)

FPS = 30
# Proporción de triángulos que se conserva (271 mil vértices son demasiados para un teléfono).
DECIMATE_RATIO = 0.14
TEXTURE_PX = 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
scene = bpy.context.scene
scene.render.fps = FPS

armature = next(o for o in scene.objects if o.type == "ARMATURE")
# El importador agrega una esfera para dibujar los huesos: no es parte del personaje.
for extra in [o for o in scene.objects if o.type == "MESH" and o.find_armature() is None]:
    bpy.data.objects.remove(extra, do_unlink=True)
meshes = [o for o in scene.objects if o.type == "MESH"]

# ---------- Modelo liviano ----------
for mesh in meshes:
    before = len(mesh.data.vertices)
    if mesh.data.shape_keys is None:
        bpy.context.view_layer.objects.active = mesh
        modifier = mesh.modifiers.new("Decimate", "DECIMATE")
        modifier.ratio = DECIMATE_RATIO
        # Antes del esqueleto: se simplifica la malla en reposo y conserva sus pesos.
        while mesh.modifiers[0] != modifier:
            bpy.ops.object.modifier_move_up(modifier=modifier.name)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    print(f"[quibar] {mesh.name}: {before} -> {len(mesh.data.vertices)} vertices")

for image in bpy.data.images:
    if image.size[0] > TEXTURE_PX:
        print(f"[quibar] textura {image.name}: {image.size[0]} -> {TEXTURE_PX} px")
        image.scale(TEXTURE_PX, round(TEXTURE_PX * image.size[1] / image.size[0]))

# ---------- Huesos de la cola ----------
# El modelo original no los trae: la cola iba pegada a la cadera y a los muslos,
# y se deformaba al caminar o sentarse. Aquí recibe su propia cadena de huesos.
TAIL_BONES = 3
TAIL_Y0 = 0.12  # Detrás de esto (m, hacia la espalda) empieza la cola.
TAIL_BLEND = 0.10  # Tramo en que pasa de la cadera a la cola.
TAIL_TOP = -0.2  # Sobre esta altura ya es mochila o cabeza.
TAIL_OWNERS = {"mixamorig:Hips", "mixamorig:LeftUpLeg", "mixamorig:RightUpLeg", "mixamorig:Spine"}

body = meshes[0]
group_names = {g.index: g.name for g in body.vertex_groups}
tail_vertices = []
for vertex in body.data.vertices:
    point = body.matrix_world @ vertex.co
    owned = sum(g.weight for g in vertex.groups if group_names[g.group] in TAIL_OWNERS)
    if point.y > TAIL_Y0 and point.z < TAIL_TOP and owned > 0.5:
        tail_vertices.append((vertex, point))
tail_end = max(point.y for _, point in tail_vertices)
tail_length = tail_end - TAIL_Y0


def tail_center(y):
    """Centro de la cola en el corte y (m)."""
    band = [p for _, p in tail_vertices if abs(p.y - y) < 0.04] or [p for _, p in tail_vertices]
    return Vector((sum(p.x for p in band) / len(band), y, sum(p.z for p in band) / len(band)))


joints = [tail_center(TAIL_Y0 + tail_length * k / TAIL_BONES) for k in range(TAIL_BONES + 1)]
bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode="EDIT")
to_armature_point = armature.matrix_world.inverted()
parent = armature.data.edit_bones["mixamorig:Hips"]
for k in range(TAIL_BONES):
    edit_bone = armature.data.edit_bones.new(f"mixamorig:Tail{k + 1}")
    edit_bone.head = to_armature_point @ joints[k]
    edit_bone.tail = to_armature_point @ joints[k + 1]
    edit_bone.parent = parent
    edit_bone.use_connect = k > 0
    parent = edit_bone
bpy.ops.object.mode_set(mode="OBJECT")

tail_groups = [body.vertex_groups.new(name=f"mixamorig:Tail{k + 1}") for k in range(TAIL_BONES)]
for vertex, point in tail_vertices:
    blend = min(1.0, (point.y - TAIL_Y0) / TAIL_BLEND)
    along = (point.y - TAIL_Y0) / tail_length * TAIL_BONES
    shares = [max(0.0, 1 - abs(min(max(along, 0.5), TAIL_BONES - 0.5) - (k + 0.5))) for k in range(TAIL_BONES)]
    for group in vertex.groups:
        group.weight *= 1 - blend
    for k, share in enumerate(shares):
        if share > 0:
            tail_groups[k].add([vertex.index], blend * share / sum(shares), "REPLACE")
print(f"[quibar] cola: {len(tail_vertices)} vertices, {tail_length:.2f} m, {TAIL_BONES} huesos")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(out / "quibar.glb"),
    export_format="GLB",
    use_selection=True,
    export_animations=False,
    export_image_format="WEBP",
    export_image_quality=88,
    export_yup=True,
)

# ---------- Animaciones ----------
def read_gltf(path):
    data = Path(path).read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    return data, size, json.loads(data[20 : 20 + size])


def hips_track(path):
    """Dónde están en el archivo las claves de traslación de la cadera, y cuántas son."""
    data, size, gltf = read_gltf(path)
    animation = gltf["animations"][0]
    channel = next(
        c
        for c in animation["channels"]
        if c["target"]["path"] == "translation"
        and gltf["nodes"][c["target"]["node"]]["name"].endswith("Hips")
    )
    accessor = gltf["accessors"][animation["samplers"][channel["sampler"]]["output"]]
    view = gltf["bufferViews"][accessor["bufferView"]]
    start = 20 + size + 8 + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return data, start, accessor["count"]


def rebase_hips(path, rest, base):
    """
    walk.glb y run.glb llevan la cadera en otro origen que la pose de reposo del
    modelo, y el visor está ajustado a ellos: los clips nuevos se pasan a ese
    origen para que Quibar no salte al cambiar de animación.
    """
    data, start, count = hips_track(path)
    data = bytearray(data)
    for key in range(count):
        offset = start + key * 12
        value = struct.unpack_from("<3f", data, offset)
        struct.pack_into("<3f", data, offset, *(v - r + b for v, r, b in zip(value, rest, base)))
    Path(path).write_bytes(data)


walk_data, walk_start, _ = hips_track(walk_path)
HIPS_BASE = struct.unpack_from("<3f", walk_data, walk_start)
HIPS_REST = next(n for n in read_gltf(source)[2]["nodes"] if n.get("name", "").endswith("Hips"))[
    "translation"
]

bones = armature.pose.bones
for bone in bones:
    bone.rotation_mode = "QUATERNION"
to_armature = armature.matrix_world.inverted().to_3x3()
world_scale = armature.matrix_world.to_scale().z


def bone(name):
    return bones[f"mixamorig:{name}"]


def update():
    bpy.context.view_layer.update()


def rotate(pbone, rotation):
    """Gira el hueso en torno a su cabeza (rotación en espacio del esqueleto)."""
    head = Matrix.Translation(pbone.matrix.translation)
    pbone.matrix = head @ rotation.to_matrix().to_4x4() @ head.inverted() @ pbone.matrix
    update()


def aim(name, direction):
    """Apunta el hueso (hacia su primer hijo) en una dirección del mundo."""
    pbone = bone(name)
    child = pbone.children[0]
    current = (child.matrix.translation - pbone.matrix.translation).normalized()
    target = (to_armature @ Vector(direction)).normalized()
    rotate(pbone, current.rotation_difference(target))


def turn(name, axis, degrees):
    """Gira el hueso en torno a un eje del mundo."""
    rotate(bone(name), Quaternion((to_armature @ Vector(axis)).normalized(), math.radians(degrees)))


def drop_hips(fraction):
    """Baja la cadera una fracción de su altura sobre los pies."""
    hips = bone("Hips")
    floor = min(bone(f"{side}ToeBase").matrix.translation.z for side in ("Left", "Right"))
    down = to_armature @ Vector((0, 0, -1))
    height = (hips.matrix.translation - Vector((0, 0, floor))).dot(-down.normalized())
    matrix = hips.matrix.copy()
    matrix.translation += down.normalized() * abs(height) * fraction
    hips.matrix = matrix
    update()


def wag(degrees, lift=0.0):
    """Mueve la cola a un lado (y la levanta): cada hueso suma su parte, así se curva."""
    turn("Tail1", (1, 0, 0), lift)
    for k in range(TAIL_BONES):
        turn(f"Tail{k + 1}", (0, 0, 1), degrees)


def stand(breath=0.0, sway=0.0):
    """De pie y relajado: brazos abajo, con un poco de respiración y vaivén."""
    turn("Spine", (1, 0, 0), 1.5 * breath)
    turn("Spine1", (1, 0, 0), 1.5 * breath)
    turn("Spine", (0, 1, 0), 1.2 * sway)
    for side, x in (("Left", 1), ("Right", -1)):
        aim(f"{side}Arm", (x * (0.30 + 0.03 * breath), 0.02, -1))
        aim(f"{side}ForeArm", (x * 0.16, -0.22 - 0.04 * breath, -1))
    wag(7 * sway, 2 * breath)


def pose_idle(t):
    stand(math.sin(t * math.tau / 3), math.sin(t * math.tau / 6))
    turn("Head", (0, 0, 1), 6 * math.sin(t * math.tau / 6))


def pose_look(t):
    stand(math.sin(t * math.tau / 2.25))
    yaw = math.sin(t * math.tau / 4.5)
    turn("Spine1", (0, 0, 1), 12 * yaw)
    turn("Neck", (0, 0, 1), 18 * yaw)
    turn("Head", (0, 0, 1), 26 * yaw)
    turn("Head", (1, 0, 0), -6)


def pose_wave(t):
    stand(math.sin(t * math.tau / 2.6))
    lift = min(1.0, t / 0.4, (2.6 - t) / 0.4)
    swing = math.sin(t * 8)
    wag(10 * swing * lift)
    # El brazo es corto y la cabeza grande: la mano va al costado y adelante, donde se ve.
    aim("RightArm", (-1, -0.4 * lift, -1 + 1.15 * lift))
    aim("RightForeArm", (-0.16 - (0.5 + swing * 0.45) * lift, -0.22 - 0.2 * lift, -1 + 1.8 * lift))
    turn("Head", (0, 1, 0), -5 * lift)


def pose_clapping(t):
    stand(math.sin(t * math.tau / 1.3))
    lift = min(1.0, t / 0.3, (2.6 - t) / 0.3)
    together = 0.5 + 0.5 * math.sin(t * math.tau * 3)
    for side, x in (("Left", 1), ("Right", -1)):
        aim(f"{side}Arm", (x * (0.30 + 0.1 * lift), -0.75 * lift, -1 + 0.6 * lift))
        aim(
            f"{side}ForeArm",
            (x * (0.16 - (0.55 + 0.4 * together) * lift), -0.22 - 0.45 * lift, -1 + 1.45 * lift),
        )


def pose_sit(t):
    breath = math.sin(t * math.tau / 3.5)
    drop_hips(0.74)
    turn("Hips", (1, 0, 0), 8)
    turn("Spine", (1, 0, 0), -6 + 1.5 * breath)
    for side, x in (("Left", 1), ("Right", -1)):
        aim(f"{side}UpLeg", (x * 0.32, -1, 0.42))
        aim(f"{side}Leg", (x * 0.05, -0.55, -1))
        aim(f"{side}Foot", (x * 0.1, -1, -0.25))
        # Manos apoyadas en el suelo, un poco atrás.
        aim(f"{side}Arm", (x * 0.55, 0.35, -1))
        aim(f"{side}ForeArm", (x * 0.25, 0.1, -1))
    turn("Head", (0, 0, 1), 10 * math.sin(t * math.tau / 7))
    # La cola se recoge hacia un lado y arriba: sentado, quedaría bajo el suelo.
    wag(24 + 4 * breath, 34)


# nombre -> (pose, segundos). Las que empiezan y terminan en la misma pose se repiten sin salto.
CLIPS = {
    "idle": (pose_idle, 6.0),
    "look": (pose_look, 4.5),
    "wave": (pose_wave, 2.6),
    "clapping": (pose_clapping, 2.6),
    "sit": (pose_sit, 7.0),
}

for mesh in meshes:
    bpy.data.objects.remove(mesh, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
armature.select_set(True)
bpy.context.view_layer.objects.active = armature

for name, (pose, seconds) in CLIPS.items():
    armature.animation_data_clear()
    armature.animation_data_create()
    action = bpy.data.actions.new(name)
    armature.animation_data.action = action
    frames = round(seconds * FPS)
    # Un cuadro clave cada 2: el movimiento más rápido (aplauso, 3 Hz) queda bien muestreado.
    for frame in range(0, frames + 1, 2):
        scene.frame_set(frame)
        for pbone in bones:
            pbone.matrix_basis = Matrix.Identity(4)
        update()
        pose(frame / FPS)
        for pbone in bones:
            pbone.keyframe_insert("rotation_quaternion", frame=frame)
        bone("Hips").keyframe_insert("location", frame=frame)
    scene.frame_start, scene.frame_end = 0, frames
    bpy.ops.export_scene.gltf(
        filepath=str(out / f"{name}.glb"),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIVE_ACTIONS",
        export_frame_range=True,
        export_force_sampling=True,
        export_yup=True,
    )
    rebase_hips(out / f"{name}.glb", HIPS_REST, HIPS_BASE)
    print(f"[quibar] {name}.glb ({seconds} s)")
