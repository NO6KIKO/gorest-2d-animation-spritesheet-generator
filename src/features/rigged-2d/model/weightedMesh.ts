export type Point = [number, number];
export type WeightedMesh = {
  vertices: Point[]; uvs: Point[]; triangles: number[];
  weights: [bone: string, weight: number][][]; hull?: number;
};
export type Pivot = { x: number; y: number; parent?: string };
export type Pose = { translate: Point; rotate: number; scale: Point };
export type Matrix = [number, number, number, number, number, number];
const I: Matrix = [1, 0, 0, 1, 0, 0];
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
export function transformPoint(m: Matrix, p: Point): Point {
  return [m[0]*p[0]+m[2]*p[1]+m[4], m[1]*p[0]+m[3]*p[1]+m[5]];
}
export function boneMatrices(pivots: Record<string, Pivot>, poses: Record<string, Pose>) {
  const result: Record<string, Matrix> = {}, visiting = new Set<string>();
  const resolve = (name: string): Matrix => {
    if (result[name]) return result[name];
    if (visiting.has(name)) throw new Error(`Cyclic bone hierarchy: ${name}`);
    const p = pivots[name];
    if (!p) throw new Error(`Unknown mesh bone: ${name}`);
    visiting.add(name);
    const pose = poses[name], a = (pose?.rotate || 0)*Math.PI/180;
    const c = Math.cos(a), s = Math.sin(a), sx = pose?.scale[0] ?? 1, sy = pose?.scale[1] ?? 1;
    const local: Matrix = [c*sx, s*sx, -s*sy, c*sy,
      p.x+(pose?.translate[0] || 0)-c*sx*p.x+s*sy*p.y,
      p.y+(pose?.translate[1] || 0)-s*sx*p.x-c*sy*p.y];
    result[name] = multiply(p.parent ? resolve(p.parent) : I, local);
    visiting.delete(name); return result[name];
  };
  Object.keys(pivots).forEach(resolve); return result;
}
export function validateMesh(mesh: WeightedMesh, pivots: Record<string, Pivot>) {
  const n = mesh.vertices.length;
  if (n < 3 || n > 65535 || mesh.uvs.length !== n || mesh.weights.length !== n) throw new Error('Invalid mesh vertex arrays');
  if (mesh.triangles.length % 3 || mesh.triangles.some(i => !Number.isInteger(i) || i < 0 || i >= n)) throw new Error('Invalid mesh triangles');
  mesh.vertices.forEach((p,i) => {
    if (p.length!==2 || !p.every(Number.isFinite) || mesh.uvs[i].length!==2 || !mesh.uvs[i].every(Number.isFinite)) throw new Error('Invalid mesh coordinates');
    const weights=mesh.weights[i];
    if (!weights.length || weights.some(([b,w]) => !pivots[b] || !Number.isFinite(w) || w<0) || Math.abs(weights.reduce((s,[,w])=>s+w,0)-1)>0.0001) throw new Error('Invalid mesh weights');
  });
}
export function deformVertices(mesh: WeightedMesh, matrices: Record<string, Matrix>, editor = {x:0,y:0,scaleX:1,scaleY:1}, size: Point = [600,1100]) {
  return mesh.vertices.map((v,i): Point => {
    // Match existing region layers: slot adjustment precedes bone transforms.
    const p: Point = [(v[0]-size[0]/2)*editor.scaleX+size[0]/2+editor.x,
      (v[1]-size[1]/2)*editor.scaleY+size[1]/2+editor.y];
    const out: Point = [0,0];
    for (const [bone,weight] of mesh.weights[i]) {
      if (!matrices[bone]) throw new Error(`Unknown mesh bone: ${bone}`);
      const q=transformPoint(matrices[bone],p);out[0]+=q[0]*weight;out[1]+=q[1]*weight;
    }
    return out;
  });
}

/** One continuous textured surface. No triangle clipping seams or painted joint overlays. */
export class MeshRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private position: WebGLBuffer;
  private uv: WebGLBuffer;
  private index: WebGLBuffer;
  private texture: WebGLTexture;
  private vertexShader: WebGLShader;
  private fragmentShader: WebGLShader;
  constructor(private canvas: HTMLCanvasElement, private mesh: WeightedMesh, image: HTMLImageElement) {
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,preserveDrawingBuffer:true});
    if (!gl) throw new Error('WebGL unavailable: weighted mesh preview requires WebGL.');
    this.gl=gl;
    const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader error');return s};
    this.vertexShader=shader(gl.VERTEX_SHADER,'attribute vec2 position; attribute vec2 uv; uniform vec2 size; varying vec2 tex; void main(){gl_Position=vec4(position.x/size.x*2.0-1.0,1.0-position.y/size.y*2.0,0.0,1.0);tex=uv;}');
    this.fragmentShader=shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 tex; uniform sampler2D image; void main(){gl_FragColor=texture2D(image,tex);}');
    this.program=gl.createProgram()!;gl.attachShader(this.program,this.vertexShader);gl.attachShader(this.program,this.fragmentShader);gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program)||'Mesh program error');
    gl.useProgram(this.program);
    this.position=gl.createBuffer()!;this.uv=gl.createBuffer()!;this.index=gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.uv);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.uvs.flat()),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(this.program,'uv');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(mesh.triangles),gl.STATIC_DRAW);
    this.texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,1);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.uniform1i(gl.getUniformLocation(this.program,'image'),0);
  }
  draw(vertices: Point[]) {
    const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);
    gl.uniform2f(gl.getUniformLocation(this.program,'size'),this.canvas.width,this.canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.position);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices.flat()),gl.DYNAMIC_DRAW);
    const loc=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    gl.drawElements(gl.TRIANGLES,this.mesh.triangles.length,gl.UNSIGNED_SHORT,0);
  }
  dispose(){const g=this.gl;g.deleteBuffer(this.position);g.deleteBuffer(this.uv);g.deleteBuffer(this.index);g.deleteTexture(this.texture);g.deleteProgram(this.program);g.deleteShader(this.vertexShader);g.deleteShader(this.fragmentShader);}
}
