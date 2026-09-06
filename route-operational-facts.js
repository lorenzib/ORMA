(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsOperationalFacts = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const CONTRACT_VERSION = '1.0.0';

  const ENTITY_TYPES = Object.freeze(['rifugio', 'lift', 'protected-area']);
  // `unknown` is a recorded answer: someone asked and could not get one. It is
  // not the same as an unverified fact, which has no answer at all.
  const DOG_POLICIES = Object.freeze([
    'accepted',
    'accepted_leashed',
    'accepted_muzzled',
    'not_accepted',
    'unknown',
  ]);
  const VERIFIED_SOURCES = Object.freeze(['phone', 'website', 'email', 'in-person']);

  const POLICY_LABEL = Object.freeze({
    accepted: 'dogs accepted',
    accepted_leashed: 'dogs accepted, leashed',
    accepted_muzzled: 'muzzle required',
    not_accepted: 'dogs not accepted',
    unknown: 'policy not published',
  });
  const ENTITY_LABEL = Object.freeze({
    rifugio: 'Rifugio',
    lift: 'Lift',
    'protected-area': 'Protected area',
  });

  const UNVERIFIED_NOTE = 'Not yet verified, check before you go';
  // A year is the point past which an opening-hours or dog rule is likely to
  // have moved without anyone telling us.
  const STALE_AFTER_MONTHS = 12;

  const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;
  const TRAIL_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function isDate(value){
    return typeof value === 'string' && DATE_PATTERN.test(value)
      && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  }

  function text(value, maximum){
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
  }

  // A fact is only usable when it can be attributed. An entry that claims a
  // policy without a verification date, source and reviewer is rejected
  // outright rather than shown with a caveat: an unattributable policy on a
  // dog-safety page is worse than no policy at all.
  function validateFact(fact, index){
    const at = `/facts/${index}`;
    const errors = [];
    if(!fact || typeof fact !== 'object'){ return [`${at}: expected an object`]; }
    if(typeof fact.id !== 'string' || !ID_PATTERN.test(fact.id)) errors.push(`${at}/id: expected a slug`);
    if(typeof fact.trail_id !== 'string' || !TRAIL_PATTERN.test(fact.trail_id)) errors.push(`${at}/trail_id: expected a trail id`);
    if(!ENTITY_TYPES.includes(fact.entity_type)) errors.push(`${at}/entity_type: expected one of ${ENTITY_TYPES.join(', ')}`);
    if(!text(fact.entity_name, 160)) errors.push(`${at}/entity_name: expected a non-empty name`);
    if(!DOG_POLICIES.includes(fact.dog_policy)) errors.push(`${at}/dog_policy: expected one of ${DOG_POLICIES.join(', ')}`);
    if(fact.policy_notes !== null && !text(fact.policy_notes, 400)) errors.push(`${at}/policy_notes: expected text or null`);

    const verified = fact.verified_at !== null && fact.verified_at !== undefined;
    if(verified && !isDate(fact.verified_at)) errors.push(`${at}/verified_at: expected an ISO date or null`);
    if(verified){
      if(!VERIFIED_SOURCES.includes(fact.verified_source)) errors.push(`${at}/verified_source: expected one of ${VERIFIED_SOURCES.join(', ')}`);
      if(!text(fact.verified_by, 120)) errors.push(`${at}/verified_by: expected a reviewer`);
    }else{
      // Without a date there is nothing standing behind the policy, so the
      // only value it may carry is `unknown`.
      if(fact.dog_policy !== 'unknown'){
        errors.push(`${at}/dog_policy: an unverified fact may only record 'unknown'`);
      }
    }
    return errors;
  }

  function validateTable(table){
    const errors = [];
    if(!table || typeof table !== 'object') return ['/: expected an object'];
    if(table.contractVersion !== CONTRACT_VERSION) errors.push(`/contractVersion: expected ${CONTRACT_VERSION}`);
    if(table.updatedAt !== null && !isDate(table.updatedAt)) errors.push('/updatedAt: expected an ISO date or null');
    if(!Array.isArray(table.facts)) return errors.concat('/facts: expected an array');
    const seen = new Set();
    table.facts.forEach((fact, index) => {
      errors.push(...validateFact(fact, index));
      if(fact && typeof fact.id === 'string'){
        if(seen.has(fact.id)) errors.push(`/facts/${index}/id: duplicate id`);
        seen.add(fact.id);
      }
    });
    return errors;
  }

  function monthsBetween(fromISO, toISO){
    const from = new Date(`${fromISO}T00:00:00Z`);
    const to = new Date(`${toISO}T00:00:00Z`);
    return (to.getUTCFullYear() - from.getUTCFullYear()) * 12
      + (to.getUTCMonth() - from.getUTCMonth());
  }

  function monthLabel(iso){
    const date = new Date(`${iso}T00:00:00Z`);
    return date.toLocaleDateString('en-GB', { month:'short', year:'numeric', timeZone:'UTC' });
  }

  function verification(fact, asOfDate){
    if(!fact || !isDate(fact.verified_at)) return { state:'unverified', label:UNVERIFIED_NOTE };
    const label = monthLabel(fact.verified_at);
    const asOf = isDate(asOfDate) ? asOfDate : new Date().toISOString().slice(0, 10);
    if(monthsBetween(fact.verified_at, asOf) >= STALE_AFTER_MONTHS){
      return { state:'stale', label:`Last verified ${label}, may have changed`, verifiedLabel:label };
    }
    return { state:'verified', label:`Verified ${label}`, verifiedLabel:label };
  }

  function factsFor(trailId, table){
    const facts = table && Array.isArray(table.facts) ? table.facts : [];
    return facts.filter(fact => fact && fact.trail_id === trailId);
  }

  // Render-ready rows for one trail. Entities ORMA already knows about (the
  // km-tagged rifugi on the route) appear even with no fact recorded, so the
  // page can name them and say plainly that nobody has checked yet. That is
  // the difference between "we have not asked" and "there is nothing here".
  function rowsFor(trail, table, asOfDate){
    if(!trail || typeof trail.id !== 'string') return [];
    const facts = factsFor(trail.id, table);
    const byName = new Map();
    for(const fact of facts){
      byName.set(String(fact.entity_name).trim().toLowerCase(), fact);
    }

    const rows = facts.map(fact => ({
      entityType: fact.entity_type,
      entityName: fact.entity_name,
      policy: fact.dog_policy,
      policyLabel: POLICY_LABEL[fact.dog_policy],
      notes: fact.policy_notes || null,
      km: null,
      ...verification(fact, asOfDate),
    }));

    const rifugi = Array.isArray(trail.rifugi) ? trail.rifugi : [];
    for(const place of rifugi){
      const name = place && typeof place.name === 'string' ? place.name.trim() : '';
      if(!name || byName.has(name.toLowerCase())) continue;
      rows.push({
        entityType:'rifugio',
        entityName:name,
        // No fact means no policy. Never a default, never an empty string.
        policy:null,
        policyLabel:null,
        notes:null,
        km:Number.isFinite(place.km) ? place.km : null,
        state:'unverified',
        label:UNVERIFIED_NOTE,
      });
    }

    return rows.sort((a, b) => {
      if(a.km !== null && b.km !== null) return a.km - b.km;
      if(a.km !== null) return -1;
      if(b.km !== null) return 1;
      return a.entityName.localeCompare(b.entityName);
    });
  }

  return Object.freeze({
    CONTRACT_VERSION,
    ENTITY_TYPES,
    DOG_POLICIES,
    VERIFIED_SOURCES,
    POLICY_LABEL,
    ENTITY_LABEL,
    UNVERIFIED_NOTE,
    STALE_AFTER_MONTHS,
    validateFact,
    validateTable,
    verification,
    factsFor,
    rowsFor,
  });
});
