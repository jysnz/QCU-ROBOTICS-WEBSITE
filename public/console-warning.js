/* What people see when they open the browser console on any QCU Robotics page (site, admin and member registration).
   It is a deliberate console.log: the one thing this site prints on purpose. Plain JavaScript, shared by every page.
   Chrome, Edge and Brave can draw an image in the console, so they get a card styled like the site. Other browsers get styled text. */
(function () {
  try {
    if (window.__qcuConsoleNote) return; // once per page, even if the script is loaded twice
    window.__qcuConsoleNote = true;
    if (!window.console || typeof console.log !== "function") return;

    var JOIN = "https://www.qcurobotics.website/member-reg";
    var LIME = "#c8f560", INK = "#10140a", VIOLET = "#8b7cff", ROSE = "#fda4af";
    var SANS = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    var W = 480, H = 256; // narrow enough for a console docked at the side of the window

    /* ---- the card: an SVG in the site's colours (dark panel, lime accent, mono labels), used as the background of a console line ---- */
    function card(logo) {
      var sans = "'Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif";
      var mono = "Consolas,'SF Mono',Menlo,'Courier New',monospace";
      var x0 = logo ? 72 : 22;
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' +
        "<defs>" +
        '<radialGradient id="g1" cx="0" cy="0" r="1" gradientTransform="translate(60 10) scale(300 190)" gradientUnits="userSpaceOnUse"><stop stop-color="' + LIME + '" stop-opacity=".16"/><stop offset="1" stop-color="' + LIME + '" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="g2" cx="0" cy="0" r="1" gradientTransform="translate(470 256) scale(280 190)" gradientUnits="userSpaceOnUse"><stop stop-color="' + VIOLET + '" stop-opacity=".22"/><stop offset="1" stop-color="' + VIOLET + '" stop-opacity="0"/></radialGradient>' +
        '<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#fff" stroke-opacity=".035"/></pattern>' +
        '<clipPath id="r"><rect width="' + W + '" height="' + H + '" rx="18"/></clipPath>' +
        "</defs>" +
        '<g clip-path="url(#r)">' +
        '<rect width="' + W + '" height="' + H + '" fill="#0a0b0f"/><rect width="' + W + '" height="' + H + '" fill="url(#grid)"/>' +
        '<rect width="' + W + '" height="' + H + '" fill="url(#g1)"/><rect width="' + W + '" height="' + H + '" fill="url(#g2)"/>' +
        "</g>" +
        '<rect x=".75" y=".75" width="' + (W - 1.5) + '" height="' + (H - 1.5) + '" rx="17.5" fill="none" stroke="#33384a" stroke-width="1.5"/>' +
        // header: logo + name on the left, status pill on the right
        (logo ? '<image x="22" y="18" width="40" height="40" href="' + logo + '" xlink:href="' + logo + '"/>' : "") +
        '<text x="' + x0 + '" y="35" font-family="' + sans + '" font-size="15" font-weight="700" fill="#f2f4f8">QCU Robotics</text>' +
        '<text x="' + x0 + '" y="50" font-family="' + mono + '" font-size="9" letter-spacing="1.4" fill="#a0a7bb">QUEZON CITY UNIVERSITY</text>' +
        '<rect x="326" y="24" width="132" height="24" rx="12" fill="#12141b" stroke="#33384a"/>' +
        '<circle cx="341" cy="36" r="3" fill="' + LIME + '"/>' +
        '<text x="351" y="39.5" font-family="' + mono + '" font-size="9" letter-spacing="1" fill="' + LIME + '">DEVELOPER CONSOLE</text>' +
        // headline + message
        '<text x="22" y="100" font-family="' + mono + '" font-size="10" letter-spacing="2" fill="' + LIME + '">HOLD ON</text>' +
        '<text x="22" y="134" font-family="' + sans + '" font-size="33" font-weight="800" letter-spacing="-1" fill="#f2f4f8">Stop right <tspan fill="' + LIME + '">there.</tspan></text>' +
        '<text font-family="' + sans + '" font-size="12.5" fill="#a0a7bb">' +
        '<tspan x="22" y="160">This panel is for developers. If someone told you to paste</tspan>' +
        '<tspan x="22" y="177">something here to unlock a feature, get free stuff or &#8220;hack&#8221; an</tspan>' +
        '<tspan x="22" y="194">account, it is a scam. It can hand over your personal details.</tspan></text>' +
        // warning tag + join button
        '<rect x="22" y="212" width="232" height="28" rx="9" fill="#f87171" fill-opacity=".1" stroke="#f87171" stroke-opacity=".55"/>' +
        '<circle cx="38" cy="226" r="6.5" fill="none" stroke="' + ROSE + '" stroke-width="1.4"/><rect x="37.3" y="222" width="1.4" height="5" rx=".7" fill="' + ROSE + '"/><circle cx="38" cy="229.4" r=".9" fill="' + ROSE + '"/>' +
        '<text x="51" y="229.6" font-family="' + mono + '" font-size="9.5" letter-spacing=".6" fill="' + ROSE + '">NEVER PASTE CODE YOU DON&#8217;T TRUST</text>' +
        '<rect x="318" y="210" width="140" height="32" rx="10" fill="' + LIME + '"/>' +
        '<text x="388" y="230.5" text-anchor="middle" font-family="' + sans + '" font-size="12.5" font-weight="700" fill="' + INK + '">Join the team  &#8594;</text>' +
        "</svg>";
      // base64 keeps the address free of quotes and brackets, which the console's style filter can refuse
      return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    }

    function printCard(logo) {
      console.log(
        "%c ",
        "font-size:1px;line-height:1;padding:" + H / 2 + "px " + W / 2 + "px;" +
        "background-image:url(" + card(logo) + ");background-size:100% 100%;background-repeat:no-repeat;background-position:center;"
      );
      // plain text underneath: still readable if a browser declines to draw the image
      console.log("%cNever paste anything here that someone sent you.", "font:600 13px/1.8 " + SANS + ";color:" + ROSE + ";");
    }

    /* ---- the same message as plain styled text, for browsers that don't draw images in the console ---- */
    function printText() {
      console.log("%c STOP! ", "font:800 56px/1.2 " + SANS + ";color:" + INK + ";background:" + LIME + ";padding:2px 14px;border-radius:10px;box-shadow:5px 5px 0 " + VIOLET + ";");
      console.log("%cThis part of the browser is for developers.", "font:700 19px/1.6 " + SANS + ";color:#fff;padding:10px 0 2px;");
      console.log(
        "%cIf someone told you to copy and paste something here to unlock a feature, get free stuff, or \"hack\" an account, it is a scam. " +
        "Anything pasted here runs as you, and it can hand over your QCU Robotics account and your personal details.",
        "font:500 15px/1.6 " + SANS + ";color:" + ROSE + ";border-left:4px solid #f87171;padding:4px 0 4px 12px;"
      );
      console.log("%cNothing on this website needs you to be here. Close this panel and carry on.", "font:500 15px/1.6 " + SANS + ";color:#cbd5e1;padding:6px 0 0;");
      console.log("%cCurious how it all works? Come build robots with us → %c" + JOIN, "font:600 14px/1.8 " + SANS + ";color:" + LIME + ";padding:6px 0 10px;", "font:500 14px/1.8 " + SANS + ";color:" + VIOLET + ";");
    }

    var ua = navigator.userAgent || "";
    var chromium = !!window.chrome || /\b(Chrome|Chromium|Edg|OPR)\//.test(ua);
    if (!chromium || typeof fetch !== "function" || typeof FileReader !== "function" || typeof btoa !== "function") { printText(); return; }

    // the logo comes from the site itself (same origin, already cached); if it can't be read the card is drawn without it
    var done = false;
    var go = function (logo) { if (!done) { done = true; printCard(logo); } };
    var timer = setTimeout(function () { go(""); }, 1500);
    fetch("/logo-96.png")
      .then(function (r) { return r.ok ? r.blob() : Promise.reject(); })
      .then(function (b) {
        var fr = new FileReader();
        fr.onload = function () { clearTimeout(timer); go(String(fr.result)); };
        fr.onerror = function () { clearTimeout(timer); go(""); };
        fr.readAsDataURL(b);
      })
      .catch(function () { clearTimeout(timer); go(""); });
  } catch (e) { /* a console message must never break a page */ }
})();
