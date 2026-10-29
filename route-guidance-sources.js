(function (global) {
  'use strict';

  // Where each line of "How to follow this route" came from, said once.
  //
  // Every stored value ends with its own source sentence, because a value is
  // quoted far from its citation (backoffice/OPERATING_STANDARD.md, "Read off
  // the map"). On the card that put the same long sentence after every line,
  // so the card takes the sentence off each line and says it once underneath,
  // naming the lines it covers. Values written before 26 October 2026 carry
  // the old map sentence, and a live record may still hold it, so both are
  // known here.
  const SOURCES = [
    {
      key: 'orma',
      sentences: [
        'This is ORMA’s suggestion, not one published by the trail’s operator.',
        'ORMA’s own suggestion from the walk it recorded, not an operator’s recommendation.',
      ],
      one: 'is ORMA’s suggestion',
      many: 'are ORMA’s suggestion',
    },
    {
      key: 'map',
      sentences: [
        'Read off the map (OpenStreetMap), not from directions the trail’s operator published.',
        'Read from the OpenStreetMap route relations this walk is built from, not from a published route description.',
      ],
      one: 'is read off the map (OpenStreetMap)',
      many: 'are read off the map (OpenStreetMap)',
    },
  ];

  const NAMES = {
    'Start': 'the start',
    'Trail numbers': 'the trail numbers',
    'Trail numbers and route': 'the route',
    'Route': 'the route',
    'Where to switch': 'where to switch',
    'Key turns': 'the key turns',
  };

  function listed(names) {
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }

  /**
   * `lines` are [label, text] pairs. Returns the same lines with their source
   * sentence taken off, and the one note that says what each source covers,
   * or '' when no line carried one.
   */
  function splitSources(lines) {
    const found = new Map();
    const stripped = (lines || []).map(([label, text]) => {
      let said = String(text == null ? '' : text);
      SOURCES.forEach(source => source.sentences.forEach(sentence => {
        if (!said.includes(sentence)) return;
        said = said.replace(sentence, '').replace(/\s{2,}/g, ' ').trim();
        if (!found.has(source.key)) found.set(source.key, []);
        const name = NAMES[label] || String(label).toLowerCase();
        if (!found.get(source.key).includes(name)) found.get(source.key).push(name);
      }));
      return [label, said];
    });
    const parts = SOURCES.filter(source => found.has(source.key)).map(source => {
      const names = found.get(source.key);
      const text = `${listed(names)} ${names.length > 1 || /s$/.test(names[0]) ? source.many : source.one}`;
      return text.charAt(0).toUpperCase() + text.slice(1);
    });
    const note = parts.length
      ? `${parts.join('. ')}. None of it was published by the trail’s operator.`
      : '';
    return { lines: stripped, note };
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  function readOn(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return match ? `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : '';
  }

  const STEPS_BADGE = 'No trail numbers on this walk: follow these landmarks';

  /**
   * A walk with no trail numbers, given turn by turn (OPERATING_STANDARD.md,
   * "A walk with no number says how to follow it"). Each step names the
   * sources it rests on by their place in `guidance.sources`, and each source
   * carries the short tag the card prints after the step -- "tourist office",
   * "map" -- so a reader can tell the operator's own words from what ORMA read
   * off OpenStreetMap to place them.
   *
   * All or nothing: a step citing no source, or a source with no https link,
   * date or tag, and the card shows the Route and Key turns lines instead,
   * which every landmark record still carries.
   */
  function landmarkSteps(guidance) {
    if (!guidance || guidance.mode !== 'landmarks') return null;
    const sources = Array.isArray(guidance.sources) ? guidance.sources : [];
    const steps = Array.isArray(guidance.steps) ? guidance.steps : [];
    const usable = index => {
      const source = sources[index];
      return Boolean(source && String(source.tag || '').trim() && String(source.label || '').trim()
        && /^https:\/\//.test(source.url || '') && readOn(source.reviewedAt));
    };
    const sourced = step => Boolean(step && String(step.text || '').trim()
      && Array.isArray(step.from) && step.from.length > 0 && step.from.every(usable));
    if (!steps.length || !steps.every(sourced)) return null;
    const used = [...new Set(steps.flatMap(step => step.from))].sort((a, b) => a - b);
    return {
      badge: STEPS_BADGE,
      steps: steps.map(step => ({
        text: String(step.text).trim(),
        tags: [...new Set(step.from.map(index => String(sources[index].tag).trim()))],
      })),
      // One line per source: `${before}${label}${after}`, the label linked.
      credits: used.map(index => {
        const source = sources[index];
        const by = String(source.authority || '').trim();
        return {
          before: `Steps marked “${String(source.tag).trim()}”: `,
          label: String(source.label).trim(),
          url: source.url,
          after: `${by ? `, ${by}` : ''}, read ${readOn(source.reviewedAt)}.`,
        };
      }),
    };
  }

  const api = { SOURCES, STEPS_BADGE, splitSources, landmarkSteps };
  global.DoloPawsRouteGuidanceSources = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
