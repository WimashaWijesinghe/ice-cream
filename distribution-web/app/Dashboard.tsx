"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  businesses: number;
  sections: number;
  lines: number;
  customers: number;
  items: number;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/dashboard/overview`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API error ${response.status}`);
        }

        return response.json();
      })
      .then(setStats)
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  const cards: { label: string; key: keyof Stats }[] = [
    { label: "Businesses", key: "businesses" },
    { label: "Sections", key: "sections" },
    { label: "Distribution Lines", key: "lines" },
    { label: "Customers / Shops", key: "customers" },
    { label: "Stock Items", key: "items" },
  ];

  return (
    <main className="page">
      <h1>Dashboard</h1>
      <p className="subtitle">
        Existing CIC / Hemas database · Live master-data counts
      </p>
      {error && (
        <div className="notice" role="alert">
          Dashboard data unavailable: {error}. Check the backend API route.
        </div>
      )}
      <div className="stat-grid">
        {cards.map((card) => (
          <div className="stat" key={card.key}>
            <span>{card.label}</span>
            <strong>
              {stats ? Number(stats[card.key]).toLocaleString() : "—"}
            </strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <h2>Quick Access</h2>
        <div className="quick-links">
          <Link href="/pos">Open POS Lorry / Section</Link>
          <Link href="/master">View Master Data</Link>
        </div>
      </section>
      <section className="panel">
        <div className="notice">
          Sales, collections and profitability figures are not shown yet
          because their legacy calculation rules need validation. POS Save
          &amp; Print remains disabled.
        </div>
      </section>
    </main>
  );
}
