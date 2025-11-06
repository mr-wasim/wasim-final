import Link from "next/link";
import { useRouter } from "next/router";
import { Home, PhoneCall, CreditCard, User } from "lucide-react";
import { useEffect } from "react";

export default function BottomNav() {
  const r = useRouter();

  // ✅ Prefetch manually once on mount (still allowed)
  useEffect(() => {
    const paths = ["/tech", "/tech/calls", "/tech/payments", "/tech/profile"];
    paths.forEach((path) => r.prefetch(path));
  }, [r]);

  const items = [
    { href: "/tech", label: "Form", icon: <Home size={22} strokeWidth={1.8} /> },
    { href: "/tech/calls", label: "Calls", icon: <PhoneCall size={22} strokeWidth={1.8} /> },
    { href: "/tech/payments", label: "Payment", icon: <CreditCard size={22} strokeWidth={1.8} /> },
    { href: "/tech/profile", label: "Profile", icon: <User size={22} strokeWidth={1.8} /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-50 to-white backdrop-blur-lg border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden z-50">
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const isActive = r.pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              shallow
              scroll={false}
              className={`relative flex flex-col items-center justify-center py-3 transition-all duration-200 ${
                isActive ? "text-blue-600 scale-105" : "text-gray-500"
              }`}
            >
              <div
                className={`flex items-center justify-center transition-all duration-200 ${
                  isActive ? "scale-110" : ""
                }`}
              >
                {it.icon}
              </div>

              <span
                className={`text-[11px] mt-1 font-medium ${
                  isActive ? "text-blue-600" : "text-gray-500"
                }`}
              >
                {it.label}
              </span>

              {isActive && (
                <span className="absolute bottom-0 w-8 h-[3px] bg-blue-500 rounded-full transition-all duration-200" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
