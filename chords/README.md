# Chord Garden

A static progressive web app for practicing piano chords, hosted separately from the original profile page in `chords.html`. It can be hosted from a `USERNAME.github.io` repository with GitHub Pages.

## Publish

Push the files to the repository's `main` branch and enable **Settings → Pages → Deploy from a branch → main / (root)**. Open `/chords.html` for the practice app; the original homepage remains `index.html`.

## Piano input

- **Microphone:** Uses the browser's live audio input and analyzes pitch classes locally. Microphone access requires HTTPS; GitHub Pages supplies it.
- **Keyboard MIDI:** Uses Web MIDI when the browser supports it. Connect a USB MIDI keyboard or a compatible adapter before tapping Connect. iPhone Safari support varies by iOS/browser version.
- If a direct digital connection is not exposed to Safari, use a USB audio interface as the microphone input, or play the chord and tap the hint/next flow as appropriate.

The app does not record or upload microphone audio. The first visit needs a network connection; the service worker caches the practice app for later offline use. For the most reliable iPhone installation, open the Pages URL in Safari, tap Share, then **Add to Home Screen**.
