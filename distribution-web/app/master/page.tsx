"use client";
import { useEffect, useState } from "react";
type Entry = { id:string; name:string; sectionId?:string };
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
export default function MasterPage(){
 const [sections,setSections]=useState<Entry[]>([]);const [lines,setLines]=useState<Entry[]>([]);const [error,setError]=useState("");
 useEffect(()=>{Promise.all([fetch(`${API}/api/legacy-pos/sections`,{credentials:"include"}),fetch(`${API}/api/legacy-pos/lines`,{credentials:"include"})]).then(async r=>{if(r.some(x=>!x.ok))throw Error("Unable to load data");return Promise.all(r.map(x=>x.json()))}).then(([s,l])=>{setSections(s);setLines(l)}).catch(e=>setError(e.message))},[]);
 return <main className="page"><h1>Master Data</h1><p className="subtitle">Existing database records · Read-only preview</p>{error&&<div className="notice">{error}</div>}<section className="panel"><h2>Sections</h2><div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>Section ID</th><th>Name</th></tr></thead><tbody>{sections.map(x=><tr key={x.id}><td>{x.id}</td><td>{x.name}</td></tr>)}</tbody></table></div></section><section className="panel"><h2>Distribution Lines</h2><div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>Line ID</th><th>Line Name</th><th>Section</th></tr></thead><tbody>{lines.map(x=><tr key={x.id}><td>{x.id}</td><td>{x.name}</td><td>{x.sectionId}</td></tr>)}</tbody></table></div></section></main>;
}
