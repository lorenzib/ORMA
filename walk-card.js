(function(global){
  'use strict';

  // Shareable walk card: draws a journal entry (name, stats, route trace,
  // optional photo) onto a canvas and hands it to the native share sheet,
  // falling back to a PNG download. Pure helpers are exported for tests.

  var W = 1080, H = 1350;
  var INK = '#2E4034', CREAM = '#F5F2E8', SOFT = '#6B7A6E',
      TERRA = '#C4652F', SAGE = '#E7ECE3', LINE = '#E3DFD2';

  // Project [[lat,lng],…] into canvas space, preserving aspect ratio
  // (longitude squeezed by cos(lat) so shapes stay true), centred in the
  // given box with padding.
  function projectRoute(route, w, h, pad){
    var pts = (route || []).filter(function(p){
      return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
    });
    if(pts.length < 2) return [];
    var latMid = pts.reduce(function(s, p){ return s + p[0]; }, 0) / pts.length;
    var kx = Math.cos(latMid * Math.PI / 180);
    var xs = pts.map(function(p){ return p[1] * kx; });
    var ys = pts.map(function(p){ return p[0]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var spanX = Math.max(maxX - minX, 1e-9), spanY = Math.max(maxY - minY, 1e-9);
    var scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
    var offX = (w - spanX * scale) / 2, offY = (h - spanY * scale) / 2;
    return pts.map(function(p, i){
      return [
        offX + (p[1] * kx - minX) * scale,
        // Latitude grows north; canvas y grows down.
        h - (offY + (p[0] - minY) * scale),
      ];
    });
  }

  function fmtDuration(minutes){
    var m = Number(minutes) || 0;
    if(m < 60) return m + ' min';
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0');
  }

  function shareText(entry, dogName){
    var bits = [];
    bits.push((dogName ? dogName + '’s walk' : 'Our walk') + ' — ' + (entry.dist || '?') + ' km in ' + fmtDuration(entry.dur));
    if(entry.trail && entry.trail !== 'Recorded walk') bits.push(entry.trail);
    return bits.join(' · ') + '. Tracked with ORMA 🐾 dolopaws.com';
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawRouteOn(ctx, route, x, y, w, h, styleOverPhoto){
    var pts = projectRoute(route, w, h, 60);
    if(pts.length < 2) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if(styleOverPhoto){
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 14;
      strokePath(ctx, pts);
    }
    ctx.strokeStyle = TERRA;
    ctx.lineWidth = 8;
    strokePath(ctx, pts);
    // start / end dots
    dot(ctx, pts[0], '#4A7856');
    dot(ctx, pts[pts.length - 1], TERRA);
    ctx.restore();
    return true;
  }

  function strokePath(ctx, pts){
    ctx.beginPath();
    pts.forEach(function(p, i){ i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
  }

  function dot(ctx, p, color){
    ctx.beginPath();
    ctx.arc(p[0], p[1], 14, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  function renderWalkCard(entry, options){
    options = options || {};
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, W, H);

    // Brand
    ctx.fillStyle = INK;
    ctx.font = '700 44px "Source Serif 4", serif';
    ctx.fillText('ORMA', 70, 106);
    ctx.font = '600 30px Inter, sans-serif';
    ctx.fillStyle = SOFT;
    ctx.textAlign = 'right';
    ctx.fillText(new Date(entry.date).toLocaleDateString(undefined, { day:'numeric', month:'long', year:'numeric' }), W - 70, 106);
    ctx.textAlign = 'left';

    // Title (two lines max)
    var title = entry.trail || 'A walk';
    ctx.fillStyle = INK;
    ctx.font = '700 68px "Source Serif 4", serif';
    var words = title.split(' '), line = '', lines = [];
    words.forEach(function(word){
      var probe = line ? line + ' ' + word : word;
      if(ctx.measureText(probe).width > W - 140 && line){ lines.push(line); line = word; }
      else line = probe;
    });
    lines.push(line);
    lines.slice(0, 2).forEach(function(l, i){ ctx.fillText(l, 70, 210 + i * 82); });
    var afterTitle = 210 + Math.min(lines.length, 2) * 82;

    // Visual panel: photo when present, route over it or over sage.
    var px = 70, py = afterTitle + 10, pw = W - 140, ph = 620;
    roundRect(ctx, px, py, pw, ph, 28);
    ctx.save();
    ctx.clip();
    var drewPhoto = false;
    if(options.photoImage){
      var img = options.photoImage;
      var s = Math.max(pw / img.width, ph / img.height);
      ctx.drawImage(img, px + (pw - img.width * s) / 2, py + (ph - img.height * s) / 2, img.width * s, img.height * s);
      drewPhoto = true;
    } else {
      ctx.fillStyle = SAGE;
      ctx.fillRect(px, py, pw, ph);
    }
    ctx.restore();
    drawRouteOn(ctx, entry.route, px, py, pw, ph, drewPhoto);
    if(!drewPhoto && !(entry.route && entry.route.length > 1)){
      ctx.fillStyle = SOFT;
      ctx.font = '600 34px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐾', W / 2, py + ph / 2 + 12);
      ctx.textAlign = 'left';
    }

    // Stats
    var sy = py + ph + 100;
    function stat(x, value, label){
      ctx.fillStyle = INK;
      ctx.font = '800 64px Inter, sans-serif';
      ctx.fillText(value, x, sy);
      ctx.fillStyle = SOFT;
      ctx.font = '700 26px Inter, sans-serif';
      ctx.fillText(label.toUpperCase(), x, sy + 42);
    }
    stat(70, (entry.dist || '0') + ' km', 'Distance');
    stat(430, fmtDuration(entry.dur), 'Time');
    if(options.dogName) stat(760, options.dogName, 'Walked with');

    // Footer
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(70, H - 110); ctx.lineTo(W - 70, H - 110); ctx.stroke();
    ctx.fillStyle = SOFT;
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillText('Every walk scored for paw safety · dolopaws.com', 70, H - 52);

    return canvas;
  }

  function loadPhoto(dataUri){
    return new Promise(function(resolve){
      if(!dataUri){ resolve(null); return; }
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = function(){ resolve(null); };
      img.src = dataUri;
    });
  }

  // → Promise<'shared'|'downloaded'>
  function shareWalkCard(entry, options){
    options = options || {};
    return loadPhoto(entry.photo).then(function(photoImage){
      var canvas = renderWalkCard(entry, { dogName: options.dogName, photoImage: photoImage });
      return new Promise(function(resolve){
        canvas.toBlob(function(blob){
          var file = blob ? new File([blob], 'dolopaws-walk.png', { type: 'image/png' }) : null;
          var text = shareText(entry, options.dogName);
          if(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
            navigator.share({ files: [file], text: text })
              .then(function(){ resolve('shared'); })
              .catch(function(){ resolve(download(canvas)); });
          } else {
            resolve(download(canvas));
          }
        }, 'image/png');
      });
    });
  }

  function download(canvas){
    var a = document.createElement('a');
    a.download = 'dolopaws-walk.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    return 'downloaded';
  }

  var api = { projectRoute: projectRoute, shareText: shareText, fmtDuration: fmtDuration,
    renderWalkCard: renderWalkCard, shareWalkCard: shareWalkCard };
  global.DoloPawsWalkCard = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
