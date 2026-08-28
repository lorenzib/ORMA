(function(root){
  'use strict';

  const VERSION = '1.2.0';
  const EARTH_RADIUS_M = 6371000;

  function validPoint(point){
    return point && Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
      point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
  }

  function pointFromNode(node){
    return Array.isArray(node) && node.length >= 2
      ? { lng:Number(node[0]), lat:Number(node[1]) }
      : null;
  }

  function toLocal(point, origin){
    const radians = Math.PI / 180;
    return {
      x:(point.lng - origin.lng) * radians * EARTH_RADIUS_M *
        Math.cos(((point.lat + origin.lat) / 2) * radians),
      y:(point.lat - origin.lat) * radians * EARTH_RADIUS_M,
    };
  }

  function nearestPointOnSegment(origin, start, end){
    const a = toLocal(start, origin);
    const b = toLocal(end, origin);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
    return {
      point:{
        lat:start.lat + (end.lat - start.lat) * fraction,
        lng:start.lng + (end.lng - start.lng) * fraction,
      },
      fraction,
      distanceM:Math.hypot(a.x + dx * fraction, a.y + dy * fraction),
    };
  }

  function validateGraph(graph){
    if(!graph || graph.schemaVersion !== 1 || !Array.isArray(graph.nodes) ||
       !Array.isArray(graph.edges) || !Array.isArray(graph.trailNodes)) return false;
    if(graph.nodes.length < 2 || graph.edges.length < 1 || graph.trailNodes.length < 1) return false;
    if(graph.nodes.some(node => !validPoint(pointFromNode(node)))) return false;
    if(!graph.trailNodes.every(index => Number.isInteger(index) && index >= 0 && index < graph.nodes.length)) return false;
    return graph.edges.every(edge => Array.isArray(edge) && edge.length >= 3 &&
      Number.isInteger(edge[0]) && Number.isInteger(edge[1]) &&
      edge[0] >= 0 && edge[0] < graph.nodes.length &&
      edge[1] >= 0 && edge[1] < graph.nodes.length &&
      Number.isFinite(edge[2]) && edge[2] > 0);
  }

  class MinQueue {
    constructor(){ this.items = []; }
    get length(){ return this.items.length; }
    push(item){
      this.items.push(item);
      let index = this.items.length - 1;
      while(index > 0){
        const parent = Math.floor((index - 1) / 2);
        if(this.items[parent][0] <= item[0]) break;
        this.items[index] = this.items[parent];
        index = parent;
      }
      this.items[index] = item;
    }
    shift(){
      if(!this.items.length) return null;
      const first = this.items[0];
      const last = this.items.pop();
      if(this.items.length){
        let index = 0;
        while(true){
          const left = index * 2 + 1;
          const right = left + 1;
          if(left >= this.items.length) break;
          const child = right < this.items.length && this.items[right][0] < this.items[left][0]
            ? right
            : left;
          if(this.items[child][0] >= last[0]) break;
          this.items[index] = this.items[child];
          index = child;
        }
        this.items[index] = last;
      }
      return first;
    }
  }

  function nearestEdge(position, graph){
    let nearest = null;
    graph.edges.forEach((edge, edgeIndex) => {
      const start = pointFromNode(graph.nodes[edge[0]]);
      const end = pointFromNode(graph.nodes[edge[1]]);
      const candidate = nearestPointOnSegment(position, start, end);
      if(!nearest || candidate.distanceM < nearest.distanceM){
        nearest = { ...candidate, edge, edgeIndex, start, end };
      }
    });
    return nearest;
  }

  function routeToTrail(position, graph, options){
    options = options || {};
    if(!validPoint(position) || !validateGraph(graph)) return null;
    const maxSnapDistanceM = Number.isFinite(options.maxSnapDistanceM)
      ? options.maxSnapDistanceM
      : 35;
    const maxRouteDistanceM = Number.isFinite(options.maxRouteDistanceM)
      ? options.maxRouteDistanceM
      : 1500;
    const snapped = nearestEdge(position, graph);
    if(!snapped || snapped.distanceM > maxSnapDistanceM) return null;

    const adjacency = Array.from({ length:graph.nodes.length }, () => []);
    graph.edges.forEach(edge => {
      adjacency[edge[0]].push([edge[1], edge[2]]);
      adjacency[edge[1]].push([edge[0], edge[2]]);
    });
    const goals = new Set(graph.trailNodes);
    const distances = Array(graph.nodes.length).fill(Infinity);
    const previous = Array(graph.nodes.length).fill(-1);
    const queue = new MinQueue();
    const edgeLength = snapped.edge[2];
    const sourceCandidates = [
      [snapped.edge[0], edgeLength * snapped.fraction],
      [snapped.edge[1], edgeLength * (1 - snapped.fraction)],
    ];
    sourceCandidates.forEach(([nodeIndex, distance]) => {
      if(distance < distances[nodeIndex]){
        distances[nodeIndex] = distance;
        queue.push([distance, nodeIndex]);
      }
    });

    let goal = -1;
    while(queue.length){
      const [distance, nodeIndex] = queue.shift();
      if(distance !== distances[nodeIndex]) continue;
      if(distance > maxRouteDistanceM) break;
      if(goals.has(nodeIndex)){
        goal = nodeIndex;
        break;
      }
      adjacency[nodeIndex].forEach(([next, cost]) => {
        const candidate = distance + cost;
        if(candidate < distances[next]){
          distances[next] = candidate;
          previous[next] = nodeIndex;
          queue.push([candidate, next]);
        }
      });
    }
    if(goal < 0) return null;

    const nodePath = [];
    for(let cursor = goal; cursor >= 0; cursor = previous[cursor]){
      nodePath.push(cursor);
      if(previous[cursor] < 0) break;
    }
    nodePath.reverse();
    const path = [snapped.point, ...nodePath.map(index => pointFromNode(graph.nodes[index]))];
    const dedupedPath = path.filter((point, index) => !index ||
      point.lat !== path[index - 1].lat || point.lng !== path[index - 1].lng);
    return {
      version:VERSION,
      routingMode:'mapped-footpath',
      path:dedupedPath,
      target:dedupedPath[dedupedPath.length - 1],
      distanceM:distances[goal],
      snapDistanceM:snapped.distanceM,
      goalNode:goal,
      source:'openstreetmap',
    };
  }

  // Route between two arbitrary points on the same published walking graph.
  // This lets one regional graph serve trail access and user-selected mapped
  // route points instead of requiring a bespoke graph for every interaction.
  function routeToPoint(position, target, graph, options){
    options = options || {};
    if(!validPoint(position) || !validPoint(target) || !validateGraph(graph)) return null;
    const maxSnapDistanceM = Number.isFinite(options.maxSnapDistanceM)
      ? options.maxSnapDistanceM
      : 35;
    const maxTargetSnapDistanceM = Number.isFinite(options.maxTargetSnapDistanceM)
      ? options.maxTargetSnapDistanceM
      : 90;
    const maxRouteDistanceM = Number.isFinite(options.maxRouteDistanceM)
      ? options.maxRouteDistanceM
      : 5000;
    const sourceSnap = nearestEdge(position, graph);
    const targetSnap = nearestEdge(target, graph);
    if(!sourceSnap || sourceSnap.distanceM > maxSnapDistanceM ||
       !targetSnap || targetSnap.distanceM > maxTargetSnapDistanceM) return null;

    if(sourceSnap.edgeIndex === targetSnap.edgeIndex){
      const distanceM = sourceSnap.edge[2] * Math.abs(sourceSnap.fraction - targetSnap.fraction);
      if(distanceM > maxRouteDistanceM) return null;
      return {
        version:VERSION,
        routingMode:'mapped-point',
        path:[sourceSnap.point, targetSnap.point],
        target:targetSnap.point,
        distanceM,
        snapDistanceM:sourceSnap.distanceM,
        targetSnapDistanceM:targetSnap.distanceM,
        source:'openstreetmap',
      };
    }

    const adjacency = Array.from({ length:graph.nodes.length }, () => []);
    graph.edges.forEach(edge => {
      adjacency[edge[0]].push([edge[1], edge[2]]);
      adjacency[edge[1]].push([edge[0], edge[2]]);
    });
    const distances = Array(graph.nodes.length).fill(Infinity);
    const previous = Array(graph.nodes.length).fill(-1);
    const queue = new MinQueue();
    [
      [sourceSnap.edge[0], sourceSnap.edge[2] * sourceSnap.fraction],
      [sourceSnap.edge[1], sourceSnap.edge[2] * (1 - sourceSnap.fraction)],
    ].forEach(([nodeIndex, distance]) => {
      if(distance < distances[nodeIndex]){
        distances[nodeIndex] = distance;
        queue.push([distance, nodeIndex]);
      }
    });
    while(queue.length){
      const [distance, nodeIndex] = queue.shift();
      if(distance !== distances[nodeIndex]) continue;
      if(distance > maxRouteDistanceM) break;
      adjacency[nodeIndex].forEach(([next, cost]) => {
        const candidate = distance + cost;
        if(candidate < distances[next] && candidate <= maxRouteDistanceM){
          distances[next] = candidate;
          previous[next] = nodeIndex;
          queue.push([candidate, next]);
        }
      });
    }
    const selected = [
      [targetSnap.edge[0], targetSnap.edge[2] * targetSnap.fraction],
      [targetSnap.edge[1], targetSnap.edge[2] * (1 - targetSnap.fraction)],
    ].map(([nodeIndex, finalCost]) => ({
      nodeIndex,
      distanceM:distances[nodeIndex] + finalCost,
    })).filter(candidate => Number.isFinite(candidate.distanceM))
      .sort((first, second) => first.distanceM - second.distanceM)[0];
    if(!selected || selected.distanceM > maxRouteDistanceM) return null;

    const nodePath = [];
    for(let cursor = selected.nodeIndex; cursor >= 0; cursor = previous[cursor]){
      nodePath.push(cursor);
      if(previous[cursor] < 0) break;
    }
    nodePath.reverse();
    const path = [sourceSnap.point, ...nodePath.map(index => pointFromNode(graph.nodes[index])), targetSnap.point];
    const dedupedPath = path.filter((point, index) => !index ||
      point.lat !== path[index - 1].lat || point.lng !== path[index - 1].lng);
    return {
      version:VERSION,
      routingMode:'mapped-point',
      path:dedupedPath,
      target:targetSnap.point,
      distanceM:selected.distanceM,
      snapDistanceM:sourceSnap.distanceM,
      targetSnapDistanceM:targetSnap.distanceM,
      source:'openstreetmap',
    };
  }

  root.DoloPawsFootpathRouter = Object.freeze({
    VERSION,
    routeToPoint,
    validateGraph,
    routeToTrail,
  });
})(typeof window !== 'undefined' ? window : globalThis);
