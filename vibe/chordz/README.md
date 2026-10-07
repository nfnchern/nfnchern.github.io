# chordz

A static progressive web app for practicing piano chords, hosted separately from the original profile page in `chords.html`. It can be hosted from a `USERNAME.github.io` repository with GitHub Pages.

## Publish

Push the files to the repository's `main` branch and enable **Settings → Pages → Deploy from a branch → main / (root)**. Open `/vibe/chordz/` for the practice app; the original homepage remains `index.html`.

## Piano input

The app requests MIDI access on launch. Grant access and connect a USB or Bluetooth MIDI keyboard; if several keyboards are connected, choose one from the input list. MIDI note-on/off events drive the keyboard indicators and chord matcher directly. Web MIDI requires HTTPS and a browser that supports the API. The app does not record or upload MIDI events. The first visit needs a network connection; the service worker caches the practice app for later offline use.

## Chord pathway

The six levels follow a gradual piano-teaching path: learn the six diatonic chords in C together, then add major and minor triads in more keys. Seventh chords follow once the triads are familiar, with diminished and augmented triads as an advanced final group. Each level includes earlier chords for review, and you can choose any level at any time. A graph beneath the practice card maps that level’s Western and Asian pop progressions without displaying their chord sequences. Each node is one progression, and a directed arrow connects two nodes when the first progression ends on a chord equivalent to the second progression’s opening chord. Chord equivalence includes enharmonic spellings and ignores inversions. Progression connections reflect the listed sequences; the graph does not add artificial transitions to connect otherwise separate groups.

Progression walk is the default flash-card mode. It starts at a random graph node, presents that progression’s chords one at a time, then chooses an outgoing edge at random to select the next progression. If a node has no outgoing edge, it chooses another random node. A bright outline on the graph marks the current node. Use the button in Settings to switch to the fully random chord deck. The selected mode is saved on this device. Run `node --test vibe/chordz/progressions.test.js` to check progression data against each level's chord deck.

The full chord library appears below the practice deck. Its rows are roots and columns are chord qualities. Highlighted chords are included in the selected level; tap any chord to add or remove it, including chords beyond that level's suggested set. Chord edits are saved for the currently selected level, while the suggested level presets stay unchanged. Selecting a level restores its preset. Level choice and the current edit are saved on this device. Level 6 contains all 84 chords. Guided mode shows two chord voicings: blue for left hand and lime for right hand; coral marks detected notes.
