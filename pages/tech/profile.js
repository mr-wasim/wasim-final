
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import { useEffect, useState } from "react";

export default function Profile(){
  const [user,setUser]=useState(null);
  useEffect(()=>{
    (async ()=>{
      const me = await fetch('/api/auth/me'); if(!me.ok){ window.location.href='/login'; return; } const u = await me.json(); if(u.role!=='technician'){ window.location.href='/login'; return; } setUser(u);
    })();
  },[]);
  return (
    <div className="pb-16">
      <Header user={user} />
      <main className="max-w-xl mx-auto p-4 space-y-3">
        <div className="card">
          <div className="text-xl font-semibold">Technician Profile</div>
          <div className="text-sm text-gray-600">Username: {user?.username}</div>
          <div className="text-sm text-gray-600">Tech ID: {user?.id}</div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
