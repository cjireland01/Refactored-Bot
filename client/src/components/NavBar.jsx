import { NavLink } from "react-router-dom";
import { useMe } from "../me.jsx";
import { logout } from "./LoginScreen.jsx";

// editor: only people who can change things see the link
const LINKS = [
  { to: "/", label: "Main Dashboard", end: true },
  { to: "/schedule", label: "BR Schedule", editor: true },
  { to: "/meta-vehicles", label: "Meta Vehicles", editor: true },
  { to: "/alts", label: "Alt Accounts", editor: true },
];

export default function NavBar() {
  const { canEdit, user, authEnabled } = useMe();
  const links = LINKS.filter((l) => !l.editor || canEdit);
  return (
    <nav className="bg-gray-800 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-2 shadow-lg">
      <h1 className="text-xl font-semibold tracking-wide">VCoM Dashboard</h1>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {links.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `transition-colors duration-300 ${
                isActive ? "text-yellow-400 font-semibold" : "text-gray-300 hover:text-white"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
        {authEnabled && user && (
          <span className="text-sm text-gray-400 flex items-center gap-2">
            {user.name}
            {!canEdit && <span className="text-xs bg-gray-700 rounded px-1.5 py-0.5">view only</span>}
            <button onClick={logout} className="underline hover:text-white">
              Sign out
            </button>
          </span>
        )}
      </div>
    </nav>
  );
}
