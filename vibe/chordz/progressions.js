// Chord progressions represented in each learning pathway level's graph.
window.chordProgressionsByLevel = [
  ['Western pop · C – F – G – C (I–IV–V–I)','Western pop · C – G – Am – F (I–V–vi–IV)','Western pop · Am – F – C – G (vi–IV–I–V)','Western pop · C – Am – F – G (I–vi–IV–V)','Western pop · Dm – G – C – Am (ii–V–I–vi)','Western pop · F – C – G – Am (IV–I–V–vi)','J-pop Royal Road · F – G – Em – Am (IV–V–iii–vi)','J-pop Royal Road rotation · Em – Am – F – G','Chinese pop canon · C – G – Am – Em – F – C – Dm – G','Chinese R&B circle · F – G – Em – Am – Dm – G – C','Taiwanese Mandopop descending bass · C – G/B – Am – Em/G – F – C/E – Dm – G','Korean pop shared loop · C – G – Am – F'],
  ['Western pop · D – G – A – D (I–IV–V–I)','Western pop · D – A – G – D (I–V–IV–I)','Western pop · A – D – E – A (I–IV–V–I)','Western pop · A – E – D – A (I–V–IV–I)','Western pop · E – D – A – E (I–♭VII–IV–I)','Western pop · E – A – D – E (I–IV–♭VII–I)','J-pop Royal Road · F – G – Em – Am','J-pop Royal Road rotation · Am – F – G – Em','Chinese pop canon · C – G – Am – Em – F – C – Dm – G','Taiwanese Mandopop descending bass · C – G/B – Am – Em/G – F – C/E – Dm – G','Korean pop shared ballad loop · Am – F – C – G'],
  ['Western pop · C – G – Am – F','Western pop · G – D – Em – C','Western pop · D – A – Bm – G','Western pop · A – E – F#m – D','Western pop · E – B – C#m – A','J-pop Royal Road · F – G – Em – Am (in C)','J-pop Royal Road · C – D – Bm – Em (in G)','J-pop Royal Road · G – A – F#m – Bm (in D)','J-pop Royal Road · D – E – C#m – F#m (in A)','J-pop Royal Road · A – B – G#m – C#m (in E)','Chinese pop canon in G · G – D – Em – Bm – C – G – Am – D','Chinese R&B circle in C · F – G – Em – Am – Dm – G – C','Taiwanese Mandopop descending bass in G · G – D/F# – Em – Bm/D – C – G/B – Am – D','Korean pop shared loop in G · G – D – Em – C'],
  ['Western pop · Dm7 – G7 – Cmaj7 (ii7–V7–Imaj7)','Western pop · Cmaj7 – Am7 – Fmaj7 – G7','Western pop ballad · Am7 – Dm7 – G7 – Cmaj7','Western pop · Dm7 – Cmaj7 – G7 – Am7','Western pop · Cmaj7 – Fmaj7 – G7','J-pop Royal Road · Fmaj7 – G7 – Em7 – Am7','J-pop Royal Road rotation · Em7 – Am7 – Fmaj7 – G7','J-pop Royal Road rotation · Am7 – Fmaj7 – G7 – Em7','Chinese R&B circle · Fmaj7 – G7 – Em7 – Am7 – Dm7 – G7 – Cmaj7','Taiwanese Mandopop descending bass · C – G/B – Am – Em/G – F – C/E – Dm – G','Korean pop shared pop color · Cmaj7 – G7 – Am7 – Fmaj7'],
  ['Western pop · Dm7 – G7 – Cmaj7','Western pop · Am7 – D7 – Gmaj7','Western pop · F#m7 – B7 – Emaj7','Western pop · Cmaj7 – G7 – Am7 – Fmaj7','Western pop · Gmaj7 – D7 – Em7 – Cmaj7','J-pop Royal Road · Fmaj7 – G7 – Em7 – Am7 (in C)','J-pop Royal Road · Cmaj7 – D7 – Bm7 – Em7 (in G)','J-pop Royal Road · Gmaj7 – A7 – F#m7 – Bm7 (in D)','J-pop Royal Road · Dmaj7 – E7 – C#m7 – F#m7 (in A)','J-pop Royal Road · Amaj7 – B7 – G#m7 – C#m7 (in E)','Chinese R&B circle in E · Amaj7 – B7 – G#m7 – C#m7 – F#m7 – B7 – Emaj7','Taiwanese Mandopop descending bass · Cmaj7 – G/B – Am7 – Em/G – Fmaj7 – C/E – Dm7 – G7','Korean pop dance vamp · repeat Em7; groove and arrangement carry the movement'],
  ['Western pop color · C – Caug – F – Fm – C','Western pop color · C – Eaug – Am – F','Western passing chord · C – C#dim – Dm – G7 – C','Western pop color · C – E7 – Am – Fm – C','J-pop Royal Road color · Fmaj7 – F#dim – G7 – Em7 – Am7','Western pop with passing chord · Cmaj7 – C#dim – Dm7 – G7 – Cmaj7','Asian pop ballad color · C – Caug – Am – F','Asian pop color loop · Am – F – G – G#dim – Am','Chinese pop canon color variation · C – G/B – Am – G#dim – G – F – C/E – Dm – G','Taiwanese Mandopop descending bass variation · C – G/B – Am – G#dim – G – F – Fm – C/E – Dm – G','Korean pop shared color loop · Cmaj7 – C#dim – Dm7 – G7 – Cmaj7']
];

const roots = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const triads = roots.flatMap(root => [root, root + 'm']);
const sevenths = roots.flatMap(root => [root + '7', root + 'maj7', root + 'm7']);
const chordSets = [
  ['C','F','G','Am','Dm','Em'],
  ['C','F','G','Am','Dm','Em','D','A','E'],
  triads,
  [...triads,'G7','Cmaj7','Fmaj7','Gmaj7','Am7','Dm7','Em7'],
  [...triads,...sevenths],
  [...triads,...sevenths,...roots.flatMap(root => [root + 'dim',root + 'aug'])]
];
window.chordDeckSymbolsByLevel = chordSets;
window.chordProgressionsByLevel = window.chordProgressionsByLevel.map((progressions, level) => {
  const chords = chordSets[level];
  const bridges = chords.map((chord, index) => {
    const next = chords[(index + 1) % chords.length];
    return `Level bridge · ${chord} – ${next}`;
  });
  return [...progressions, ...bridges];
});
