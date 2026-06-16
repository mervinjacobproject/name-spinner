import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "name-spinner-state";

const COLORS = {
  main: "#C8102E",
  mainDark: "#9E0B23",
  mainLight: "#FBE9ED",
  mainMid: "#E0455C",
};

const CONFETTI_COLORS = ["#C8102E", "#E0455C", "#FBE9ED", "#9E0B23", "#ffffff"];

function buildDisplay(remaining, winner) {
  if (remaining.length === 0) return [];
  const arr = [];
  for (let i = 0; i < 9; i++) {
    arr.push(remaining[Math.floor(Math.random() * remaining.length)]);
  }
  if (winner) arr[4] = winner;
  return arr;
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
  const [removingTag, setRemovingTag] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const textareaRef = useRef(null);
  const timeoutRef = useRef(null);

  const triggerBump = (setter) => {
    setter(false);
    requestAnimationFrame(() => setter(true));
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

  const addNames = () => {
    const raw = textareaRef.current.value;
    if (!raw.trim()) return;
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setAllNames((prev) => {
      const newN = parts.filter((n) => !prev.includes(n));
      const updated = [...prev, ...newN];
      setSelected((sel) => {
        const newRemaining = updated.filter((n) => !sel.includes(n));
        setRemaining(newRemaining);
        if (newRemaining.length) setDisplayItems(buildDisplay(newRemaining));
        return sel;
      });
      if (updated.length !== prev.length) triggerBump(setBumpTotal);
      return updated;
    });

    textareaRef.current.value = "";
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
    for (let i = 0; i < 24; i++) {
      pieces.push({
        id: Math.random().toString(36).slice(2),
        left: Math.random() * 100,
        bg: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 5 + Math.random() * 5,
        duration: 0.8 + Math.random() * 0.7,
        delay: Math.random() * 0.15,
      });
    }
    setConfetti(pieces);
    setTimeout(() => setConfetti([]), 2000);
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
          }, 0);

          return rem;
        });
        return sel;
      });
      return allN;
    });

    setSpinning(false);
    setFlash(false);
    requestAnimationFrame(() => setFlash(true));
    launchConfetti();
  }, []);

  const startSpin = () => {
    if (spinning) return;
    if (remaining.length === 0) {
      alert("No names left! Reset or add more.");
      return;
    }
    setSpinning(true);
    setShowResult(false);
    setWinnerIdx(undefined);

    let elapsed = 0;
    let lastTime = null;
    const totalTime = 5000;

    const step = (ts) => {
      if (!lastTime) lastTime = ts;
      elapsed += ts - lastTime;
      lastTime = ts;
      const progress = elapsed / totalTime;
      const speed =
        progress < 0.6 ? 40 : Math.max(40, 40 + (progress - 0.6) * 600);

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
    if (allNames.length) setDisplayItems(buildDisplay(allNames));
    else setDisplayItems([]);
  };

  const totalCount = allNames.length;
  const remainCount = remaining.length;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
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
          font-size: 12px;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: .07em;
          margin-bottom: .75rem;
        }
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

        .ns-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 1rem; }
        .ns-stat { border-radius: 8px; padding: 10px 12px; text-align: center; transition: transform .2s ease; }
        .ns-stat-total { background: var(--main-light); border: 0.5px solid #C8102E33; }
        .ns-stat-remain { background: var(--main-light); border: 0.5px solid #C8102E33; }
        .ns-stat-n {
          font-size: 24px;
          font-weight: 500;
          display: inline-block;
          transition: transform .25s cubic-bezier(.34,1.56,.64,1);
        }
        .ns-stat-total .ns-stat-n { color: var(--main-dark); }
        .ns-stat-remain .ns-stat-n { color: var(--main-dark); }
        .ns-stat-l { font-size: 11px; font-weight: 500; margin-top: 2px; }
        .ns-stat-total .ns-stat-l { color: var(--main); }
        .ns-stat-remain .ns-stat-l { color: var(--main); }
        .ns-stat-n.ns-bump { animation: ns-bump .35s cubic-bezier(.34,1.56,.64,1); }
        @keyframes ns-bump { 0% { transform: scale(1); } 40% { transform: scale(1.35); } 100% { transform: scale(1); } }

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
        }
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
          transition: color .1s, background .1s;
        }
        .ns-spin-item.ns-center {
          font-size: 21px;
          font-weight: 500;
          color: #111827;
          background: #fff;
          border: 1.5px solid #e5e7eb;
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
          position: absolute; top: 0; width: 8px; height: 8px; border-radius: 2px;
          pointer-events: none; z-index: 3; animation: ns-confettiFall linear forwards;
        }
        @keyframes ns-confettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(210px) rotate(540deg); opacity: 0; }
        }

        .ns-spin-btn-wrap { display: flex; gap: 8px; justify-content: center; margin-top: .75rem; }

        .ns-result-banner {
          text-align: center; padding: .9rem 1rem; border-radius: 8px;
          background: var(--main-light); border: 0.5px solid #C8102E55;
          margin-top: .75rem; animation: ns-pop .35s cubic-bezier(.34,1.56,.64,1);
        }
        .ns-result-banner .ns-name { font-size: 20px; font-weight: 500; color: var(--main-dark); }
        .ns-result-banner .ns-sub {
          font-size: 12px; color: var(--main); margin-top: 3px;
          font-weight: 500; text-transform: uppercase; letter-spacing: .06em;
        }
        @keyframes ns-pop { from { opacity: 0; transform: scale(.88); } to { opacity: 1; transform: scale(1); } }

        .ns-tag-wrap { display: flex; flex-wrap: wrap; gap: 5px; max-height: 110px; overflow-y: auto; margin-top: .75rem; }
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
        .ns-tag-delete svg { width: 10px; height: 10px; display: block; }

        .ns-summary-list { display: flex; flex-direction: column; gap: 6px; }
        .ns-summary-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          background: #f9fafb; border-radius: 8px; border: 0.5px solid #e5e7eb;
          animation: ns-slideIn .35s cubic-bezier(.34,1.56,.64,1) both;
        }
        .ns-summary-item .ns-num {
          font-size: 11px; font-weight: 500; color: #fff; background: var(--main);
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
          width: 36px; height: 36px; background: #fff2; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        .ns-header-title { font-size: 17px; font-weight: 500; }
        .ns-header-sub { font-size: 12px; opacity: .8; margin-top: 2px; }
        .ns-sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }
      `}</style>

      <div className="ns-app">
        <h2 className="ns-sr-only">
          Name spinner — paste names, spin to pick one randomly
        </h2>

        <div className="ns-header">
          <div className="ns-header-icon">🔄</div>
          <div>
            <div className="ns-header-title">Name Spinner</div>
            <div className="ns-header-sub">
              Paste names · Spin · Pick a winner
            </div>
          </div>
        </div>

        <div className="ns-card">
          <div className="ns-section-title">👥 Add names</div>
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
              + Add names
            </button>
            <button className="ns-btn ns-btn-danger" onClick={clearAll}>
              🗑
            </button>
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
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 2L10 10M10 2L2 10"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
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
              <div className="ns-stat-l">Total names</div>
            </div>
            <div className="ns-stat ns-stat-remain">
              <div className={"ns-stat-n" + (bumpRemain ? " ns-bump" : "")}>
                {remainCount}
              </div>
              <div className="ns-stat-l">Remaining</div>
            </div>
          </div>

          <div className={"ns-spinner-wrap" + (flash ? " ns-flash" : "")}>
            <div className="ns-spin-track">
              {displayItems.map((n, i) => (
                <div
                  key={i}
                  className={
                    "ns-spin-item" +
                    (winnerIdx !== undefined && i === 6
                      ? " ns-winner"
                      : i === 6
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
                className="ns-confetti"
                style={{
                  left: c.left + "%",
                  background: c.bg,
                  width: c.size,
                  height: c.size,
                  animationDuration: c.duration + "s",
                  animationDelay: c.delay + "s",
                }}
              />
            ))}
          </div>

          {showResult && (
            <div className="ns-result-banner">
              <div className="ns-name">{resultName}</div>
              <div className="ns-sub">🏆 Selected!</div>
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
              ▶ Spin
            </button>
            {selected.length > 0 && (
              <button
                className="ns-btn ns-btn-outline-red"
                onClick={resetSpins}
              >
                ↻ Reset
              </button>
            )}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="ns-card">
            <div className="ns-section-title">✅ Selected names</div>
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
