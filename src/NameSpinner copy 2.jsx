import { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Ticket,
  Users,
  CheckCircle2,
  Trophy,
  Trash2,
  Plus,
  UploadCloud,
  Play,
  RotateCcw,
  Loader2,
  X,
  AlertCircle,
  Info,
} from "lucide-react";

const STORAGE_KEY = "name-spinner-state";
const SUPPORTED_EXT = [".xlsx", ".xls", ".csv"];
const SHAPES = ["circle", "square", "triangle"];

const COLORS = {
  main: "#C8102E",
  mainDark: "#9E0B23",
  mainLight: "#FBE9ED",
  mainMid: "#E0455C",
  gold: "#D9A52C",
  goldDark: "#A6740A",
  goldLight: "#FBF1DA",
};

const CONFETTI_COLORS = [
  "#C8102E",
  "#E0455C",
  "#FBE9ED",
  "#9E0B23",
  "#D9A52C",
  "#ffffff",
];

function buildDisplay(remaining, winner) {
  if (remaining.length === 0) return [];
  const arr = [];
  for (let i = 0; i < 9; i++) {
    arr.push(remaining[Math.floor(Math.random() * remaining.length)]);
  }
  if (winner) arr[4] = winner;
  return arr;
}

function extractNamesFromWorkbook(workbook) {
  const names = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    rows.forEach((row) => {
      row.forEach((cell) => {
        const str = String(cell ?? "").trim();
        if (str) names.push(str);
      });
    });
  });
  return names;
}

