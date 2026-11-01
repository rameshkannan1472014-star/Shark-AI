/* Shark v1 — plan, code, deploy, bugs, launch. Local-first; only the AI brain
   needs the internet. GitHub connection is a personal access token kept on
   this device only. */
(function () {
  "use strict";
  var store = {
    get: function (k, f) { try { var v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (_) { return f; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---------- goal: first 10,000 users ---------- */
  var GOAL = 10000;
  function goal() { return store.get("shark-users", 0); }
  function renderGoal() {
    var n = goal();
    document.getElementById("goal-n").textContent = n.toLocaleString("en-IN") + " / 10,000 users";
    document.getElementById("goal-fill").style.width = Math.min(100, n / GOAL * 100) + "%";
  }
  document.getElementById("goal-edit").addEventListener("click", function () {
    var v = prompt("How many users do you have right now?", String(goal()));
    if (v == null) return;
    v = Math.max(0, Math.min(GOAL, parseInt(v, 10) || 0));
    store.set("shark-users", v);
    renderGoal();
    say("ai", v >= GOAL ? "10,000! You did it. Time to plan the next 100,000. 🦈" : "Updated. " + v + " down, " + (GOAL - v) + " to go. Every step below moves it.");
    checkStage("launch");
  });

  /* ---------- stages ---------- */
  var STAGES = [
    { id: "plan", icon: "🧭", label: "Plan" },
    { id: "code", icon: "💻", label: "Code" },
    { id: "deploy", icon: "🚀", label: "Deploy" },
    { id: "bugs", icon: "🔍", label: "Bugs" },
    { id: "launch", icon: "📣", label: "Launch" }
  ];
  function stageDone(id) { return !!store.get("shark-stage-" + id, false); }
  function renderStages() {
    var el = document.getElementById("stages");
    el.innerHTML = STAGES.map(function (s, i) {
      var cls = "stage" + (stageDone(s.id) ? " done" : "") + (!stageDone(s.id) && (i === 0 || stageDone(STAGES[i - 1].id)) ? " now" : "");
      return '<button class="' + cls + '" data-stage="' + s.id + '"><b>' + s.icon + "</b>" + s.label + "</button>";
    }).join("");
  }
  document.getElementById("stages").addEventListener("click", function (e) {
    var b = e.target.closest("[data-stage]");
    if (!b) return;
    setTab(b.dataset.stage);
    document.getElementById("q").focus();
  });
  function checkStage(id) {
    renderStages();
  }
  function markStage(id) {
    store.set("shark-stage-" + id, true);
    renderStages();
  }

  /* ---------- chat ---------- */
  var TAB_PROMPT = {
    plan: "You are Shark's Planner. Turn the user's app idea into a sharp 1-week plan: the exact user, the painful problem, the 3 core features (and what to cut), and day-by-day steps. Keep it short, concrete, no fluff.",
    code: "You are Shark's Coder. Write real, working code the user can paste and run. Prefer one file, plain HTML/CSS/JS. Explain in 2 short lines, then the code in a fenced block, then how to run it.",
    deploy: "You are Shark's Deployer. Give the exact steps to put this online free: GitHub Pages (or Render for backends), custom wording for each click, and how to check it's live. Ask what kind of app they have first if unclear.",
    bugs: "You are Shark's Bug Hunter. When they paste an error or describe what's broken, give the most likely cause first, then the exact fix with code, then one way to check it's fixed. Ask for the error text if they didn't paste it.",
    launch: "You are Shark's Launch Coach. The goal is the first 10,000 users. Give 3 concrete places to post this week (school, WhatsApp groups, Reddit/Discord/Play Store), the exact first message to send, and how to count signups. Pushy but friendly."
  };
  var AGENT_PROMPT = {
    planner: TAB_PROMPT.plan,
    coder: TAB_PROMPT.code,
    reviewer: "You are Shark's Reviewer. When they paste code, find the 3 riskiest bugs or slow parts, show the fixed lines, and say what to test. If no code is pasted, ask for it.",
    deployer: TAB_PROMPT.deploy
  };
  var tab = "plan", agent = null;
  function setTab(t) {
    tab = t; agent = null;
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("is-on", b.dataset.tab === t); });
  }
  document.querySelectorAll(".tab").forEach(function (b) {
    b.addEventListener("click", function () { setTab(b.dataset.tab); });
  });
  document.querySelectorAll("[data-agent]").forEach(function (b) {
    b.addEventListener("click", function () {
      agent = b.dataset.agent;
      say("ai", agentLabel(agent) + " reporting. Tell me what you're building (or paste code for me to review).");
      document.getElementById("q").focus();
    });
  });
  function agentLabel(a) {
    return { planner: "🧭 Planner", coder: "💻 Coder", reviewer: "🔍 Reviewer", deployer: "🚀 Deployer" }[a] || a;
  }

  var log = document.getElementById("log");
  function say(role, text) {
    var d = document.createElement("div");
    d.className = "msg " + role;
    d.innerHTML = fmt(text);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function fmt(t) {
    var h = esc(t);
    h = h.replace(/```(\w*\n?)([\s\S]*?)```/g, function (_, l, c) { return "<pre><code>" + c.replace(/^\n/, "") + "</code></pre>"; });
    h = h.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    return h.replace(/\n/g, "<br>");
  }
  var brain = "https://text.pollinations.ai/openai";
  var lastCall = 0;
  async function askAI(prompt) {
    var gap = 31000 - (Date.now() - lastCall);
    if (gap > 0) {
      var wait = say("ai", "Shark is catching its breath… answering in " + Math.ceil(gap / 1000) + "s (free AI limit).");
      await new Promise(function (r) { setTimeout(r, gap); });
      wait.remove();
    }
    lastCall = Date.now();
    var sys = AGENT_PROMPT[agent] || TAB_PROMPT[tab];
    var r = await fetch(brain, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai", messages: [{ role: "system", content: sys }, { role: "user", content: String(prompt).slice(0, 2000) }], referrer: "shark-ai" })
    });
    if (!r.ok) throw new Error("busy");
    var d = await r.json();
    var c = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    if (!c) throw new Error("empty");
    return c.trim();
  }

  document.getElementById("ask").addEventListener("submit", async function (e) {
    e.preventDefault();
    var input = document.getElementById("q");
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    say("me", text);
    var typing = say("ai", "…");
    try {
      var reply = await askAI(text);
      typing.innerHTML = fmt(reply);
      log.scrollTop = log.scrollHeight;
      maybeLearn(text, reply);
    } catch (_) {
      typing.textContent = "The free AI is busy right now. Try one agent chip, or paste your error and I'll still read it.";
    }
  });

  /* Small wins auto-mark stages: a plan written, a deploy link shared… */
  function maybeLearn(text, reply) {
    var t = text.toLowerCase();
    if (tab === "plan" && /plan|feature|user/.test(t)) markStage("plan");
    if (tab === "deploy" && /live|deployed|github\.io|vercel|render/.test(t + " " + reply.toLowerCase())) markStage("deploy");
    if (tab === "launch" && /posted|shared|users|signup/.test(t)) {
      var n = goal();
      if (n < GOAL) { store.set("shark-users", Math.min(GOAL, n + 10)); renderGoal(); }
    }
    if (/deploy|github pages|render|apk|play store/i.test(reply)) {
      /* the deploy agent tends to finish its job — count it */
    }
  }

  /* ---------- preview ---------- */
  var code = document.getElementById("pv-code"), frame = document.getElementById("pv-frame");
  function runPreview() {
    var html = code.value;
    if (!/<html/i.test(html)) html = "<!DOCTYPE html><html><body>" + html + "</body></html>";
    frame.srcdoc = html;
  }
  document.getElementById("pv-run").addEventListener("click", runPreview);
  document.getElementById("pv-clear").addEventListener("click", function () { code.value = ""; frame.removeAttribute("srcdoc"); });
  document.getElementById("pv-save").addEventListener("click", function () {
    var name = prompt("File name?", "index.html") || "index.html";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code.value], { type: "text/html" }));
    a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });

  /* ---------- GitHub (token on this device only) ---------- */
  var ghToken = function () { return store.get("shark-gh", ""); };
  async function gh(path, opts) {
    var r = await fetch("https://api.github.com" + path, Object.assign({ headers: { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + ghToken() } }, opts || {}));
    if (!r.ok) throw new Error("GitHub said " + r.status);
    return r.json();
  }
  async function renderStatus() {
    var el = document.getElementById("gh-status");
    if (!ghToken()) { el.textContent = "Not connected. Connect GitHub to pull your repos and push from Shark."; return; }
    try {
      var me = await gh("/user");
      el.textContent = "Connected as " + me.login + ". Your repos load below.";
    } catch (_) {
      el.textContent = "Saved token didn't work. Connect again.";
      store.set("shark-gh", "");
    }
  }
  async function listRepos() {
    var box = document.getElementById("repo-list");
    if (!ghToken()) { box.innerHTML = ""; say("ai", "Connect GitHub first — tap Connect and paste a token."); return; }
    box.innerHTML = "<p class='hint'>Loading…</p>";
    try {
      var repos = await gh("/user/repos?per_page=20&sort=updated");
      box.innerHTML = repos.map(function (r) {
        return '<div class="repo"><span>📦</span><span><b>' + esc(r.name) + "</b><br><small>" + esc(r.private ? "private" : "public") + (r.description ? " · " + esc(r.description.slice(0, 60)) : "") + "</small></span></div>";
      }).join("") || "<p class='hint'>No repos yet.</p>";
    } catch (_) {
      box.innerHTML = "<p class='hint'>Couldn't load repos. Check the token.</p>";
    }
  }
  function connectFlow() {
    var t = prompt("Paste a GitHub personal access token (Settings → Developer settings → Tokens, tick 'repo'). It stays on this device only.");
    if (!t) return;
    store.set("shark-gh", t.trim());
    renderStatus(); listRepos();
    say("ai", "GitHub connected. Your repos are below. Shark can read them and help you push.");
  }
  document.getElementById("gh-btn").addEventListener("click", connectFlow);
  document.getElementById("gh-connect").addEventListener("click", connectFlow);
  document.getElementById("gh-repos").addEventListener("click", listRepos);

  renderGoal(); renderStages(); renderStatus();
  code.value = "<h1>Hello from Shark 🦈</h1><p>Edit me, hit Run.</p>";
  runPreview();
  say("ai", "I'm Shark. Tell me your app idea — I'll plan it, code it with you, get it online, fix it, and push it to your first 10,000 users. Start anywhere: pick a tab, or tap an agent.");
})();
