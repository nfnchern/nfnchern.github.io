const test = require('node:test');
const assert = require('node:assert/strict');

global.window = {};
require('./progressions.js');
const graphTools = require('./progression-graph.js');

const progressionSets = global.window.chordProgressionsByLevel;
const chordDecks = global.window.chordDeckSymbolsByLevel;

test('pathway progressions use chords from their level deck', () => {
  progressionSets.forEach((labels, index) => {
    const graph = graphTools.buildGraph(labels);
    const deck = new Set(chordDecks[index].map(symbol => {
      const chord = graphTools.parseChord(symbol);
      return `${chord.root}:${chord.quality}`;
    }));
    assert.ok(graph.progressions.length, `level ${index + 1} has no progressions`);
    graph.progressions.forEach(progression => {
      assert.ok(progression.chords.length >= 2, `level ${index + 1} has an invalid progression`);
      progression.chords.forEach(chord => {
        assert.ok(deck.has(`${chord.root}:${chord.quality}`), `level ${index + 1} progression uses chord ${chord.symbol} outside its deck`);
      });
    });
  });
});