export default function NameSpinner() {
  const [allNames, setAllNames] = useState([]);
  const [remaining, setRemaining] = useState([]);
  const [selected, setSelected] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [displayItems, setDisplayItems] = useState([
    "Add",
    "names",
    "to",
    "begin",
    "spinning",
    "the",
    "wheel",
    "now",
    "!",
  ]);
  const [winnerIdx, setWinnerIdx] = useState(undefined);
  const [showResult, setShowResult] = useState(false);
  const [resultName, setResultName] = useState("");
  const [confetti, setConfetti] = useState([]);
  const [flash, setFlash] = useState(false);
  const [bumpTotal, setBumpTotal] = useState(false);
  const [bumpRemain, setBumpRemain] = useState(false);
  const [bumpDrawn, setBumpDrawn] = useState(false);
  const [removingTag, setRemovingTag] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fastPhase, setFastPhase] = useState(false);
  const [nearStop, setNearStop] = useState(false);
  const [toast, setToast] = useState(null);

  const textareaRef = useRef(null);
  const timeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const triggerBump = (setter) => {
    setter(false);
    requestAnimationFrame(() => setter(true));
  };

  const showToast = (message, type = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3400);
  };

  // Load persisted state on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (cancelled) return;
        if (result && result.value) {
          const parsed = JSON.parse(result.value);
          const names = Array.isArray(parsed.allNames) ? parsed.allNames : [];
          const sel = Array.isArray(parsed.selected) ? parsed.selected : [];
          const rem = names.filter((n) => !sel.includes(n));
          setAllNames(names);
          setSelected(sel);
          setRemaining(rem);
          setDisplayItems(
            rem.length
              ? buildDisplay(rem)
              : [
                  "Add",
                  "names",
                  "to",
                  "begin",
                  "spinning",
                  "the",
                  "wheel",
                  "now",
                  "!",
                ],
          );
        }
      } catch {
        // no saved state yet, or storage unavailable — start fresh
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist state whenever it changes (after initial load)
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(
          STORAGE_KEY,
          JSON.stringify({ allNames, selected }),
        );
      } catch {
        // ignore storage errors
      }
    })();
  }, [allNames, selected, loaded]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Shared merge logic for both typed and imported names
  const commitNames = (rawNames) => {
    const cleaned = rawNames.map((s) => s.trim()).filter(Boolean);
    if (!cleaned.length) return { added: 0, duplicates: 0 };

    const seen = new Set(allNames);
    const fresh = [];
    let duplicates = 0;
    cleaned.forEach((name) => {
      if (seen.has(name)) {
        duplicates += 1;
      } else {
        seen.add(name);
        fresh.push(name);
      }
    });

    if (fresh.length) {
      const updated = [...allNames, ...fresh];
      setAllNames(updated);
      const newRemaining = updated.filter((n) => !selected.includes(n));
      setRemaining(newRemaining);
      setDisplayItems(buildDisplay(newRemaining));
      triggerBump(setBumpTotal);
    }

    return { added: fresh.length, duplicates };
  };

  const addNames = () => {
    const raw = textareaRef.current.value;
    if (!raw.trim()) return;
    const parts = raw.split(",");
    const { added, duplicates } = commitNames(parts);

    if (added === 0 && duplicates > 0) {
      showToast("Those names are already on your list.", "info");
    } else if (added > 0 && duplicates > 0) {
      showToast(
        `Added ${added} name${added === 1 ? "" : "s"} (${duplicates} already on the list).`,
        "success",
      );
    } else if (added > 0) {
      showToast(`Added ${added} name${added === 1 ? "" : "s"}.`, "success");
    }

    textareaRef.current.value = "";
  };

  const handleFiles = async (fileList) => {
    const file = fileList && fileList[0];
    if (!file) return;
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!SUPPORTED_EXT.includes(ext)) {
      showToast(
        `"${file.name}" isn't a supported file type. Use .xlsx, .xls, or .csv.`,
        "error",
      );
      return;
    }

    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: "array" });
      const found = extractNamesFromWorkbook(workbook);

      if (!found.length) {
        showToast(`No names found in "${file.name}".`, "error");
      } else {
        const { added, duplicates } = commitNames(found);
        if (added > 0) {
          showToast(
            `Imported ${added} name${added === 1 ? "" : "s"} from "${file.name}"` +
              (duplicates ? ` (${duplicates} already on the list).` : "."),
            "success",
          );
        } else {
          showToast(
            `Found ${found.length} entries in "${file.name}", but they're all already on your list.`,
            "info",
          );
        }
      }
    } catch (err) {
      showToast(
        `Couldn't read "${file.name}". Make sure it's a valid spreadsheet.`,
        "error",
      );
    } finally {
      setImporting(false);
    }
  };

  const removeName = (name) => {
    setRemovingTag(name);
    setTimeout(() => {
      setAllNames((prev) => {
        const updated = prev.filter((n) => n !== name);
        setSelected((sel) => {
          const newSel = sel.filter((n) => n !== name);
          const newRemaining = updated.filter((n) => !newSel.includes(n));
          setRemaining(newRemaining);
          if (newRemaining.length) setDisplayItems(buildDisplay(newRemaining));
          else setDisplayItems([]);
          return newSel;
        });
        triggerBump(setBumpTotal);
        triggerBump(setBumpRemain);
        return updated;
      });
      setRemovingTag(null);
    }, 220);
  };

  const clearAll = () => {
    setAllNames([]);
    setRemaining([]);
    setSelected([]);
    setDisplayItems([]);
    setShowResult(false);
    setWinnerIdx(undefined);
    setToast(null);
    (async () => {
      try {
        await window.storage.delete(STORAGE_KEY);
      } catch {
        // ignore
      }
    })();
  };

  const launchConfetti = () => {
    const pieces = [];
    for (let i = 0; i < 30; i++) {
      const left = 50 + (Math.random() * 90 - 45);
      pieces.push({
        id: Math.random().toString(36).slice(2),
        left: Math.min(96, Math.max(4, left)),
        bg: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 5 + Math.random() * 6,
        duration: 1 + Math.random() * 0.8,
        delay: Math.random() * 0.2,
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        driftX: Math.random() * 60 - 30,
        rotSign: Math.random() > 0.5 ? 1 : -1,
      });
    }
    setConfetti(pieces);
    setTimeout(() => setConfetti([]), 2300);
  };

  const finishSpin = useCallback(() => {
    setAllNames((allN) => {
      setSelected((sel) => {
        setRemaining((rem) => {
          const winner = rem[Math.floor(Math.random() * rem.length)];
          setDisplayItems(buildDisplay(rem, winner));
          setWinnerIdx(6);
          setResultName(winner);
          setShowResult(true);

          const newSelected = [...sel, winner];
          const newRemaining = allN.filter((n) => !newSelected.includes(n));

          // schedule dependent state updates after this batch
          setTimeout(() => {
            setSelected(newSelected);
            setRemaining(newRemaining);
            triggerBump(setBumpRemain);
            triggerBump(setBumpDrawn);
          }, 0);

          return rem;
        });
        return sel;
      });
      return allN;
    });

    setSpinning(false);
    setFastPhase(false);
    setNearStop(false);
    setFlash(false);
    requestAnimationFrame(() => setFlash(true));
    launchConfetti();
  }, []);

  const startSpin = () => {
    if (spinning) return;
    if (remaining.length === 0) {
      showToast("No names left to draw. Reset or add more names.", "error");
      return;
    }
    setSpinning(true);
    setShowResult(false);
    setWinnerIdx(undefined);
    setFastPhase(true);
    setNearStop(false);
    setFlash(false);

    let elapsed = 0;
    let lastTime = null;
    const totalTime = 5000;

    const step = (ts) => {
      if (!lastTime) lastTime = ts;
      elapsed += ts - lastTime;
      lastTime = ts;
      const progress = Math.min(1, elapsed / totalTime);

      const decel = Math.max(0, (progress - 0.55) / 0.45);
      const eased = 1 - Math.pow(1 - decel, 3);
      const speed = progress < 0.55 ? 38 : 38 + eased * 260;

      const isFast = progress < 0.45;
      const isNear = progress > 0.85;
      setFastPhase((prev) => (prev === isFast ? prev : isFast));
      setNearStop((prev) => (prev === isNear ? prev : isNear));

      setRemaining((rem) => {
        setDisplayItems(buildDisplay(rem));
        return rem;
      });

      if (elapsed < totalTime) {
        timeoutRef.current = setTimeout(
          () => requestAnimationFrame(step),
          speed,
        );
      } else {
        finishSpin();
      }
    };
    requestAnimationFrame(step);
  };

  const resetSpins = () => {
    setSelected([]);
    setRemaining([...allNames]);
    setShowResult(false);
    setWinnerIdx(undefined);
    setFastPhase(false);
    setNearStop(false);
    if (allNames.length) setDisplayItems(buildDisplay(allNames));
    else setDisplayItems([]);
  };

  const totalCount = allNames.length;
  const remainCount = remaining.length;
  const progressPct = totalCount
    ? Math.round((selected.length / totalCount) * 100)
    : 0;

  const headerSub = spinning
    ? "Spinning…"
    : totalCount === 0
      ? "Add names to begin"
      : remainCount === 0
        ? "All names drawn — reset to spin again"
        : `${remainCount} of ${totalCount} ready to draw`;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Poppins:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .ns-app * { box-sizing: border-box; margin: 0; padding: 0; }
        .ns-app {
          font-family: 'Poppins', sans-serif;
          --main: ${COLORS.main};
          --main-dark: ${COLORS.mainDark};
          --main-light: ${COLORS.mainLight};
          --main-mid: ${COLORS.mainMid};
          --gold: ${COLORS.gold};
          --gold-dark: ${COLORS.goldDark};
          --gold-light: ${COLORS.goldLight};
          position: relative;
          max-width: 480px;
          margin: 0 auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .ns-card {
          background: #fff;
          border: none;
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow: 0 2px 10px -4px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.04);
          transition: box-shadow .25s ease, transform .25s ease;
        }
        .ns-card:hover {
          box-shadow: 0 10px 28px -8px rgba(200,16,46,.22), 0 2px 6px rgba(0,0,0,.05);
          transform: translateY(-2px);
        }
        .ns-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: .07em;
          margin-bottom: .75rem;
        }
        .ns-section-title svg { color: var(--main); flex-shrink: 0; }
        .ns-name-input {
          width: 100%;
          min-height: 72px;
          resize: vertical;
          font-size: 14px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 0.5px solid #e5e7eb;
          background: #f9fafb;
          color: #111827;
          font-family: inherit;
          margin-bottom: 8px;
          transition: box-shadow .2s ease, border-color .2s ease;
        }
        .ns-name-input::placeholder { color: #9ca3af; }
        .ns-name-input:focus {
          outline: none;
          box-shadow: 0 0 0 3px #C8102E26;
          border-color: var(--main);
        }
        .ns-btn-row { display: flex; gap: 8px; }
        .ns-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          border: 0.5px solid #e5e7eb;
          background: transparent;
          color: #111827;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all .15s cubic-bezier(.34,1.56,.64,1);
          font-family: inherit;
        }
        .ns-btn:hover { background: #f9fafb; transform: translateY(-1px); }
        .ns-btn:active { transform: translateY(0) scale(.97); }
        .ns-btn:focus-visible {
          outline: 2px solid var(--main-dark);
          outline-offset: 2px;
        }
        .ns-btn-primary { background: var(--main); color: #fff; border-color: var(--main); }
        .ns-btn-primary:hover { background: var(--main-dark); border-color: var(--main-dark); box-shadow: 0 4px 14px -4px #C8102E66; }
        .ns-btn-danger { background: var(--main); color: #fff; border-color: var(--main); }
        .ns-btn-danger:hover { background: var(--main-dark); border-color: var(--main-dark); box-shadow: 0 4px 14px -4px #C8102E66; }
        .ns-btn-outline-red { border-color: var(--main); color: var(--main-dark); }
        .ns-btn-outline-red:hover { background: var(--main-light); }
        .ns-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }

        .ns-spin-btn.ns-spinning { animation: ns-pulseGlow 1s ease-in-out infinite; }
        @keyframes ns-pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 #C8102E55; }
          50% { box-shadow: 0 0 0 8px #C8102E00; }
        }
        .ns-spin-icon { animation: ns-rotate .9s linear infinite; }
        @keyframes ns-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .ns-divider { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
        .ns-divider::before, .ns-divider::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }
        .ns-divider span { font-size: 10.5px; color: #9ca3af; text-transform: uppercase; letter-spacing: .08em; font-weight: 500; }

        .ns-dropzone {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1.5px dashed #d1d5db;
          border-radius: 10px;
          padding: 12px 14px;
          cursor: pointer;
          background: #fafafa;
          transition: border-color .2s ease, background .2s ease, transform .15s ease;
          margin-bottom: 10px;
        }
        .ns-dropzone:hover { border-color: var(--main); background: var(--main-light); }
        .ns-dropzone:focus-visible { outline: 2px solid var(--main); outline-offset: 2px; }
        .ns-dropzone.ns-drag-active { border-color: var(--main); background: var(--main-light); transform: scale(1.01); }
        .ns-dropzone.ns-importing { opacity: .85; cursor: progress; }
        .ns-dropzone svg { color: var(--main); flex-shrink: 0; }
        .ns-dropzone-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .ns-dropzone-text strong { font-size: 13px; color: #111827; font-weight: 500; }
        .ns-dropzone-text span { font-size: 11px; color: #6b7280; }

        .ns-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: .85rem; }
        .ns-stat { border-radius: 8px; padding: 10px 8px; text-align: center; transition: transform .2s ease; }
        .ns-stat-total { background: var(--main-light); border: 0.5px solid #C8102E33; }
        .ns-stat-remain { background: var(--main-light); border: 0.5px solid #C8102E33; }
        .ns-stat-drawn { background: var(--gold-light); border: 0.5px solid #D9A52C55; }
        .ns-stat-n {
          font-family: 'Fraunces', serif;
          font-size: 23px;
          font-weight: 600;
          display: inline-block;
          transition: transform .25s cubic-bezier(.34,1.56,.64,1);
        }
        .ns-stat-total .ns-stat-n, .ns-stat-remain .ns-stat-n { color: var(--main-dark); }
        .ns-stat-drawn .ns-stat-n { color: var(--gold-dark); }
        .ns-stat-l { font-size: 10.5px; font-weight: 500; margin-top: 2px; }
        .ns-stat-total .ns-stat-l, .ns-stat-remain .ns-stat-l { color: var(--main); }
        .ns-stat-drawn .ns-stat-l { color: var(--gold-dark); }
        .ns-stat-n.ns-bump { animation: ns-bump .35s cubic-bezier(.34,1.56,.64,1); }
        @keyframes ns-bump { 0% { transform: scale(1); } 40% { transform: scale(1.35); } 100% { transform: scale(1); } }

        .ns-progress { margin-bottom: .9rem; }
        .ns-progress-track { height: 5px; border-radius: 100px; background: #f1f2f4; overflow: hidden; }
        .ns-progress-fill {
          height: 100%; border-radius: 100px;
          background: linear-gradient(90deg, var(--main), var(--gold));
          transition: width .5s cubic-bezier(.34,1.2,.64,1);
        }

        .ns-spinner-wrap {
          position: relative;
          width: 100%;
          height: 390px;
          overflow: hidden;
          border-radius: 8px;
          background: #f9fafb;
          border: 0.5px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: box-shadow .2s ease;
        }
        .ns-spinner-wrap.ns-near-stop { box-shadow: inset 0 0 0 2px #C8102E33; }
        .ns-spin-track { display: flex; flex-direction: column; align-items: center; gap: 6px; transition: transform .12s linear; }
        .ns-spin-item {
          font-size: 17px;
          font-weight: 500;
          color: #9ca3af;
          padding: 8px 28px;
          border-radius: 8px;
          white-space: nowrap;
          text-align: center;
          max-width: 320px;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color .1s, background .1s, filter .15s, opacity .15s;
        }
        .ns-spinner-wrap.ns-fast .ns-spin-item:not(.ns-center):not(.ns-winner) {
          filter: blur(1px);
          opacity: .5;
        }
        .ns-spin-item.ns-center {
          font-size: 21px;
          font-weight: 500;
          color: #111827;
          background: #fff;
          border: 1.5px solid #e5e7eb;
        }
        .ns-spinner-wrap.ns-near-stop .ns-spin-item.ns-center {
          animation: ns-anticipate .6s ease-in-out infinite;
        }
        @keyframes ns-anticipate {
          0%, 100% { box-shadow: 0 0 0 0 #C8102E00; }
          50% { box-shadow: 0 0 0 6px #C8102E22; }
        }
        .ns-spin-item.ns-winner {
          font-size: 22px;
          font-weight: 600;
          color: var(--main-dark);
          background: var(--main-light);
          border: 2px solid var(--main);
          animation: ns-winnerPop .5s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes ns-winnerPop {
          0% { transform: scale(.7); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        .ns-fade-top {
          position: absolute; top: 0; left: 0; right: 0; height: 65px;
          background: linear-gradient(to bottom, #f9fafb, transparent);
          pointer-events: none; z-index: 2;
        }
        .ns-fade-bottom {
          position: absolute; bottom: 0; left: 0; right: 0; height: 65px;
          background: linear-gradient(to top, #f9fafb, transparent);
          pointer-events: none; z-index: 2;
        }
        .ns-spin-line-top {
          position: absolute; left: 8%; right: 8%; height: 1.5px;
          background: var(--main); opacity: .25; top: calc(50% - 24px); pointer-events: none;
        }
        .ns-spin-line-bot {
          position: absolute; left: 8%; right: 8%; height: 1.5px;
          background: var(--main); opacity: .25; top: calc(50% + 24px); pointer-events: none;
        }
        .ns-spinner-wrap.ns-flash::after {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 50%, #C8102E33, transparent 70%);
          animation: ns-flash .6s ease-out forwards;
          pointer-events: none; z-index: 1;
        }
        @keyframes ns-flash { from { opacity: 1; } to { opacity: 0; } }

        .ns-confetti {
          position: absolute; top: calc(50% - 6px); width: 8px; height: 8px; border-radius: 2px;
          pointer-events: none; z-index: 3; animation: ns-confettiFall linear forwards;
        }
        .ns-confetti.shape-circle { border-radius: 50%; }
        .ns-confetti.shape-square { border-radius: 2px; }
        .ns-confetti.shape-triangle { background: transparent !important; border-style: solid; border-color: transparent; }
        @keyframes ns-confettiFall {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          55% { transform: translate(var(--driftX, 0px), 120px) rotate(calc(var(--rot, 1) * 280deg)); opacity: 1; }
          100% { transform: translate(calc(var(--driftX, 0px) * -1), 230px) rotate(calc(var(--rot, 1) * 540deg)); opacity: 0; }
        }

        .ns-spin-btn-wrap { display: flex; gap: 8px; justify-content: center; margin-top: .75rem; }

        .ns-ticket {
          position: relative;
          text-align: center;
          margin-top: .75rem;
          padding: 18px 18px 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--main-light), #fff 65%);
          border: 1.5px dashed var(--gold-dark);
          animation: ns-pop .35s cubic-bezier(.34,1.56,.64,1);
        }
        .ns-ticket::before, .ns-ticket::after {
          content: '';
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #fff;
        }
        .ns-ticket::before { left: -8px; }
        .ns-ticket::after { right: -8px; }
        .ns-ticket-ribbon {
          position: absolute; top: -11px; right: 16px;
          display: inline-flex; align-items: center; gap: 4px;
          background: linear-gradient(135deg, var(--gold), var(--gold-dark));
          color: #fff; font-size: 10px; font-weight: 600;
          padding: 4px 10px; border-radius: 100px;
          transform: rotate(4deg);
          box-shadow: 0 3px 8px -2px rgba(0,0,0,.25);
          text-transform: uppercase; letter-spacing: .04em;
        }
        .ns-ticket-name {
          font-family: 'Fraunces', serif;
          font-size: 22px; font-weight: 600; color: var(--main-dark);
          margin-top: 8px;
        }
        .ns-ticket-sub {
          font-size: 11px; color: var(--gold-dark); margin-top: 5px;
          font-weight: 600; text-transform: uppercase; letter-spacing: .08em;
        }
        @keyframes ns-pop { from { opacity: 0; transform: scale(.88); } to { opacity: 1; transform: scale(1); } }

        .ns-tag-wrap { display: flex; flex-wrap: wrap; gap: 5px; max-height: 110px; overflow-y: auto; margin-top: .5rem; }
        .ns-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px; padding: 3px 6px 3px 10px; background: var(--main-light);
          border: 0.5px solid #C8102E33; border-radius: 100px; color: var(--main-dark);
          max-width: 180px;
          animation: ns-tagIn .3s cubic-bezier(.34,1.56,.64,1) both;
          transition: background .25s, color .25s, opacity .25s, transform .25s;
        }
        .ns-tag.ns-removing {
          animation: ns-tagOut .22s cubic-bezier(.4,0,.6,1) forwards;
        }
        @keyframes ns-tagIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
        @keyframes ns-tagOut {
          0% { opacity: 1; transform: scale(1); max-width: 180px; margin-right: 5px; }
          60% { opacity: 0; transform: scale(.8); }
          100% { opacity: 0; transform: scale(.6); max-width: 0; padding-left: 0; padding-right: 0; margin-right: 0; }
        }
        .ns-tag.ns-used {
          background: var(--main-light); border-color: #C8102E55;
          color: var(--main-dark); opacity: .7;
        }
        .ns-tag.ns-used .ns-tag-text { text-decoration: line-through; }
        .ns-tag-text {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 130px;
        }
        .ns-tag-delete {
          display: flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; flex-shrink: 0;
          border: none; background: transparent; padding: 0; cursor: pointer;
          color: var(--main-dark); opacity: .5;
          border-radius: 50%;
          transition: opacity .15s ease, background .15s ease, transform .15s cubic-bezier(.34,1.56,.64,1);
        }
        .ns-tag-delete:hover {
          opacity: 1;
          background: var(--main);
          color: #fff;
          transform: scale(1.15) rotate(90deg);
        }
        .ns-tag-delete:active {
          transform: scale(.9) rotate(90deg);
        }
        .ns-tag-delete:focus-visible {
          outline: 2px solid var(--main-dark);
          outline-offset: 2px;
        }
        .ns-tag-delete svg { width: 10px; height: 10px; display: block; }

        .ns-summary-list { display: flex; flex-direction: column; gap: 6px; }
        .ns-summary-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          background: #f9fafb; border-radius: 8px; border: 0.5px dashed #e5e7eb;
          animation: ns-slideIn .35s cubic-bezier(.34,1.56,.64,1) both;
          transition: transform .15s ease, border-color .15s ease;
        }
        .ns-summary-item:hover { transform: translateX(2px); border-color: #C8102E55; }
        .ns-summary-item .ns-num {
          font-family: 'Fraunces', serif;
          font-size: 12px; font-weight: 600; color: #fff;
          background: linear-gradient(135deg, var(--gold), var(--gold-dark));
          border-radius: 50%; width: 22px; height: 22px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .ns-summary-item .ns-sname { font-size: 14px; color: #111827; font-weight: 500; flex: 1; }
        @keyframes ns-slideIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }

        .ns-header {
          display: flex; align-items: center; gap: 10px; padding: 1rem 1.25rem;
          background: var(--main); border-radius: 12px; color: #fff;
          position: relative; overflow: hidden;
          box-shadow: 0 4px 16px -4px rgba(200,16,46,.35);
        }
        .ns-header::after {
          content: ''; position: absolute; top: -50%; left: -20%; width: 60%; height: 200%;
          background: linear-gradient(120deg, transparent, #ffffff22, transparent);
          animation: ns-sheen 4.5s ease-in-out infinite;
        }
        @keyframes ns-sheen {
          0% { transform: translateX(-120%) rotate(8deg); }
          50% { transform: translateX(220%) rotate(8deg); }
          100% { transform: translateX(220%) rotate(8deg); }
        }
        .ns-header-icon {
          width: 38px; height: 38px; background: #fff2; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; color: #fff;
          flex-shrink: 0;
          animation: ns-bob 3s ease-in-out infinite;
        }
        @keyframes ns-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .ns-header-title { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; letter-spacing: -.01em; }
        .ns-header-sub { font-size: 12px; opacity: .85; margin-top: 2px; }
        .ns-sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .ns-toast {
          position: absolute; top: 8px; left: 8px; right: 8px; z-index: 50;
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; border-radius: 10px; font-size: 12.5px; font-weight: 500;
          box-shadow: 0 10px 26px -8px rgba(0,0,0,.25);
          animation: ns-toastIn .35s cubic-bezier(.34,1.56,.64,1);
        }
        .ns-toast-success { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
        .ns-toast-error { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
        .ns-toast-info { background: var(--gold-light); color: var(--gold-dark); border: 1px solid var(--gold); }
        .ns-toast-icon { display: flex; flex-shrink: 0; }
        .ns-toast-msg { flex: 1; line-height: 1.35; }
        @keyframes ns-toastIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        @media (prefers-reduced-motion: reduce) {
          .ns-app *, .ns-app *::before, .ns-app *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
          }
        }
      `}</style>

      <div className="ns-app">
        <h2 className="ns-sr-only">
          Name spinner — paste or import names, spin to pick one randomly
        </h2>

        {toast && (
          <div
            className={`ns-toast ns-toast-${toast.type}`}
            role="status"
            aria-live="polite"
          >
            <span className="ns-toast-icon">
              {toast.type === "success" && <CheckCircle2 size={16} />}
              {toast.type === "error" && <AlertCircle size={16} />}
              {toast.type === "info" && <Info size={16} />}
            </span>
            <span className="ns-toast-msg">{toast.message}</span>
          </div>
        )}

        <div className="ns-header">
          <div className="ns-header-icon">
            <Ticket size={19} />
          </div>
          <div>
            <div className="ns-header-title">Name Spinner</div>
            <div className="ns-header-sub">{headerSub}</div>
          </div>
        </div>

        <div className="ns-card">
          <div className="ns-section-title">
            <Users size={13} /> Add names
          </div>
          <textarea
            ref={textareaRef}
            className="ns-name-input"
            placeholder={
              "Paste names separated by commas\ne.g. Alice, Bob, Carol, Dave, ..."
            }
          />
          <div className="ns-btn-row">
            <button
              className="ns-btn ns-btn-primary"
              style={{ flex: 1 }}
              onClick={addNames}
            >
              <Plus size={15} /> Add names
            </button>
            <button
              className="ns-btn ns-btn-danger"
              onClick={clearAll}
              aria-label="Clear all names"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="ns-divider">
            <span>or</span>
          </div>

          <div
            className={
              "ns-dropzone" +
              (dragActive ? " ns-drag-active" : "") +
              (importing ? " ns-importing" : "")
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current && fileInputRef.current.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="ns-sr-only"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {importing ? (
              <Loader2 className="ns-spin-icon" size={20} />
            ) : (
              <UploadCloud size={20} />
            )}
            <div className="ns-dropzone-text">
              <strong>
                {importing
                  ? "Reading file…"
                  : dragActive
                    ? "Drop to import"
                    : "Import an Excel or CSV file"}
              </strong>
              <span>.xlsx · .xls · .csv — names from every cell are added</span>
            </div>
          </div>

          <div className="ns-tag-wrap">
            {allNames.map((n, i) => (
              <span
                key={n + i}
                className={
                  "ns-tag" +
                  (selected.includes(n) ? " ns-used" : "") +
                  (removingTag === n ? " ns-removing" : "")
                }
                title={n}
                style={{
                  animationDelay: removingTag === n ? "0s" : i * 0.03 + "s",
                }}
              >
                <span className="ns-tag-text">{n}</span>
                <button
                  className="ns-tag-delete"
                  aria-label={`Remove ${n}`}
                  onClick={() => removeName(n)}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="ns-card">
          <div className="ns-stats">
            <div className="ns-stat ns-stat-total">
              <div className={"ns-stat-n" + (bumpTotal ? " ns-bump" : "")}>
                {totalCount}
              </div>
              <div className="ns-stat-l">Total</div>
            </div>
            <div className="ns-stat ns-stat-remain">
              <div className={"ns-stat-n" + (bumpRemain ? " ns-bump" : "")}>
                {remainCount}
              </div>
              <div className="ns-stat-l">Remaining</div>
            </div>
            <div className="ns-stat ns-stat-drawn">
              <div className={"ns-stat-n" + (bumpDrawn ? " ns-bump" : "")}>
                {selected.length}
              </div>
              <div className="ns-stat-l">Drawn</div>
            </div>
          </div>

          {totalCount > 0 && (
            <div className="ns-progress">
              <div className="ns-progress-track">
                <div
                  className="ns-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <div
            className={
              "ns-spinner-wrap" +
              (flash ? " ns-flash" : "") +
              (fastPhase ? " ns-fast" : "") +
              (nearStop ? " ns-near-stop" : "")
            }
          >
            <div className="ns-spin-track">
              {displayItems.map((n, i) => (
                <div
                  key={i}
                  className={
                    "ns-spin-item" +
                    (winnerIdx !== undefined && i === 4
                      ? " ns-winner"
                      : i === 4
                        ? " ns-center"
                        : "")
                  }
                >
                  {n || ""}
                </div>
              ))}
            </div>
            <div className="ns-fade-top" />
            <div className="ns-fade-bottom" />
            <div className="ns-spin-line-top" />
            <div className="ns-spin-line-bot" />
            {confetti.map((c) => (
              <div
                key={c.id}
                className={`ns-confetti shape-${c.shape}`}
                style={{
                  left: c.left + "%",
                  background: c.shape === "triangle" ? "transparent" : c.bg,
                  borderBottomColor: c.shape === "triangle" ? c.bg : undefined,
                  width: c.shape === "triangle" ? 0 : c.size,
                  height: c.shape === "triangle" ? 0 : c.size,
                  borderLeftWidth:
                    c.shape === "triangle" ? c.size / 2 : undefined,
                  borderRightWidth:
                    c.shape === "triangle" ? c.size / 2 : undefined,
                  borderBottomWidth:
                    c.shape === "triangle" ? c.size : undefined,
                  borderLeftColor:
                    c.shape === "triangle" ? "transparent" : undefined,
                  borderRightColor:
                    c.shape === "triangle" ? "transparent" : undefined,
                  animationDuration: c.duration + "s",
                  animationDelay: c.delay + "s",
                  "--driftX": c.driftX + "px",
                  "--rot": c.rotSign,
                }}
              />
            ))}
          </div>

          {showResult && (
            <div className="ns-ticket">
              <span className="ns-ticket-ribbon">
                <Trophy size={12} /> Winner
              </span>
              <div className="ns-ticket-name">{resultName}</div>
              <div className="ns-ticket-sub">Draw #{selected.length}</div>
            </div>
          )}

          <div className="ns-spin-btn-wrap">
            <button
              className={
                "ns-btn ns-btn-primary ns-spin-btn" +
                (spinning ? " ns-spinning" : "")
              }
              style={{ padding: "10px 32px", fontSize: 15 }}
              onClick={startSpin}
              disabled={spinning}
            >
              {spinning ? (
                <Loader2 className="ns-spin-icon" size={16} />
              ) : (
                <Play size={15} />
              )}
              {spinning ? "Spinning…" : "Spin"}
            </button>
            {selected.length > 0 && (
              <button
                className="ns-btn ns-btn-outline-red"
                onClick={resetSpins}
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="ns-card">
            <div className="ns-section-title">
              <CheckCircle2 size={13} /> Selected names
            </div>
            <div className="ns-summary-list">
              {[...selected].reverse().map((name, i) => (
                <div
                  className="ns-summary-item"
                  key={name + i}
                  style={{ animationDelay: ".05s" }}
                >
                  <div className="ns-num">{selected.length - i}</div>
                  <div className="ns-sname">{name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
