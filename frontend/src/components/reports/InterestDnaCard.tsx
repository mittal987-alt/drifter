import { useState, useEffect, useRef } from "react";
import {
  Download,
  Share2,
  Sparkles,
  Dna,
  RefreshCw,
  Check,
  Zap,
  ShieldCheck,
  X,
} from "lucide-react";
import { getInterestDna, type InterestDnaData } from "@/services/analytics";

interface InterestDnaCardProps {
  source?: string;
}

// 4 Custom Color Themes
interface CardTheme {
  id: string;
  name: string;
  accent: string;
  secondary: string;
  cardBg: string;
  glow: string;
}

const THEMES: CardTheme[] = [
  {
    id: "amber",
    name: "Cyber Amber",
    accent: "#f2b56b",
    secondary: "#75d6c2",
    cardBg: "#09090c",
    glow: "rgba(242, 181, 107, 0.18)",
  },
  {
    id: "violet",
    name: "Cosmic Violet",
    accent: "#c084fc",
    secondary: "#38bdf8",
    cardBg: "#0c0a14",
    glow: "rgba(192, 132, 252, 0.2)",
  },
  {
    id: "emerald",
    name: "Matrix Emerald",
    accent: "#34d399",
    secondary: "#22d3ee",
    cardBg: "#070f0b",
    glow: "rgba(52, 211, 153, 0.2)",
  },
  {
    id: "titanium",
    name: "Titanium Slate",
    accent: "#f8fafc",
    secondary: "#94a3b8",
    cardBg: "#0a0c10",
    glow: "rgba(255, 255, 255, 0.12)",
  },
];

