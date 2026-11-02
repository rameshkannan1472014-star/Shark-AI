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
  var AGENT_LABEL = { planner: "🧭 Planner", coder: "💻 Coder", reviewer: "🔍 Reviewer", deployer: "🚀 Deployer" };
  var log = $("log"), empty = $("empty");
  function agentBtn() {
    var b = $("agent-btn");
    b.textContent = agent ? (AGENT_LABEL[agent] || agent) : "Agent";
    b.classList.toggle("has", !!agent);
  }
  /* ---------- chat history (many chats, like ChatGPT) ---------- */
  function chats() { return store.get("shark-chats", []); }
  function saveChats(c) { store.set("shark-chats", c.slice(0, 30)); }
  var cid = store.get("shark-cid", null);
  function cur() { var c = chats().filter(function (x) { return x.id === cid; })[0]; return c || null; }
  function newChat() {
    var c = { id: "c" + Date.now().toString(36), title: "New chat", msgs: [], at: Date.now() };
    var all = chats(); all.unshift(c); saveChats(all);
    cid = c.id; store.set("shark-cid", cid);
    if (typeof log !== "undefined") { log.innerHTML = ""; empty.style.display = ""; }
    renderChatList();
    return c;
  }
  function persist(role, text) {
    var c = cur() || newChat();
    c.msgs.push({ r: role, t: String(text).slice(0, 3000), a: agent, tb: tab });
    if (c.title === "New chat" && role === "me") c.title = String(text).slice(0, 34);
    c.at = Date.now();
    var all = chats().map(function (x) { return x.id === c.id ? c : x; });
    saveChats(all); renderChatList();
  }
  function renderChatList() {
    var box = $("chat-list");
    if (!box) return;
    var all = chats();
    box.innerHTML = all.length ? all.map(function (c) {
      return '<button class="chat-row' + (c.id === cid ? " on" : "") + '" data-chat="' + c.id + '"><span>💬</span><span class="ct">' + esc(c.title) + "</span></button>";
    }).join("") : "<p style='font-size:12px;color:var(--muted)'>No chats yet.</p>";
  }
  function openChat(id) {
    cid = id; store.set("shark-cid", cid);
    var c = cur();
    log.innerHTML = "";
    if (!c || !c.msgs.length) { empty.style.display = ""; }
    else { empty.style.display = "none"; c.msgs.slice(-60).forEach(function (m) { paint(m.r, m.t); }); }
    renderChatList();
  }
  function paint(role, text) {
    var d = document.createElement("div");
    d.className = "msg " + role;
    var h = esc(text).replace(/```(\w*\n?)([\s\S]*?)```/g, function (_, l, c) { return "<pre><code>" + c.replace(/^\n/, "") + "</code></pre>"; });
    d.innerHTML = h.replace(/\n/g, "<br>");
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  }
  function say(role, text, nopersist) {
    empty.style.display = "none";
    var d = paint(role, text);
    if (!nopersist && (role === "me" || role === "ai") && !/^…$/.test(String(text)) && !/Catching breath/.test(String(text))) persist(role, text);
    return d;
  }
  var lastCall = 0;
  var TAB_BRIEF = { plan: "🧭 Planner", code: "💻 Coder", deploy: "🚀 Deployer", bugs: "🔍 Bug Hunter", launch: "📣 Launch Coach" };
  async function brain(prompt) {
    var gap = 31000 - (Date.now() - lastCall);
    if (gap > 0) {
      var w = say("ai", "Catching breath… answering in " + Math.ceil(gap / 1000) + "s (free AI limit).");
      await new Promise(function (r) { setTimeout(r, gap); });
      w.remove();
    }
    lastCall = Date.now();
    var sys = AGENT_PROMPT[agent] || TAB_PROMPT[tab];
    /* The Coder must return runnable single-file code in one fenced block. */
    if ((agent === "coder" || tab === "code") && /\b(build|make|create|generate|design|page|app|website|button|form)\b/i.test(prompt)) {
      sys += "\n\nIMPORTANT: answer with runnable single-file HTML in exactly one ```html fenced block, so it can be previewed.";
    }
    var r = await fetch("https://text.pollinations.ai/openai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model(), messages: [{ role: "system", content: sys }, { role: "user", content: String(prompt).slice(0, 2000) }], referrer: "shark-ai" })
    });
    if (!r.ok) throw new Error("busy");
    var d = await r.json();
    var c = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    if (!c) throw new Error("empty");
    return c.trim();
  }
  /* ---------- / commands + @ connectors ---------- */
  var COMMANDS = [
    { c: "/plan", d: "switch to Planner" },
    { c: "/code", d: "switch to Coder" },
    { c: "/deploy", d: "switch to Deployer" },
    { c: "/bugs", d: "switch to Bug Hunter" },
    { c: "/launch", d: "switch to Launch Coach" },
    { c: "/social", d: "switch to Social media agent" },
    { c: "/preview", d: "open the Preview" },
    { c: "/users", d: "set user count" },
    { c: "/new", d: "start a new chat" },
    { c: "/clear", d: "clear this chat" }
  ];
  var CONNECTORS = [
    { c: "@github", d: "attach a GitHub repo as context" },
    { c: "@preview", d: "attach current Preview code" }
  ];
  var attached = "";
  function renderSuggest() {
    var v = $("q").value, box = $("suggest");
    var m = v.match(/(\/\w*|@\w*)$/);
    if (!m) { box.hidden = true; return; }
    var frag = m[1].toLowerCase();
    var items = COMMANDS.concat(CONNECTORS).filter(function (x) { return x.c.toLowerCase().indexOf(frag) === 0; }).slice(0, 6);
    if (!items.length) { box.hidden = true; return; }
    box.innerHTML = items.map(function (x) { return '<button type="button" data-sg="' + x.c + '"><b>' + x.c + "</b><small>" + x.d + "</small></button>"; }).join("");
    box.hidden = false;
  }
  $("q").addEventListener("input", renderSuggest);
  $("suggest").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sg]");
    if (!b) return;
    pickSuggest(b.dataset.sg);
  });
  function pickSuggest(which) {
    var box = $("suggest"); box.hidden = true;
    if (which.charAt(0) === "/") { runCommand(which); return; }
    if (which === "@github") {
      listRepos(); openDrawer(true);
      say("ai", "Pick a repo from the menu — I'll keep it in context. Or paste `owner/repo` here.", true);
      pendingAt = true; return;
    }
    if (which === "@preview") {
      attached = lastCode ? "\n\n[Preview code attached:\n" + lastCode.slice(0, 1500) + "\n]" : "";
      say("ai", attached ? "Preview attached to your next message. What should I change?" : "Preview is empty — ask me to build something first.", true);
      return;
    }
  }
  var pendingAt = false;
  function runCommand(cmd) {
    var c = cmd.toLowerCase();
    if (c === "/new") { newChat(); return true; }
    if (c === "/clear") { if (cur()) { cur().msgs = []; var all = chats().map(function (x) { return x.id === cid ? cur() : x; }); saveChats(all); } log.innerHTML = ""; empty.style.display = ""; return true; }
    if (c === "/preview") { show("pv"); return true; }
    if (c === "/users") { setUsers(); return true; }
    var map = { "/plan": "plan", "/code": "code", "/deploy": "deploy", "/bugs": "bugs", "/launch": "launch", "/social": "social" };
    if (map[c]) {
      tab = map[c] === "social" ? "launch" : map[c];
      agent = map[c]; agentBtn();
      say("ai", "Switched to **" + c.slice(1) + "**. Ask me your question.", true);
      return true;
    }
    return false;
  }
  /* ---------- settings sheet ---------- */
  var sSheet = null;
  function model() { return store.get("shark-model", "openai"); }
  var sSheet = null;
  function ensureSettings() {
    if (sSheet) return sSheet;
    sSheet = document.createElement("div");
    sSheet.className = "sheet"; sSheet.hidden = true;
    sSheet.innerHTML = '<div class="sheet-card">' +
      '<button data-s="theme" type="button">🌙 Theme <small id="s-theme-v"></small></button>' +
      '<button data-s="model" type="button">🧠 AI model <small id="s-model-v"></small></button>' +
      '<button data-s="goal" type="button">🎯 User goal <small id="s-goal-v"></small></button>' +
      '<button data-s="clear" type="button">🧹 Clear all chats <small></small></button>' +
      '</div>';
    document.querySelector(".app").appendChild(sSheet);
    sSheet.addEventListener("click", function (e) {
      if (e.target === sSheet) { sSheet.hidden = true; return; }
      var b = e.target.closest("[data-s]");
      if (!b) return;
      settingsAction(b.dataset.s);
      sSheet.hidden = true;
    });
    return sSheet;
  }
  function theme() { return store.get("shark-theme", "dark"); }
  function applyTheme() {
    document.body.classList.toggle("light", theme() === "light");
  }
  function settingsAction(k) {
    if (k === "theme") { store.set("shark-theme", theme() === "dark" ? "light" : "dark"); applyTheme(); }
    if (k === "model") {
      var m = prompt("AI model (openai, mistral, llama, qwen):", model());
      if (m) store.set("shark-model", m.trim().toLowerCase() || "openai");
    }
    if (k === "goal") setUsers();
    if (k === "clear") { saveChats([]); cid = null; store.set("shark-cid", null); newChat(); }
  }

  function send(forceAgent) {
    var input = $("q"), text = input.value.trim();
    if (!text) return;
    input.value = ""; if ($("suggest")) $("suggest").hidden = true;
    if (forceAgent) agent = forceAgent;
    if (/^\//.test(text) && runCommand(text.split(/\s/)[0])) return;
    if (pendingAt && /^[\w-]+\/[\w.-]+$/.test(text)) {
      pendingAt = false;
      attachRepo(text); return;
    }
    if (attached) { text = text + attached; attached = ""; }
    /* 'build/make/create X' always goes to the Coder, whatever the tab. */
    if (!agent && /\b(build|make|create|generate|design)\b/i.test(text)) agent = "coder";
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
  document.addEventListener("click", function (e) {
    if (e.target.closest("#open-settings")) { ensureSettings(); sSheet.hidden = false; openDrawer(false); }
  });
  function learn(text, reply) {
    var t = text.toLowerCase();
    if (tab === "plan" && /plan|feature|user/.test(t)) store.set("shark-stage-plan", true);
    if (tab === "deploy" && /live|deployed|github\.io|vercel|render/.test(t + " " + reply.toLowerCase())) store.set("shark-stage-deploy", true);
    if (tab === "launch" && /posted|shared|users|signup/.test(t)) store.set("shark-users", Math.min(GOAL, goal() + 10));
    renderStages(); renderGoal();
    /* If the Coder wrote a file, preview it as a proposal: apply only if ok. */
    var fence = reply.match(/```\w*\n?([\s\S]*?)```/);
    var code = fence ? fence[1].trim() : "";
    /* No fence? Maybe the Coder returned raw HTML — accept it if it looks like markup. */
    if ((!code || code.length < 40) && /<\s*(h1|div|p|button|section|main|style|html)\b/i.test(reply)) {
      var raw = reply.replace(/^[^<]*/, "").trim();
      if (raw.length > 40) code = raw.slice(0, 4000);
    }
    if (code && code.length > 20) {
      setProposal(code);
      show("pv");
      say("ai", "Previewing the changes above 👆 — Apply if it looks right, or tell me what's wrong.", true);
    }
  }

  /* ---------- social media agent ---------- */
  TAB_PROMPT.social = "You are Shark's Social Media agent for a small agency. Write ready-to-post content: hook first line, short body, 5 hashtags, best time to post in IST. Ask which platform (Instagram, YouTube Shorts, X) if unclear. Keep it punchy.";
  AGENT_PROMPT.social = TAB_PROMPT.social;
  AGENT_LABEL.social = "📣 Social";

  /* ---------- attach a GitHub repo as context ---------- */
  async function attachRepo(full) {
    say("me", "@github " + full);
    var typing = say("ai", "…");
    try {
      var info = await gh("/repos/" + full);
      var tree = await gh("/repos/" + full + "/contents/");
      var files = (Array.isArray(tree) ? tree : []).slice(0, 25).map(function (f) { return f.name; }).join(", ");
      var ctx = "\n\n[Repo context: " + info.full_name + " — " + (info.description || "no description") + ". Top files: " + files + "]";
      typing.remove();
      brain("Repo attached: " + info.full_name + ". What do you want to do with it?");
      var input = $("q");
      attached = ctx;
      say("ai", "Got **" + info.full_name + "** (" + files.split(",").length + " files listed). What should I do with it — review, fix, or add a feature?", true);
    } catch (_) {
      typing.textContent = "Couldn't read that repo. Check the name, or connect GitHub with a token first.";
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

  document.addEventListener("click", function (e) {
    if (e.target.closest("#pv-keep")) { lastCode && persist("ai", "Applied preview (" + lastCode.split(/\n/).length + " lines)."); clearProposal(); say("ai", "Applied. ✓ Tell me the next change.", true); show("pv"); }
    if (e.target.closest("#pv-drop")) { lastCode = ""; runPreview(); clearProposal(); show("chat"); say("ai", "Discarded. Tell me what to change.", true); }
  });

  /* ---------- + sheet ---------- */
  var pSheet = $("plus-sheet");
  $("plus-btn").addEventListener("click", function () { pSheet.hidden = false; });
  pSheet.addEventListener("click", function (e) {
    if (e.target === pSheet) { pSheet.hidden = true; return; }
    if (e.target.closest("#p-paste")) {
      var pasted = prompt("Paste the code to preview:");
      if (pasted) { lastCode = pasted; show("pv"); runPreview(); }
    }
    if (e.target.closest("#p-users")) setUsers();
    if (e.target.closest("#p-clear")) { log.innerHTML = ""; empty.style.display = ""; }
    pSheet.hidden = true;
  });

  /* ---------- preview: show new code as a proposal first ---------- */
  var lastCode = "", proposed = "";
  function setProposal(code) {
    proposed = code;
    $("pv-apply-txt").textContent = "✨ " + code.split(/\n/).length + " lines ready — previewing. Apply to keep.";
    $("pv-apply").hidden = false;
    lastCode = code;
    runPreview();
  }
  function clearProposal() { proposed = ""; $("pv-apply").hidden = true; }
  function runPreview() {
    var frame = $("pv-frame"), ph = $("pv-empty");
    if (!lastCode.trim()) { frame.hidden = true; frame.removeAttribute("srcdoc"); if (ph) ph.hidden = false; return; }
    var html = lastCode;
    if (!/<html/i.test(html)) html = "<!DOCTYPE html><html><body>" + html + "</body></html>";
    frame.srcdoc = html;
    frame.hidden = false;
    if (ph) ph.hidden = true;
  }

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

  renderGoal(); renderStages(); renderStatus(); applyTheme();
  if (!cur()) newChat(); else openChat(cid);
  runPreview();
})();
