
import Header from "../../../components/Header";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function TechDetail(){
  const r = useRouter();
  const { id } = r.query;
  const [user,setUser]=useState(null);
  const [info,setInfo]=useState(null);
  const [summary,setSummary]=useState({today:0,total:0,online:0,cash:0});

  useEffect(()=>{
    if(!id) return;
    (async ()=>{
      const me = await fetch('/api/auth/me'); const u = await me.json(); if(u.role!=='admin'){ window.location.href='/login'; return; } setUser(u);
      const a = await fetch('/api/admin/tech-info?id='+id); const ad = await a.json(); setInfo(ad);
      const s = await fetch('/api/admin/tech-summary?id='+id); const sd = await s.json(); setSummary(sd);
    })();
  },[id]);

  return (
    <div>
      <Header user={user} />
      <main className="max-w-5xl mx-auto p-4 space-y-3">
        {info? (<>
          <div className="card">
            <div className="text-xl font-semibold">{info.username}</div>
            <div className="text-sm text-gray-500">Joined: {new Date(info.createdAt).toLocaleString()}</div>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <div className="card"><div className="text-sm text-gray-500">Today Collection</div><div className="text-2xl font-bold">₹{summary.today}</div></div>
            <div className="card"><div className="text-sm text-gray-500">Total Collection</div><div className="text-2xl font-bold">₹{summary.total}</div></div>
            <div className="card"><div className="text-sm text-gray-500">Online</div><div className="text-2xl font-bold">₹{summary.online}</div></div>
            <div className="card"><div className="text-sm text-gray-500">Cash</div><div className="text-2xl font-bold">₹{summary.cash}</div></div>
          </div>
        </>): <div className="card h-24 skeleton" />}
      </main>
    </div>
  );
}
