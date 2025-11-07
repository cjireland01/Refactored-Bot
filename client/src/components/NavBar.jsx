import { NavLink } from "react-router-dom";

export default function NavBar() {
  return (
    <nav className="bg-gray-800 text-white px-6 py-3 flex items-center justify-between shadow-lg">
      <h1 className="text-xl font-semibold tracking-wide">
        VCoM Dashboard
      </h1>
      <div className="flex gap-6">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `transition-colors duration-300 ${
              isActive
                ? "text-yellow-400 font-semibold"
                : "text-gray-300 hover:text-white"
            }`
          }
        >
          Main Dashboard
        </NavLink>
        <NavLink
          to="/schedule"
          className={({ isActive }) =>
            `transition-colors duration-300 ${
              isActive
                ? "text-yellow-400 font-semibold"
                : "text-gray-300 hover:text-white"
            }`
          }
        >
          BR Schedule
        </NavLink>
      </div>
    </nav>
  );
}
