# Chord Garden

A static progressive web app for practicing piano chords, hosted separately from the original profile page in `chords.html`. It can be hosted from a `USERNAME.github.io` repository with GitHub Pages.

## Publish

Push the files to the repository's `main` branch and enable **Settings → Pages → Deploy from a branch → main / (root)**. Open `/vibe/chordz/` for the practice app; the original homepage remains `index.html`.

## Piano input

- **Microphone:** Listening starts when the page opens and uses the browser's live audio input to analyze pitch classes locally. The browser may ask you to grant microphone permission; access requires HTTPS, which GitHub Pages supplies. Use **Stop listening** if you want to pause. Optional **Calibrate with notes** measures two seconds of quiet, then prompts C4, D4, E4, F4, G4, A4, and B4. Each prompt advances only after the microphone detects the expected pitch at a sustained level above the measured room noise; release each note before playing the next.
- **Keyboard MIDI:** Uses Web MIDI when the browser supports it. Connect a USB MIDI keyboard or a compatible adapter before tapping Connect. iPhone Safari support varies by iOS/browser version.
- Correct chords advance automatically. If a direct digital connection is not exposed to Safari, use a USB audio interface as the microphone input.

The app does not record or upload microphone audio. Calibration saves only quiet-room and played-note levels on this device. The first visit needs a network connection; the service worker caches the practice app for later offline use. For the most reliable iPhone installation, open the Pages URL in Safari, tap Share, then **Add to Home Screen**.

## Chord pathway

The six levels follow a gradual piano-teaching path: learn the six diatonic chords in C together, then add major and minor triads in more keys. Seventh chords follow once the triads are familiar, with diminished and augmented triads as an advanced final group. Each level includes earlier chords for review, and you can choose any level at any time.

The full chord library appears below the practice deck. Its rows are roots and columns are chord qualities. Highlighted chords are included in the selected level; tap any chord to add or remove it, including chords beyond that level's suggested set. Level choice and custom chord selections are saved on this device. Level 6 contains all 84 chords. Guided mode shows two chord voicings: blue for left hand and lime for right hand; coral marks detected notes. Calibration opens a visual prompt for each step.
