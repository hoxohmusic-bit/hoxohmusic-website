/* explicit-badge.js v2.1 – EXPLIZIT nur unten bei der Jahreszeile,
   alte Overlays am Cover werden zuverlässig entfernt. */
(function () {
  // Sprache -> Label
  var lang = (document.documentElement.lang || 'de').slice(0,2).toLowerCase();
  var LABELS = { de: 'EXPLIZIT', en: 'EXPLICIT', es: 'EXPLÍCITO' };
  var BADGE_TEXT = LABELS[lang] || LABELS.de;

  // Alle Album-Cover (ggf. Pfad anpassen)
  var covers = document.querySelectorAll('img[src*="assets/covers/"]');

  function isYearText(el){
    if(!el) return false;
    var t = (el.textContent||'').trim();
    return /^(19|20)\d{2}$/.test(t);
  }

  function findYearElemAround(img){
    // 1) unter Geschwistern suchen
    var n = img.parentElement ? img.parentElement.firstElementChild : null;
    while(n){
      if(isYearText(n)) return n;
      n = n.nextElementSibling;
    }
    // 2) bis zu 4 Ebenen hoch und darunter suchen
    var p = img;
    for(var i=0; i<4 && p; i++){
      p = p.parentElement;
      if(!p) break;
      var cand = Array.from(p.querySelectorAll('div,span,p')).find(isYearText);
      if(cand) return cand;
    }
    return null;
  }

  function removeOldCoverBadges(card, img){
    if(!card) return;

    // 1) Alles mit "explicit" im Klassennamen (außer in der Jahr-Zeile) entfernen
    Array.from(card.querySelectorAll('.explicit, .explicit-badge, .badge-explicit, [class*="explicit"]'))
      .forEach(function(el){
        if(!el.closest('.hoxo-year-row')) el.remove();
      });

    // 2) Eingeblendete PNGs/SVGs entfernen (Dateiname enthält "explicit")
    Array.from(card.querySelectorAll('img')).forEach(function(el){
      var src = (el.getAttribute('src')||'').toLowerCase();
      if (el !== img && (src.includes('explicit-') || src.includes('/explicit') || src.includes('logo/explicit'))) {
        el.remove();
      }
    });

    // 3) Notfalls Elemente mit background-image:*explicit* ausblenden
    Array.from(card.querySelectorAll('*')).forEach(function(el){
      var bg = (el.style && el.style.backgroundImage) || '';
      // computed style nur wenn inline nicht gesetzt
      if(!bg && window.getComputedStyle){
        bg = getComputedStyle(el).backgroundImage || '';
      }
      if (bg && /explicit/i.test(bg) && !el.closest('.hoxo-year-row')) {
        el.style.display = 'none';
      }
    });
  }

  covers.forEach(function(img){
    var file = (img.getAttribute('src')||'').split('/').pop(); // z.B. album-animal-cover.jpg
    if(!file) return;

    // Prüfen, ob das gleiche Cover in assets/explizit/ liegt
    var probe = new Image();
    probe.onload = function(){
      var yearEl = findYearElemAround(img);
      if(!yearEl) return;

      // Karte bestimmen
      var card = yearEl.closest('.album-card') || img.closest('.album-card') ||
                 yearEl.closest('article') || img.closest('article') ||
                 yearEl.closest('section') || img.closest('section') ||
                 yearEl.closest('div');

      // Alte Overlays am Cover entfernen
      removeOldCoverBadges(card, img);

      // Jahr-Zeile aufbauen
      var row = yearEl.closest('.hoxo-year-row');
      if(!row){
        row = document.createElement('div');
        row.className = 'hoxo-year-row';
        yearEl.classList.add('hoxo-year-chip');
        yearEl.parentNode.insertBefore(row, yearEl);
        row.appendChild(yearEl);
      }

      // EXPLIZIT rechts einfügen (nur einmal)
      if(!row.querySelector('.hoxo-explicit-badge')){
        var badge = document.createElement('div');
        badge.className = 'hoxo-explicit-badge';
        badge.textContent = BADGE_TEXT;
        row.appendChild(badge);
      }
    };
    probe.onerror = function(){ /* kein explizites Duplikat -> kein Badge */ };
    probe.src = 'assets/explizit/' + file;
  });
})();
