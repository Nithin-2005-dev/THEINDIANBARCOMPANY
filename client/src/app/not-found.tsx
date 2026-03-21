export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white text-center px-6">

      <h1 className="text-6xl font-bold mb-4">
        404
      </h1>

      <h2 className="text-2xl font-semibold mb-2">
        Page Not Found
      </h2>

      <p className="text-zinc-400 mb-8 max-w-md">
        The page you are looking for doesn’t exist or has been moved.
      </p>

      <a
        href="/"
        className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 transition"
      >
        Go Home
      </a>

    </main>
  )
}