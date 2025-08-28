
import Header from "../../components/Header";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function CreateTech(){
  const [user,setUser]=useState(null);
  const [form,setForm]=useState({ username:'', password:'' });

  useEffect(()=>{
    (async ()=>{
      const me = await fetch('/api/auth/me'); const u = await me.json(); if(u.role!=='admin'){ window.location.href='/login'; return; } setUser(u);
    })();
  },[]);

  async function submit(e){
    e.preventDefault();
    const r = await fetch('/api/admin/create-tech', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    const d = await r.json();
    if(!r.ok){ toast.error(d.error||'Failed'); return; }
    toast.success('Technician created');
    setForm({ username:'', password:'' });
  }

  return (
    <div>
      <Header user={user} />
      <main className="max-w-lg mx-auto p-4">
        <div className="card">
          <div className="font-semibold mb-3">Create Technician</div>
          <form onSubmit={submit} className="grid gap-2">
            <input className="input" placeholder="Username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required />
            <input type="password" className="input" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required />
            <button className="btn bg-blue-600 text-white">Create</button>
          </form>
        </div>
      </main>
    </div>
  );
}
