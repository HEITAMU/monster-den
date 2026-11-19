/* Source-runtime material descriptors. All rendering is performed by Cocos.
 * The Creator editor normally generates equivalent descriptors while importing
 * .effect files. This bootstrap does not replace the Cocos renderer.
 */
export async function installPreviewEffects(cc) {
  const response = await fetch(new URL('./vendor/uniform-chunks.json', import.meta.url));
  if (!response.ok) throw new Error('Cocos shader uniform definitions are unavailable.');
  const chunks = await response.json();
  const { gfx, EffectAsset, Material, builtinResMgr } = cc;
  const strip = text => text.replace(/\/\/[^\n]*/g, '').replace(/#pragma[^\n]*/g, '').replace(/layout\([^)]*\)\s*/g, '');
  const expand = (text, modern) => modern
    ? strip(text).replace(/uniform\s+(\w+)\s*\{/g, 'layout(std140) uniform $1 {')
    : strip(text).replace(/uniform\s+\w+\s*\{([\s\S]*?)\};/g, (_, body) => body.split(';').map(x => x.trim()).filter(Boolean).map(x => `uniform ${x};`).join('\n'));
  const builtin = (blocks = [], textures = []) => ({buffers: [], blocks: blocks.map(name => ({name, defines: []})), samplerTextures: textures.map(name => ({name, defines: []})), images: []});
  const attribute = (name, format, location, defines = []) => ({name, format, location, stream: 0, isNormalized: false, isInstanced: false, defines});
  let hash = 388100;
  function descriptor(name, build, attributes, defines = [], blocks = [], textures = []) {
    return {name: `monster-den-preview/${name}`, hash: hash++, glsl1: build(false), glsl3: build(true), glsl4: build(true),
      attributes, defines, blocks, samplerTextures: textures, samplers: [], textures: [], buffers: [], images: [], subpassInputs: [], descriptors: [],
      builtins: {globals: builtin(['CCGlobal', 'CCCamera']), locals: builtin(['CCLocal']), statistics: {}}};
  }
  function effect(name, shader, properties, state = {}, techniques = 1) {
    const asset = new EffectAsset();
    asset.name = name; asset.shaders = [shader];
    const pass = {program: shader.name, properties, rasterizerState: {cullMode: gfx.CullMode.BACK}, depthStencilState: {depthTest: true, depthWrite: true}, ...state};
    asset.techniques = Array.from({length: techniques}, () => ({passes: [JSON.parse(JSON.stringify(pass))]}));
    asset.onLoaded();
    return asset;
  }
  function addMaterial(key, asset, defines = {}) {
    const material = new Material(); material.name = key;
    material.initialize({effectAsset: asset, defines}); builtinResMgr.addAsset(key, material);
    return material;
  }
  const surfaceBlock = 'uniform Surface { vec4 mainColor; vec4 surfaceParams; };';
  function surfaceSource(modern, lit) {
    const input = modern ? 'in' : 'attribute', varyingOut = modern ? 'out' : 'varying', varyingIn = modern ? 'in' : 'varying';
    const output = modern ? 'fragColor' : 'gl_FragColor';
    const vertex = `precision highp float;\n${expand(chunks['cc-global'], modern)}\n${expand(chunks['cc-local'], modern)}\n${input} vec3 a_position;\n${input} vec3 a_normal;\n${input} vec2 a_texCoord;\n#if USE_VERTEX_COLOR\n${input} vec4 a_color;\n#endif\n${varyingOut} vec3 v_normal;\n${varyingOut} vec3 v_world;\n${varyingOut} vec2 v_uv;\n${varyingOut} vec4 v_color;\nvoid main(){vec4 world=cc_matWorld*vec4(a_position,1.0);gl_Position=cc_matViewProj*world;v_normal=normalize(mat3(cc_matWorldIT)*a_normal);v_world=world.xyz;v_uv=a_texCoord;v_color=vec4(1.0);\n#if USE_VERTEX_COLOR\nv_color=a_color;\n#endif\n}`;
    const fragment = `precision highp float;\n${expand(chunks['cc-global'], modern)}\n${expand(surfaceBlock, modern)}\n${varyingIn} vec3 v_normal;\n${varyingIn} vec3 v_world;\n${varyingIn} vec2 v_uv;\n${varyingIn} vec4 v_color;\n#if USE_TEXTURE\nuniform sampler2D mainTexture;\n#endif\n${modern ? 'out vec4 fragColor;' : ''}\nvoid main(){vec4 base=mainColor*v_color;\n#if USE_TEXTURE\nbase*=${modern ? 'texture' : 'texture2D'}(mainTexture,v_uv);\n#endif\n${lit ? 'vec3 n=normalize(v_normal);vec3 l=normalize(vec3(-0.42,0.82,0.40));if(length(cc_mainLitDir.xyz)>0.1)l=normalize(-cc_mainLitDir.xyz);float diffuse=max(dot(n,l),0.0);vec3 v=normalize(cc_cameraPos.xyz-v_world);float rim=pow(1.0-max(dot(n,v),0.0),3.0);float spec=pow(max(dot(n,normalize(l+v)),0.0),mix(60.0,5.0,surfaceParams.x))*0.12;vec3 shade=vec3(0.32,0.37,0.45)+vec3(0.78,0.75,0.66)*diffuse;base.rgb=base.rgb*shade+vec3(spec)+vec3(0.12,0.16,0.20)*rim*surfaceParams.y+base.rgb*surfaceParams.z;vec3 linearColor=max(base.rgb,vec3(0.0));vec3 low=linearColor*12.92;vec3 high=1.055*pow(linearColor,vec3(1.0/2.4))-0.055;base.rgb=mix(low,high,step(vec3(0.0031308),linearColor));' : ''}\n${output}=base;}`;
    return {vert: vertex, frag: fragment};
  }
  const surfaceAttrs = [attribute('a_position', gfx.Format.RGB32F, 0), attribute('a_normal', gfx.Format.RGB32F, 1), attribute('a_texCoord', gfx.Format.RG32F, 2), attribute('a_color', gfx.Format.RGBA32F, 3, ['USE_VERTEX_COLOR'])];
  const surfaceDefines = [{name: 'USE_TEXTURE', type: 'boolean'}, {name: 'USE_VERTEX_COLOR', type: 'boolean'}];
  const surfaceBlocks = [{name: 'Surface', binding: 0, stageFlags: gfx.ShaderStageFlagBit.FRAGMENT, members: [{name: 'mainColor', type: gfx.Type.FLOAT4, count: 1}, {name: 'surfaceParams', type: gfx.Type.FLOAT4, count: 1}]}];
  const surfaceTextures = [{name: 'mainTexture', binding: 1, type: gfx.Type.SAMPLER2D, count: 1, stageFlags: gfx.ShaderStageFlagBit.FRAGMENT}];
  const properties = {mainColor: {type: gfx.Type.FLOAT4, value: [1, 1, 1, 1]}, surfaceParams: {type: gfx.Type.FLOAT4, value: [0.7, 0.5, 0, 0]}, mainTexture: {type: gfx.Type.SAMPLER2D, value: 'white'}};
  const lit = effect('monster-den/lit', descriptor('lit', modern => surfaceSource(modern, true), surfaceAttrs, surfaceDefines, surfaceBlocks, surfaceTextures), properties);
  const unlit = effect('monster-den/unlit', descriptor('unlit', modern => surfaceSource(modern, false), surfaceAttrs, surfaceDefines, surfaceBlocks, surfaceTextures), properties);
  // Aliases make common Cocos material examples usable in the source preview.
  // The game uses monster-den/lit to retain the same authored effect in Creator.
  for (const [name, original] of [['builtin-standard', lit], ['builtin-unlit', unlit]]) effect(name, original.shaders[0], properties);
  addMaterial('missing-material', lit).setProperty('mainColor', new cc.Color(220, 40, 190, 255));
  addMaterial('default-material', lit);

  const alpha = {targets: [{blend: true, blendSrc: gfx.BlendFactor.SRC_ALPHA, blendDst: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA, blendSrcAlpha: gfx.BlendFactor.ONE, blendDstAlpha: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA}]};
  function uiSource(modern, graphics = false, clear = false) {
    const input = modern ? 'in' : 'attribute', varyingOut = modern ? 'out' : 'varying', varyingIn = modern ? 'in' : 'varying', output = modern ? 'fragColor' : 'gl_FragColor';
    if (clear) return {vert: `precision highp float;${input} vec3 a_position;void main(){gl_Position=vec4(a_position,1.0);}`, frag: `precision highp float;${modern ? 'out vec4 fragColor;' : ''}void main(){${output}=vec4(1.0);}`};
    const vert = `precision highp float;\n${expand(chunks['cc-global'], modern)}\n#if USE_LOCAL\n${expand(chunks['cc-local'], modern)}\n#endif\n${input} vec3 a_position;${input} vec4 a_color;${varyingOut} vec4 v_color;\n${graphics ? `${input} float a_dist;${varyingOut} float v_dist;` : `${input} vec2 a_texCoord;${varyingOut} vec2 v_uv;`}\nvoid main(){vec4 p=vec4(a_position,1.0);\n#if USE_LOCAL\np=cc_matWorld*p;\n#endif\ngl_Position=cc_matViewProj*p;v_color=a_color;${graphics ? 'v_dist=a_dist;' : 'v_uv=a_texCoord;'}}`;
    const frag = graphics
      ? `${modern ? '' : '#extension GL_OES_standard_derivatives : enable\n'}precision highp float;${varyingIn} vec4 v_color;${varyingIn} float v_dist;${modern ? 'out vec4 fragColor;' : ''}\nvoid main(){float aa=0.05;\n${modern ? 'aa=fwidth(v_dist);' : '#ifdef GL_OES_standard_derivatives\naa=fwidth(v_dist);\n#endif'}\nfloat coverage=1.0-smoothstep(-aa,0.0,abs(v_dist)-1.0);${output}=v_color*vec4(1.0,1.0,1.0,coverage);}`
      : `precision highp float;${varyingIn} vec4 v_color;${varyingIn} vec2 v_uv;${modern ? 'out vec4 fragColor;' : ''}\n#if USE_TEXTURE\nuniform sampler2D cc_spriteTexture;\n#endif\nvoid main(){vec4 c=v_color;\n#if USE_TEXTURE\nc*=${modern ? 'texture' : 'texture2D'}(cc_spriteTexture,v_uv);\n#endif\n${output}=c;}`;
    return {vert, frag};
  }
  function uiEffect(name, graphics = false, clear = false, techniques = 1) {
    const attrs = clear ? [attribute('a_position', gfx.Format.RGB32F, 0)] : graphics
      ? [attribute('a_position', gfx.Format.RGB32F, 0), attribute('a_color', gfx.Format.RGBA32F, 1), attribute('a_dist', gfx.Format.R32F, 2)]
      : [attribute('a_position', gfx.Format.RGB32F, 0), attribute('a_texCoord', gfx.Format.RG32F, 1), attribute('a_color', gfx.Format.RGBA32F, 2)];
    const s = descriptor(name, modern => uiSource(modern, graphics, clear), attrs, [{name: 'USE_TEXTURE', type: 'boolean'}, {name: 'USE_LOCAL', type: 'boolean'}]);
    s.builtins = {globals: builtin(clear ? [] : ['CCGlobal', 'CCCamera']), locals: builtin(clear ? [] : ['CCLocal'], graphics || clear ? [] : ['cc_spriteTexture']), statistics: {}};
    return effect(name, s, {}, {rasterizerState: {cullMode: gfx.CullMode.NONE}, depthStencilState: {depthTest: false, depthWrite: false}, blendState: alpha}, techniques);
  }
  const sprite = uiEffect('builtin-sprite'), graphics = uiEffect('builtin-graphics', true), clear = uiEffect('builtin-clear-stencil', false, true);
  uiEffect('internal/builtin-geometry-renderer', false, true, 6);
  uiEffect('internal/builtin-occlusion-query', false, true);
  for (const key of ['ui-sprite-material', 'ui-sprite-gray-material', 'ui-sprite-alpha-sep-material', 'ui-sprite-gray-alpha-sep-material']) addMaterial(key, sprite, {USE_TEXTURE: true, USE_LOCAL: false});
  addMaterial('ui-base-material', sprite, {USE_TEXTURE: false, USE_LOCAL: false});
  addMaterial('ui-graphics-material', graphics, {USE_LOCAL: true});
  addMaterial('default-clear-stencil', clear);
  return {lit, unlit};
}
