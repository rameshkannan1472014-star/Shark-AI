/* Shark v3 — Ramesh's layout: menu · Chat | Preview on top, logo in the
   middle, "Let's build" composer with + · Agent · send at the bottom. */
(function () {
  "use strict";
  var store = {
    get: function (k, f) { try { var v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (_) { return f; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- drawer ---------- */
  var drawer = $("drawer"), scrim = $("scrim");
  function openDrawer(o) { drawer.classList.toggle("open", o); scrim.classList.toggle("show", o); }
  $("menu-btn").addEventListener("click", function () { openDrawer(true); });
  scrim.addEventListener("click", function () { openDrawer(false); });

  /* ---------- Chat | Preview ---------- */
  function show(view) {
    $("view-chat").hidden = view !== "chat";
    $("view-pv").hidden = view !== "pv";
    $("seg-chat").classList.toggle("on", view === "chat");
    $("seg-pv").classList.toggle("on", view === "pv");
  }
  $("seg-chat").addEventListener("click", function () { show("chat"); });
  $("seg-pv").addEventListener("click", function () { show("pv"); });

  /* ---------- goal ---------- */
  var GOAL = 10000;
  function goal() { return store.get("shark-users", 0); }
  function renderGoal() {
    var n = goal();
    $("goal-n").textContent = n.toLocaleString("en-IN") + " / 10,000 users";
    $("goal-fill").style.width = Math.min(100, n / GOAL * 100) + "%";
  }
  function setUsers() {
    var v = prompt("How many users do you have right now?", String(goal()));
    if (v == null) return;
    v = Math.max(0, Math.min(GOAL, parseInt(v, 10) || 0));
    store.set("shark-users", v);
    renderGoal();
    say("ai", v >= GOAL ? "10,000! You did it. Time to plan the next 100,000. 🦈" : "Updated — " + v + " down, " + (GOAL - v) + " to go.");
  }
  $("goal-edit").addEventListener("click", setUsers);

  /* ---------- stages ---------- */
  var STAGES = [
    { id: "plan", icon: "🧭", label: "Plan" },
    { id: "code", icon: "💻", label: "Code" },
    { id: "deploy", icon: "🚀", label: "Deploy" },
    { id: "bugs", icon: "🔍", label: "Bugs" },
    { id: "launch", icon: "📣", label: "Launch" }
  ];
  var tab = "plan";
  function done(id) { return !!store.get("shark-stage-" + id, false); }
  function renderStages() {
    $("stages").innerHTML = STAGES.map(function (s, i) {
      var cls = "stage" + (done(s.id) ? " done" : "") + (!done(s.id) && (i === 0 || done(STAGES[i - 1].id)) ? " now" : "");
      return '<button class="' + cls + '" data-stage="' + s.id + '"><b>' + s.icon + "</b>" + s.label + "</button>";
    }).join("");
  }
  $("stages").addEventListener("click", function (e) {
    var b = e.target.closest("[data-stage]");
    if (!b) return;
    tab = b.dataset.stage; agent = null; agentBtn();
    openDrawer(false);
    say("ai", "Switched to **" + b.dataset.stage + "**. Ask me your question.");
    $("q").focus();
  });

  /* ---------- chat ---------- */
  var TAB_PROMPT = {
    plan: "You are Shark's Planner. Turn the idea into a sharp 1-week plan: the exact user, the painful problem, the 3 core features (and what to cut), day-by-day steps. Short, concrete, no fluff.",
    code: "You are Shark's Coder. Write real working code the user can paste and run. One file, plain HTML/CSS/JS. Two short lines, then a fenced code block, then how to run it.",
    deploy: "You are Shark's Deployer. Exact steps to put this online free: GitHub Pages (or Render for backends), each click, how to check it's live. Ask what kind of app first if unclear.",
    bugs: "You are Shark's Bug Hunter. Most likely cause first, then the exact fix with code, then how to check. Ask for the error text if missing.",
    launch: "You are Shark's Launch Coach. Goal: first 10,000 users. 3 concrete places to post this week, the exact first message, how to count signups. Pushy but friendly."
  };
  var AGENT_PROMPT = {
    planner: TAB_PROMPT.plan, coder: TAB_PROMPT.code, deployer: TAB_PROMPT.deploy,
    reviewer: "You are Shark's Reviewer. When code is pasted, find the 3 riskiest bugs or slow parts, show fixed lines, say what to test. If no code, ask for it."
  };
  var agent = null;
  var log = $("log"), empty = $("empty");
  function agentBtn() {
    var b = $("agent-btn");
    b.textContent = agent ? { planner: "🧭 Planner", coder: "💻 Coder", reviewer: "🔍 Reviewer", deployer: "🚀 Deployer" }[agent] : "Agent";
    b.classList.toggle("has", !!agent);
  }
  function say(role, text) {
    empty.style.display = "none";
    var d = document.createElement("div");
    d.className = "msg " + role;
    var h = esc(text).replace(/```(\w*\n?)([\s\S]*?)```/g, function (_, l, c) { return "<pre><code>" + c.replace(/^\n/, "") + "</code></pre>"; });
    d.innerHTML = h.replace(/\n/g, "<br>");
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  var lastCall = 0;
  async function brain(prompt) {
    var gap = 31000 - (Date.now() - lastCall);
    if (gap > 0) {
      var w = say("ai", "Catching breath… answering in " + Math.ceil(gap / 1000) + "s (free AI limit).");
      await new Promise(function (r) { setTimeout(r, gap); });
      w.remove();
    }
    lastCall = Date.now();
    var r = await fetch("https://text.pollinations.ai/openai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai", messages: [{ role: "system", content: AGENT_PROMPT[agent] || TAB_PROMPT[tab] }, { role: "user", content: String(prompt).slice(0, 2000) }], referrer: "shark-ai" })
    });
    if (!r.ok) throw new Error("busy");
    var d = await r.json();
    var c = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    if (!c) throw new Error("empty");
    return c.trim();
  }
  function send() {
    var input = $("q"), text = input.value.trim();
    if (!text) return;
    input.value = "";
    say("me", text);
    var typing = say("ai", "…");
    brain(text).then(function (reply) {
      var h = esc(reply).replace(/```(\w*\n?)([\s\S]*?)```/g, function (_, l, c) { return "<pre><code>" + c.replace(/^\n/, "") + "</code></pre>"; });
      typing.innerHTML = h.replace(/\n/g, "<br>");
      log.scrollTop = log.scrollHeight;
      learn(text, reply);
    }).catch(function () {
      typing.textContent = "The free AI is busy. Try again in a bit — or paste your error and I'll still read it.";
    });
  }
  $("send-btn").addEventListener("click", send);
  $("q").addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
  function learn(text, reply) {
    var t = text.toLowerCase();
    if (tab === "plan" && /plan|feature|user/.test(t)) store.set("shark-stage-plan", true);
    if (tab === "deploy" && /live|deployed|github\.io|vercel|render/.test(t + " " + reply.toLowerCase())) store.set("shark-stage-deploy", true);
    if (tab === "launch" && /posted|shared|users|signup/.test(t)) store.set("shark-users", Math.min(GOAL, goal() + 10));
    renderStages(); renderGoal();
    /* If the Coder wrote a file, offer it in Preview. */
    var m = reply.match(/```(?:html)?\n([\s\S]*?)```/);
    if (m && m[1].trim().length > 40) {
      $("pv-code").value = m[1].trim();
      show("pv");
      runPreview();
    }
  }

  /* ---------- agent sheet ---------- */
  var aSheet = $("agent-sheet");
  $("agent-btn").addEventListener("click", function () { aSheet.hidden = false; });
  aSheet.addEventListener("click", function (e) {
    if (e.target === aSheet) { aSheet.hidden = true; return; }
    var b = e.target.closest("[data-agent]");
    if (!b) return;
    agent = b.dataset.agent || null;
    agentBtn();
    aSheet.hidden = true;
    if (agent) say("ai", "Agent set: **" + b.textContent.trim().split(" ")[0] + "**. What are we building?");
  });

  /* ---------- + sheet ---------- */
  var pSheet = $("plus-sheet");
  $("plus-btn").addEventListener("click", function () { pSheet.hidden = false; });
  pSheet.addEventListener("click", function (e) {
    if (e.target === pSheet) { pSheet.hidden = true; return; }
    if (e.target.closest("#p-paste")) { show("pv"); $("pv-code").focus(); }
    if (e.target.closest("#p-users")) setUsers();
    if (e.target.closest("#p-clear")) { log.innerHTML = ""; empty.style.display = ""; }
    pSheet.hidden = true;
  });

  /* ---------- preview ---------- */
  function runPreview() {
    var html = $("pv-code").value;
    if (!/<html/i.test(html)) html = "<!DOCTYPE html><html><body>" + html + "</body></html>";
    $("pv-frame").srcdoc = html;
  }
  $("pv-run").addEventListener("click", runPreview);
  $("pv-clear").addEventListener("click", function () { $("pv-code").value = ""; $("pv-frame").removeAttribute("srcdoc"); });
  $("pv-save").addEventListener("click", function () {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([$("pv-code").value], { type: "text/html" }));
    a.download = (prompt("File name?", "index.html") || "index.html");
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });

  /* ---------- GitHub ---------- */
  function token() { return store.get("shark-gh", ""); }
  async function gh(path) {
    var r = await fetch("https://api.github.com" + path, { headers: { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + token() } });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  async function renderStatus() {
    if (!token()) { $("gh-status").textContent = "Not connected."; return; }
    try { var me = await gh("/user"); $("gh-status").textContent = "Connected as " + me.login + "."; $("dr-user").textContent = me.login; }
    catch (_) { $("gh-status").textContent = "Token didn't work. Connect again."; store.set("shark-gh", ""); }
  }
  function connectFlow() {
    var t = prompt("Paste a GitHub token (Settings → Developer settings → Tokens, tick 'repo'). Stays on this device only.");
    if (!t) return;
    store.set("shark-gh", t.trim());
    renderStatus(); listRepos();
  }
  async function listRepos() {
    var box = $("repo-list");
    if (!token()) { say("ai", "Connect GitHub first — open the menu and tap Connect."); openDrawer(true); return; }
    box.innerHTML = "<p style='font-size:12px;color:var(--muted)'>Loading…</p>";
    try {
      var repos = await gh("/user/repos?per_page=20&sort=updated");
      box.innerHTML = repos.map(function (r) {
        return '<div class="repo">📦 <b>' + esc(r.name) + "</b> <small>" + (r.private ? "private" : "public") + "</small></div>";
      }).join("") || "<p style='font-size:12px'>No repos.</p>";
    } catch (_) { box.innerHTML = "<p style='font-size:12px'>Couldn't load. Check the token.</p>"; }
  }
  $("gh-connect").addEventListener("click", connectFlow);
  $("gh-repos").addEventListener("click", listRepos);

  renderGoal(); renderStages(); renderStatus();
  $("pv-code").value = "<h1>Hello from Shark 🦈</h1><p>Edit me, hit Run.</p>";
  runPreview();
})();
