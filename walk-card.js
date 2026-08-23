(function(global){
  'use strict';

  // Shareable Trail Tale cards. Journal data remains local: this module only
  // draws a user-selected entry and hands the resulting PNG to the device.
  var FORMATS = {
    post: { width:1080, height:1350, label:'Post 4:5' },
    story: { width:1080, height:1920, label:'Story 9:16' },
    square: { width:1080, height:1080, label:'Square 1:1' }
  };
  var INK = '#2E4034', CREAM = '#F5F2E8', SOFT = '#6B7A6E',
      TERRA = '#C4652F', SAGE = '#E7ECE3', LINE = '#E3DFD2';
  var TALE_LABELS = {
    paws: { happy:'Happy paws', tender:'A little tender', check:'Check them tonight' },
    energy: { zoomies:'Still had zoomies', justRight:'Just right', nap:'Ready for a nap' },
    moment: { water:'The water stop', view:'The big view', sniffs:'Forest sniffing', rifugio:'Rifugio rest', mud:'Mud mission' }
  };

  function validRoute(route){
    return (route || []).filter(function(p){
      return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
    });
  }

  function projectRoute(route, w, h, pad){
    var pts = validRoute(route);
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
    return pts.map(function(p){
      return [offX + (p[1] * kx - minX) * scale, h - (offY + (p[0] - minY) * scale)];
    });
  }

  function metresBetween(a, b){
    var rad = Math.PI / 180, earth = 6371000;
    var lat1 = a[0] * rad, lat2 = b[0] * rad;
    var dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // Conceals roughly `distanceM` from both ends without mutating the route.
  function maskRouteEnds(route, distanceM){
    var pts = validRoute(route).map(function(p){ return [p[0], p[1]]; });
    var mask = Number.isFinite(distanceM) ? Math.max(distanceM, 0) : 200;
    if(pts.length < 2 || mask === 0) return pts;
    var segments = [], total = 0;
    for(var i = 1; i < pts.length; i++){
      var segment = metresBetween(pts[i - 1], pts[i]); segments.push(segment); total += segment;
    }
    if(total <= mask * 2) return [];
    function pointAt(target){
      var covered = 0;
      for(var index = 0; index < segments.length; index++){
        if(covered + segments[index] >= target){
          var ratio = segments[index] ? (target - covered) / segments[index] : 0;
          return { index:index, point:[
            pts[index][0] + (pts[index + 1][0] - pts[index][0]) * ratio,
            pts[index][1] + (pts[index + 1][1] - pts[index][1]) * ratio
          ] };
        }
        covered += segments[index];
      }
      return { index:pts.length - 2, point:pts[pts.length - 1].slice() };
    }
    var start = pointAt(mask), end = pointAt(total - mask);
    var output = [start.point];
    for(var pointIndex = start.index + 1; pointIndex <= end.index; pointIndex++) output.push(pts[pointIndex].slice());
    output.push(end.point);
    return output;
  }

  function routeForShare(entry, options){
    options = options || {};
    if(options.hideRoute) return [];
    return options.hideEnds === false ? validRoute(entry.route) : maskRouteEnds(entry.route, 200);
  }

  function formatSize(format){
    var item = FORMATS[format] || FORMATS.post;
    return { width:item.width, height:item.height };
  }

  function fmtDuration(minutes){
    var m = Number(minutes) || 0;
    if(m < 60) return m + ' min';
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0');
  }

  function taleSentence(entry, dogName){
    var energy = TALE_LABELS.energy[(entry.tale || {}).energy];
    if(!energy) return '';
    return (dogName ? dogName + '’s verdict: ' : 'Trail verdict: ') + energy.toLowerCase() + '.';
  }

  function shareText(entry, dogName){
    var bits = [];
    bits.push((dogName ? dogName + '’s Trail Tale' : 'Our Trail Tale') + ' — ' + (entry.dist || '?') + ' km in ' + fmtDuration(entry.dur));
    if(entry.trail && entry.trail !== 'Recorded walk') bits.push(entry.trail);
    var verdict = taleSentence(entry, dogName);
    return bits.join(' · ') + '. ' + (verdict ? verdict + ' ' : '') + 'Made with ORMA 🐾 app-orma.com';
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function strokePath(ctx, pts){
    ctx.beginPath(); pts.forEach(function(p, i){ i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke();
  }

  function dot(ctx, p, color){
    ctx.beginPath(); ctx.arc(p[0], p[1], 14, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
  }

  function drawRouteOn(ctx, route, x, y, w, h, styleOverPhoto){
    var pts = projectRoute(route, w, h, Math.min(64, w * .08));
    if(pts.length < 2) return false;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if(styleOverPhoto){ ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 15; strokePath(ctx, pts); }
    ctx.strokeStyle = TERRA; ctx.lineWidth = 8; strokePath(ctx, pts);
    dot(ctx, pts[0], '#4A7856'); dot(ctx, pts[pts.length - 1], TERRA); ctx.restore();
    return true;
  }

  function drawCoverPhoto(ctx, img, x, y, w, h){
    var scale = Math.max(w / img.width, h / img.height);
    ctx.drawImage(img, x + (w - img.width * scale) / 2, y + (h - img.height * scale) / 2, img.width * scale, img.height * scale);
  }

  function wrapLines(ctx, text, maxWidth, maxLines){
    var words = String(text || '').split(/\s+/), lines = [], line = '';
    words.forEach(function(word){
      var probe = line ? line + ' ' + word : word;
      if(ctx.measureText(probe).width > maxWidth && line){ lines.push(line); line = word; } else line = probe;
    });
    if(line) lines.push(line);
    return lines.slice(0, maxLines || lines.length);
  }

  function drawVisual(ctx, options, x, y, w, h){
    var photo = options.photoImage, visual = options.visual || (photo ? 'split' : 'map');
    if(!photo && visual !== 'map') visual = 'map';
    roundRect(ctx, x, y, w, h, 30); ctx.save(); ctx.clip();
    if(visual === 'photo'){
      drawCoverPhoto(ctx, photo, x, y, w, h);
    } else if(visual === 'split'){
      var split = Math.round(h * .56);
      drawCoverPhoto(ctx, photo, x, y, w, split);
      ctx.fillStyle = SAGE; ctx.fillRect(x, y + split, w, h - split);
      drawRouteOn(ctx, options.route, x, y + split, w, h - split, false);
    } else {
      ctx.fillStyle = SAGE; ctx.fillRect(x, y, w, h);
      drawRouteOn(ctx, options.route, x, y, w, h, false);
    }
    ctx.restore();
    if(visual === 'map' && options.route.length < 2){
      ctx.fillStyle = SOFT; ctx.font = '600 42px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('A good walk leaves a mark 🐾', x + w / 2, y + h / 2); ctx.textAlign = 'left';
    }
  }

  function renderWalkCard(entry, options){
    options = options || {};
    var size = formatSize(options.format), W = size.width, H = size.height;
    var canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d'), route = options.route || routeForShare(entry, options);
    var compact = H <= 1080, story = H >= 1800;

    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK; ctx.font = '700 44px "Bricolage Grotesque", sans-serif'; ctx.fillText('ORMA', 70, 100);
    ctx.font = '700 24px Inter, sans-serif'; ctx.fillStyle = TERRA; ctx.fillText('TRAIL TALE', 70, 140);
    ctx.font = '600 28px Inter, sans-serif'; ctx.fillStyle = SOFT; ctx.textAlign = 'right';
    ctx.fillText(new Date(entry.date).toLocaleDateString(undefined, { day:'numeric', month:'long', year:'numeric' }), W - 70, 104); ctx.textAlign = 'left';

    var titleY = compact ? 215 : 225;
    ctx.fillStyle = INK; ctx.font = '700 ' + (compact ? 56 : 66) + 'px "Bricolage Grotesque", sans-serif';
    var lines = wrapLines(ctx, entry.trail || 'A walk', W - 140, 2);
    lines.forEach(function(line, i){ ctx.fillText(line, 70, titleY + i * (compact ? 64 : 78)); });
    var visualY = titleY + lines.length * (compact ? 64 : 78) + 24;
    var footerSpace = compact ? 250 : (story ? 440 : 340);
    var visualH = Math.max(compact ? 450 : 560, H - visualY - footerSpace);
    drawVisual(ctx, { photoImage:options.photoImage, visual:options.visual, route:route }, 70, visualY, W - 140, visualH);

    var statsY = visualY + visualH + (compact ? 58 : 74);
    function stat(x, value, label){
      ctx.fillStyle = INK; ctx.font = '800 ' + (compact ? 43 : 52) + 'px Inter, sans-serif'; ctx.fillText(value, x, statsY);
      ctx.fillStyle = SOFT; ctx.font = '700 21px Inter, sans-serif'; ctx.fillText(label.toUpperCase(), x, statsY + 34);
    }
    stat(70, (entry.dist || '0') + ' km', 'Distance'); stat(390, fmtDuration(entry.dur), 'Time');
    if(options.dogName) stat(720, options.dogName, 'Walked with');

    var tale = entry.tale || {}, chips = [];
    if(TALE_LABELS.paws[tale.paws]) chips.push(TALE_LABELS.paws[tale.paws]);
    if(TALE_LABELS.moment[tale.moment]) chips.push('Best bit: ' + TALE_LABELS.moment[tale.moment].toLowerCase());
    var verdict = taleSentence(entry, options.dogName);
    if(verdict && !compact){
      ctx.fillStyle = INK; ctx.font = '700 31px "Bricolage Grotesque", sans-serif'; ctx.fillText(verdict, 70, statsY + 104);
    }
    if(chips.length && !compact){
      ctx.fillStyle = SOFT; ctx.font = '600 24px Inter, sans-serif'; ctx.fillText(chips.join('  ·  '), 70, statsY + 145);
    }

    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(70, H - 96); ctx.lineTo(W - 70, H - 96); ctx.stroke();
    ctx.fillStyle = SOFT; ctx.font = '600 26px Inter, sans-serif'; ctx.fillText('Made for dogs who take the scenic route · app-orma.com', 70, H - 42);
    return canvas;
  }

  function loadPhoto(dataUri){
    return new Promise(function(resolve){
      if(!dataUri){ resolve(null); return; }
      var img = new Image(); img.onload = function(){ resolve(img); }; img.onerror = function(){ resolve(null); }; img.src = dataUri;
    });
  }

  function createWalkCard(entry, options){
    options = options || {};
    return loadPhoto(entry.photo).then(function(photoImage){
      return renderWalkCard(entry, Object.assign({}, options, { photoImage:photoImage }));
    });
  }

  function download(canvas){
    var a = document.createElement('a'); a.download = 'orma-trail-tale.png'; a.href = canvas.toDataURL('image/png'); a.click(); return 'downloaded';
  }

  function downloadWalkCard(entry, options){ return createWalkCard(entry, options).then(download); }

  function shareWalkCard(entry, options){
    options = options || {};
    return createWalkCard(entry, options).then(function(canvas){
      return new Promise(function(resolve){
        canvas.toBlob(function(blob){
          var file = blob && typeof File !== 'undefined' ? new File([blob], 'orma-trail-tale.png', { type:'image/png' }) : null;
          var text = shareText(entry, options.dogName);
          if(file && typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files:[file] })){
            navigator.share({ files:[file], text:text }).then(function(){ resolve('shared'); }).catch(function(error){
              if(error && error.name === 'AbortError') resolve('cancelled');
              else resolve(download(canvas));
            });
          } else resolve(download(canvas));
        }, 'image/png');
      });
    });
  }

  var api = {
    FORMATS:FORMATS, TALE_LABELS:TALE_LABELS, projectRoute:projectRoute,
    maskRouteEnds:maskRouteEnds, routeForShare:routeForShare, formatSize:formatSize,
    shareText:shareText, taleSentence:taleSentence, fmtDuration:fmtDuration,
    renderWalkCard:renderWalkCard, createWalkCard:createWalkCard,
    downloadWalkCard:downloadWalkCard, shareWalkCard:shareWalkCard
  };
  global.DoloPawsWalkCard = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
