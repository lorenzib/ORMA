[out:json][timeout:120];
relation["route"~"^(hiking|foot)$"](46.49,11.99,46.54,12.08)->.routes;
way(r.routes)->.routeways;
way["highway"]["ref"~"(^|;)(425|439)(;|$)"](46.49,11.99,46.54,12.08)->.numbered;
(.routes;.routeways;.numbered;);
out body geom;
