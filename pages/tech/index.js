import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

export default function TechHome(){
  const [user,setUser]=useState(null);
  const [form,setForm]=useState({ clientName:'', address:'', payment:0, phone:'', status:'Services Done', signature:'' });
  const [canvasWidth, setCanvasWidth] = useState(500); // default width
  const sigRef = useRef();

  // ✅ Responsive canvas resize
  useEffect(()=>{
    function updateSize(){
      if(window.innerWidth < 500){
        setCanvasWidth(window.innerWidth - 40); // 20px padding each side
      } else {
        setCanvasWidth(500);
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return ()=>window.removeEventListener("resize", updateSize);
  },[]);

  useEffect(()=>{
    (async ()=>{
      const me = await fetch('/api/auth/me');
      if(!me.ok){ window.location.href='/login'; return; }
      const u = await me.json();
      if(u.role!=='technician'){ window.location.href='/login'; return; }
      setUser(u);
    })();
  },[]);

  function clearSig(){ 
    sigRef.current?.clear(); 
    setForm({...form, signature:''}); 
  }

  async function submit(e){
    e.preventDefault();
    const signature = form.signature || sigRef.current?.toDataURL();
    const r = await fetch('/api/tech/submit-form', { 
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify({...form, signature}) 
    });
    const d = await r.json();
    if(!r.ok){ toast.error(d.error||'Failed'); return; }
    toast.success('Form submitted');
    setForm({ clientName:'', address:'', payment:0, phone:'', status:'Services Done', signature:'' });
    clearSig();
  }

  return (
    <div className="pb-16">
      <Header user={user} />
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div>📝</div>
            <div className="font-semibold">Service Form</div>
          </div>
          <form onSubmit={submit} className="grid gap-2">
            <input className="input" placeholder="Client Name" value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})} required />
            <input className="input" placeholder="Client Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} required />
            <input className="input" type="number" placeholder="Payment (₹)" value={form.payment} onChange={e=>setForm({...form,payment:Number(e.target.value)})} />
            <input className="input" placeholder="Phone Number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} required />
            
            <select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
              <option>Services Done</option>
              <option>Installation Done</option>
              <option>Complaint Done</option>
              <option>Under Process</option>
            </select>

            {/* ✅ Signature Pad */}
            <div>
              <div className="label mb-1">Client Signature</div>
              <div className="border rounded-xl overflow-hidden">
                <SignaturePad 
                  ref={sigRef} 
                  canvasProps={{
                    width: canvasWidth,
                    height: 200,
                    className:'sigCanvas w-full'
                  }} 
                />
              </div>
              <div></div>
              <div className="text-xs text-gray-500 mt-1">
                Sign inside box. 
                <button type="button" onClick={clearSig} className="underline ml-2">Clear</button>
              </div>
            </div>

            <button className="btn bg-blue-600 text-white">Submit</button>
          </form>
        </div>
      </main>
      <BottomNav />
    </div>
   
  );
}
