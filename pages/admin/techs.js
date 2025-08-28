
import Header from "../../components/Header";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Techs(){
  const [user,setUser]=useState(null);
  const [items,setItems]=useState([]);

  useEffect(()=>{
    (async ()=>{
      const me = await fetch('/api/auth/me'); const u = await me.json(); if(u.role!=='admin'){ window.location.href='/login'; return; } setUser(u);
      const r = await fetch('/api/admin/techs'); const d = await r.json(); setItems(d.items);
    })();
  },[]);

  return (
    <div>
      <Header user={user} />
      <main className="max-w-6xl mx-auto p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="text-xl font-semibold">Technicians</div>
          <Link href="/admin/create-tech" className="btn bg-blue-600 text-white">Create Technician</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {items.map(t=>(
            <Link key={t._id} href={`/admin/tech/${t._id}`} className="card block">
              <div className="font-semibold">{t.username}</div>
              <div className="text-sm text-gray-500">Joined: {new Date(t.createdAt).toLocaleDateString()}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
