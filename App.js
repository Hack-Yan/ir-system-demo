import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Filter,
  Tag,
  FileText,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  X,
  LayoutGrid,
  Flame,
  Copy,
  List,
  Activity,
} from "lucide-react";

// Demo data
const categories = [
  { id: "comp.graphics", name: "Computer Graphics", count: 584 },
  { id: "sci.space", name: "Space Science", count: 593 },
  { id: "rec.autos", name: "Automobiles", count: 594 },
  { id: "sci.med", name: "Medicine", count: 594 },
  { id: "comp.sys.mac", name: "Mac Hardware", count: 578 },
  { id: "talk.politics.guns", name: "Gun Politics", count: 546 },
];

const sampleDocs = [
  {
    id: 1,
    title: "Neural Rendering: The Future of GPU Architecture",
    category: "comp.graphics",
    score: 0.99,
    snippet:
      "The integration of neural networks into the graphics pipeline is redefining real-time rendering. We analyze how AI-driven ray tracing outperforms traditional methods...",
  },
  {
    id: 2,
    title: "James Webb Telescope: Deep Space Imaging",
    category: "sci.space",
    score: 0.95,
    snippet:
      "New data from the JWST reveals unprecedented details of the Carina Nebula, showcasing the power of mid-infrared instrumentation in vacuum environments...",
  },
  {
    id: 3,
    title: "Autonomous Driving: Sensor Fusion Algorithms",
    category: "rec.autos",
    score: 0.88,
    snippet:
      "Combining LiDAR, Radar, and Computer Vision is essential for Level 5 autonomy. This paper discusses the late-fusion approach in adverse weather conditions...",
  },
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/** Escape regex helper */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Count occurrences of query tokens in text */
function countHits(text, q) {
  const query = (q || "").trim();
  if (!query) return 0;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  const re = new RegExp(`(${tokens.map(escapeRegex).join("|")})`, "ig");
  const matches = String(text).match(re);
  return matches ? matches.length : 0;
}

/** Highlight query tokens inside text (returns JSX) */
function highlight(text, q) {
  const query = (q || "").trim();
  if (!query) return text;

  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;

  const re = new RegExp(`(${tokens.map(escapeRegex).join("|")})`, "ig");
  const parts = String(text).split(re);

  return parts.map((chunk, i) =>
    re.test(chunk) ? (
      <mark
        key={i}
        className="rounded-md bg-cyan-300/20 px-1 py-0.5 text-cyan-100 ring-1 ring-cyan-200/20"
      >
        {chunk}
      </mark>
    ) : (
      <React.Fragment key={i}>{chunk}</React.Fragment>
    )
  );
}

function ScorePill({ value }) {
  const pct = Math.max(0, Math.min(1, value));
  const label = Math.round(pct * 100);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      <span>Score {label}%</span>
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-3">
        <div className="h-8 w-20 rounded-full bg-white/10" />
        <div className="h-8 w-24 rounded-full bg-white/10" />
      </div>
      <div className="mt-5 h-7 w-2/3 rounded-xl bg-white/10" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-full rounded-lg bg-white/10" />
        <div className="h-4 w-11/12 rounded-lg bg-white/10" />
        <div className="h-4 w-4/5 rounded-lg bg-white/10" />
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
        <div className="h-10 w-40 rounded-2xl bg-white/10" />
        <div className="h-10 w-28 rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

/** Build a demo “paper-like” structure from snippet */
function buildSections(doc) {
  const base = (doc?.snippet || "").replace(/\.\.\.$/, "").trim();
  const sentences = base
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const s1 = sentences.slice(0, 2).join(" ");
  const s2 = sentences.slice(2).join(" ");

  return [
    {
      id: "abstract",
      title: "Abstract",
      body:
        s1 ||
        "This document summarizes key findings and provides a structured breakdown of the main ideas, methods, and implications.",
    },
    {
      id: "key-ideas",
      title: "Key Ideas",
      body:
        s2 ||
        "We outline the central concepts, the motivation behind the approach, and how the proposed technique compares to conventional baselines.",
    },
    {
      id: "method",
      title: "Method / Approach",
      body: "We describe the pipeline, the key components, and the assumptions. In a real system, this section would include diagrams, equations, and ablation-style reasoning.",
    },
    {
      id: "evidence",
      title: "Evidence & Results",
      body: "We summarize results, highlight notable metrics, and point out where the approach shines or fails. A production version can show plots, tables, and citations.",
    },
    {
      id: "takeaways",
      title: "Takeaways",
      body: "Practical implications, recommended next steps, and what to verify if you want to reproduce or extend the work.",
    },
  ];
}

/** Clamp 0..1 */
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export default function ProfessionalSearchSystem() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryClassification, setQueryClassification] = useState(null);
  const [sort, setSort] = useState("relevance");

  // Reader Drawer
  const [activeDoc, setActiveDoc] = useState(null);
  const [activeSections, setActiveSections] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);

  const sectionRefs = useRef({});
  const contentScrollRef = useRef(null);
  const inputRef = useRef(null);

  // Toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1400);
  };

  // Progress within drawer content
  const [readProgress, setReadProgress] = useState(0);

  const closeDrawer = () => {
    setDrawerOpen(false);
    window.setTimeout(() => {
      setActiveDoc(null);
      setActiveSections([]);
      setActiveSectionId(null);
      setReadProgress(0);
    }, 180);
  };

  const openDoc = (doc) => {
    const secs = buildSections(doc);
    setActiveDoc(doc);
    setActiveSections(secs);
    setActiveSectionId(secs[0]?.id || null);
    window.setTimeout(() => setDrawerOpen(true), 10);

    // reset refs + progress
    sectionRefs.current = {};
    setReadProgress(0);

    // Scroll to top next tick
    window.setTimeout(() => {
      if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
    }, 30);
  };

  const performSearch = () => {
    if (!query.trim()) return;
    setIsSearching(true);

    window.setTimeout(() => {
      const lower = query.toLowerCase();
      let predicted = null;
      if (lower.includes("gpu") || lower.includes("render"))
        predicted = { id: "comp.graphics", conf: 0.98 };
      else if (lower.includes("space") || lower.includes("star"))
        predicted = { id: "sci.space", conf: 0.96 };

      setQueryClassification(predicted);
      setResults(sampleDocs);
      setIsSearching(false);
    }, 650);
  };

  // Keyboard: / focus search, ESC close drawer
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (activeDoc) closeDrawer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = results;

    if (selectedCategories.length > 0) {
      list = list.filter((d) => selectedCategories.includes(d.category));
    }

    if (q) {
      list = list.filter((d) =>
        `${d.title} ${d.snippet} ${d.category}`.toLowerCase().includes(q)
      );
    }

    if (sort === "score") {
      list = [...list].sort((a, b) => b.score - a.score);
    }

    return list;
  }, [results, selectedCategories, query, sort]);

  const activeCategoryNames = useMemo(
    () =>
      categories
        .filter((c) => selectedCategories.includes(c.id))
        .map((c) => c.name),
    [selectedCategories]
  );

  // Hit stats (for drawer)
  const hitStats = useMemo(() => {
    if (!activeDoc) return { total: 0, title: 0, snippet: 0, sections: {} };

    const titleHits = countHits(activeDoc.title, query);
    const snippetHits = countHits(activeDoc.snippet, query);

    const sectionHits = {};
    let sumSections = 0;
    for (const s of activeSections) {
      const h = countHits(s.title, query) + countHits(s.body, query);
      sectionHits[s.id] = h;
      sumSections += h;
    }

    return {
      total: titleHits + snippetHits + sumSections,
      title: titleHits,
      snippet: snippetHits,
      sections: sectionHits,
    };
  }, [activeDoc, activeSections, query]);

  // Evidence strength per section (0..1)
  const evidenceStrength = useMemo(() => {
    // use hit density: hits / (words/10) as a cheap heuristic
    const map = {};
    for (const s of activeSections) {
      const text = `${s.title} ${s.body}`;
      const words =
        String(text).trim().split(/\s+/).filter(Boolean).length || 1;
      const hits = hitStats.sections?.[s.id] ?? 0;
      const density = hits / (words / 10); // hits per ~10 words
      map[s.id] = clamp01(density / 1.8); // normalize to look nice
    }
    return map;
  }, [activeSections, hitStats]);

  const copyCitation = async () => {
    if (!activeDoc) return;
    const catName =
      categories.find((c) => c.id === activeDoc.category)?.name ||
      activeDoc.category;

    const text =
      `Title: ${activeDoc.title}\n` +
      `Category: ${catName} (${activeDoc.category})\n` +
      `Score: ${(activeDoc.score * 100).toFixed(0)}%\n` +
      `Query: ${query.trim() || "(none)"}\n` +
      `Snippet: ${activeDoc.snippet}\n`;

    try {
      await navigator.clipboard.writeText(text);
      showToast("已复制引用");
    } catch {
      showToast("复制失败（浏览器限制）");
    }
  };

  const scrollToSection = (id) => {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // TOC sync + progress
  useEffect(() => {
    if (!activeDoc || !drawerOpen) return;

    const scroller = contentScrollRef.current;
    if (!scroller) return;

    let raf = 0;

    const compute = () => {
      // Progress
      const max = scroller.scrollHeight - scroller.clientHeight;
      const p = max <= 0 ? 0 : scroller.scrollTop / max;
      setReadProgress(clamp01(p));

      // Active section (closest to top)
      const entries = activeSections
        .map((s) => ({ id: s.id, el: sectionRefs.current[s.id] }))
        .filter((x) => x.el);

      if (entries.length === 0) return;

      // find the section whose top is closest but <= containerTop+offset
      const containerTop = scroller.getBoundingClientRect().top;
      const offset = 120; // header breathing room
      let bestId = entries[0].id;
      let bestDist = Number.POSITIVE_INFINITY;

      for (const { id, el } of entries) {
        const top = el.getBoundingClientRect().top - containerTop;
        const dist = Math.abs(top - offset);
        if (top <= offset + 40 && dist < bestDist) {
          bestDist = dist;
          bestId = id;
        }
      }

      setActiveSectionId(bestId);
    };

    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    // initial compute
    window.setTimeout(compute, 60);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [activeDoc, drawerOpen, activeSections]);

  return (
    <div className="min-h-screen bg-[#070A12] text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600/30 via-violet-600/25 to-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[-180px] h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-fuchsia-500/20 via-indigo-500/10 to-sky-500/10 blur-3xl" />
        <div className="absolute right-[-260px] top-[35%] h-[560px] w-[560px] rounded-full bg-gradient-to-tr from-cyan-500/18 via-indigo-500/12 to-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.06),transparent_45%)]" />
        <div className="absolute inset-0 opacity-[0.15] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:52px_52px]" />
      </div>

      {/* Top bar */}
      <div className="relative h-1 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />

      <main className="relative mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Header */}
        <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold tracking-widest text-white/80">
            <Sparkles className="h-4 w-4" />
            NEXT-GEN RETRIEVAL
          </div>
          <h1 className="text-balance text-4xl font-black tracking-tight sm:text-6xl">
            Insight
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-200 bg-clip-text text-transparent">
              Search
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-white/70 sm:text-base">
            阅读器级交互：命中词高亮 · 目录同步 · 证据强度 · 复制引用
          </p>
          <div className="mt-4 text-[12px] text-white/45">
            快捷键：<span className="text-white/70">/</span> 聚焦搜索，
            <span className="text-white/70">ESC</span> 关闭详情
          </div>
        </header>

        {/* Search card */}
        <section className="mx-auto mb-8 max-w-3xl sm:mb-12">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-2 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex items-center gap-2 rounded-[22px] bg-black/30 px-3 py-3 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-indigo-400/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                <Search className="h-5 w-5 text-white/70" />
              </div>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && performSearch()}
                placeholder="搜索任何技术文档…（例如：GPU / Space / Sensor Fusion）"
                className="w-full bg-transparent px-2 text-base text-white/90 placeholder:text-white/40 outline-none sm:text-lg"
              />
              <button
                onClick={performSearch}
                className="group inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-black shadow-lg shadow-white/10 transition active:scale-[0.98] hover:bg-white/90"
              >
                {isSearching ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    Searching
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Flame className="h-4 w-4" />
                    搜索
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Intent bubble */}
          {queryClassification && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-[11px] font-semibold tracking-widest text-white/50">
                QUERY INTENT
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80">
                <LayoutGrid className="h-4 w-4" />
                {categories.find((c) => c.id === queryClassification.id)?.name}
                <span className="text-white/40">
                  {(queryClassification.conf * 100).toFixed(0)}%
                </span>
              </span>
            </div>
          )}

          {/* Active chips */}
          {(activeCategoryNames.length > 0 || sort !== "relevance") && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {activeCategoryNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/80"
                >
                  <Tag className="h-3.5 w-3.5" />
                  {name}
                </span>
              ))}
              {sort !== "relevance" && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/80">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Sort: {sort}
                </span>
              )}
            </div>
          )}
        </section>

        <div className="grid grid-cols-12 gap-8">
          {/* Filters */}
          <aside className="col-span-12 lg:col-span-4">
            <div className="sticky top-6">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-xs font-black tracking-[0.22em] text-white/60">
                    <Filter className="h-4 w-4" />
                    FILTERS
                  </h3>
                  {(selectedCategories.length > 0 || sort !== "relevance") && (
                    <button
                      onClick={() => {
                        setSelectedCategories([]);
                        setSort("relevance");
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70 hover:bg-white/10"
                    >
                      <X className="h-3.5 w-3.5" />
                      清除
                    </button>
                  )}
                </div>

                <div className="mt-4 grid gap-2">
                  {categories.map((cat) => {
                    const active = selectedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() =>
                          setSelectedCategories((prev) =>
                            prev.includes(cat.id)
                              ? prev.filter((c) => c !== cat.id)
                              : [...prev, cat.id]
                          )
                        }
                        className={cn(
                          "group flex items-center justify-between rounded-2xl px-4 py-3 text-left transition",
                          active
                            ? "bg-gradient-to-r from-indigo-500/90 to-violet-500/80 text-white shadow-lg shadow-indigo-500/15"
                            : "bg-black/20 text-white/75 hover:bg-white/5 border border-white/10"
                        )}
                      >
                        <span className="font-semibold">{cat.name}</span>
                        <span
                          className={cn(
                            "rounded-xl px-2 py-0.5 text-[10px] font-bold",
                            active ? "bg-white/15" : "bg-white/5"
                          )}
                        >
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white/70">
                      Sorting
                    </div>
                    <div className="text-[11px] text-white/45">
                      仅影响当前结果
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { id: "relevance", label: "Relevance" },
                      { id: "score", label: "Score" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSort(opt.id)}
                        className={cn(
                          "rounded-full px-3 py-1 text-[12px] font-semibold transition",
                          sort === opt.id
                            ? "bg-white text-black"
                            : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4">
                  <div className="text-xs font-bold text-white/75">Tips</div>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    结果卡片打开详情后：目录同步 + 证据强度 + 命中统计 +
                    复制引用。
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* Results */}
          <section className="col-span-12 lg:col-span-8">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/80">
                  Results
                </div>
                <div className="text-[12px] text-white/45">
                  {filtered.length} item(s)
                  {selectedCategories.length > 0
                    ? " · filtered by category"
                    : ""}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[12px] text-white/50">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <FileText className="h-4 w-4" />
                  Reader Mode
                </span>
              </div>
            </div>

            <div className="space-y-5">
              {isSearching && (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              )}

              {!isSearching &&
                filtered.length > 0 &&
                filtered.map((doc) => (
                  <article
                    key={doc.id}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/[0.075]"
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                      <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/15 blur-2xl" />
                      <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
                    </div>

                    <div className="relative z-10">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/80">
                          <Tag className="h-4 w-4" />
                          {highlight(doc.category, query)}
                        </span>
                        <ScorePill value={doc.score} />
                      </div>

                      <h2 className="text-balance text-xl font-bold tracking-tight text-white/90 transition group-hover:text-white sm:text-2xl">
                        {highlight(doc.title, query)}
                      </h2>

                      <p className="mt-3 text-sm leading-relaxed text-white/60 sm:text-base">
                        {highlight(doc.snippet, query)}
                      </p>

                      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                            <FileText className="h-5 w-5 text-white/60" />
                          </div>
                          <div>
                            <div className="text-[12px] font-semibold text-white/70">
                              Document Analysis
                            </div>
                            <div className="text-[11px] text-white/45">
                              Highlight · Navigate · Evidence
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => openDoc(doc)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black shadow-lg shadow-white/10 transition hover:bg-white/90 active:scale-[0.98]"
                        >
                          阅读详情
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}

              {!isSearching && filtered.length === 0 && results.length > 0 && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-10 text-center shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
                    <LayoutGrid className="h-8 w-8 text-white/40" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white/80">
                    没有匹配结果
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
                    换个关键词，或清除筛选条件再试试。
                  </p>
                </div>
              )}

              {!isSearching && results.length === 0 && query.trim() === "" && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-12 text-center shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
                    <LayoutGrid className="h-8 w-8 text-white/40" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white/80">
                    等待检索指令…
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
                    输入关键词并按回车即可开始。打开详情会看到“阅读器增强”。
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm font-semibold text-white/80 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            {toast}
          </div>
        </div>
      )}

      {/* Reader Drawer */}
      {activeDoc && (
        <>
          {/* Overlay */}
          <div
            className={cn(
              "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
              drawerOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={closeDrawer}
          />

          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[600px]">
            <div
              className={cn(
                "relative h-full rounded-l-3xl border border-white/10 bg-[#0B1020]/92 shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-transform duration-200",
                drawerOpen ? "translate-x-0" : "translate-x-6"
              )}
              style={{ willChange: "transform" }}
            >
              {/* Top progress bar */}
              <div className="absolute left-0 top-0 h-0.5 w-full overflow-hidden rounded-tl-3xl bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-200"
                  style={{ width: `${Math.round(readProgress * 100)}%` }}
                />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/80">
                      <Tag className="h-4 w-4" />
                      {highlight(
                        categories.find((c) => c.id === activeDoc.category)
                          ?.name || activeDoc.category,
                        query
                      )}
                      <span className="text-white/40">
                        · {(activeDoc.score * 100).toFixed(0)}%
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/75">
                      <Activity className="h-4 w-4" />
                      Hits{" "}
                      <span className="text-white/90">{hitStats.total}</span>
                      <span className="text-white/35">
                        (T{hitStats.title} · S{hitStats.snippet})
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/65">
                      Progress{" "}
                      <span className="text-white/85">
                        {Math.round(readProgress * 100)}%
                      </span>
                    </span>
                  </div>

                  <h3 className="text-balance text-xl font-bold text-white/90">
                    {highlight(activeDoc.title, query)}
                  </h3>

                  <p className="mt-2 text-sm text-white/55">
                    目录随滚动自动高亮 · 段落证据强度条 · 一键复制引用/段落
                  </p>
                </div>

                <button
                  onClick={closeDrawer}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              {/* ✅关键修复：min-h-0 让 Grid 子项允许收缩，overflow-y 才会生效 */}
              <div className="grid min-h-0 h-[calc(100%-88px)] grid-cols-12 gap-4 p-4 sm:p-6">
                {/* TOC */}
                {/* ✅关键修复：aside 也要 min-h-0，里面容器 h-full + overflow 才能滚且可点击 */}
                <aside className="col-span-12 sm:col-span-4 min-h-0">
                  <div className="min-h-0 h-full overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-black tracking-[0.22em] text-white/55">
                        <List className="h-4 w-4" />
                        OUTLINE
                      </div>

                      <button
                        onClick={copyCitation}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/75 hover:bg-white/10"
                        title="复制引用"
                      >
                        <Copy className="h-4 w-4" />
                        复制
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {activeSections.map((s) => {
                        const hits = hitStats.sections?.[s.id] ?? 0;
                        const strength = evidenceStrength[s.id] ?? 0;
                        const isActive = activeSectionId === s.id;

                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => scrollToSection(s.id)}
                            className={cn(
                              "w-full rounded-2xl border px-3 py-2 text-left transition",
                              isActive
                                ? "border-white/20 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                                : "border-white/10 bg-black/20 hover:bg-white/5"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-white/80">
                                {highlight(s.title, query)}
                              </div>
                              <div className="shrink-0 text-[11px] font-bold text-white/55">
                                hits {hits}
                              </div>
                            </div>

                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-200/70 via-violet-200/70 to-indigo-200/70"
                                style={{
                                  width: `${Math.round(strength * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="mt-1 text-[11px] text-white/40">
                              Evidence {Math.round(strength * 100)}%
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-[12px] text-white/55">
                      小提示：按 <span className="text-white/75">ESC</span>{" "}
                      关闭；
                      <span className="text-white/75">/</span> 聚焦搜索框。
                    </div>
                  </div>
                </aside>

                {/* Content */}
                {/* ✅关键修复：section 必须 min-h-0，内部滚动容器也 min-h-0 */}
                <section className="col-span-12 sm:col-span-8 min-h-0">
                  <div
                    ref={contentScrollRef}
                    className="min-h-0 h-full overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"
                  >
                    {/* Snippet card */}
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-black tracking-[0.22em] text-white/55">
                          HIGHLIGHTS
                        </div>
                        <div className="text-[11px] font-semibold text-white/45">
                          snippet hits {hitStats.snippet}
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-white/75">
                        {highlight(activeDoc.snippet, query)}
                      </p>
                    </div>

                    <div className="mt-4 space-y-4">
                      {activeSections.map((s) => {
                        const hits = hitStats.sections?.[s.id] ?? 0;
                        const strength = evidenceStrength[s.id] ?? 0;

                        return (
                          <div
                            key={s.id}
                            ref={(el) => (sectionRefs.current[s.id] = el)}
                            className="rounded-3xl border border-white/10 bg-black/20 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-xs font-black tracking-[0.22em] text-white/55">
                                {highlight(s.title.toUpperCase(), query)}
                              </div>
                              <div className="shrink-0 text-[11px] font-bold text-white/45">
                                hits {hits}
                              </div>
                            </div>

                            <div className="mt-2">
                              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-200/70 via-violet-200/70 to-indigo-200/70"
                                  style={{
                                    width: `${Math.round(strength * 100)}%`,
                                  }}
                                />
                              </div>
                              <div className="mt-1 text-[11px] text-white/40">
                                Evidence strength {Math.round(strength * 100)}%
                              </div>
                            </div>

                            <p className="mt-3 text-sm leading-relaxed text-white/70">
                              {highlight(s.body, query)}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const excerpt =
                                    `【${s.title}】\n` +
                                    `${activeDoc.title}\n\n` +
                                    (typeof s.body === "string" ? s.body : "");
                                  navigator.clipboard
                                    .writeText(excerpt)
                                    .then(() => showToast("已复制段落"))
                                    .catch(() =>
                                      showToast("复制失败（浏览器限制）")
                                    );
                                }}
                                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/75 hover:bg-white/10"
                              >
                                <Copy className="h-4 w-4" />
                                复制段落
                              </button>

                              <button
                                type="button"
                                onClick={() => scrollToSection(s.id)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/75 hover:bg-white/10"
                              >
                                <ChevronRight className="h-4 w-4" />
                                定位
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4">
                      <div className="text-xs font-black tracking-[0.22em] text-white/55">
                        EXPORT
                      </div>
                      <p className="mt-2 text-sm text-white/60">
                        可接入：原文链接、PDF
                        下载、引用格式（BibTeX/APA）、命中证据定位到具体段落。
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={copyCitation}
                          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-white/90 active:scale-[0.98]"
                        >
                          <Copy className="h-4 w-4" />
                          复制引用
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast("（Demo）打开原文")}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10 active:scale-[0.98]"
                        >
                          打开原文
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pb-2 text-center text-[11px] text-white/35">
                      End · Progress {Math.round(readProgress * 100)}%
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
