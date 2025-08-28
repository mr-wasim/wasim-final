
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const TABS = ['All Calls','Today Calls','Pending','Completed','Closed'];

export default function Calls(){
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState('All Calls');
  const [items,setItems]=useState([]);
  const [page,setPage]=useState(1);
  const [count,setCount]=useState(0);
  const [lastCount,setLastCount]=useState(0);

  async function load(){
    const params = new URLSearchParams({ tab, page });
    const r = await fetch('/api/tech/my-calls?'+params.toString());
    const d = await r.json(); setItems(d.items); setCount(d.total);
    if(d.total>lastCount) toast('🔔 New call received');
    setLastCount(d.total);
  }

  useEffect(()=>{
    (async ()=>{
      const me = await fetch('/api/auth/me');
      if(!me.ok){ window.location.href='/login'; return; }
      const u = await me.json();
      if(u.role!=='technician'){ window.location.href='/login'; return; }
      setUser(u);
      await load();
      const t = setInterval(load, 15000);
      return ()=>clearInterval(t);
    })();
  },[tab,page]);

  async function updateStatus(id,status){
    const r = await fetch('/api/tech/update-call',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, status }) });
    const d = await r.json(); if(!r.ok){ toast.error(d.error||'Failed'); return; }
    toast.success('Updated'); load();
  }

  return (
    <div className="pb-16">
      <Header user={user} />
      <main className="max-w-3xl mx-auto p-4 space-y-3">
        <div className="card">
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map(t=>(
              <button key={t} onClick={()=>{setTab(t); setPage(1);}}
                className={`btn whitespace-nowrap ${tab===t?'bg-blue-600 text-white':'bg-gray-100'}`}>{t}{t==='Today Calls' && <span className="ml-1 badge bg-red-100 text-red-600">NEW</span>}</button>
            ))}
          </div>
        </div>
        <div className="card space-y-2">
          {items.map(call=>(
            <div key={call._id} className="border rounded-xl p-3">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">{call.clientName}</div>
                  <div className="text-sm text-gray-600">{call.phone} • {call.address}</div>
                </div>
                <div className="text-sm">{call.status}</div>
              </div>
              <div className="flex gap-2 mt-2">
                <a className="btn bg-green-600 text-white" href={`tel:${call.phone}`}>Call</a>
                <a className="btn bg-gray-100" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(call.address)}`}>Go</a>
                {tab==='All Calls' && (
                  <select className="input" defaultValue={call.status} onChange={e=>updateStatus(call._id, e.target.value)}>
                    <option>Pending</option>
                    <option>In Process</option>
                    <option>Completed</option>
                    <option>Closed</option>
                  </select>
                )}
                {tab!=='All Calls' && <button className="btn bg-gray-100" onClick={()=>updateStatus(call._id,'Closed')}>Close Call</button>}
              </div>
            </div>
          ))}
          <div className="flex justify-between">
            <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="btn bg-gray-100">Prev</button>
            <div className="text-sm text-gray-600">Page {page} • Showing {items.length} of {count}</div>
            <button onClick={()=>setPage(p=>p+1)} className="btn bg-gray-100">Next</button>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
