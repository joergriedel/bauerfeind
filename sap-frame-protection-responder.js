/**
 * SAP Frame Protection – Parent-Responder (Test für Custom Global JS)
 *
 * Simuliert die Antwort, die SAP Fiori (ClickjackingFramingProtection.js) vom
 * übergeordneten Fenster erwartet:
 *
 *   Fiori  -> Parent : "SAPFrameProtection*require-origin"
 *   Parent -> Fiori  : "SAPFrameProtection*parent-unlocked"
 *
 * WICHTIG: Custom Global JS läuft im Top-Fenster der Staffbase-Plattform.
 * Fiori akzeptiert die Antwort aber nur von seinem DIREKTEN Parent. Der Test
 * funktioniert daher nur, wenn Fiori (oder der Selbsttest) direkt auf einer
 * Plattform-Seite eingebettet ist. Im echten Setup (Plattform -> Plugin -> Fiori)
 * muss derselbe Listener in der Plugin-Seite laufen.
 *
 * Nutzung:
 *  1. FIORI_ORIGINS anpassen (nur Origin: Schema + Host, ohne Pfad).
 *  2. Script in Custom Global JS der Demo-Umgebung einfügen.
 *  3. Selbsttest: beliebige Plattform-Seite mit ?sapfp_selftest=1 öffnen.
 *     Unten rechts erscheint ein Mini-Frame mit dem Ergebnis (OK/FAIL).
 *  4. Konsole zeigt Logs mit Präfix [SAP-FP].
 */
(function () {
  'use strict';

  // ---- Konfiguration -------------------------------------------------------
  var FIORI_ORIGINS = [
    'https://fiori.example.com' // <- Bauerfeind-Fiori-Origin eintragen
  ];
  var DEBUG = true;
  // --------------------------------------------------------------------------

  if (window.__sapFrameProtectionResponder) return; // Doppelte Installation verhindern
  window.__sapFrameProtectionResponder = true;

  var REQUIRE = 'SAPFrameProtection*require-origin';
  var ORIGIN = 'SAPFrameProtection*parent-origin';
  var UNLOCKED = 'SAPFrameProtection*parent-unlocked';
  var selfTestWin = null;

  function log() {
    if (!DEBUG) return;
    var a = ['[SAP-FP]'].concat([].slice.call(arguments));
    console.log.apply(console, a);
  }

  function isChildFrame(src) {
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === src) return true;
    }
    return false;
  }

  window.addEventListener('message', function (e) {
    if (e.data !== REQUIRE) return;
    if (!e.source || !isChildFrame(e.source)) {
      log('ignoriert: Absender ist kein iFrame dieser Seite', e.origin);
      return;
    }
    var isSelfTest = selfTestWin && e.source === selfTestWin && e.origin === 'null';
    if (FIORI_ORIGINS.indexOf(e.origin) === -1 && !isSelfTest) {
      log('abgelehnt: Origin nicht in Allowlist', e.origin);
      return;
    }
    // Opaque Origin (Selbsttest) erlaubt nur '*' als targetOrigin
    var target = isSelfTest ? '*' : e.origin;
    // Beide Antworten senden: parent-origin (löst Whitelist-Prüfung aus),
    // danach parent-unlocked (Parent gilt als sicher)
    e.source.postMessage(ORIGIN, target);
    e.source.postMessage(UNLOCKED, target);
    log('geantwortet (parent-origin + parent-unlocked) an', e.origin);
  });

  log('Responder aktiv. Erlaubte Origins:', FIORI_ORIGINS.join(', '));

  // ---- Selbsttest: simuliert Fiori-Seite (?sapfp_selftest=1) ---------------
  if (!/[?&]sapfp_selftest=1/.test(location.search)) return;

  var childCode =
    '<body style="margin:0;font:12px sans-serif;padding:8px">Warte auf Parent…' +
    '<script>' +
    'var done=false;' +
    'function r(ok,m){if(done)return;done=true;document.body.style.background=ok?"#d4f5d4":"#f8d4d4";' +
    'document.body.textContent=(ok?"OK: ":"FAIL: ")+m;parent.postMessage("sapfp-selftest-"+(ok?"ok":"fail"),"*");}' +
    'window.addEventListener("message",function(e){' +
    'if(e.source===parent&&e.data==="' + UNLOCKED + '")r(true,"parent-unlocked erhalten");});' +
    'setTimeout(function(){r(false,"keine Antwort nach 3s");},3000);' +
    'parent.postMessage("' + REQUIRE + '","*");' +
    '<\/script></body>';

  var f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts'); // erzwingt fremde (opaque) Origin wie bei Fiori
  f.style.cssText =
    'position:fixed;right:12px;bottom:12px;width:300px;height:60px;border:1px solid #888;' +
    'z-index:2147483647;background:#fff';
  f.srcdoc = childCode;
  document.body.appendChild(f);
  selfTestWin = f.contentWindow;

  window.addEventListener('message', function (e) {
    if (e.source === selfTestWin && /^sapfp-selftest-/.test(e.data)) {
      log('Selbsttest:', e.data);
      setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 8000);
    }
  });
})();
