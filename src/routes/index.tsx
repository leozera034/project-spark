import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
      <div
        className="absolute top-1/2 left-1/2 h-16 w-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_40px_rgba(34,211,238,0.6)]"
        style={{
          animation: "float 6s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translate(-50%, -50%) translate(0, 0);
          }
          25% {
            transform: translate(-50%, -50%) translate(120px, -80px);
          }
          50% {
            transform: translate(-50%, -50%) translate(-100px, 40px);
          }
          75% {
            transform: translate(-50%, -50%) translate(60px, 100px);
          }
        }
      `}</style>
    </div>
  );
}