export default function InterestDnaCard({ source }: InterestDnaCardProps) {
  const [data, setData] = useState<InterestDnaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>(THEMES[0]);
  const [showTraitModal, setShowTraitModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDna();
  }, [source]);

  async function loadDna() {
    setLoading(true);
    try {
      const res = await getInterestDna(source);
      setData(res);
    } catch (err) {
      console.error("Failed to load interest DNA", err);
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadPng() {
    if (!data) return;
    setExporting(true);

    try {
      // Create high-resolution canvas to render the card
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = 860;
      const height = 1120;
      canvas.width = width;
      canvas.height = height;

      // Draw dark aesthetic background
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, selectedTheme.cardBg);
      bgGrad.addColorStop(0.5, "#101015");
      bgGrad.addColorStop(1, "#050507");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw subtle glowing accent orbs
      const radGrad = ctx.createRadialGradient(width * 0.8, 180, 10, width * 0.8, 180, 450);
      radGrad.addColorStop(0, selectedTheme.glow);
      radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, width, height);

      const radGrad2 = ctx.createRadialGradient(160, height * 0.75, 10, 160, height * 0.75, 450);
      radGrad2.addColorStop(0, selectedTheme.glow);
      radGrad2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = radGrad2;
      ctx.fillRect(0, 0, width, height);

      // Card outer rounded border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 2;
      ctx.strokeRect(35, 35, width - 70, height - 70);

      // Top branding
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("DRIFTER // ATTENTION ARCHETYPE", 65, 85);

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 13px monospace";
      ctx.fillText(data.dna_id, width - 210, 85);

      // Archetype Title
      ctx.fillStyle = selectedTheme.accent;
      ctx.font = "bold 40px sans-serif";
      ctx.fillText(data.archetype, 65, 155);

      // Subtitle
      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.font = "16px sans-serif";
      ctx.fillText(data.subtitle, 65, 190);

      // Horizontal separator
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.moveTo(65, 215);
      ctx.lineTo(width - 65, 215);
      ctx.stroke();

      // ==========================================
      // DRAW RADAR CHART ON CANVAS
      // ==========================================
      const radarCenterX = width / 2;
      const radarCenterY = 370;
      const radarRadius = 110;

      // Draw concentric rings (25%, 50%, 75%, 100%)
      [0.25, 0.5, 0.75, 1.0].forEach((rPct) => {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const r = radarRadius * rPct;
        ctx.moveTo(radarCenterX, radarCenterY - r);
        ctx.lineTo(radarCenterX + r, radarCenterY);
        ctx.lineTo(radarCenterX, radarCenterY + r);
        ctx.lineTo(radarCenterX - r, radarCenterY);
        ctx.closePath();
        ctx.stroke();
      });

      // Draw cross axis lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.moveTo(radarCenterX, radarCenterY - radarRadius - 10);
      ctx.lineTo(radarCenterX, radarCenterY + radarRadius + 10);
      ctx.moveTo(radarCenterX - radarRadius - 10, radarCenterY);
      ctx.lineTo(radarCenterX + radarRadius + 10, radarCenterY);
      ctx.stroke();

      // Calculate 4 points
      const m = data.metrics;
      const pTop = radarCenterY - (m.curiosity_entropy / 100) * radarRadius;
      const pRight = radarCenterX + (m.drift_velocity / 100) * radarRadius;
      const pBottom = radarCenterY + (m.deep_dive_index / 100) * radarRadius;
      const pLeft = radarCenterX - (m.nocturnal_quotient / 100) * radarRadius;

      // Fill radar polygon
      ctx.fillStyle = selectedTheme.glow;
      ctx.beginPath();
      ctx.moveTo(radarCenterX, pTop);
      ctx.lineTo(pRight, radarCenterY);
      ctx.lineTo(radarCenterX, pBottom);
      ctx.lineTo(pLeft, radarCenterY);
      ctx.closePath();
      ctx.fill();

      // Stroke radar polygon
      ctx.strokeStyle = selectedTheme.accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Axis labels on Canvas
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = selectedTheme.secondary;
      ctx.fillText(`ENTROPY (${m.curiosity_entropy}%)`, radarCenterX - 45, radarCenterY - radarRadius - 18);
      ctx.fillText(`VELOCITY (${m.drift_velocity}%)`, radarCenterX + radarRadius + 15, radarCenterY + 4);
      ctx.fillText(`DEEP DIVE (${m.deep_dive_index}%)`, radarCenterX - 45, radarCenterY + radarRadius + 24);
      ctx.fillText(`NOCTURNAL (${m.nocturnal_quotient}%)`, radarCenterX - radarRadius - 130, radarCenterY + 4);

      // ==========================================
      // DNA METRIC BARS
      // ==========================================
      const metrics = [
        { label: "CURIOSITY ENTROPY", val: m.curiosity_entropy, col: selectedTheme.secondary },
        { label: "DRIFT VELOCITY", val: m.drift_velocity, col: selectedTheme.accent },
        { label: "DEEP DIVE INDEX", val: m.deep_dive_index, col: "#a7b8ff" },
        { label: "NOCTURNAL QUOTIENT", val: m.nocturnal_quotient, col: "#f472b6" },
      ];

      let startY = 560;
      metrics.forEach((item) => {
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "bold 13px monospace";
        ctx.fillText(item.label, 65, startY);

        ctx.fillStyle = item.col;
        ctx.font = "bold 16px monospace";
        ctx.fillText(`${item.val} / 100`, width - 145, startY);

        // Bar track
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(65, startY + 12, width - 130, 8);

        // Bar fill
        ctx.fillStyle = item.col;
        ctx.fillRect(65, startY + 12, (width - 130) * (item.val / 100), 8);

        startY += 75;
      });

      // Markers section
      startY += 30;
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 12px monospace";
      ctx.fillText("PRIMARY INTEREST MARKERS", 65, startY);

      let markerX = 65;
      data.primary_markers.forEach((marker) => {
        const tagText = `#${marker}`;
        ctx.font = "bold 16px sans-serif";
        const tagWidth = ctx.measureText(tagText).width + 30;

        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(markerX, startY + 16, tagWidth, 38);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.strokeRect(markerX, startY + 16, tagWidth, 38);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(tagText, markerX + 15, startY + 41);

        markerX += tagWidth + 15;
      });

      // Bottom footer bar
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "12px monospace";
      ctx.fillText(`VERIFIED DRIFT RECORD // ${data.generated_at}`, 65, height - 70);
      ctx.fillText(`${data.total_events} RECORDED TRACES`, width - 260, height - 70);

      // Trigger download
      const link = document.createElement("a");
      link.download = `${data.dna_id}_${selectedTheme.id}_dna.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Canvas export failed", e);
    } finally {
      setExporting(false);
    }
  }

  function handleCopySummary() {
    if (!data) return;
    const summaryText = `🧬 My Drifter Interest DNA: ${data.archetype} (${data.dna_id})\nEntropy: ${data.metrics.curiosity_entropy}% | Drift Velocity: ${data.metrics.drift_velocity}% | Deep Dive: ${data.metrics.deep_dive_index}% | Nocturnal: ${data.metrics.nocturnal_quotient}%\nTop Markers: ${data.primary_markers.join(", ")}`;
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyBadge() {
    if (!data) return;
    const badgeText = `[![Drifter DNA](https://img.shields.io/badge/Drifter_DNA-${encodeURIComponent(data.archetype)}-amber?style=for-the-badge&logo=dna)](http://localhost:5173)`;
    navigator.clipboard.writeText(badgeText);
    setCopiedBadge(true);
    setTimeout(() => setCopiedBadge(false), 2000);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER */}
      <header className="workspace-intro">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="workspace-eyebrow">Identity Signal / Personal DNA</p>
          </div>
          <h1>Interest DNA Card</h1>
          <p>
            Your unique digital curiosity fingerprint, sequenced across entropy breadth, drift velocity, focus depth, and nocturnal cadence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDna}
            disabled={loading}
            className="workspace-action"
            title="Recalculate DNA"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh DNA
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 rounded-2xl border border-white/10 bg-[#0b0b0e] space-y-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
            <Dna size={20} className="text-amber-400 absolute inset-0 m-auto" />
          </div>
          <p className="text-xs text-white/50 font-mono uppercase tracking-wider">
            Sequencing interest genome...
          </p>
        </div>
      ) : data ? (
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* THE SHAREABLE DNA CARD */}
          <div
            ref={cardRef}
            className="relative w-full max-w-md rounded-3xl border border-white/15 p-6 sm:p-7 shadow-2xl overflow-hidden space-y-6 select-none group transition-all duration-500"
            style={{ backgroundColor: selectedTheme.cardBg }}
          >
            {/* AMBIENT GLOW */}
            <div
              className="absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl pointer-events-none transition-all duration-700"
              style={{ backgroundColor: selectedTheme.glow }}
            />
            <div
              className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full blur-3xl pointer-events-none transition-all duration-700"
              style={{ backgroundColor: selectedTheme.glow }}
            />

            {/* CARD TOP BAR */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2 text-white font-semibold text-xs tracking-wider">
                <Dna size={16} style={{ color: selectedTheme.accent }} />
                <span>DRIFTER IDENTITY</span>
              </div>
              <span className="text-[10px] font-mono text-white/40 tracking-widest uppercase">
                {data.dna_id}
              </span>
            </div>

            {/* ARCHETYPE BLOCK */}
            <div className="space-y-1.5">
              <span
                className="text-[10px] uppercase font-mono tracking-widest font-semibold"
                style={{ color: selectedTheme.accent }}
              >
                Attention Persona
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">{data.archetype}</h2>
              <p className="text-xs text-white/60 leading-relaxed">{data.subtitle}</p>
            </div>

            {/* SVG RADAR / SPIDER CHART */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">
                4-Axis Attention Geometry
              </span>
              <RadarChartSVG metrics={data.metrics} theme={selectedTheme} />
            </div>

            {/* 4 DNA METRIC BARS */}
            <div className="space-y-3.5 pt-1">
              <MetricRow
                label="Curiosity Entropy"
                value={data.metrics.curiosity_entropy}
                color={selectedTheme.secondary}
                desc="Breadth vs specialized focus"
              />
              <MetricRow
                label="Drift Velocity"
                value={data.metrics.drift_velocity}
                color={selectedTheme.accent}
                desc="Frequency of interest shifts"
              />
              <MetricRow
                label="Deep Dive Index"
                value={data.metrics.deep_dive_index}
                color="#a7b8ff"
                desc="Immersion in continuous rabbit holes"
              />
              <MetricRow
                label="Nocturnal Quotient"
                value={data.metrics.nocturnal_quotient}
                color="#f472b6"
                desc="Late-night exploration ratio"
              />
            </div>

            {/* MARKERS */}
            <div className="pt-2 border-t border-white/[0.08]">
              <span className="text-[10px] uppercase tracking-wider text-white/30 block mb-2 font-mono">
                Primary Markers
              </span>
              <div className="flex flex-wrap gap-1.5">
                {data.primary_markers.map((marker) => (
                  <span
                    key={marker}
                    className="rounded-lg bg-white/[0.05] border border-white/10 px-2.5 py-1 text-xs text-white/85 font-medium"
                  >
                    #{marker}
                  </span>
                ))}
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-white/30 border-t border-white/[0.06]">
              <span>VERIFIED // {data.generated_at}</span>
              <span>{data.total_events} TRACES ANALYZED</span>
            </div>
          </div>

          {/* ACTIONS & CUSTOMIZATION SIDEBAR */}
          <div className="flex-1 space-y-4 max-w-lg">
            {/* THEME PICKER */}
            <div className="p-6 rounded-2xl bg-[#0c0c10] border border-white/[0.08] space-y-3">
              <h3 className="text-xs font-semibold text-white tracking-wider uppercase font-mono flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                Customize Card Theme
              </h3>
              <p className="text-xs text-white/50">
                Choose a visual palette before exporting your high-resolution card.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium transition ${
                      selectedTheme.id === theme.id
                        ? "border-amber-400 bg-white/[0.08] text-white shadow-sm"
                        : "border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: theme.accent }}
                    />
                    <span>{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* EXPORT & SHARE BUTTONS */}
            <div className="p-6 rounded-2xl bg-[#0c0c10] border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <Share2 size={16} className="text-amber-400" />
                Export & Distribute
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Download your Interest DNA card as a high-resolution PNG image with integrated radar geometry, or copy sharing snippets.
              </p>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  onClick={handleDownloadPng}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition shadow-lg shadow-amber-500/10"
                >
                  <Download size={14} />
                  {exporting ? "Generating High-Res PNG..." : "Download Card (PNG)"}
                </button>

                <button
                  onClick={handleCopySummary}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white font-medium text-xs transition"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                  {copied ? "Copied!" : "Copy Summary"}
                </button>

                <button
                  onClick={handleCopyBadge}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white font-medium text-xs transition"
                  title="Copy GitHub Markdown Badge"
                >
                  {copiedBadge ? <Check size={14} className="text-emerald-400" /> : <ShieldCheck size={14} />}
                  {copiedBadge ? "Badge Copied!" : "Markdown Badge"}
                </button>
              </div>

              {/* TRAIT INSPECTOR BUTTON */}
              {data.traits && (
                <div className="pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={() => setShowTraitModal(true)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-xs text-white/80 transition group"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Zap size={14} className="text-amber-400" />
                      Inspect Persona Traits & Energy Windows
                    </span>
                    <span className="text-[10px] font-mono text-white/40 group-hover:text-amber-300">
                      View Details →
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* TRAIT MODAL / CARD */}
            {showTraitModal && data.traits && (
              <div className="p-6 rounded-2xl bg-[#0f0e15] border border-amber-500/30 space-y-4 animate-in fade-in duration-200 relative">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap size={15} className="text-amber-400" />
                    {data.archetype} Traits
                  </h4>
                  <button
                    onClick={() => setShowTraitModal(false)}
                    className="text-white/40 hover:text-white"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">
                      Cognitive Superpower
                    </span>
                    <p className="text-white/80">{data.traits.superpower}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider block font-bold">
                      Attention Vulnerability
                    </span>
                    <p className="text-white/80">{data.traits.vulnerability}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                      <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block font-bold">
                        Peak Flow Hours
                      </span>
                      <p className="text-white/80 font-mono">{data.traits.peak_hours}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">
                        Partner Archetype
                      </span>
                      <p className="text-white/80">{data.traits.complementary}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// 4-AXIS SVG RADAR CHART
function RadarChartSVG({
  metrics,
  theme,
}: {
  metrics: {
    curiosity_entropy: number;
    drift_velocity: number;
    deep_dive_index: number;
    nocturnal_quotient: number;
  };
  theme: CardTheme;
}) {
  const size = 200;
  const center = size / 2;
  const radius = 68;

  // Points on 4 axes:
  // Top: Entropy (Y negative)
  // Right: Velocity (X positive)
  // Bottom: Deep Dive (Y positive)
  // Left: Nocturnal (X negative)
  const topY = center - (metrics.curiosity_entropy / 100) * radius;
  const rightX = center + (metrics.drift_velocity / 100) * radius;
  const bottomY = center + (metrics.deep_dive_index / 100) * radius;
  const leftX = center - (metrics.nocturnal_quotient / 100) * radius;

  const polygonPoints = `${center},${topY} ${rightX},${center} ${center},${bottomY} ${leftX},${center}`;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="overflow-visible">
        {/* Concentric diamond grid rings */}
        {[0.25, 0.5, 0.75, 1.0].map((pct) => {
          const r = radius * pct;
          const points = `${center},${center - r} ${center + r},${center} ${center},${center + r} ${center - r},${center}`;
          return (
            <polygon
              key={pct}
              points={points}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis Crosshairs */}
        <line
          x1={center}
          y1={center - radius - 8}
          x2={center}
          y2={center + radius + 8}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        <line
          x1={center - radius - 8}
          y1={center}
          x2={center + radius + 8}
          y2={center}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />

        {/* Filled Data Polygon */}
        <polygon
          points={polygonPoints}
          fill={theme.glow}
          stroke={theme.accent}
          strokeWidth="2"
          className="transition-all duration-700"
        />

        {/* Vertices */}
        <circle cx={center} cy={topY} r="3" fill={theme.secondary} />
        <circle cx={rightX} cy={center} r="3" fill={theme.accent} />
        <circle cx={center} cy={bottomY} r="3" fill="#a7b8ff" />
        <circle cx={leftX} cy={center} r="3" fill="#f472b6" />

        {/* Metric Labels */}
        <text
          x={center}
          y={center - radius - 14}
          textAnchor="middle"
          fill={theme.secondary}
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
        >
          ENTROPY {metrics.curiosity_entropy}%
        </text>
        <text
          x={center + radius + 8}
          y={center + 3}
          textAnchor="start"
          fill={theme.accent}
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
        >
          VELOCITY {metrics.drift_velocity}%
        </text>
        <text
          x={center}
          y={center + radius + 18}
          textAnchor="middle"
          fill="#a7b8ff"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
        >
          DEEP DIVE {metrics.deep_dive_index}%
        </text>
        <text
          x={center - radius - 8}
          y={center + 3}
          textAnchor="end"
          fill="#f472b6"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
        >
          NOCTURNAL {metrics.nocturnal_quotient}%
        </text>
      </svg>
    </div>
  );
}

function MetricRow({
  label,
  value,
  color,
  desc,
}: {
  label: string;
  value: number;
  color: string;
  desc: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/70 font-medium">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-[10px] text-white/30">{desc}</p>
    </div>
  );
}
