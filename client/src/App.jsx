import { Routes, Route, Navigate } from "react-router-dom";
import { useMe } from "./me.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import NavBar from "./components/NavBar.jsx";
import AutoQueue from "./components/AutoQueue.jsx";
import AltQueue from "./components/AltQueue.jsx";
import VcomStats from "./components/VcomStats.jsx";
import BRScheduler from "./components/BRScheduler.jsx";
import MetaVehicles from "./components/MetaVehicles.jsx";
import AltManager from "./components/AltManager.jsx";

// Pages that change things are only for editors (the server enforces this too)
function EditorOnly({ children }) {
  const { canEdit } = useMe();
  return canEdit ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { loading, authEnabled, level } = useMe();
  if (loading) return <div className="min-h-screen bg-gray-900" />;
  if (authEnabled && level === "none") return <LoginScreen />;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <Routes>
          {/* Main Dashboard */}
          <Route
            path="/"
            element={
              <>
                <h1 className="text-3xl font-bold text-center mb-6">
                  VCoM Bot Dashboard
                </h1>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AutoQueue />
                  <AltQueue />
                </div>
                <div className="mt-8">
                  <VcomStats />
                </div>
              </>
            }
          />

          {/* BR Schedule Editor */}
          <Route
            path="/schedule"
            element={<EditorOnly>
              <>
                <h1 className="text-3xl font-bold text-center mb-6">
                  BR Schedule Editor
                </h1>
                <BRScheduler />
              </>
            </EditorOnly>}
          />

          {/* Meta Vehicles Editor */}
          <Route
            path="/meta-vehicles"
            element={<EditorOnly>
              <>
                <h1 className="text-3xl font-bold text-center mb-6">
                  Meta Vehicles Editor
                </h1>
                <MetaVehicles />
              </>
            </EditorOnly>}
          />

          {/* Alt Account Manager */}
          <Route
            path="/alts"
            element={<EditorOnly>
              <>
                <h1 className="text-3xl font-bold text-center mb-6">
                  Alt Account Manager
                </h1>
                <AltManager />
              </>
            </EditorOnly>}
          />
        </Routes>
      </main>
    </div>
  );
}
