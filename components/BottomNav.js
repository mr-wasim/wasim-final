
import Link from "next/link";
import { useRouter } from "next/router";

export default function BottomNav(){
  const r = useRouter();
  const items = [
    {href:'/tech', label:'Form', icon:'📝'},
    {href:'/tech/calls', label:'Calls', icon:'📞'},
    {href:'/tech/payments', label:'Payment', icon:'💳'},
    {href:'/tech/profile', label:'User', icon:'👤'},
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t md:hidden">
      <div className="grid grid-cols-4">
        {items.map(it=>(
          <Link key={it.href} href={it.href} className={`flex flex-col items-center py-2 ${r.pathname===it.href?'text-blue-600':'text-gray-600'}`}>
            <div className="text-xl">{it.icon}</div>
            <div className="text-xs">{it.label}</div>
          </Link>
        ))}
      </div>
    </nav>
  );
}
