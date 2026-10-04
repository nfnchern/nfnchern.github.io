# chordz

A static progressive web app for practicing piano chords, hosted separately from the original profile page in `chords.html`. It can be hosted from a `USERNAME.github.io` repository with GitHub Pages.

## Publish

Push the files to the repository's `main` branch and enable **Settings → Pages → Deploy from a branch → main / (root)**. Open `/vibe/chordz/` for the practice app; the original homepage remains `index.html`.

## Piano input

- **Microphone:** Desktop browsers request microphone access on launch and begin calibration automatically. On iOS, tap **Start listening** first so the browser can activate its audio engine. Calibration runs in the chord card: stay quiet briefly; play and release C3–B3, then C4–B4; then play and release the six Level 1 chords with the left hand and again with the right. Each prompt advances after sound is captured, even when pitch recognition is uncertain. Access requires HTTPS, which GitHub Pages supplies. Use **Stop listening** if you want to pause.
- Correct chords advance automatically. Place the phone near the piano, or connect a USB audio interface to the phone's microphone input.

The app does not record or upload microphone audio. Calibration saves quiet-room and playing levels plus compact note and chord detection profiles on this device. The microphone requests disabled echo cancellation, noise suppression, and automatic gain control where supported; browser behavior varies. If microphone access is denied, allow it in the browser's site settings and restart listening. The first visit needs a network connection; the service worker caches the practice app for later offline use. For the most reliable iPhone installation, open the Pages URL in Safari, tap Share, then **Add to Home Screen**.

## Chord pathway

The six levels follow a gradual piano-teaching path: learn the six diatonic chords in C together, then add major and minor triads in more keys. Seventh chords follow once the triads are familiar, with diminished and augmented triads as an advanced final group. Each level includes earlier chords for review, and you can choose any level at any time. A graph beneath the practice card maps that level’s Western and Asian pop progressions without displaying their chord sequences. Each node is one progression, and a directed arrow connects two nodes when the first progression ends on a chord equivalent to the second progression’s opening chord. Chord equivalence includes enharmonic spellings and ignores inversions. Short transitions connect the progression nodes into a strongly connected graph, and each level chord appears in at least one progression.

Progression walk is the default flash-card mode. It starts at a random graph node, presents that progression’s chords one at a time, then chooses an outgoing edge at random to select the next progression. A bright outline on the graph marks the current node. Use the button in the flash-card header to switch to the previous fully random chord deck. The selected mode is saved on this device. Run `node --test vibe/chordz/progressions.test.js` to check graph reachability and chord coverage for every level.

The full chord library appears below the practice deck. Its rows are roots and columns are chord qualities. Highlighted chords are included in the selected level; tap any chord to add or remove it, including chords beyond that level's suggested set. Chord edits are saved for the currently selected level, while the suggested level presets stay unchanged. Selecting a level restores its preset. Level choice and the current edit are saved on this device. Level 6 contains all 84 chords. Guided mode shows two chord voicings: blue for left hand and lime for right hand; coral marks detected notes. Calibration prompts and highlighted keys appear in the chord card and include all six Level 1 chords in both registers.
