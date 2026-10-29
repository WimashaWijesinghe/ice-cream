'use client';
import {useRouter} from 'next/navigation';
const API=process.env.NEXT_PUBLIC_API_URL??'http://localhost:5000';
export default function LogoutButton(){const router=useRouter();return <button onClick={async()=>{await fetch(`${API}/api/auth/logout`,{method:'POST',credentials:'include'});router.replace('/login');router.refresh()}}>Logout</button>}
