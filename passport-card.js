(function(global){
  'use strict';

  // SOCIAL-07 — the dog passport as a picture to share: the dog's ID, the
  // valley visas and the trail stamps, drawn in the Trail Tale card's look
  // (walk-card.js). It draws only what the passport already shows: trail
  // names and the trails' own published lines, never the walker's GPS track,
  // so it gives away no more than a list of trails walked.
  //
  // The passport comes from dog-passport.js (buildPassport). Labels come
  // through options.t (the journal's window.t), so the card speaks Italian
  // to Italian readers.

  var FORMATS = {
    // A story keeps its visas and stamps clear of the bottom 260 px, where
    // Instagram puts its reply bar, and centres them in the space above.
    story: { width: 1080, height: 1920, visas: 4, stamps: 6, cols: 3, r: 90, footerFromBottom: 220, center: true, label: 'Story 9:16' },
    post: { width: 1080, height: 1350, visas: 2, stamps: 4, cols: 4, r: 82, footerFromBottom: 96, center: false, label: 'Post 4:5' },
  };
  var INK = '#2E4034', CREAM = '#F5F2E8', SOFT = '#6B7A6E', TERRA = '#C4652F',
      PAPER = '#FFFFFF', SAND = '#EDE3CC', LINE = '#E3DFD2', STAMP = '#2F6B4F';
  var VISA_INKS = ['#2F6B4F', '#9A4B24', '#43508F', '#7A5A12'];
  var FILENAME = 'orma-dog-passport.png';
  var VISA_FILENAME = 'orma-new-visa.png';

  function formatOf(name){ return FORMATS[name] || FORMATS.story; }

  function passportApi(){ return global.DoloPawsPassport || null; }

  function shortDate(value, lang, withYear){
    var d = new Date(value);
    if(isNaN(d)) return '';
    var opts = { day: 'numeric', month: 'short' };
    if(withYear) opts.year = 'numeric';
    return d.toLocaleDateString(lang, opts);
  }

  // What goes on the card, decided without drawing anything: newest stamps
  // first, visas in the order the dog entered them, and how many did not fit.
  function cardContent(passport, options){
    options = options || {};
    var f = formatOf(options.format);
    var lastDate = function(s){ return String(s.dates[s.dates.length - 1] || ''); };
    var stamps = (passport && passport.stamps || []).slice().sort(function(a, b){
      return lastDate(b).localeCompare(lastDate(a));
    });
    var valleys = (passport && passport.valleys || []).slice();
    return {
      format: f,
      stamps: stamps.slice(0, f.stamps),
      moreStamps: Math.max(0, stamps.length - f.stamps),
      valleys: valleys.slice(0, f.visas),
      moreValleys: Math.max(0, valleys.length - f.visas),
      totals: passport ? passport.totals : { stamps: 0, valleys: 0, km: 0, walks: 0, climb: 0 },
      since: passport ? passport.since : null,
    };
  }

  // The caption that goes with the picture: counts only, no places beyond the
  // card's own, no account details.
  function shareText(passport, options){
    options = options || {};
    var t = options.t || function(key){ return key; };
    if(options.valley){
      var valley = (passport && passport.valleys || []).filter(function(v){ return v.name === options.valley; })[0];
      var api = passportApi();
      var fresh = !!(valley && api && api.isNewVisa && api.isNewVisa(valley, options.now));
      return t(fresh ? 'journal.passport.card.visaCaption' : 'journal.passport.card.visaCaptionPlain', {
        name: options.dogName || t('journal.passport.card.yourDog'),
        valley: options.valley,
      });
    }
    var totals = passport ? passport.totals : { stamps: 0, valleys: 0, km: 0 };
    var fmt = function(n){ return Number(n).toLocaleString(options.lang); };
    return t('journal.passport.card.caption', {
      name: options.dogName || t('journal.passport.card.yourDog'),
      stamps: fmt(totals.stamps),
      valleys: fmt(totals.valleys),
      km: fmt(totals.km),
    });
  }

  // ---- Drawing ------------------------------------------------------------

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function fitText(ctx, text, maxWidth){
    text = String(text || '');
    if(ctx.measureText(text).width <= maxWidth) return text;
    while(text.length > 1 && ctx.measureText(text + '…').width > maxWidth) text = text.slice(0, -1);
    return text.trim() + '…';
  }

  function wrapLines(ctx, text, maxWidth, maxLines){
    var words = String(text || '').split(/\s+/).filter(Boolean), lines = [], line = '';
    words.forEach(function(word){
      var probe = line ? line + ' ' + word : word;
      if(ctx.measureText(probe).width > maxWidth && line){ lines.push(line); line = word; } else line = probe;
    });
    if(line) lines.push(line);
    // A single word wider than the space (Sassolungo–Sassopiatto) is cut.
    lines = lines.map(function(l){ return fitText(ctx, l, maxWidth); });
    if(lines.length > maxLines){
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = fitText(ctx, lines[maxLines - 1] + ' …', maxWidth);
    }
    return lines;
  }

  function coverImage(ctx, img, x, y, w, h){
    var scale = Math.max(w / img.width, h / img.height);
    ctx.drawImage(img, x + (w - img.width * scale) / 2, y + (h - img.height * scale) / 2, img.width * scale, img.height * scale);
  }

  // The route outline from dog-passport.js ("M x yL x y…" in a 44 box) drawn
  // as lines, so it needs no Path2D.
  function drawOutline(ctx, d, cx, cy, size){
    var pts = String(d || '').split(/[ML]/).filter(Boolean).map(function(pair){
      var xy = pair.trim().split(/\s+/).map(Number);
      return [cx - size / 2 + xy[0] / 44 * size, cy - size / 2 + xy[1] / 44 * size];
    }).filter(function(p){ return Number.isFinite(p[0]) && Number.isFinite(p[1]); });
    if(pts.length < 2) return false;
    ctx.beginPath();
    pts.forEach(function(p, i){ i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
    return true;
  }

  function drawIdPanel(ctx, content, options, x, y, w, h){
    var t = options.t, lang = options.lang;
    roundRect(ctx, x, y, w, h, 28); ctx.fillStyle = PAPER; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = LINE; ctx.stroke();
    var pw = 200, ph = h - 60, px = x + 30, py = y + 30;
    ctx.save(); roundRect(ctx, px, py, pw, ph, 20); ctx.clip();
    if(options.dogPhotoImage) coverImage(ctx, options.dogPhotoImage, px, py, pw, ph);
    else {
      ctx.fillStyle = SAND; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#8A6A2E'; ctx.font = '800 96px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(options.dogName || '?').charAt(0).toUpperCase(), px + pw / 2, py + ph / 2 + 34);
      ctx.textAlign = 'left';
    }
    ctx.restore();
    var tx = px + pw + 40, tw = x + w - tx - 30;
    var rows = [];
    if(options.dogName) rows.push([t('journal.passport.idName'), options.dogName, 58]);
    if(options.dogBreed) rows.push([t('journal.passport.idBreed'), options.dogBreed, 34]);
    if(content.since) rows.push([t('journal.passport.idSince'), shortDate(content.since, lang, true), 34]);
    // Rows share the photo's height, top to bottom.
    var used = rows.reduce(function(sum, row){ return sum + 22 + 8 + row[2]; }, 0);
    var gap = rows.length > 1 ? Math.min(34, Math.max(14, (ph - used) / (rows.length - 1))) : 0;
    var ry = py + (ph - used - gap * (rows.length - 1)) / 2 - 10;
    rows.forEach(function(row){
      ry += 20;
      ctx.fillStyle = SOFT; ctx.font = '700 20px Inter, sans-serif';
      ctx.fillText(String(row[0]).toUpperCase(), tx, ry);
      ry += 10 + row[2] * 0.82;
      ctx.fillStyle = INK; ctx.font = '800 ' + row[2] + 'px "Bricolage Grotesque", Inter, sans-serif';
      ctx.fillText(fitText(ctx, row[1], tw), tx, ry);
      ry += row[2] * 0.18 + gap;
    });
  }

  function drawTotals(ctx, content, options, y, W){
    var t = options.t, fmt = function(n){ return Number(n).toLocaleString(options.lang); };
    var totals = content.totals;
    var cells = [
      [fmt(totals.stamps), t(totals.stamps === 1 ? 'journal.passport.card.stamp' : 'journal.passport.card.stampsLabel')],
      [fmt(totals.valleys), t(totals.valleys === 1 ? 'journal.passport.card.valley' : 'journal.passport.card.valleysLabel')],
      [fmt(totals.km), 'km'],
    ];
    var cw = (W - 140) / cells.length;
    cells.forEach(function(cell, i){
      var x = 70 + i * cw;
      ctx.fillStyle = INK; ctx.font = '800 64px Inter, sans-serif'; ctx.fillText(cell[0], x, y);
      ctx.fillStyle = SOFT; ctx.font = '700 22px Inter, sans-serif'; ctx.fillText(String(cell[1]).toUpperCase(), x, y + 38);
    });
  }

  function drawHeading(ctx, text, more, y, W){
    ctx.fillStyle = INK; ctx.font = '800 34px "Bricolage Grotesque", Inter, sans-serif';
    ctx.fillText(text, 70, y);
    if(more){
      ctx.fillStyle = SOFT; ctx.font = '600 24px Inter, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(more, W - 70, y); ctx.textAlign = 'left';
    }
  }

  function drawVisas(ctx, content, options, y, W){
    var t = options.t, lang = options.lang;
    var cols = 2, gap = 30, vw = (W - 140 - gap) / cols, vh = VISA_ROW - 26;
    content.valleys.forEach(function(v, i){
      var col = i % cols, row = Math.floor(i / cols);
      var x = 70 + col * (vw + gap), top = y + row * VISA_ROW;
      var ink = VISA_INKS[i % VISA_INKS.length];
      ctx.save();
      ctx.translate(x + vw / 2, top + vh / 2);
      ctx.rotate([-0.035, 0.03, -0.015, 0.025][i % 4]);
      roundRect(ctx, -vw / 2 + 8, -vh / 2 + 6, vw - 16, vh - 12, i % 2 ? 40 : 14);
      ctx.lineWidth = 5; ctx.strokeStyle = ink; ctx.stroke();
      ctx.fillStyle = ink; ctx.textAlign = 'center';
      var name = String(v.name).toUpperCase(), size = 32;
      ctx.font = '800 ' + size + 'px Inter, sans-serif';
      while(size > 22 && ctx.measureText(name).width > vw - 60){ size -= 2; ctx.font = '800 ' + size + 'px Inter, sans-serif'; }
      ctx.fillText(fitText(ctx, name, vw - 60), 0, -12);
      ctx.font = '700 22px Inter, sans-serif';
      ctx.fillText(t('journal.passport.entered', { date: shortDate(v.firstDate, lang) }) + '  ·  ' + visaLevel(v, t), 0, 30);
      ctx.restore();
    });
    return Math.ceil(content.valleys.length / cols) * VISA_ROW;
  }

  // "★★☆☆☆ Explorer": the valley's level, as on the passport.
  function visaLevel(v, t){
    var api = passportApi();
    var lv = v && v.level;
    if(!lv || !api || !api.stars) return '';
    return api.stars(lv) + (lv.id ? ' ' + t('journal.passport.level.' + lv.id) : '');
  }

  var ID_H = 300, VISA_ROW = 146, STAMP_LABEL = 100, ID_BLOCK = ID_H + 90 + 110;
  function stampRowH(f){ return f.r * 2 + STAMP_LABEL; }

  // How tall the ID, visas and stamps are together, to centre them.
  function contentHeight(content){
    var f = content.format, h = ID_BLOCK;
    if(content.valleys.length) h += 30 + Math.ceil(content.valleys.length / 2) * VISA_ROW;
    if(content.stamps.length) h += 50 + 30 + Math.ceil(content.stamps.length / f.cols) * stampRowH(f);
    return h;
  }

  function drawStamps(ctx, content, options, y, W){
    var api = passportApi();
    var cols = content.format.cols, cw = (W - 140) / cols, r = content.format.r;
    content.stamps.forEach(function(s, i){
      var col = i % cols, row = Math.floor(i / cols);
      var cx = 70 + col * cw + cw / 2, cy = y + r + row * stampRowH(content.format);
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate([-0.1, 0.08, -0.03, 0.05][i % 4]); ctx.translate(-cx, -cy);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#F1F5EE'; ctx.fill();
      ctx.setLineDash && ctx.setLineDash([12, 9]); ctx.lineWidth = 5; ctx.strokeStyle = STAMP; ctx.stroke();
      ctx.setLineDash && ctx.setLineDash([]);
      ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      var d = api && api.outlinePath ? api.outlinePath(s.path, 44) : '';
      if(!drawOutline(ctx, d, cx, cy, r * 1.5)){
        ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fillStyle = STAMP; ctx.fill();
      }
      ctx.restore();
      var label = r >= 90 ? 25 : 22;
      ctx.fillStyle = INK; ctx.font = '700 ' + label + 'px Inter, sans-serif'; ctx.textAlign = 'center';
      wrapLines(ctx, s.name, cw - 16, 2).forEach(function(line, j){ ctx.fillText(line, cx, cy + r + 38 + j * (label + 6)); });
      ctx.textAlign = 'left';
    });
    return Math.ceil(content.stamps.length / cols) * stampRowH(content.format);
  }

  // Draws onto `canvas` (or a new one). Returns the canvas.
  function renderPassportCard(passport, options, canvas){
    options = Object.assign({ t: function(key){ return key; } }, options || {});
    var t = options.t;
    var content = cardContent(passport, options);
    var W = content.format.width, H = content.format.height;
    canvas = canvas || document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var fmt = function(n){ return Number(n).toLocaleString(options.lang); };

    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK; ctx.font = '700 44px "Bricolage Grotesque", sans-serif'; ctx.fillText('ORMA', 70, 100);
    ctx.fillStyle = TERRA; ctx.font = '700 24px Inter, sans-serif';
    ctx.fillText(String(t('journal.passport.card.kicker')).toUpperCase(), 70, 140);

    var footerY = H - content.format.footerFromBottom;
    var y = 180;
    if(content.format.center){
      y += Math.max(0, Math.floor((footerY - 40 - 180 - contentHeight(content)) / 2));
    }
    drawIdPanel(ctx, content, options, 70, y, W - 140, ID_H);
    y += ID_H + 90;
    drawTotals(ctx, content, options, y, W);
    y += 110;

    if(content.valleys.length){
      drawHeading(ctx, t('journal.passport.visas'),
        content.moreValleys ? t('journal.passport.card.more', { n: fmt(content.moreValleys) }) : '', y, W);
      y += 30 + drawVisas(ctx, content, options, y + 20, W);
    }
    if(content.stamps.length){
      y += 50;
      drawHeading(ctx, t('journal.passport.stampsTitle'),
        content.moreStamps ? t('journal.passport.card.more', { n: fmt(content.moreStamps) }) : '', y, W);
      drawStamps(ctx, content, options, y + 30, W);
    }

    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(70, footerY); ctx.lineTo(W - 70, footerY); ctx.stroke();
    ctx.fillStyle = SOFT; ctx.font = '600 26px Inter, sans-serif';
    ctx.fillText(t('journal.passport.card.footer'), 70, footerY + 54);
    return canvas;
  }

  // ---- One valley: the new visa --------------------------------------------

  var VISA_STAMPS = 3;

  // What the visa picture shows: the valley, its level, and the trails stamped
  // there (newest first). Null when the passport has no such visa.
  function visaContent(passport, options){
    options = options || {};
    var valley = (passport && passport.valleys || []).filter(function(v){ return v.name === options.valley; })[0];
    if(!valley) return null;
    var lastDate = function(s){ return String(s.dates[s.dates.length - 1] || ''); };
    var here = (passport.stamps || []).filter(function(s){ return s.valley === valley.name; })
      .sort(function(a, b){ return lastDate(b).localeCompare(lastDate(a)); });
    var api = passportApi();
    return {
      format: formatOf(options.format),
      valley: valley,
      // "Luna's new visa" only for a visa first stamped in the last two weeks.
      fresh: !!(api && api.isNewVisa && api.isNewVisa(valley, options.now)),
      stamps: here.slice(0, VISA_STAMPS),
      moreStamps: Math.max(0, here.length - VISA_STAMPS),
    };
  }

  var VISA_PHOTO = 220, VISA_STAMP_ROW = 290, VISA_TOP = 170;
  function visaBox(f){ return f.height > 1500 ? 470 : 380; }
  // Everything but the dog's photo, which takes what room is left (up to 220).
  function visaHeight(content){
    return 90 + 40 + visaBox(content.format) + (content.stamps.length ? 70 + VISA_STAMP_ROW : 0);
  }
  function visaPhoto(content){
    var f = content.format;
    var room = f.height - f.footerFromBottom - 40 - VISA_TOP - visaHeight(content) - 40;
    var size = Math.min(VISA_PHOTO, room);
    return size >= 120 ? size : 0;
  }

  function renderVisaCard(passport, options, canvas){
    options = Object.assign({ t: function(key){ return key; } }, options || {});
    var t = options.t, lang = options.lang;
    var content = visaContent(passport, options);
    if(!content) return renderPassportCard(passport, options, canvas);
    var f = content.format, W = f.width, H = f.height, v = content.valley;
    canvas = canvas || document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var fmt = function(n){ return Number(n).toLocaleString(lang); };
    var ink = VISA_INKS[Math.max(0, passport.valleys.indexOf(v)) % VISA_INKS.length];

    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK; ctx.font = '700 44px "Bricolage Grotesque", sans-serif'; ctx.fillText('ORMA', 70, 100);
    ctx.fillStyle = TERRA; ctx.font = '700 24px Inter, sans-serif';
    ctx.fillText(String(t(content.fresh ? 'journal.passport.card.visaKicker' : 'journal.passport.card.visaKickerPlain')).toUpperCase(), 70, 140);

    var footerY = H - f.footerFromBottom, box = visaBox(f);
    // A post has less room: the photo shrinks before anything is cut.
    var photo = visaPhoto(content);
    var used = visaHeight(content) + (photo ? photo + 40 : 0);
    var y = VISA_TOP + Math.max(0, Math.floor((footerY - 40 - VISA_TOP - used) / 2));

    // The dog, in a round frame.
    if(photo){
      var r = photo / 2, cx = W / 2, cy = y + r;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
      if(options.dogPhotoImage) coverImage(ctx, options.dogPhotoImage, cx - r, cy - r, photo, photo);
      else {
        ctx.fillStyle = SAND; ctx.fillRect(cx - r, cy - r, photo, photo);
        ctx.fillStyle = '#8A6A2E'; ctx.font = '800 ' + Math.round(photo * 0.42) + 'px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String(options.dogName || '?').charAt(0).toUpperCase(), cx, cy + photo * 0.15);
      }
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 8; ctx.strokeStyle = PAPER; ctx.stroke();
      y += photo + 40;
    }

    // "Luna's new visa"
    ctx.textAlign = 'center'; ctx.fillStyle = INK;
    var title = options.dogName
      ? t(content.fresh ? 'journal.passport.card.visaTitle' : 'journal.passport.card.visaTitlePlain', { name: options.dogName })
      : t(content.fresh ? 'journal.passport.card.visaTitleNoName' : 'journal.passport.card.visaTitleNoNamePlain');
    var size = 72;
    ctx.font = '800 ' + size + 'px "Bricolage Grotesque", Inter, sans-serif';
    while(size > 44 && ctx.measureText(title).width > W - 140){ size -= 4; ctx.font = '800 ' + size + 'px "Bricolage Grotesque", Inter, sans-serif'; }
    ctx.fillText(fitText(ctx, title, W - 140), W / 2, y + 70);
    y += 90 + 40;

    // The visa itself: a big rubber stamp, slightly crooked.
    var bw = W - 200, bh = box - 40;
    ctx.save();
    ctx.translate(W / 2, y + box / 2);
    ctx.rotate(-0.04);
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 36); ctx.fillStyle = PAPER; ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = ink; ctx.stroke();
    roundRect(ctx, -bw / 2 + 18, -bh / 2 + 18, bw - 36, bh - 36, 24); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = '700 26px Inter, sans-serif';
    ctx.fillText(String(t('journal.passport.card.visaLabel')).toUpperCase(), 0, -bh / 2 + 82);
    var name = String(v.name).toUpperCase(), ns = 76;
    ctx.font = '800 ' + ns + 'px Inter, sans-serif';
    while(ns > 40 && ctx.measureText(name).width > bw - 90){ ns -= 4; ctx.font = '800 ' + ns + 'px Inter, sans-serif'; }
    var lines = ctx.measureText(name).width > bw - 90 ? wrapLines(ctx, name, bw - 90, 2) : [name];
    var ly = (lines.length > 1 ? -ns * 0.35 : ns * 0.2) - (box < 470 ? 24 : 0);
    lines.forEach(function(line, i){ ctx.fillText(line, 0, ly + i * ns * 1.05); });
    ctx.font = '700 28px Inter, sans-serif';
    ctx.fillText(t('journal.passport.entered', { date: shortDate(v.firstDate, lang, true) }), 0, bh / 2 - 112);
    ctx.font = '800 40px Inter, sans-serif';
    ctx.fillText(visaLevel(v, t), 0, bh / 2 - 52);
    ctx.restore();
    y += box;

    // The trails stamped there.
    if(content.stamps.length){
      y += 70;
      ctx.textAlign = 'left';
      drawHeading(ctx, t('journal.passport.card.visaStamps'),
        content.moreStamps ? t('journal.passport.card.more', { n: fmt(content.moreStamps) }) : '', y, W);
      // One or two stamps sit in the middle, not at the left of three slots.
      drawStamps(ctx, { stamps: content.stamps, format: { cols: content.stamps.length, r: 78 } }, options, y + 30, W);
    }

    ctx.textAlign = 'left';
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(70, footerY); ctx.lineTo(W - 70, footerY); ctx.stroke();
    ctx.fillStyle = SOFT; ctx.font = '600 26px Inter, sans-serif';
    ctx.fillText(t('journal.passport.card.footer'), 70, footerY + 54);
    return canvas;
  }

  function loadImage(src){
    return new Promise(function(resolve){
      if(!src || typeof Image === 'undefined'){ resolve(null); return; }
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = function(){ resolve(null); };
      img.src = src;
    });
  }

  function createPassportCard(passport, options){
    options = options || {};
    var photo = typeof options.dogPhoto === 'string' && /^data:image\/(png|jpe?g|webp|gif);/i.test(options.dogPhoto)
      ? options.dogPhoto : '';
    return loadImage(photo).then(function(img){
      var opts = Object.assign({}, options, { dogPhotoImage: img });
      return options.valley ? renderVisaCard(passport, opts) : renderPassportCard(passport, opts);
    });
  }

  function download(canvas, name){
    var a = document.createElement('a'); a.download = name || FILENAME; a.href = canvas.toDataURL('image/png'); a.click();
    return 'downloaded';
  }

  // The phone's share sheet when it takes a picture, otherwise a download.
  function sharePassportCard(passport, options, how){
    var name = options && options.valley ? VISA_FILENAME : FILENAME;
    return createPassportCard(passport, options).then(function(canvas){
      if(how === 'download') return download(canvas, name);
      return new Promise(function(resolve){
        canvas.toBlob(function(blob){
          var file = blob && typeof File !== 'undefined' ? new File([blob], name, { type: 'image/png' }) : null;
          var nav = typeof navigator !== 'undefined' ? navigator : null;
          if(file && nav && nav.share && nav.canShare && nav.canShare({ files: [file] })){
            nav.share({ files: [file], text: shareText(passport, options) })
              .then(function(){ resolve('shared'); })
              .catch(function(error){ resolve(error && error.name === 'AbortError' ? 'cancelled' : download(canvas, name)); });
          } else resolve(download(canvas, name));
        }, 'image/png');
      });
    });
  }

  var api = {
    FORMATS: FORMATS, FILENAME: FILENAME,
    cardContent: cardContent, contentHeight: contentHeight, shareText: shareText,
    visaContent: visaContent, visaHeight: visaHeight, visaPhoto: visaPhoto, VISA_TOP: VISA_TOP, renderVisaCard: renderVisaCard,
    renderPassportCard: renderPassportCard, createPassportCard: createPassportCard,
    sharePassportCard: sharePassportCard,
  };
  global.DoloPawsPassportCard = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
