
import Header from "../../components/Header";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function AdminHome(){
  const [user,setUser]=useState(null);
  const [stats,setStats]=useState(null);

  useEffect(()=>{
    (async ()=>{
      const me = await fetch('/api/auth/me'); if(me.ok){ const u = await me.json(); if(u.role!=='admin'){ window.location.href='/login'; return; } setUser(u); }
      const r = await fetch('/api/admin/summary'); const d = await r.json(); setStats(d);
    })();
  },[]);

  return (
    <div>
      <Header user={user} />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="grid md:grid-cols-4 gap-3">
          {stats? (<>
            <div className="card"><div className="text-sm text-gray-500">Technicians</div><div className="text-2xl font-bold">{stats.techs}</div></div>
            <div className="card"><div className="text-sm text-gray-500">Forms Submitted</div><div className="text-2xl font-bold">{stats.forms}</div></div>
            <div className="card"><div className="text-sm text-gray-500">Forwarded Calls</div><div className="text-2xl font-bold">{stats.calls}</div></div>
            <div className="card"><div className="text-sm text-gray-500">Total Payments</div><div className="text-2xl font-bold">₹{stats.totalPayments}</div></div>
          </>):[1,2,3,4].map(i=>(<div key={i} className="card h-24 skeleton"></div>))}
        </div>
        <div className="card">
          <div className="font-semibold mb-2">Recent Forwarded Calls</div>
          <RecentForwarded />
        </div>
      </main>
    </div>
  )
}

function RecentForwarded(){
  const [items,setItems]=useState(null);
  useEffect(()=>{
    let cancelled=false;
    async function load(){
      const r = await fetch('/api/admin/forwarded?limit=10');
      const d = await r.json();
      if(!cancelled) setItems(d.items);
    }
    load();
  },[]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th className="p-2">Client</th><th className="p-2">Phone</th><th className="p-2">Tech</th><th className="p-2">Status</th><th className="p-2">Date</th></tr></thead>
        <tbody>
          {items? items.map(it=>(<tr key={it._id} className="border-t">
            <td className="p-2">{it.clientName}</td>
            <td className="p-2">{it.phone}</td>
            <td className="p-2">{it.techName||'-'}</td>
            <td className="p-2">{it.status}</td>
            <td className="p-2">{new Date(it.createdAt).toLocaleString()}</td>
          </tr>)) : Array.from({length:5}).map((_,i)=>(<tr key={i}><td className="p-2" colSpan="5"><div className="h-5 skeleton"/></td></tr>))}
        </tbody>
      </table>
    </div>
  );
}
