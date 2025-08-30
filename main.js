const form = document.getElementById("countdownForm");
const timersContainer = document.getElementById("timers");
const alarmSound = document.getElementById("alarmSound");

let allTimers = [];             // [{ id, name, targetTs, important, completed, createdAt }]
let currentFilter = "recent";   // "recent" | "important" | "completed"

// --- Create timer from form ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("eventName").value.trim();
  const dateVal = document.getElementById("eventDate").value;

  const target = new Date(dateVal);
  if (!name || !dateVal || isNaN(target.getTime())) {
    alert("Please enter a valid event name and date/time.");
    return;
  }
  if (target <= new Date()) {
    alert("Please choose a future date/time!");
    return;
  }

  const timerObj = {
    id: Date.now() + Math.random().toString(16).slice(2),
    name,
    targetTs: target.getTime(),
    important: false,
    completed: false,
    createdAt: Date.now(),
  };

  allTimers.unshift(timerObj); // newest first
  renderTimers();              // render without creating per-card intervals
  form.reset();
});

// --- Render based on currentFilter ---
function renderTimers(filter = currentFilter) {
  currentFilter = filter;
  markActiveFilterButton();

  timersContainer.innerHTML = "";

  let list = [...allTimers];

  if (filter === "important") {
    list = list.filter(t => t.important && !t.completed);
  } else if (filter === "completed") {
    list = list.filter(t => t.completed);
  }
  // "recent" = all, already newest first

  for (const t of list) {
    const card = document.createElement("div");
    card.className = "timer-card";
    if (t.completed) card.classList.add("completed");
    card.dataset.id = t.id;

    card.innerHTML = `
      <div class="timer-header">
        <h3 class="timer-title" title="${t.name}">${escapeHtml(t.name)}</h3>
        <div class="badges">
          ${t.important && !t.completed ? `<span class="badge">⭐ Important</span>` : ""}
          ${t.completed ? `<span class="badge">✅ Completed</span>` : ""}
        </div>
      </div>

      <div class="time">
        <div><p class="days">00</p><span>Days</span></div>
        <div><p class="hours">00</p><span>Hours</span></div>
        <div><p class="minutes">00</p><span>Minutes</span></div>
        <div><p class="seconds">00</p><span>Seconds</span></div>
      </div>

      <p class="endMsg">🎉 Time’s Up! 🎉</p>

      <div class="actions">
        <button class="btn btn-important">${t.important ? "⭐ Unmark" : "☆ Mark Important"}</button>
        <button class="btn btn-delete">🗑 Delete</button>
      </div>
    `;

    // Attach events
    card.querySelector(".btn-important").addEventListener("click", () => {
      t.important = !t.important;
      renderTimers(); // re-render view only (no extra intervals)
    });

    card.querySelector(".btn-delete").addEventListener("click", () => {
      allTimers = allTimers.filter(x => x.id !== t.id);
      renderTimers();
    });

    timersContainer.appendChild(card);
  }

  // Immediately update the displayed times once after render (no 1s delay)
  tickOnce();
}

// --- Global tick: update all cards once per second (prevents flicker/duplicates) ---
function tickOnce() {
  const now = Date.now();

  let needsRerender = false;

  for (const t of allTimers) {
    const diff = t.targetTs - now;

    // If just completed this tick
    if (diff <= 0 && !t.completed) {
      t.completed = true;
      triggerCompleteEffects(t.id);
      needsRerender = true; // so filters update (e.g., remove from Important)
    }

    // Update UI for the card if visible
    const card = document.querySelector(`.timer-card[data-id="${t.id}"]`);
    if (card) updateCardTime(card, Math.max(0, diff), t.completed);
  }

  if (needsRerender) {
    renderTimers(); // safe: we don't create per-timer intervals
  }
}

setInterval(tickOnce, 1000);

// --- Helpers ---
function updateCardTime(card, ms, isCompleted) {
  const daysEl = card.querySelector(".days");
  const hoursEl = card.querySelector(".hours");
  const minutesEl = card.querySelector(".minutes");
  const secondsEl = card.querySelector(".seconds");
  const endMsg = card.querySelector(".endMsg");

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  daysEl.textContent = String(days).padStart(2, "0");
  hoursEl.textContent = String(hours).padStart(2, "0");
  minutesEl.textContent = String(minutes).padStart(2, "0");
  secondsEl.textContent = String(seconds).padStart(2, "0");

  if (isCompleted) {
    endMsg.style.display = "block";
    card.classList.add("completed", "flash", "shake");
  } else {
    endMsg.style.display = "none";
    card.classList.remove("flash", "shake");
  }
}

function triggerCompleteEffects(id) {
  // Try playing alarm; if blocked or fails, use WebAudio fallback beep.
  const p = alarmSound?.play?.();
  if (p && typeof p.then === "function") {
    p.catch(() => beepFallback());
  } else {
    // If play() not available or returned non-promise
    try { alarmSound.play(); } catch { beepFallback(); }
  }
}

function beepFallback() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // ignore if not supported
  }
}

function markActiveFilterButton() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === currentFilter);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}

// Initial render
renderTimers();
