(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ChordProgressionGraph = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  const roots = {C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,'E#':5,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};
  const intervals = {maj:[0,4,7],m:[0,3,7],dim:[0,3,6],aug:[0,4,8],'7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10]};
  const chordPattern = /^([A-G](?:#|b)?)(maj7|m7|dim|aug|7|m)?(?:\/([A-G](?:#|b)?))?$/;

  function parseChord(symbol) {
    const match = chordPattern.exec(symbol);
    if (!match) return null;
    const root = roots[match[1]], quality = match[2] || 'maj';
    const pcs = [...new Set(intervals[quality].map(value => (root + value) % 12))].sort((a, b) => a - b);
    return {symbol, root, quality, key:pcs.join(',')};
  }

  function parseProgression(label, index = 0) {
    const separator = label.indexOf(' · ');
    const category = separator < 0 ? 'Other' : label.slice(0, separator);
    const body = (separator < 0 ? label : label.slice(separator + 3)).split(/[;(]/)[0];
    const symbols = body.match(/[A-G](?:#|b)?(?:maj7|m7|dim|aug|7|m)?(?:\/[A-G](?:#|b)?)?/g) || [];
    const chords = symbols.map(parseChord).filter(Boolean);
    return {index, category, chords, start:chords[0]?.key || null, end:chords[chords.length - 1]?.key || null};
  }

  function buildGraph(labels) {
    const progressions = labels.map(parseProgression);
    const edges = [], outgoing = progressions.map(() => []);
    progressions.forEach((source, from) => progressions.forEach((target, to) => {
      if (source.end && source.end === target.start) {
        edges.push({from, to});
        outgoing[from].push(to);
      }
    }));
    return {progressions, edges, outgoing};
  }

  function isStronglyConnected(graph) {
    const count = graph.progressions.length;
    if (!count) return true;
    const reachesAll = adjacency => {
      const seen = new Set([0]), pending = [0];
      while (pending.length) for (const next of adjacency[pending.pop()]) if (!seen.has(next)) { seen.add(next); pending.push(next); }
      return seen.size === count;
    };
    const forward = graph.progressions.map((_, index) => graph.outgoing[index]);
    const reverse = graph.progressions.map(() => []);
    graph.edges.forEach(({from, to}) => reverse[to].push(from));
    return reachesAll(forward) && reachesAll(reverse);
  }

  return {parseChord, parseProgression, buildGraph, isStronglyConnected};
});
