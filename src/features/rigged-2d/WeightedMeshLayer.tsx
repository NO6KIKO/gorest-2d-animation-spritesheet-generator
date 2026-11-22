import {useEffect,useRef,useState} from 'react';
import {boneMatrices,deformVertices,MeshRenderer,validateMesh,type WeightedMesh} from './model/weightedMesh';
import type {BonePivot,BonePose,EditorTransform} from './types';

export function WeightedMeshLayer({url,mesh,size,pivots,poses,transform,slot}:{
  url:string;mesh:WeightedMesh;size:[number,number];pivots:Record<string,BonePivot>;
  poses:Record<string,BonePose>;transform:EditorTransform;slot:string;
}) {
  const canvas=useRef<HTMLCanvasElement>(null),renderer=useRef<MeshRenderer|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;setReady(false);setError('');
    const image=new Image();image.src=url;
    image.decode().then(()=>{if(cancelled||!canvas.current)return;validateMesh(mesh,pivots);renderer.current=new MeshRenderer(canvas.current,mesh,image);setReady(true)}).catch(e=>{if(!cancelled)setError(String(e))});
    return()=>{cancelled=true;renderer.current?.dispose();renderer.current=null};
  },[url,mesh,pivots]);
  useEffect(()=>{
    if(!ready||!renderer.current)return;
    try{renderer.current.draw(deformVertices(mesh,boneMatrices(pivots,poses),transform,size))}catch(e){setError(String(e))}
  },[ready,mesh,pivots,poses,transform,size]);
  return <><canvas ref={canvas} width={size[0]} height={size[1]} data-mesh-slot={slot} data-render-state={error?'error':ready?'ready':'loading'} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>{error&&<span role="alert">{error}</span>}</>;
}
