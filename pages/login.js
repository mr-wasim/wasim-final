
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function Login(){
  const [role,setRole]=useState("admin");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    // keep logged in if token exists
    (async ()=>{
      const r = await fetch('/api/auth/me');
      if(r.ok){
        const u = await r.json();
        if(u.role==='admin') window.location.href='/admin';
        if(u.role==='technician') window.location.href='/tech';
      }
    })();
  },[]);

  async function onSubmit(e){
    e.preventDefault();
    setLoading(true);
    try{
      const r = await fetch(`/api/auth/login-${role}`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ username, password })
      });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error||'Login failed');
      toast.success('Login successful');
      if(role==='admin') window.location.href='/admin';
      else window.location.href='/tech';
    }catch(err){
      toast.error(err.message);
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md card">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold">Welcome</div>
          <div className="text-sm text-gray-500">Admin & Technician Login</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={()=>setRole('admin')} className={`btn ${role==='admin'?'bg-blue-600 text-white':'bg-gray-100'}`}>Admin Login</button>
          <button onClick={()=>setRole('technician')} className={`btn ${role==='technician'?'bg-blue-600 text-white':'bg-gray-100'}`}>Technician Login</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <div className="label">Username</div>
            <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" required />
          </div>
          <div>
            <div className="label">Password</div>
            <input type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required />
          </div>
          <button disabled={loading} className="btn w-full bg-blue-600 text-white">{loading?'Please wait...':'Login'}</button>
        </form>
        <p className="text-xs text-gray-500 mt-3">Technician IDs are created by Admin in the dashboard.</p>
      </div>
    </div>
  );
}
