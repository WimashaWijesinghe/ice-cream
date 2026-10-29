'use client';
import { useEffect, useRef, useState } from 'react';

type Opt = { id: string; name: string; sectionId?: string };
type Customer = Opt & { address: string; creditLimit: string; blocked: string };
type Item = Opt & { barcode?: string; sectionQty?: string; unit?: string };
type CartRow = { id: string; name: string; qty: number; price: number; discount: number };
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api/legacy-pos${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
export default function PosPage() {
  const [sections, setSections] = useState<Opt[]>([]);
  const [lines, setLines] = useState<Opt[]>([]);
  const [section, setSection] = useState('');
  const [line, setLine] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [rows, setRows] = useState<CartRow[]>([]);
  const [cash, setCash] = useState('0');
  const [cheque, setCheque] = useState('0');
  const [error, setError] = useState('');
  const customerRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef<HTMLInputElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLSelectElement>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    function shortcuts(e: KeyboardEvent) {
      if (e.key === 'F2') { e.preventDefault(); sectionRef.current?.focus(); }
      if (e.key === 'F3') { e.preventDefault(); customerRef.current?.focus(); }
      if (e.key === 'F4') { e.preventDefault(); itemRef.current?.focus(); }
      if (e.key === 'End') { e.preventDefault(); cashRef.current?.focus(); }
      if (e.key === 'F10') { e.preventDefault(); setNotice('Save & Print is locked until legacy invoice posting rules are verified.'); }
      if (e.key === 'Escape') { setNotice(''); setError(''); }
    }
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, []);
  useEffect(() => { getJson<Opt[]>('/sections').then(setSections).catch(e => setError(e.message)); }, []);
  useEffect(() => { getJson<Opt[]>(`/lines?section=${encodeURIComponent(section)}`).then(setLines).catch(e => setError(e.message)); }, [section]);
  useEffect(() => { const t = setTimeout(() => getJson<Customer[]>(`/customers?q=${encodeURIComponent(customerSearch)}&lineId=${encodeURIComponent(line)}`).then(setCustomers).catch(e => setError(e.message)), 250); return () => clearTimeout(t); }, [customerSearch, line]);
  useEffect(() => { const t = setTimeout(() => getJson<Item[]>(`/items?q=${encodeURIComponent(itemSearch)}&section=${encodeURIComponent(section)}`).then(setItems).catch(e => setError(e.message)), 250); return () => clearTimeout(t); }, [itemSearch, section]);
  const selectedItem = items.find(i => i.id === itemId);
  const selectedCustomer = customers.find(c => c.id === customerId);
  const total = rows.reduce((sum, r) => sum + r.qty * r.price - r.discount, 0);
  const due = total - (Number(cash) || 0) - (Number(cheque) || 0);
  const validPayments = [cash, cheque].every(v => Number.isFinite(Number(v)) && Number(v) >= 0);
  const creditPreview = validPayments ? Math.max(0, due) : 0;
  const changePreview = validPayments ? Math.max(0, -due) : 0;
  function addItem() {
    const q = Number(qty), p = Number(price), d = Number(discount);
    if (!selectedItem || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0 || !Number.isFinite(d) || d < 0 || d > q * p) { setError('Select item and enter valid quantity, price and discount.'); return; }
    setRows(prev => [...prev, { id: selectedItem.id, name: selectedItem.name, qty: q, price: p, discount: d }]);
    setError(''); setItemId(''); setQty('1'); setPrice('0'); setDiscount('0');
  }
  const input = { width: '100%', padding: '9px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', color: '#172033' } as const;
  const panel = { border: '1px solid #cbd5e1', borderRadius: 5, padding: 12, background: '#f8fafc' } as const;
  return <main style={{ minHeight: '100vh', background: '#e6edf5', color: '#172033', padding: 12, fontFamily: 'Arial, sans-serif' }}>
    <header style={{ background: '#c4d9ed', border: '1px solid #a7bfd7', padding: '12px 16px', fontWeight: 700 }}>POS LORRY / SECTION <span style={{ float: 'right', fontSize: 12 }}>Web preview · Read-only</span></header>
    {notice && <p role="status" style={{ background: '#fff3cd', padding: 10 }}>{notice}</p>}
    {error && <p role="alert" style={{ background: '#fee2e2', padding: 10 }}>{error}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12, marginTop: 12 }}>
      <section style={panel}><h3>Invoice (F2)</h3><label>Section<select ref={sectionRef} style={input} value={section} onChange={e => { setSection(e.target.value); setLine(''); }}>{<option value="">Select section</option>}{sections.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Route / Line<select style={input} value={line} onChange={e => setLine(e.target.value)}><option value="">All lines</option>{lines.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><p>Date: {new Date().toLocaleDateString()}</p></section>
      <section style={panel}><h3>Customer (F3)</h3><input ref={customerRef} style={input} placeholder="Search customer / ID" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}/><select style={input} value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}</select><p>{selectedCustomer?.address ?? 'Customer address'}</p><p>Credit limit: {selectedCustomer?.creditLimit ?? '—'}</p></section>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 12, marginTop: 12 }} className="pos-columns">
      <section style={panel}><h3>Item Details (F4)</h3><input ref={itemRef} style={input} placeholder="Search item / barcode" value={itemSearch} onChange={e => setItemSearch(e.target.value)}/><select style={input} value={itemId} onChange={e => setItemId(e.target.value)}><option value="">Select item</option>{items.map(i => <option key={i.id} value={i.id}>{i.id} — {i.name}</option>)}</select><p>On hand: {selectedItem?.sectionQty ?? '—'} · Unit: {selectedItem?.unit ?? '—'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}><label>Qty<input style={input} type="number" min="0.001" step="0.001" value={qty} onChange={e => setQty(e.target.value)}/></label><label>Price<input style={input} type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}/></label><label>Discount<input style={input} type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}/></label></div>
      <button onClick={addItem} style={{ marginTop: 10, padding: '10px 18px' }}>Add (+)</button>
      <div style={{ overflowX: 'auto', marginTop: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 530 }}><thead><tr>{['Item Code','Description','QTY','Price','Discount','Total',''].map(x => <th key={x} style={{ textAlign: 'left', borderBottom: '1px solid #cbd5e1', padding: 6 }}>{x}</th>)}</tr></thead><tbody>{rows.map((r, idx) => <tr key={idx}><td>{r.id}</td><td>{r.name}</td><td>{r.qty}</td><td>{r.price.toFixed(2)}</td><td>{r.discount.toFixed(2)}</td><td>{(r.qty*r.price-r.discount).toFixed(2)}</td><td><button onClick={() => setRows(v => v.filter((_,i) => i!==idx))}>×</button></td></tr>)}</tbody></table></div></section>
      <section style={panel}><h3>Payments (END)</h3><p>Total Amount: <strong>{total.toFixed(2)}</strong></p><label>Cash Payment<input ref={cashRef} style={input} type="number" min="0" step="0.01" value={cash} onChange={e => setCash(e.target.value)}/></label><label>Cheque Payment<input style={input} type="number" min="0" step="0.01" value={cheque} onChange={e => setCheque(e.target.value)}/></label><p>Remaining / Credit (preview): <strong>{creditPreview.toFixed(2)}</strong></p><p>Change (preview): <strong>{changePreview.toFixed(2)}</strong></p>{!validPayments && <p role="alert">Cash and cheque amounts must be valid non-negative numbers.</p>}<button disabled style={{ width: '100%', padding: 12 }}>Save & Print (F10) — pending legacy validation</button><small>Saving is intentionally disabled until existing invoice rules, returns, cheque and credit accounting are mapped and tested.</small></section>
    </div>
    <style jsx>{`@media(max-width:760px){.pos-columns{grid-template-columns:1fr!important} main{padding:8px!important} section{min-width:0} input,select,button{min-height:42px}}`}</style>
  </main>;
}
