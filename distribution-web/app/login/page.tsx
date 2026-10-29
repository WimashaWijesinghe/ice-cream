'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
const API=process.env.NEXT_PUBLIC_API_URL??'http://localhost:5000';
export default function Login(){
 const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const router=useRouter();
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setBusy(true);try{
 const r=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username,password})});
 const j=await r.json();if(!r.ok)throw Error(j.error??'Login failed');window.location.assign('/');
 }catch(e){setError(e instanceof Error?e.message:'Login failed')}finally{setBusy(false)}}
 return <main className="login-page"><form className="login-panel" onSubmit={submit}><h1>Distribution Management</h1><p>Sign in to Web POS</p><label>Username<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="notice">{error}</p>}<button disabled={busy} type="submit">{busy?'Signing in…':'Login'}</button></form></main>;
}
