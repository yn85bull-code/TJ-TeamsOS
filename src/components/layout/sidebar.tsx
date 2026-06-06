import { navItems } from "@/lib/dashboard-demo-data";
import { canAccessNavItem } from "@/lib/domain/permissions";
import { AppRole } from "@/types/database";
import { ChevronRight } from "lucide-react";

export function Sidebar({
  activeKey,
  appRole = "member",
  onSelect,
}: {
  activeKey: string;
  appRole?: AppRole;
  onSelect: (key: string) => void;
}) {
  const visibleNavItems = navItems.filter((item) => canAccessNavItem(appRole, item.key));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col bg-[#080F14] px-4 py-5 text-white lg:flex">
      <div className="flex items-center gap-3 px-2">
        <div className="grid size-10 place-items-center rounded-xl bg-[#D6001C] text-sm font-black">TJ</div>
        <div>
          <h1 className="text-sm font-bold">TJ-TeamOS</h1>
          <p className="text-[11px] text-slate-400">Work OS / MVP</p>
        </div>
      </div>

      <nav className="mt-8 grid gap-1.5">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              className={`group flex h-11 items-center justify-between rounded-lg px-3 text-sm font-semibold transition ${
                active ? "bg-gradient-to-r from-[#D6001C] to-[#EF233C] text-white shadow-lg shadow-red-950/30" : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
              type="button"
              onClick={() => onSelect(item.key)}
            >
              <span className="flex items-center gap-3">
                <Icon size={17} />
                {item.label}
              </span>
              {item.badge ? <span className="rounded-full bg-[#D6001C] px-2 py-0.5 text-[11px] text-white">{item.badge}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-xl bg-white/5 p-3">
        <div className="grid size-9 place-items-center rounded-full bg-slate-700 text-sm font-bold">T</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">Tauros株式会社</p>
          <p className="truncate text-[11px] text-slate-400">営業本部</p>
        </div>
        <ChevronRight size={16} className="text-slate-400" />
      </div>
    </aside>
  );
}
