
import Header from "../../components/Header";
import { useEffect, useState } from "react";
import { saveAs } from "../../utils/csv";

export default function Payments(){
  const [user,setUser]=useState(null);
  const [techs,setTechs]=useState([]);
  const [techId,setTechId]=useState("");
  const [items,setItems]=useState([]);
  const [sum,setSum]=useState({ online:0, cash:0, total:0 });
  const [range,setRange]=useState('today');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');

  useEffect(()=>{
    (async ()=>{
      const me = await fetch('/api/auth/me'); const u = await me.json(); if(u.role!=='admin'){ window.location.href='/login'; return; } setUser(u);
      const r = await fetch('/api/admin/techs'); const d = await r.json(); setTechs(d.items);
    })();
  },[]);

  async function load(){
    const params = new URLSearchParams({ techId, range, from, to });
    const r = await fetch('/api/admin/payments?'+params.toString());
    const d = await r.json(); setItems(d.items); setSum(d.sum);
  }

  return (
    <div>
      <Header user={user} />
      <main className="max-w-6xl mx-auto p-4 space-y-3">
        <div className="card grid md:grid-cols-6 gap-2">
          <select className="input" value={techId} onChange={e=>setTechId(e.target.value)}>
            <option value="">Select Technician</option>
            {techs.map(t=>(<option key={t._id} value={t._id}>{t.username}</option>))}
          </select>
          <select className="input" value={range} onChange={e=>setRange(e.target.value)}>
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">All</option>
            <option value="custom">Custom</option>
          </select>
          {range==='custom' && (<>
            <input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} />
            <input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} />
          </>)}
          <button onClick={load} className="btn bg-blue-600 text-white">Load</button>
          <button onClick={async()=>{
            const params = new URLSearchParams({ techId, range, from, to, csv:'1' });
            const r = await fetch('/api/admin/payments?'+params.toString());
            const d = await r.json();
            const csv = d.csv;
            const blob = new Blob([csv], {type:'text/csv'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'payments.csv'; a.click(); URL.revokeObjectURL(url);
          }} className="btn bg-gray-100">Export CSV</button>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="card"><div className="text-sm text-gray-500">Online</div><div className="text-2xl font-bold">₹{sum.online}</div></div>
          <div className="card"><div className="text-sm text-gray-500">Cash</div><div className="text-2xl font-bold">₹{sum.cash}</div></div>
          <div className="card"><div className="text-sm text-gray-500">Total</div><div className="text-2xl font-bold">₹{sum.total}</div></div>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-2">Who Received</th><th className="p-2">Mode</th><th className="p-2">Online</th><th className="p-2">Cash</th><th className="p-2">Receiver Sign</th><th className="p-2">Tech</th><th className="p-2">Date</th></tr></thead>
            <tbody>
              {items.map(p=>(<tr key={p._id} className="border-t">
                <td className="p-2">{p.receiver}</td>
                <td className="p-2">{p.mode}</td>
                <td className="p-2">₹{p.onlineAmount||0}</td>
                <td className="p-2">₹{p.cashAmount||0}</td>
                <td className="p-2">{p.receiverSignature? <img src={p.receiverSignature} className="h-10" />:'-'}</td>
                <td className="p-2">{p.techUsername}</td>
                <td className="p-2">{new Date(p.createdAt).toLocaleString()}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
