"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
const menus = [
  { title: "Dashboard", path: "/" },
  { title: "POS Lorry / Section", path: "/pos" },
  { title: "Business / Section", path: "/master" },
  { title: "Distribution Lines", path: "/master" },
  { title: "Customers / Shops", path: "/master" },
  { title: "Items / Stock", path: "/master" },
];
export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <>
    <button className="mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open}>☰ Menu</button>
    {open && <button className="overlay" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">DISTRIBUTION SYSTEM<small>Legacy-style Web POS</small></div>
      <div className="nav-caption">MAIN MENU</div>
      <nav>{menus.map((m, i) => <Link key={`${m.title}-${i}`} href={m.path} onClick={() => setOpen(false)} className={pathname === m.path ? "active" : ""}>{m.title}</Link>)}</nav>
      <div className="nav-caption">COMING NEXT</div>
      <div className="nav-muted">Purchasing · Loading · Collections · Reports · Trip Settlement</div>
    </aside>
  </>;
}
