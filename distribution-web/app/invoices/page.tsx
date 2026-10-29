'use client';
import { useEffect, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
type Invoice = { TraNo:string; BillNo:string; TraDat:string; customerId:string; lineCount:number; cashPay:string; chequePay:string; creditPay:string };
type Detail = { SaleId:number; itemName:string; SaleQty:string; SalePrc:string; TotBal:string; customerName:string };
export default function InvoiceHistory() {
 const [items,setItems]=useState<Invoice[]>([]); const [detail,setDetail]=useState<Detail[]>([]);
 const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
 useEffect(()=>{ fetch(`${API}/api/invoices/recent`,{credentials:'include'}).then(async r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}).then(d=>setItems(d.items)).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[]);
 async function view(i:Invoice){setError('');setDetail([]);try{const d=new Date(i.TraDat).toISOString().slice(0,10);const q=new URLSearchParams({traNo:i.TraNo,billNo:i.BillNo,customerId:i.customerId,date:d});const r=await fetch(`${API}/api/invoices/detail?${q}`,{credentials:'include'});if(!r.ok)throw Error(`HTTP ${r.status}`);setDetail((await r.json()).items);}catch(e){setError(String(e));}}
 return <main className="page"><h1>Invoice History</h1><p className="subtitle">Existing Desktop POS invoices — read-only review and print preview</p>{error&&<div role="alert" className="notice">{error}</div>}{loading?<p>Loading…</p>:<div style={{overflowX:'auto'}}><table cellPadding={10}><thead><tr><th>Date</th><th>Transaction</th><th>Bill</th><th>Customer ID</th><th>Lines</th><th>Action</th></tr></thead><tbody>{items.map((i,n)=><tr key={`${i.TraNo}-${i.BillNo}-${n}`}><td>{String(i.TraDat).slice(0,10)}</td><td>{i.TraNo}</td><td>{i.BillNo}</td><td>{i.customerId}</td><td>{i.lineCount}</td><td><button onClick={()=>view(i)}>View</button></td></tr>)}</tbody></table></div>}
 {detail.length>0&&<section className="panel" style={{marginTop:20}}><h2>Invoice details</h2><p>Customer: {detail[0].customerName}</p><div style={{overflowX:'auto'}}><table cellPadding={10}><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Legacy line balance</th></tr></thead><tbody>{detail.map(d=><tr key={d.SaleId}><td>{d.itemName}</td><td>{d.SaleQty}</td><td>{d.SalePrc}</td><td>{d.TotBal}</td></tr>)}</tbody></table></div><p>Amounts are legacy stored values; final payable total is not calculated until rules are verified.</p><button onClick={()=>window.print()}>Print preview</button></section>}
 </main>;
}
