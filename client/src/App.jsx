import AutoQueue from "./components/AutoQueue.jsx";
import AltQueue from "./components/AltQueue.jsx";
import VcomStats from "./components/VcomStats.jsx";

export default function App() {
  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold text-center mb-6">VCoM Bot Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AutoQueue />
        <AltQueue />
      </div>
      <div className="mt-8">
        <VcomStats />
      </div>
    </div>
  );
}
