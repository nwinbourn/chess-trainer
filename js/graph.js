import { getLast5Months } from './data.js';
import { fetchCurrentBlitzRating, fetchMonthAvgRating } from './chess-api.js';

// ── Internal SVG renderer (pure, synchronous) ────────────────────────────────

function drawGraph(entries) {
  const svg = document.getElementById('rating-graph');
  const container = document.getElementById('graph-container');

  if (entries.length < 2) {
    svg.innerHTML = `<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5b8fa8" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#5b8fa8" stop-opacity="0.0"/>
    </linearGradient></defs>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
      font-family="JetBrains Mono,monospace" font-size="10" fill="#3a5570">
      ${entries.length === 0 ? 'No blitz games found in the last 5 months' : 'Need at least 2 months of data to draw graph'}
    </text>`;
    return;
  }

  const W = container.clientWidth || 700;
  const H = 96;
  const pL = 44, pR = 12, pT = 8, pB = 22;
  const pW = W - pL - pR, pH = H - pT - pB;

  const rvals = entries.map(e => e.rating);
  const minR = Math.min(...rvals) - 25;
  const maxR = Math.max(...rvals) + 25;

  const pts = entries.map((e, i) => ({
    x: pL + (i / (entries.length - 1)) * pW,
    y: pT + (1 - (e.rating - minR) / (maxR - minR)) * pH,
    rating: e.rating,
    label: e.label,
  }));

  function curvePath(points) {
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  const linePath = curvePath(pts);
  const f = pts[0], l = pts[pts.length - 1];
  const areaPath = `${linePath} L ${l.x.toFixed(1)} ${(pT + pH).toFixed(1)} L ${f.x.toFixed(1)} ${(pT + pH).toFixed(1)} Z`;

  let yLabels = '', gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(minR + (maxR - minR) * i / 4);
    const y = pT + (1 - (val - minR) / (maxR - minR)) * pH;
    gridLines += `<line x1="${pL}" y1="${y.toFixed(1)}" x2="${(pL + pW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#253545" stroke-width="1"/>`;
    yLabels += `<text x="${pL - 5}" y="${y.toFixed(0)}" text-anchor="end" dominant-baseline="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#3a5570">${val}</text>`;
  }

  let xLabels = '';
  pts.forEach((p, i) => {
    const anchor = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle';
    xLabels += `<text x="${p.x.toFixed(0)}" y="${H - 3}" text-anchor="${anchor}" dominant-baseline="auto" font-family="JetBrains Mono,monospace" font-size="9" fill="#3a5570">${entries[i].label}</text>`;
  });

  const dots = pts.map((p, i) => {
    const anchor = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle';
    const labelY = p.y - 8;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#7aafc8"/>
    <text x="${p.x.toFixed(0)}" y="${labelY.toFixed(0)}" text-anchor="${anchor}" font-family="JetBrains Mono,monospace" font-size="8" fill="#7aafc8">${p.rating}</text>`;
  }).join('');

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5b8fa8" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#5b8fa8" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaPath}" fill="url(#areaGrad)"/>
    <path d="${linePath}" fill="none" stroke="#5b8fa8" stroke-width="1.5" stroke-linejoin="round"/>
    ${dots}
    ${yLabels}
    ${xLabels}`;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
}

// ── Public: fetch + render ────────────────────────────────────────────────────

export async function renderGraph() {
  const rDisplay = document.getElementById('graph-current-rating');
  const rSub = document.getElementById('graph-current-sub');

  // Show loading placeholder immediately
  rDisplay.textContent = '…';
  rSub.textContent = 'Fetching from Chess.com';

  const months = getLast5Months();

  try {
    // Fire current-rating and all monthly fetches in parallel
    const [currentRating, monthlyResults] = await Promise.all([
      fetchCurrentBlitzRating(),
      Promise.all(
        months.map(m => {
          const [y, mo] = m.key.split('-').map(Number);
          return fetchMonthAvgRating(y, mo).then(avg => ({ label: m.label, rating: avg }));
        })
      ),
    ]);

    // Update header display
    if (currentRating !== null) {
      rDisplay.textContent = currentRating;
      rSub.textContent = 'Blitz · Live from Chess.com';
    } else {
      rDisplay.textContent = '—';
      rSub.textContent = 'No blitz rating on Chess.com';
    }

    // Draw graph with months that have data
    const entries = monthlyResults.filter(m => m.rating !== null);
    drawGraph(entries);

  } catch (err) {
    console.error('Chess.com API error:', err);
    rDisplay.textContent = '—';
    rSub.textContent = 'Could not reach Chess.com';

    const svg = document.getElementById('rating-graph');
    svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
      font-family="JetBrains Mono,monospace" font-size="10" fill="#3a5570">
      Unable to reach Chess.com — check your connection
    </text>`;
  }
}
