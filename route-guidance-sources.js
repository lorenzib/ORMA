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
      sentences: ['This is ORMA’s suggestion, not one published by the trail’s operator.'],
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

  const api = { SOURCES, splitSources };
  global.DoloPawsRouteGuidanceSources = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
