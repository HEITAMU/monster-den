#!/usr/bin/env node
/** Author the same compact 3D effects for Creator's native .effect importer. */
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../assets/resources/effects');
const vertex=`precision highp float;
#include <builtin/uniforms/cc-global>
#include <builtin/uniforms/cc-local>
in vec3 a_position;
in vec3 a_normal;
in vec2 a_texCoord;
#if USE_VERTEX_COLOR
  in vec4 a_color;
#endif
out vec3 v_normal;
out vec3 v_world;
out vec2 v_uv;
out vec4 v_color;
vec4 vert () {
  vec4 world = cc_matWorld * vec4(a_position, 1.0);
  v_normal = normalize(mat3(cc_matWorldIT) * a_normal);
  v_world = world.xyz;
  v_uv = a_texCoord;
  v_color = vec4(1.0);
  #if USE_VERTEX_COLOR
    v_color = a_color;
  #endif
  return cc_matViewProj * world;
}`;
function fragment(lit){return `precision highp float;
#include <builtin/uniforms/cc-global>
uniform Surface {
  vec4 mainColor;
  vec4 surfaceParams;
};
in vec3 v_normal;
in vec3 v_world;
in vec2 v_uv;
in vec4 v_color;
#if USE_TEXTURE
  uniform sampler2D mainTexture;
#endif
vec4 frag () {
  vec4 base = mainColor * v_color;
  #if USE_TEXTURE
    base *= texture(mainTexture, v_uv);
  #endif
  ${lit ? `vec3 n = normalize(v_normal);
  vec3 l = normalize(vec3(-0.42, 0.82, 0.40));
  if (length(cc_mainLitDir.xyz) > 0.1) l = normalize(-cc_mainLitDir.xyz);
  float diffuse = max(dot(n, l), 0.0);
  vec3 v = normalize(cc_cameraPos.xyz - v_world);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float spec = pow(max(dot(n, normalize(l + v)), 0.0), mix(60.0, 5.0, surfaceParams.x)) * 0.12;
  vec3 shade = vec3(0.32, 0.37, 0.45) + vec3(0.78, 0.75, 0.66) * diffuse;
  base.rgb = base.rgb * shade + vec3(spec) + vec3(0.12, 0.16, 0.20) * rim * surfaceParams.y + base.rgb * surfaceParams.z;` : ''}
  return base;
}`;}
fs.mkdirSync(out,{recursive:true});
for(const kind of ['lit','unlit']){
 const effect=`// Monster Den original material; source-preview equivalent: web/engine-effects.js
CCEffect %{
  techniques:
  - passes:
    - vert: surface-vs:vert
      frag: surface-fs:frag
      rasterizerState: { cullMode: back }
      depthStencilState: { depthTest: true, depthWrite: true }
      properties:
        mainColor: { value: [1, 1, 1, 1], editor: { type: color } }
        surfaceParams: { value: [0.7, 0.5, 0, 0] }
        mainTexture: { value: white }
}%
CCProgram surface-vs %{
${vertex}
}%
CCProgram surface-fs %{
${fragment(kind==='lit')}
}%
`;
 fs.writeFileSync(path.join(out,`monster-den-${kind}.effect`),effect);
}
console.log('Authored Creator .effect assets for lit/unlit materials. These still require a Creator importer/build check.');
