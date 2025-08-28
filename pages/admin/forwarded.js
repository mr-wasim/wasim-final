
import Header from "../../components/Header";
import { useEffect, useState } from "react";

export default function ForwardedList(){
  const [user,setUser]=useState(null);
  const [items,setItems]=useState([]);
  const [page,setPage]=useState(1);
  const [q,setQ]=useState("");
  const [status,setStatus]=useState("");

  async function load(){
    const params = new URLSearchParams({ page, q, status });
    const r = await fetch('/api/admin/forwarded?'+params.toString());
    const d = await r.json(); setItems(d.items);
  }

  useEffect(()=>{
    (async ()=>{
      const me = await fetch('/api/auth/me'); const u = await me.json(); if(u.role!=='admin'){ window.location.href='/login'; return; } setUser(u);
      await load();
    })();
  },[]);

  return (
    <div>
      <Header user={user} />
      <main className="max-w-6xl mx-auto p-4 space-y-3">
        <div className="card grid md:grid-cols-4 gap-2">
          <input className="input" placeholder="Search name/phone/address" value={q} onChange={e=>setQ(e.target.value)} />
          <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="">All</option>
            <option>Pending</option>
            <option>In Process</option>
            <option>Completed</option>
            <option>Closed</option>
          </select>
          <button onClick={()=>{ setPage(1); load(); }} className="btn bg-blue-600 text-white">Filter</button>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-2">Client</th><th className="p-2">Phone</th><th className="p-2">Address</th><th className="p-2">Technician</th><th className="p-2">Status</th><th className="p-2">Date</th></tr></thead>
            <tbody>
              {items.map(it=>(<tr key={it._id} className="border-t">
                <td className="p-2">{it.clientName}</td>
                <td className="p-2">{it.phone}</td>
                <td className="p-2">{it.address}</td>
                <td className="p-2">{it.techName}</td>
                <td className="p-2">{it.status}</td>
                <td className="p-2">{new Date(it.createdAt).toLocaleString()}</td>
              </tr>))}
            </tbody>
          </table>
          <div className="flex justify-between mt-3">
            <button disabled={page<=1} onClick={()=>{ setPage(p=>p-1); setTimeout(load,0); }} className="btn bg-gray-100">Prev</button>
            <div className="text-sm text-gray-600">Page {page}</div>
            <button onClick={()=>{ setPage(p=>p+1); setTimeout(load,0); }} className="btn bg-gray-100">Next</button>
          </div>
        </div>
      </main>
    </div>
  );
}
