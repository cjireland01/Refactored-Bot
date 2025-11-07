import { Routes, Route } from "react-router-dom";
import AutoQueue from "./components/AutoQueue.jsx";
import AltQueue from "./components/AltQueue.jsx";
import VcomStats from "./components/VcomStats.jsx";
import BRScheduler from "./components/BRScheduler.jsx";
import NavBar from "./components/NavBar.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <Routes>
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
          <Route
            path="/schedule"
            element={
              <>
                <h1 className="text-3xl font-bold text-center mb-6">
                  BR Schedule Editor
                </h1>
                <BRScheduler />
              </>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
