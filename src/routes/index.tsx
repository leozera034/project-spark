import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const orbitCount = 12;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* Grid de fundo sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Centro da órbita */}
      <div className="orbit-center">
        {/* Núcleo pulsante */}
        <div className="nucleus" />

        {/* Anel externo */}
        <div className="ring ring-1" />
        <div className="ring ring-2" />

        {/* Bolinhas orbitando */}
        {Array.from({ length: orbitCount }).map((_, i) => (
          <div
            key={i}
            className="orbiter"
            style={{
              animationDelay: `${(i * -2.5) / orbitCount}s`,
              transform: `rotate(${(i * 360) / orbitCount}deg)`,
            }}
          >
            <div
              className="orbiter-ball"
              style={{
                animationDelay: `${(i * -0.4) / orbitCount}s`,
              }}
            />
          </div>
        ))}

        {/* Bolinha principal com rastro */}
        <div className="main-ball-wrapper">
          <div className="main-ball" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="trail-dot"
              style={{
                animationDelay: `${-0.08 * (i + 1)}s`,
                opacity: 1 - i * 0.1,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        .orbit-center {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
        }

        .nucleus {
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          background: radial-gradient(circle at 30% 30%, #a5f3fc, #06b6dismissed);
          background: radial-gradient(circle at 30% 30%, #a5f3fc, #0891b2);
          box-shadow: 0 0 60px 20px rgba(6, 182, 212, 0.45);
          transform: translate(-50%, -50%);
          animation: pulse 2.4s ease-in-out infinite;
        }

        .ring {
          position: absolute;
          border-radius: 9999px;
          border: 1px solid rgba(34, 211, 238, 0.25);
          transform: translate(-50%, -50%);
        }

        .ring-1 {
          width: 220px;
          height: 220px;
          animation: spin 10s linear infinite;
        }

        .ring-2 {
          width: 340px;
          height: 340px;
          border-color: rgba(167, 139, 250, 0.2);
          animation: spin 16s linear infinite reverse;
        }

        .orbiter {
          position: absolute;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          transform-origin: 0 0;
          animation: orbit 8s linear infinite;
        }

        .orbiter-ball {
          position: absolute;
          top: -110px;
          left: -6px;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: #22d3ee;
          box-shadow: 0 0 16px #22d3ee;
          animation: orbiter-pulse 1.6s ease-in-out infinite alternate;
        }

        .main-ball-wrapper {
          position: absolute;
          width: 0;
          height: 0;
          animation: lissajous 10s ease-in-out infinite;
        }

        .main-ball {
          position: absolute;
          width: 32px;
          height: 32px;
          border-radius: 9999px;
          background: radial-gradient(circle at 30% 30%, #f0abfc, #c026d3);
          box-shadow: 0 0 40px 12px rgba(192, 38, 211, 0.55);
          transform: translate(-50%, -50%);
          animation: ball-scale 1.8s ease-in-out infinite alternate;
        }

        .trail-dot {
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: rgba(240, 171, 252, 0.55);
          transform: translate(-50%, -50%);
          animation: lissajous 10s ease-in-out infinite;
          filter: blur(2px);
        }

        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
          50% { transform: translate(-50%, -50%) scale(1.35); opacity: 1; }
        }

        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes orbiter-pulse {
          from { transform: scale(0.7); opacity: 0.6; }
          to { transform: scale(1.2); opacity: 1; }
        }

        @keyframes lissajous {
          0% { transform: translate(-50%, -50%) translate(0, 0); }
          20% { transform: translate(-50%, -50%) translate(160px, -90px); }
          40% { transform: translate(-50%, -50%) translate(0, -180px); }
          60% { transform: translate(-50%, -50%) translate(-160px, -90px); }
          80% { transform: translate(-50%, -50%) translate(0, 90px); }
          100% { transform: translate(-50%, -50%) translate(0, 0); }
        }

        @keyframes ball-scale {
          from { transform: translate(-50%, -50%) scale(0.85); }
          to { transform: translate(-50%, -50%) scale(1.15); }
        }
      `}</style>
    </div>
  );
}
