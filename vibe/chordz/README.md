# Chord Garden

A static progressive web app for practicing piano chords, hosted separately from the original profile page in `chords.html`. It can be hosted from a `USERNAME.github.io` repository with GitHub Pages.

## Publish

Push the files to the repository's `main` branch and enable **Settings → Pages → Deploy from a branch → main / (root)**. Open `/vibe/chordz/` for the practice app; the original homepage remains `index.html`.

## Piano input

- **Microphone:** The page requests microphone access on launch and begins calibration automatically. After two seconds of quiet, play and release C4, D4, E4, F4, G4, A4, and B4 as prompted, then play and release C major, A minor, and G7. You can skip the chord check. Access requires HTTPS, which GitHub Pages supplies. Use **Stop listening** if you want to pause.
- Correct chords advance automatically. Place the phone near the piano, or connect a USB audio interface to the phone's microphone input.

The app does not record or upload microphone audio. Calibration saves quiet-room and playing levels plus compact note and chord detection profiles on this device. The microphone requests disabled echo cancellation, noise suppression, and automatic gain control where supported; browser behavior varies. If microphone access is denied, allow it in the browser's site settings and restart listening. The first visit needs a network connection; the service worker caches the practice app for later offline use. For the most reliable iPhone installation, open the Pages URL in Safari, tap Share, then **Add to Home Screen**.

## Chord pathway

The six levels follow a gradual piano-teaching path: learn the six diatonic chords in C together, then add major and minor triads in more keys. Seventh chords follow once the triads are familiar, with diminished and augmented triads as an advanced final group. Each level includes earlier chords for review, and you can choose any level at any time.

The full chord library appears below the practice deck. Its rows are roots and columns are chord qualities. Highlighted chords are included in the selected level; tap any chord to add or remove it, including chords beyond that level's suggested set. Chord edits are saved for the currently selected level, while the suggested level presets stay unchanged. Selecting a level restores its preset. Level choice and the current edit are saved on this device. Level 6 contains all 84 chords. Guided mode shows two chord voicings: blue for left hand and lime for right hand; coral marks detected notes. Calibration opens a visual prompt for each step. After the C4–B4 notes, it asks for C major, A minor, and G7; you can skip the chord check.
