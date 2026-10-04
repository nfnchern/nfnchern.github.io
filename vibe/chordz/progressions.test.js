const test = require('node:test');
const assert = require('node:assert/strict');

global.window = {};
require('./progressions.js');
const graphTools = require('./progression-graph.js');

const progressionSets = global.window.chordProgressionsByLevel;
const chordDecks = global.window.chordDeckSymbolsByLevel;

test('each pathway level progression graph is strongly connected', () => {
  progressionSets.forEach((labels, index) => {
    const graph = graphTools.buildGraph(labels);
    assert.ok(graphTools.isStronglyConnected(graph), `level ${index + 1} has unreachable progression vertices`);
  });
});

test('each chord in every pathway level appears in at least one progression', () => {
  progressionSets.forEach((labels, index) => {
    const covered = new Set(labels.flatMap(label => graphTools.parseProgression(label).chords.map(chord => `${chord.root}:${chord.quality}`)));
    chordDecks[index].forEach(symbol => {
      const chord = graphTools.parseChord(symbol);
      assert.ok(covered.has(`${chord.root}:${chord.quality}`), `level ${index + 1} chord ${symbol} is not covered by any progression`);
    });
  });
});
