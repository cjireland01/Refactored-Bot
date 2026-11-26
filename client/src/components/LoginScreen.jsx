import { useMe } from "../me.jsx";

async function logout() {
  try {
    await fetch("/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/";
  }
}

// Shown instead of the dashboard when login is on and the person can't use it yet
export default function LoginScreen() {
  const { user } = useMe();
  return (
    <div className="min-h-screen bg-gray-900 text-white grid place-items-center p-6">
      <div className="max-w-sm w-full bg-gray-800 rounded-lg shadow p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">VCoM Dashboard</h1>
        {user ? (
          <>
            <p className="text-gray-300 mb-4">
              You're signed in as <span className="font-semibold">{user.name}</span>, but this account doesn't have
              access. You need to be a member of the squadron's Discord server.
            </p>
            <button onClick={logout} className="px-4 py-2 bg-gray-700 rounded">
              Sign out
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-300 mb-4">Sign in with your Discord account to see the squadron dashboard.</p>
            <a
              href="/auth/login"
              className="inline-block px-4 py-2 rounded font-semibold bg-indigo-600 hover:bg-indigo-500"
            >
              Log in with Discord
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export { logout };
