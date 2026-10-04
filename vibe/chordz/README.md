# chordz

A static progressive web app for practicing piano chords, hosted separately from the original profile page in `chords.html`. It can be hosted from a `USERNAME.github.io` repository with GitHub Pages.

## Publish

Push the files to the repository's `main` branch and enable **Settings → Pages → Deploy from a branch → main / (root)**. Open `/vibe/chordz/` for the practice app; the original homepage remains `index.html`.

## Piano input

- **Microphone:** Desktop browsers request microphone access on launch and immediately start listening for chords. On iOS, tap **Start listening** first so the browser can activate its audio engine. Practice begins right away with automatic continuous noise floor tracking; no mandatory calibration is required. Optional calibration can be started anytime via **Calibrate** to tune the input and measure single-note harmonic profiles (C2–B2 left hand, C4–B4 right hand). Correct chords advance automatically with low latency (~130 ms). Place the phone near the piano, or connect a USB audio interface to the phone's microphone input.

The app does not record or upload microphone audio. The audio engine uses dynamic noise tracking, inharmonicity-corrected partial modeling, log-compressed spectral magnitudes, and score-informed template matching that accounts for natural acoustic piano overtones (avoiding false rejections on minor and 7th chords). The microphone requests disabled echo cancellation, noise suppression, and automatic gain control where supported; browser behavior varies. If microphone access is denied, allow it in the browser's site settings and restart listening. The first visit needs a network connection; the service worker caches the practice app for later offline use. For the most reliable iPhone installation, open the Pages URL in Safari, tap Share, then **Add to Home Screen**.

## Chord pathway

The six levels follow a gradual piano-teaching path: learn the six diatonic chords in C together, then add major and minor triads in more keys. Seventh chords follow once the triads are familiar, with diminished and augmented triads as an advanced final group. Each level includes earlier chords for review, and you can choose any level at any time. A graph beneath the practice card maps that level’s Western and Asian pop progressions without displaying their chord sequences. Each node is one progression, and a directed arrow connects two nodes when the first progression ends on a chord equivalent to the second progression’s opening chord. Chord equivalence includes enharmonic spellings and ignores inversions. Short transitions connect the progression nodes into a strongly connected graph, and each level chord appears in at least one progression.

Progression walk is the default flash-card mode. It starts at a random graph node, presents that progression’s chords one at a time, then chooses an outgoing edge at random to select the next progression. A bright outline on the graph marks the current node. Use the button in the flash-card header to switch to the previous fully random chord deck. The selected mode is saved on this device. Run `node --test vibe/chordz/progressions.test.js` to check graph reachability and chord coverage for every level.

The full chord library appears below the practice deck. Its rows are roots and columns are chord qualities. Highlighted chords are included in the selected level; tap any chord to add or remove it, including chords beyond that level's suggested set. Chord edits are saved for the currently selected level, while the suggested level presets stay unchanged. Selecting a level restores its preset. Level choice and the current edit are saved on this device. Level 6 contains all 84 chords. Guided mode shows two chord voicings: blue for left hand and lime for right hand; coral marks detected notes.

## Audio Engine & Potential Next Steps

### Implemented: Option A (Zero-Dependency Pure-JS DSP Engine)
* **Buffer & Latency Optimization**: FFT buffer size reduced to 8192 ($170\text{ ms}$ window at $48\text{ kHz}$) with `smoothingTimeConstant = 0` and 32-bit float time-domain sampling (`getFloatTimeDomainData`), dropping response latency from $> 750\text{ ms}$ to $\approx 130\text{ ms}$.
* **Piano Inharmonicity Correction**: Partials are computed with the physical string dispersion model $f_h = h \cdot f_0 \sqrt{1 + B h^2}$ ($B = 0.0004$), preventing upper partial drift from missing detection windows.
* **Logarithmic Spectral Compression**: Decibel magnitudes are compressed to normalize dynamic range, ensuring quiet chord tones are not suppressed by loudly struck roots.
* **Score-Informed Template Matching**: Replaced negative peak rejection (`extraStrong`) with normalized cosine similarity and an overtone shadow model (covering the 3rd, 5th, and 7th partials). Correct chords like Am and Dm are no longer rejected by their own physical acoustic overtones.
* **Streamlined Calibration & Dynamic Noise Tracking**: Continuous percentile-based noise tracking eliminates room sound lockups. Calibration runs passively in the background, with an optional 14-note manual tuner featuring 1.2s release timeouts to prevent reverberation hangs.

### Future Roadmap: Option B (In-Browser Neural Polyphony via Basic Pitch)
* **Overview**: A future upgrade path involves integrating Spotify's [Basic Pitch](https://github.com/spotify/basic-pitch) (`@spotify/basic-pitch-ts`) or an ONNX Runtime Web model directly in the browser.
* **Capabilities**:
  * **Discrete Note Tracking**: Rather than folding pitch classes into a 12-semitone chroma vector, a lightweight convolutional neural network (< 17,000 parameters, $\approx 70\text{ KB}$ runtime) outputs note-on/note-off probabilities across all 88 keys simultaneously.
  * **Voicing & Inversion Discrimination**: Distinguishes specific chord inversions (root position vs. first/second inversion) and validates whether the left hand (blue hints) and right hand (lime hints) played their designated registers.
  * **Extreme Acoustic Robustness**: Trained on diverse multi-instrument and acoustic piano datasets, eliminating sensitivity to room acoustics, mic frequency response curves, or non-standard piano hammer hardness.
* **Integration Strategy**:
  1. Bundle `@spotify/basic-pitch-ts` via ES modules or load the ONNX model using `onnxruntime-web` with WebAssembly/WebGPU execution.
  2. Feed streaming 250 ms audio windows into the inference loop every 50 ms.
  3. Compare the output active note matrix against the required chord voicings for instant, exact feedback.
