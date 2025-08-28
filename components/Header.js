
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Header({ user }){
  const r = useRouter();
  const [mobileOpen,setMobileOpen]=useState(false);
  return (
    <header className="w-full bg-white sticky top-0 z-30 shadow">
      <div className="max-w-6xl mx-auto flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <button className="md:hidden" onClick={()=>setMobileOpen(!mobileOpen)} aria-label="toggle menu">☰</button>
          <div className="text-xl font-bold">Chimney Solutions CRM</div>
        </div>
        <div className="flex items-center gap-4">
          {user?.role && <div className="text-sm text-gray-600">Logged in: <span className="font-semibold">{user.role}</span></div>}
          {user && <button onClick={async()=>{ await fetch('/api/auth/logout',{method:'POST'}); r.push('/login'); }} className="btn bg-red-500 text-white">Logout</button>}
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t">
          <nav className="p-2 flex flex-col gap-2">
            {user?.role==='admin' && (<>
              <Link className="btn bg-gray-100" href="/admin">Dashboard</Link>
              <Link className="btn bg-gray-100" href="/admin/forms">Service Forms</Link>
              <Link className="btn bg-gray-100" href="/admin/forward">Call Forwarding</Link>
              <Link className="btn bg-gray-100" href="/admin/forwarded">Forwarded Calls</Link>
              <Link className="btn bg-gray-100" href="/admin/payments">Payments / Reports</Link>
              <Link className="btn bg-gray-100" href="/admin/techs">Technicians</Link>
              <Link className="btn bg-gray-100" href="/admin/create-tech">Create Technician</Link>
            </>)}
            {user?.role==='technician' && (<>
              <Link className="btn bg-gray-100" href="/tech">Dashboard</Link>
              <Link className="btn bg-gray-100" href="/tech/payments">Payment Mode</Link>
            </>)}
          </nav>
        </div>
      )}
    </header>
  )
}
