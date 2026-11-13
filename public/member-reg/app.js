(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TOTAL = 4;
  const PHOTOS = 5;
  const ROLE_LABELS = { member: "Member", media: "Media", player: "Player" };
  const HOBBIES = ["Robotics", "Gaming", "Coding", "Drawing", "Music", "Sports", "Reading", "Photography"];
  const LIKES = ["Anime", "Movies", "Coffee", "Tech gadgets", "Pets", "K-pop", "Space", "Basketball"];
  const state = { step: 1, photos: [], files: [], hobbies: new Set(), likes: new Set(), role: "" };

  const screens = { welcome: $("#welcome"), flow: $("#flow"), done: $("#done") };
  const show = (name) => {
    Object.values(screens).forEach((s) => s.classList.remove("is-active"));
    screens[name].classList.add("is-active");
    document.body.dataset.screen = name;
    window.scrollTo({ top: 0 });
    updatePreview();
  };

  const val = (id) => $("#" + id).value.trim();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{3,19}$/;
  const genderVal = () => ($('input[name="gender"]:checked') || {}).value || "";
  const yearVal = () => ($('input[name="year"]:checked') || {}).value || "";

  function parseBirthday(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(v + "T00:00:00");
    return isNaN(d) ? null : d;
  }
  const todayStr = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

  /* ---------- custom program dropdown (native <select> stays as the form value) ---------- */
  const ddSel = $("#program"), ddBtn = $("#programBtn"), ddPanel = $("#programPanel"), ddText = $("#programText");
  const ddOpts = [];
  const TICK = '<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  [...ddSel.children].forEach((node) => {
    if (node.tagName === "OPTGROUP") {
      const g = document.createElement("div"); g.className = "dd-group"; g.setAttribute("role", "presentation"); g.textContent = node.label;
      ddPanel.append(g);
      [...node.children].forEach((o) => addOpt(o.value || o.textContent));
    }
  });
  function addOpt(value) {
    const el = document.createElement("div");
    el.className = "dd-opt"; el.id = "ddopt-" + ddOpts.length; el.setAttribute("role", "option"); el.setAttribute("aria-selected", "false");
    el.dataset.value = value;
    const i = value.indexOf(" in ");
    const label = document.createElement("span");
    if (i > -1) { const pre = document.createElement("span"); pre.className = "pre"; pre.textContent = value.slice(0, i + 4); label.append(pre, document.createTextNode(value.slice(i + 4))); }
    else label.textContent = value;
    el.append(label); el.insertAdjacentHTML("beforeend", TICK);
    el.addEventListener("pointermove", () => setActive(ddOpts.indexOf(el), false));
    el.addEventListener("click", () => { pick(el.dataset.value); closeDd(true); });
    ddOpts.push(el); ddPanel.append(el);
  }
  let ddActive = -1;
  const isOpen = () => !ddPanel.hidden;
  function setActive(i, scroll = true) {
    ddActive = Math.max(0, Math.min(ddOpts.length - 1, i));
    ddOpts.forEach((o, k) => o.classList.toggle("active", k === ddActive));
    ddBtn.setAttribute("aria-activedescendant", ddOpts[ddActive].id);
    if (scroll) ddOpts[ddActive].scrollIntoView({ block: "nearest" });
  }
  function placeDd() {
    const r = ddBtn.getBoundingClientRect();
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const want = Math.min(380, ddPanel.scrollHeight + 2);
    ddPanel.style.left = r.left + "px"; ddPanel.style.width = r.width + "px";
    if (below >= want || below >= above) { ddPanel.style.top = r.bottom + 6 + "px"; ddPanel.style.bottom = "auto"; ddPanel.style.maxHeight = Math.max(160, Math.min(380, below)) + "px"; }
    else { ddPanel.style.bottom = innerHeight - r.top + 6 + "px"; ddPanel.style.top = "auto"; ddPanel.style.maxHeight = Math.max(160, Math.min(380, above)) + "px"; }
  }
  function openDd() {
    if (isOpen()) return;
    ddPanel.hidden = false; ddBtn.setAttribute("aria-expanded", "true"); placeDd();
    const cur = ddOpts.findIndex((o) => o.dataset.value === ddSel.value);
    setActive(cur > -1 ? cur : 0);
  }
  function closeDd(refocus) {
    if (!isOpen()) return;
    ddPanel.hidden = true; ddBtn.setAttribute("aria-expanded", "false"); ddBtn.removeAttribute("aria-activedescendant");
    if (refocus) ddBtn.focus();
  }
  function syncProgram() {
    const v = ddSel.value;
    ddText.textContent = v || "Select your program"; ddText.classList.toggle("placeholder", !v);
    ddOpts.forEach((o) => o.setAttribute("aria-selected", String(o.dataset.value === v)));
  }
  function pick(v) { ddSel.value = v; syncProgram(); ddSel.dispatchEvent(new Event("change", { bubbles: true })); }
  let typed = "", typedTimer;
  ddBtn.addEventListener("click", () => (isOpen() ? closeDd(false) : openDd()));
  ddBtn.addEventListener("keydown", (e) => {
    const k = e.key;
    if (!isOpen()) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(k)) { e.preventDefault(); openDd(); }
      return;
    }
    if (k === "ArrowDown") { e.preventDefault(); setActive(ddActive + 1); }
    else if (k === "ArrowUp") { e.preventDefault(); setActive(ddActive - 1); }
    else if (k === "Home") { e.preventDefault(); setActive(0); }
    else if (k === "End") { e.preventDefault(); setActive(ddOpts.length - 1); }
    else if (k === "Enter" || k === " ") { e.preventDefault(); pick(ddOpts[ddActive].dataset.value); closeDd(true); }
    else if (k === "Escape") { e.preventDefault(); closeDd(true); }
    else if (k === "Tab") closeDd(false);
    else if (k.length === 1) {
      typed += k.toLowerCase(); clearTimeout(typedTimer); typedTimer = setTimeout(() => (typed = ""), 600);
      const hit = ddOpts.findIndex((o) => o.dataset.value.toLowerCase().replace(/^bachelor of (science |early childhood )?(in )?/, "").startsWith(typed));
      if (hit > -1) setActive(hit);
    }
  });
  document.addEventListener("pointerdown", (e) => { if (isOpen() && !ddPanel.contains(e.target) && !ddBtn.contains(e.target)) closeDd(false); });
  addEventListener("resize", () => closeDd(false));
  $(".shell").addEventListener("scroll", () => closeDd(false));

  /* ---------- custom birthday calendar ---------- */
  const calEl = $("#calPanel"), bdBtn = $("#birthdayBtn"), bdText = $("#birthdayText"), bdInput = $("#birthday");
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const MIN_ISO = "1950-01-01", MIN_YEAR = 1950;
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoOf = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const inRange = (iso) => iso >= MIN_ISO && iso <= todayStr();
  const CHEV_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  const CHEV_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const CHEV_D = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const fmtLong = (iso) => parseBirthday(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  let calView = "days", vy = 2005, vm = 0;

  function syncBirthday() {
    const v = bdInput.value;
    bdText.textContent = v && parseBirthday(v) ? fmtLong(v) : "Select date";
    bdText.classList.toggle("placeholder", !v);
  }
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function renderCal(focusIso) {
    const t = new Date(), ty = t.getFullYear(), tm = t.getMonth();
    calEl.innerHTML = "";
    const head = el("div", "cal-head");
    const prev = el("button", "cal-nav", CHEV_L), next = el("button", "cal-nav", CHEV_R), title = el("button", "cal-title");
    prev.type = next.type = title.type = "button";
    if (calView === "days") {
      title.innerHTML = `${MONTHS[vm]} ${vy}${CHEV_D}`;
      title.setAttribute("aria-label", `${MONTHS[vm]} ${vy}, choose year`);
      prev.setAttribute("aria-label", "Previous month"); next.setAttribute("aria-label", "Next month");
      prev.disabled = vy === MIN_YEAR && vm === 0; next.disabled = vy === ty && vm === tm;
      prev.onclick = () => { vm--; if (vm < 0) { vm = 11; vy--; } renderCal(); calEl.querySelector(".cal-nav")?.focus(); };
      next.onclick = () => { vm++; if (vm > 11) { vm = 0; vy++; } renderCal(); calEl.querySelectorAll(".cal-nav")[1]?.focus(); };
    } else if (calView === "months") {
      title.innerHTML = `${vy}${CHEV_D}`; title.setAttribute("aria-label", `${vy}, choose year`);
      prev.setAttribute("aria-label", "Previous year"); next.setAttribute("aria-label", "Next year");
      prev.disabled = vy <= MIN_YEAR; next.disabled = vy >= ty;
      prev.onclick = () => { vy--; renderCal(); calEl.querySelector(".cal-nav")?.focus(); };
      next.onclick = () => { vy++; renderCal(); calEl.querySelectorAll(".cal-nav")[1]?.focus(); };
    } else {
      title.textContent = "Choose year"; title.disabled = true;
      prev.style.visibility = next.style.visibility = "hidden"; prev.disabled = next.disabled = true;
    }
    title.onclick = () => { calView = calView === "days" ? "months" : "years"; renderCal(); focusFirst(); };
    head.append(prev, title, next); calEl.append(head);

    const cur = bdInput.value;
    if (calView === "days") {
      const dow = el("div", "cal-dow"); dow.setAttribute("aria-hidden", "true");
      DOW.forEach((d) => dow.append(el("span", "", d))); calEl.append(dow);
      const grid = el("div", "cal-days"); grid.setAttribute("role", "grid"); grid.setAttribute("aria-label", `${MONTHS[vm]} ${vy}`);
      const first = new Date(vy, vm, 1).getDay(), days = new Date(vy, vm + 1, 0).getDate();
      const tabIso = (cur && cur.slice(0, 7) === `${vy}-${pad2(vm + 1)}`) ? cur : null;
      let firstEnabled = null;
      for (let i = 0; i < first; i++) grid.append(el("span"));
      for (let d = 1; d <= days; d++) {
        const iso = isoOf(vy, vm, d);
        const b = el("button", "cal-day", String(d)); b.type = "button"; b.dataset.d = iso; b.setAttribute("role", "gridcell");
        b.setAttribute("aria-label", fmtLong(iso));
        b.setAttribute("aria-selected", String(iso === cur));
        if (iso === todayStr()) b.classList.add("today");
        if (!inRange(iso)) b.disabled = true; else if (!firstEnabled) firstEnabled = iso;
        b.tabIndex = -1;
        b.onclick = () => chooseDate(iso);
        grid.append(b);
      }
      const roving = focusIso || tabIso || firstEnabled;
      const rb = roving && grid.querySelector(`[data-d="${roving}"]`); if (rb) rb.tabIndex = 0;
      calEl.append(grid);
      calEl.append(el("p", "cal-hint", "Arrow keys move between days"));
    } else if (calView === "months") {
      const grid = el("div", "cal-grid months");
      MONTHS.forEach((name, i) => {
        const b = el("button", "cal-cell", name.slice(0, 3)); b.type = "button"; b.setAttribute("aria-label", `${name} ${vy}`);
        b.disabled = vy > ty || (vy === ty && i > tm);
        b.setAttribute("aria-selected", String(cur && cur.slice(0, 7) === `${vy}-${pad2(i + 1)}`));
        b.onclick = () => { vm = i; calView = "days"; renderCal(); focusFirst(); };
        grid.append(b);
      });
      calEl.append(grid);
    } else {
      const grid = el("div", "cal-grid");
      for (let y = ty; y >= MIN_YEAR; y--) {
        const b = el("button", "cal-cell", String(y)); b.type = "button";
        b.setAttribute("aria-selected", String(cur && cur.slice(0, 4) === String(y)));
        b.onclick = () => { vy = y; calView = "months"; renderCal(); focusFirst(); };
        grid.append(b);
      }
      calEl.append(grid);
    }
    const foot = el("div", "cal-foot");
    const clear = el("button", "", "Clear"); clear.type = "button"; clear.disabled = !cur;
    clear.onclick = () => { bdInput.value = ""; syncBirthday(); bdInput.dispatchEvent(new Event("input", { bubbles: true })); closeCal(true); };
    const close = el("button", "", "Close"); close.type = "button"; close.onclick = () => closeCal(true);
    foot.append(clear, close); calEl.append(foot);
    if (focusIso) { const f = calEl.querySelector(`[data-d="${focusIso}"]`); if (f) f.focus(); }
  }
  function focusFirst() {
    const t = calEl.querySelector('.cal-day[tabindex="0"]') || calEl.querySelector('[aria-selected="true"]:not(:disabled)') || calEl.querySelector(".cal-cell:not(:disabled), .cal-day:not(:disabled)");
    if (t) { t.focus(); t.scrollIntoView({ block: "nearest" }); }
  }
  function chooseDate(iso) {
    bdInput.value = iso; syncBirthday();
    bdInput.dispatchEvent(new Event("input", { bubbles: true }));
    closeCal(true);
  }
  const calOpen = () => !calEl.hidden;
  function placeCal() {
    const r = bdBtn.getBoundingClientRect();
    const w = Math.min(320, innerWidth - 24);
    calEl.style.width = w + "px";
    calEl.style.left = Math.max(12, Math.min(r.left, innerWidth - w - 12)) + "px";
    const below = innerHeight - r.bottom - 12, above = r.top - 12, need = Math.min(calEl.scrollHeight, 420);
    if (below >= need || below >= above) { calEl.style.top = r.bottom + 6 + "px"; calEl.style.bottom = "auto"; calEl.style.maxHeight = Math.max(200, below) + "px"; }
    else { calEl.style.bottom = innerHeight - r.top + 6 + "px"; calEl.style.top = "auto"; calEl.style.maxHeight = Math.max(200, above) + "px"; }
  }
  function openCal() {
    if (calOpen()) return;
    const v = bdInput.value;
    if (v && parseBirthday(v)) { vy = +v.slice(0, 4); vm = +v.slice(5, 7) - 1; calView = "days"; }
    else { vy = 2005; vm = 0; calView = "years"; }
    calEl.hidden = false; bdBtn.setAttribute("aria-expanded", "true");
    renderCal(); placeCal(); focusFirst();
    if (calView === "years") { const s = calEl.querySelector(".cal-cell:not(:disabled)"); const t = [...calEl.querySelectorAll(".cal-cell")].find((b) => b.textContent === "2005"); if (t) { t.focus(); t.scrollIntoView({ block: "center" }); } }
  }
  function closeCal(refocus) {
    if (!calOpen()) return;
    calEl.hidden = true; bdBtn.setAttribute("aria-expanded", "false");
    if (refocus) bdBtn.focus();
  }
  bdBtn.addEventListener("click", () => (calOpen() ? closeCal(false) : openCal()));
  calEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeCal(true); return; }
    const t = e.target;
    if (calView !== "days" || !t.classList.contains("cal-day")) return;
    const d = parseBirthday(t.dataset.d); if (!d) return;
    let n = null;
    if (e.key === "ArrowLeft") d.setDate(d.getDate() - 1);
    else if (e.key === "ArrowRight") d.setDate(d.getDate() + 1);
    else if (e.key === "ArrowUp") d.setDate(d.getDate() - 7);
    else if (e.key === "ArrowDown") d.setDate(d.getDate() + 7);
    else if (e.key === "PageUp") d.setMonth(d.getMonth() - 1);
    else if (e.key === "PageDown") d.setMonth(d.getMonth() + 1);
    else if (e.key === "Home") d.setDate(d.getDate() - d.getDay());
    else if (e.key === "End") d.setDate(d.getDate() + (6 - d.getDay()));
    else return;
    e.preventDefault();
    n = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
    if (!inRange(n)) return;
    vy = d.getFullYear(); vm = d.getMonth(); renderCal(n);
  });
  document.addEventListener("pointerdown", (e) => { if (calOpen() && !calEl.contains(e.target) && !bdBtn.contains(e.target)) closeCal(false); });
  addEventListener("resize", () => closeCal(false));
  $(".shell").addEventListener("scroll", () => closeCal(false));

  /* ---------- live member card ---------- */
  function updatePreview() {
    // The welcome page always shows a generic sample card, never saved answers.
    const generic = screens.welcome.classList.contains("is-active");
    const first = generic ? "" : val("firstName"), last = generic ? "" : val("lastName");
    const photos = generic ? [] : state.photos;
    const name = [first, last].filter(Boolean).join(" ");
    const set = (id, text, fallback) => {
      const el = $(id); el.textContent = text || fallback; el.classList.toggle("empty", !text);
    };
    set("#pvName", name, "Your name");
    set("#pvProgram", generic ? "" : val("program"), "Your program");
    set("#pvMeta", generic ? "" : [yearVal(), val("section")].filter(Boolean).join(" · "), "Year level · Section");
    set("#pvId", generic || !val("studentId") ? "" : "Student ID " + val("studentId"), "Student ID");
    const bd = generic ? null : parseBirthday(val("birthday"));
    set("#pvBday", bd ? "Born " + bd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "", "Birthday");

    const ph = $("#pvPhoto");
    if (photos[0]) { ph.style.backgroundImage = `url(${photos[0]})`; ph.classList.add("has-img"); }
    else { ph.style.backgroundImage = ""; ph.classList.remove("has-img"); }
    $("#pvInitials").textContent = ((first[0] || "") + (last[0] || "")).toUpperCase() || "?";

    $$("#pvStrip i").forEach((el, i) => { el.style.backgroundImage = photos[i] ? `url(${photos[i]})` : ""; });
    $("#pvCount").textContent = `${photos.length} / ${PHOTOS} photos`;
    $("#pvRole").textContent = ROLE_LABELS[state.role] || "Member";

    const tags = $("#pvTags"); tags.innerHTML = "";
    (generic ? [] : [...state.hobbies, ...state.likes]).slice(0, 6).forEach((t) => {
      const li = document.createElement("li"); li.textContent = t; tags.append(li);
    });
  }

  const changed = () => updatePreview();

  /* ---------- role picker (welcome) ---------- */
  $$('input[name="role"]').forEach((i) => i.addEventListener("change", () => {
    state.role = i.value; $("#role-err").textContent = ""; updatePreview();
  }));

  /* ---------- chips ---------- */
  function addChip(el, text, set, checked) {
    const label = document.createElement("label");
    label.className = "chip";
    const input = document.createElement("input");
    input.type = "checkbox"; input.value = text; input.checked = checked;
    const span = document.createElement("span");
    span.textContent = text;
    input.addEventListener("change", () => { input.checked ? set.add(text) : set.delete(text); setErr("interests", ""); updateCounts(); changed(); });
    label.append(input, span);
    el.append(label);
    if (checked) set.add(text);
  }
  const buildChips = (el, items, set) => { el.innerHTML = ""; items.forEach((t) => addChip(el, t, set, false)); };
  buildChips($("#hobbyChips"), HOBBIES, state.hobbies);
  buildChips($("#likeChips"), LIKES, state.likes);

  $$("[data-add]").forEach((btn) => btn.addEventListener("click", () => addCustom(btn.dataset.add)));
  $$("#hobbyCustom,#likeCustom").forEach((inp) =>
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addCustom(inp.id === "hobbyCustom" ? "hobby" : "like"); }
    })
  );
  function addCustom(kind) {
    const inp = $(kind === "hobby" ? "#hobbyCustom" : "#likeCustom");
    const v = inp.value.trim();
    if (!v) return;
    const set = kind === "hobby" ? state.hobbies : state.likes;
    const box = $(kind === "hobby" ? "#hobbyChips" : "#likeChips");
    const existing = $$("input", box).find((i) => i.value.toLowerCase() === v.toLowerCase());
    if (existing) { if (!existing.checked) { existing.checked = true; set.add(existing.value); } }
    else addChip(box, v, set, true);
    inp.value = "";
    setErr("interests", "");
    updateCounts(); changed();
  }

  function updateCounts() {
    $("#hobbyCount").textContent = `${state.hobbies.size} selected`;
    $("#likeCount").textContent = `${state.likes.size} selected`;
    $("#aboutCount").textContent = `${$("#about").value.length} / 240`;
  }

  /* ---------- photos: exactly 5, first is the profile photo ---------- */
  const MAX = 800;
  const slotsEl = $("#slots");
  const X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const PLUS_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

  function renderSlots() {
    slotsEl.innerHTML = "";
    for (let i = 0; i < PHOTOS; i++) {
      const src = state.photos[i];
      const wrap = document.createElement("div");
      wrap.setAttribute("role", "listitem");
      if (src) {
        wrap.className = "slot filled";
        const img = new Image(); img.src = src; img.alt = i === 0 ? "Profile photo" : `Photo ${i + 1}`;
        const rm = document.createElement("button");
        rm.type = "button"; rm.className = "rm"; rm.innerHTML = X_ICON;
        rm.setAttribute("aria-label", `Remove photo ${i + 1}`);
        rm.addEventListener("click", () => { state.photos.splice(i, 1); state.files.splice(i, 1); renderSlots(); setErr("photo", ""); });
        wrap.append(img, rm);
        if (i === 0) { const t = document.createElement("span"); t.className = "tag"; t.textContent = "Profile"; wrap.append(t); }
      } else {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot" + (i === state.photos.length ? " next" : "");
        btn.innerHTML = PLUS_ICON + `<span>${i === 0 ? "Profile" : i + 1}</span>`;
        btn.setAttribute("aria-label", `Add photo ${i + 1}`);
        btn.addEventListener("click", () => $("#photoFile").click());
        wrap.append(btn);
      }
      slotsEl.append(wrap);
    }
    const n = state.photos.length;
    $("#photoCount").textContent = `${n} of ${PHOTOS} added`;
    $("#photoHint").textContent = n >= PHOTOS ? "All set" : n === 0 ? "Next: profile photo" : `Next: photo ${n + 1}`;
    updatePreview();
  }

  const resize = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      // Keep each photo small: Vercel rejects requests over 4.5 MB, and 5 photos travel in one request.
      let q = 0.8, out = c.toDataURL("image/jpeg", q);
      while (out.length > 600000 && q > 0.45) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });

  async function addFiles(fileList) {
    const err = $("#photo-err"); err.textContent = "";
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (!files.length) { if (fileList.length) err.textContent = "Please choose image files (JPG or PNG)."; return; }
    const room = PHOTOS - state.photos.length;
    if (room <= 0) { err.textContent = "You already have 5 photos. Remove one to add another."; return; }
    let failed = 0;
    for (const f of files.slice(0, room)) {
      try { const small = await resize(f); state.photos.push(small); state.files.push(f); renderSlots(); } catch (_) { failed++; }
    }
    if (failed) err.textContent = `${failed} image${failed > 1 ? "s" : ""} couldn't be read. Try another.`;
    else if (files.length > room) err.textContent = `Only ${room} more fit, so the extra photos were skipped.`;
  }
  ["#photoCamera", "#photoFile"].forEach((id) =>
    $(id).addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; })
  );
  ["dragenter", "dragover"].forEach((ev) => slotsEl.addEventListener(ev, (e) => { e.preventDefault(); slotsEl.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => slotsEl.addEventListener(ev, (e) => { e.preventDefault(); slotsEl.classList.remove("drag"); }));
  slotsEl.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

  /* ---------- validation ---------- */
  const setErr = (id, msg) => {
    const e = $("#" + id + "-err"); if (!e) return;
    e.textContent = msg || "";
    const f = e.closest(".field"); if (f) f.classList.toggle("invalid", !!msg);
  };
  function validate(step) {
    let ok = true, first = null;
    const need = (id, msg) => { if (!val(id)) { setErr(id, msg); ok = false; first ||= $(id === "program" ? "#programBtn" : "#" + id); } else setErr(id, ""); };
    if (step === 1) {
      need("firstName", "Please enter your first name.");
      need("lastName", "Please enter your last name.");
      if (!genderVal()) { setErr("gender", "Please select an option."); ok = false; first ||= $('input[name="gender"]'); } else setErr("gender", "");
      const bd = parseBirthday(val("birthday"));
      if (!val("birthday")) { setErr("birthday", "Please enter your birthday."); ok = false; first ||= $("#birthdayBtn"); }
      else if (!bd || val("birthday") < "1950-01-01") { setErr("birthday", "Enter a valid birthday."); ok = false; first ||= $("#birthdayBtn"); }
      else if (val("birthday") > todayStr()) { setErr("birthday", "Birthday can't be in the future."); ok = false; first ||= $("#birthdayBtn"); }
      else setErr("birthday", "");
      if (!val("email")) { setErr("email", "Please enter your email."); ok = false; first ||= $("#email"); }
      else if (!EMAIL_RE.test(val("email"))) { setErr("email", "Enter a valid email address."); ok = false; first ||= $("#email"); }
      else setErr("email", "");
    }
    if (step === 2) {
      if (!val("studentId")) { setErr("studentId", "Please enter your student ID."); ok = false; first ||= $("#studentId"); }
      else if (!ID_RE.test(val("studentId"))) { setErr("studentId", "Use 4 to 20 letters, numbers or dashes."); ok = false; first ||= $("#studentId"); }
      else setErr("studentId", "");
      need("program", "Please select your program.");
      if (!yearVal()) { setErr("year", "Pick your year level."); ok = false; first ||= $('input[name="year"]'); } else setErr("year", "");
      need("section", "Please enter your section.");
    }
    if (step === 3) {
      const n = state.photos.length;
      if (n < PHOTOS) { setErr("photo", n ? `Add ${PHOTOS - n} more photo${PHOTOS - n > 1 ? "s" : ""} (${n} of ${PHOTOS} so far).` : "Please add 5 photos to continue."); ok = false; }
      else setErr("photo", "");
    }
    if (step === 4) {
      if (!state.hobbies.size || !state.likes.size) { setErr("interests", "Choose at least one hobby and one like."); ok = false; } else setErr("interests", "");
    }
    if (first) first.focus();
    return ok;
  }

  /* ---------- navigation ---------- */
  function go(n) {
    state.step = n;
    $$(".step").forEach((s) => s.classList.toggle("is-active", +s.dataset.step === n));
    $$("#steps li").forEach((li, i) => {
      li.classList.toggle("done", i < n - 1);
      li.classList.toggle("current", i === n - 1);
      if (i === n - 1) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    $("#nextBtn").textContent = n === TOTAL ? "Submit registration" : "Continue";
    window.scrollTo({ top: 0 });
    hc.el.hidden = n !== TOTAL;
    if (n === TOTAL) hcStart(); // begin the human check as soon as the last step opens
    const f = $(`.step[data-step="${n}"] input[type=text]`);
    if (f && n === 1) setTimeout(() => f.focus({ preventScroll: true }), 50);
  }

  $("#continueBtn").addEventListener("click", () => {
    if (!state.role) { $("#role-err").textContent = "Please choose Member, Media or Player."; return; }
    show("flow"); go(1);
  });
  $("#backBtn").addEventListener("click", () => (state.step === 1 ? show("welcome") : go(state.step - 1)));
  $("#flow").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(state.step)) return;
    if (state.step < TOTAL) go(state.step + 1); else submitWithCheck();
  });
  $$("#flow input, #flow textarea, #flow select").forEach((i) => i.addEventListener("input", () => {
    const f = i.closest(".field");
    if (f) { f.classList.remove("invalid"); const e = f.querySelector(".error"); if (e) e.textContent = ""; }
    if (i.id === "about") updateCounts();
    changed();
  }));
  $$('input[name="year"]').forEach((i) => i.addEventListener("change", () => { setErr("year", ""); changed(); }));
  $("#program").addEventListener("change", () => { setErr("program", ""); changed(); });
  $$('input[name="gender"]').forEach((i) => i.addEventListener("change", () => { setErr("gender", ""); changed(); }));

  /* ---------- human check (Cloudflare Turnstile) ----------
     Runs in the background when the last step opens. We show our own animated status;
     Cloudflare's checkbox only appears if it needs the person to click. */
  const hc = { el: $("#humancheck"), text: $("#hcText"), retry: $("#hcRetry"), token: "", widget: null, started: 0, pending: false, state: "idle", siteKey: null };
  const MIN_CHECK_MS = 1600; // keep the scanning animation on screen long enough to be seen
  function hcSet(stateName, msg, short) {
    hc.state = stateName;
    hc.el.dataset.state = stateName;
    const text = { idle: "Human check", verifying: "Checking that you're human", challenge: "Please confirm you're human below", success: "Verified. You're human.", error: short || "Couldn't verify you" }[stateName];
    hc.text.textContent = text;
    hc.text.title = stateName === "error" ? (msg || "") : ""; // the short label stays readable; the reason shows on hover
    hc.retry.hidden = stateName !== "error";
    if (stateName === "challenge") setTimeout(() => hc.el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 80);
  }
  const whenTurnstile = () => new Promise((resolve, reject) => {
    let n = 0;
    const t = setInterval(() => {
      if (window.turnstile) { clearInterval(t); resolve(); }
      else if (++n > 80) { clearInterval(t); reject(new Error("unavailable")); }
    }, 100);
  });
  function hcOnToken(t) {
    const wait = Math.max(0, MIN_CHECK_MS - (Date.now() - hc.started));
    setTimeout(() => {
      hc.token = t; hcSet("success");
      if (hc.pending) { hc.pending = false; setTimeout(finish, 650); } // let the checkmark play first
    }, wait);
  }
  // Turnstile reports a numeric code when it can't run; say what it means instead of a vague failure.
  const TS_ERRORS = {
    110200: ["Address not allowed", "This website's address isn't in your Turnstile widget's hostnames. Add it in the Cloudflare dashboard."],
    110100: ["Wrong site key", "The Turnstile site key isn't valid."],
    110110: ["Wrong site key", "The Turnstile site key isn't valid."],
    400020: ["Wrong site key", "The Turnstile site key isn't valid."],
    200100: ["Clock is off", "This device's date and time look wrong, which breaks the check."],
    110500: ["Browser unsupported", "This browser can't run the check."],
  };
  function hcFail(msg, short) {
    hc.token = ""; hcSet("error", msg, short);
    if (hc.pending) { hc.pending = false; const b = $("#nextBtn"); b.disabled = false; b.textContent = "Submit registration"; }
  }
  async function hcStart() {
    if (hc.token || hc.state === "verifying" || hc.state === "challenge") return;
    hcSet("verifying"); hc.started = Date.now();
    try {
      if (hc.siteKey === null) hc.siteKey = (await (await fetch("/api/config")).json()).turnstileSiteKey || "";
      if (!hc.siteKey) return hcFail("TURNSTILE_SITE_KEY is missing on the server, so the human check can't start.", "Check not set up");
      await whenTurnstile();
      if (hc.widget !== null) { window.turnstile.reset(hc.widget); return; }
      hc.widget = window.turnstile.render("#tsBox", {
        sitekey: hc.siteKey, theme: "dark", size: "flexible", appearance: "interaction-only",
        callback: hcOnToken,
        "before-interactive-callback": () => hcSet("challenge"),
        "after-interactive-callback": () => { hcSet("verifying"); hc.started = Date.now(); },
        "expired-callback": () => { hc.token = ""; hc.state = "idle"; if (state.step === TOTAL) hcStart(); },
        "timeout-callback": () => hcFail("The check timed out."),
        "error-callback": (code) => {
          const known = TS_ERRORS[code];
          console.warn("Turnstile error", code);
          hcFail(known ? known[1] : `The check couldn't run (Turnstile error ${code}). Try again.`, known ? known[0] : `Error ${code}`);
          return true;
        },
        "unsupported-callback": () => hcFail("This browser can't run the check."),
      });
    } catch (e) { hcFail("The check couldn't load. Try again."); }
  }
  function hcReset() {
    hc.token = ""; hc.pending = false; hc.state = "idle"; hcSet("idle");
    if (hc.widget !== null && window.turnstile) { try { window.turnstile.reset(hc.widget); } catch (_) {} }
  }
  hc.retry.addEventListener("click", () => { hc.state = "idle"; hcStart(); });

  function submitWithCheck() {
    if (hc.token) return finish();
    hc.pending = true;
    const btn = $("#nextBtn"); btn.disabled = true; btn.textContent = "Verifying...";
    if (hc.state === "error" || hc.state === "idle") { hc.state = "idle"; hcStart(); }
  }

  /* ---------- submit ---------- */
  // A small square preview of the profile photo, so the members page doesn't have to load full-size images.
  const makeThumb = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const S = 192, c = document.createElement("canvas"); c.width = c.height = S;
      const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      c.getContext("2d").drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve("");
    img.src = src;
  });

  /* Full-resolution originals go straight to the private storage with signed links (no size limit, since they don't pass
     through the website). It runs after the registration is already saved, so any failure here is silent: the person is
     registered either way and the admins still have the 800 px copies. */
  async function uploadOriginals(ticket, btn) {
    try {
      const files = state.files.slice(0, PHOTOS);
      if (!files.length) return;
      const r = await fetch("/api/members/originals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket, files: files.map((f) => ({ type: f.type, size: f.size })) }) });
      if (!r.ok) return;
      const { uploads } = await r.json();
      let done = 0;
      btn.textContent = `Uploading photos 0/${uploads.length}...`;
      const put = async (i) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await fetch(uploads[i].url, { method: "PUT", headers: { "Content-Type": uploads[i].type }, body: files[i] });
            if (res.ok) break;
          } catch (_) { /* retry once */ }
        }
        btn.textContent = `Uploading photos ${++done}/${uploads.length}...`;
      };
      let next = 0;
      await Promise.all([0, 1].map(async () => { while (next < uploads.length) await put(next++); }));
    } catch (_) { /* the registration itself is already saved */ }
  }

  async function finish() {
    const btn = $("#nextBtn");
    btn.disabled = true; btn.textContent = "Submitting...";
    const data = {
      firstName: val("firstName"), lastName: val("lastName"),
      gender: genderVal(), birthday: val("birthday"), email: val("email").toLowerCase(),
      studentId: val("studentId"), program: val("program"), year: yearVal(), section: val("section"),
      role: state.role,
      photos: state.photos, thumb: await makeThumb(state.photos[0]),
      hobbies: [...state.hobbies], likes: [...state.likes], about: val("about"),
      captchaToken: hc.token,
    };
    let ok = false;
    try {
      const r = await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (r.status === 413) throw new Error("Your photos are too large to upload. Please choose smaller photos.");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const err = new Error(j.error || "Something went wrong."); err.field = j.field; err.code = j.code; throw err; }
      ok = true;
      // The 800 px copies above are what the site uses. If full-resolution storage is set up, send the originals there too.
      if (j.upload && j.upload.ticket) await uploadOriginals(j.upload.ticket, btn);
      $("#doneName").textContent = data.firstName;
      $("#stageCap").textContent = "Your member card";
      show("done");
    } catch (e) {
      if (e.field === "studentId") { go(2); setErr("studentId", e.message); $("#studentId").focus(); }
      else setErr("interests", e.message === "Failed to fetch" ? "Can't reach the server. Check your connection and try again." : e.message);
    } finally {
      btn.disabled = false; btn.textContent = "Submit registration";
      hc.token = ""; hc.state = "idle"; // each token works once, so get a fresh one
      if (!ok && state.step === TOTAL) hcStart();
      else if (hc.widget !== null && window.turnstile) { try { window.turnstile.reset(hc.widget); } catch (_) {} }
    }
  }

  $("#againBtn").addEventListener("click", () => {
    $("#flow").reset();
    bdInput.value = ""; // a hidden input keeps its value through form.reset()
    state.photos = []; state.files = []; state.hobbies.clear(); state.likes.clear();
    state.role = ""; $$('input[name="role"]').forEach((i) => (i.checked = false));
    buildChips($("#hobbyChips"), HOBBIES, state.hobbies);
    buildChips($("#likeChips"), LIKES, state.likes);
    $("#stageCap").textContent = "Live preview. Your card fills in as you type.";
    hcReset();
    renderSlots(); updateCounts(); syncProgram(); syncBirthday();
    show("welcome");
  });

  document.body.dataset.screen = "welcome";
  renderSlots(); updateCounts();
})();

/* intro animation: the badge reveals, then flies into the header logo. Click or any key skips it. */
(() => {
  const s = document.getElementById("splash");
  const body = document.body;
  if (!s) { body.classList.remove("intro", "flying"); return; }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let done = false;
  const finish = () => { body.classList.remove("flying"); s.remove(); };
  const leave = (fast) => {
    if (done) return;
    done = true;
    body.classList.remove("intro");
    s.classList.add("leaving");
    const wrap = s.querySelector(".splash-logo");
    const target = document.querySelector(".topbar .logo");
    if (reduce || !wrap || !target) { setTimeout(finish, 350); return; }
    wrap.style.animation = "none";
    const a = wrap.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const k = b.width / a.width;
    const dur = fast ? 450 : 850;
    wrap.style.transition = `transform ${dur}ms cubic-bezier(.7,0,.2,1)`;
    requestAnimationFrame(() => { wrap.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`; });
    setTimeout(finish, dur + 60);
  };
  setTimeout(() => leave(false), reduce ? 700 : 2500);
  s.addEventListener("click", () => leave(true));
  addEventListener("keydown", () => leave(true), { once: true });
})();
