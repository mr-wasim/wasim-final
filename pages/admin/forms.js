
import Header from "../../components/Header";
import { useEffect, useState } from "react";
import { saveAs } from "../../utils/csv";

export default function AdminForms(){
  const [user,setUser]=useState(null);
  const [items,setItems]=useState([]);
  const [q,setQ]=useState("");
  const [status,setStatus]=useState("");
  const [tech,setTech]=useState("");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);

  async function load(){
    const params = new URLSearchParams({ q, status, tech, page, dateFrom, dateTo });
    const r = await fetch('/api/admin/forms?'+params.toString());
    const d = await r.json(); setItems(d.items); setTotal(d.total);
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
        <div className="card grid md:grid-cols-6 gap-2">
          <input className="input md:col-span-2" placeholder="Search name/phone/address" value={q} onChange={e=>setQ(e.target.value)} />
          <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option>Services Done</option>
            <option>Installation Done</option>
            <option>Complaint Done</option>
            <option>Under Process</option>
          </select>
          <input className="input" placeholder="Technician username" value={tech} onChange={e=>setTech(e.target.value)} />
          <input className="input" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          <input className="input" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
          <div className="md:col-span-6 flex gap-2">
            <button onClick={()=>{setPage(1); load();}} className="btn bg-blue-600 text-white">Filter</button>
            <button onClick={async()=>{
              const params = new URLSearchParams({ q, status, tech, dateFrom, dateTo, csv: '1' });
              const r = await fetch('/api/admin/forms?'+params.toString());
              const d = await r.json();
              saveAs('forms.csv', d.csv);
            }} className="btn bg-gray-100">Export CSV</button>
          </div>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-2">Technician</th><th className="p-2">Client</th><th className="p-2">Phone</th><th className="p-2">Address</th><th className="p-2">Payment</th><th className="p-2">Status</th><th className="p-2">Signature</th><th className="p-2">Date</th></tr></thead>
            <tbody>
              {items.map(it=>(<tr key={it._id} className="border-t">
                <td className="p-2">{it.techUsername}</td>
                <td className="p-2">{it.clientName}</td>
                <td className="p-2">{it.phone}</td>
                <td className="p-2">{it.address}</td>
                <td className="p-2">₹{it.payment||0}</td>
                <td className="p-2">{it.status}</td>
                <td className="p-2">{it.signature? <img src={it.signature} alt="sig" className="h-10" />:'-'}</td>
                <td className="p-2">{new Date(it.createdAt).toLocaleString()}</td>
              </tr>))}
            </tbody>
          </table>
          <div className="flex justify-between mt-3">
            <button disabled={page<=1} onClick={()=>{ setPage(p=>p-1); setTimeout(load,0); }} className="btn bg-gray-100">Prev</button>
            <div className="text-sm text-gray-600">Page {page} • Total {total}</div>
            <button onClick={()=>{ setPage(p=>p+1); setTimeout(load,0); }} className="btn bg-gray-100">Next</button>
          </div>
        </div>
      </main>
    </div>
  );
}
