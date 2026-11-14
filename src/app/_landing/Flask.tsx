// A bubbling flask, CSS only (the 3D scene lives on the Play page).
export function Flask() {
  return (
    <svg viewBox="0 0 120 140" width="96" height="112" aria-hidden className="drop-shadow-[0_0_24px_rgb(232_121_249/0.45)]">
      <defs>
        <linearGradient id="liq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E879F9" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <clipPath id="body">
          <path d="M46 14h28v34l30 62a14 14 0 0 1-12.6 20H28.6A14 14 0 0 1 16 110l30-62z" />
        </clipPath>
      </defs>
      <g clipPath="url(#body)">
        <rect x="0" y="70" width="120" height="70" fill="url(#liq)" opacity="0.9" />
        {[30, 52, 70, 86].map((x, i) => (
          <circle key={x} cx={x} cy="128" r={3 + (i % 2) * 2} fill="#E5E7EB" opacity="0.8">
            <animate attributeName="cy" values="128;72" dur={`${1.6 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
            <animate attributeName="opacity" values="0.8;0" dur={`${1.6 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>
        ))}
      </g>
      <path d="M46 14h28v34l30 62a14 14 0 0 1-12.6 20H28.6A14 14 0 0 1 16 110l30-62z" fill="none" stroke="#E5E7EB" strokeWidth="3" />
      <rect x="40" y="8" width="40" height="8" rx="3" fill="#E5E7EB" />
    </svg>
  );
}
