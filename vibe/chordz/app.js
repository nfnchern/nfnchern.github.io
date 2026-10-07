(()=>{
  const notes=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'],whitePitchClasses=[0,2,4,5,7,9,11];const qualities=[{
    name:'maj',short:'Major',label:'major triad',ints:[0,4,7]
  },{
    name:'m',short:'Minor',label:'minor triad',ints:[0,3,7]
  },{
    name:'dim',short:'Dim',label:'diminished triad',ints:[0,3,6]
  },{
    name:'aug',short:'Aug',label:'augmented triad',ints:[0,4,8]
  },{
    name:'7',short:'7th',label:'dominant seventh',ints:[0,4,7,10]
  },{
    name:'maj7',short:'Maj 7',label:'major seventh',ints:[0,4,7,11]
  },{
    name:'m7',short:'Min 7',label:'minor seventh',ints:[0,3,7,10]
  }];const levelSpecs=[{
    title:'C major and its diatonic chords',summary:'Learn C, F, and G major (I–IV–V), plus Am, Dm, and Em. These six chords use the white-note collection in C major.'
  },{
    title:'Nearby major keys · D, A, and E',summary:'Practice familiar major triads in neighboring keys before moving across the full keyboard.'
  },{
    title:'Major and minor triads in every key',summary:'Complete the twelve major and twelve minor triads, including black-key roots.'
  },{
    title:'Common seventh chords',summary:'Meet G7 and familiar major/minor sevenths after the triads are comfortable.'
  },{
    title:'Seventh chords in every key',summary:'Add the remaining dominant, major, and minor seventh chords across all roots.'
  },{
    title:'Diminished and augmented triads',summary:'Explore less common triad colors. The full chord library is now included.'
  }];const allChords=[];notes.forEach((_,root)=>qualities.forEach(q=>allChords.push([root,q.name])));const levels=levelSpecs.map((spec,index)=>({
    ...spec,progressions:window.chordProgressionsByLevel[index],chords:window.chordDeckSymbolsByLevel[index].map(symbol=>{
      const parsed=window.ChordProgressionGraph.parseChord(symbol);return{
        root:parsed.root,q:qualities.find(q=>q.name===parsed.quality)
      }
    })
  }));const chordCatalog=allChords.map(([root,name])=>({
    root,q:qualities.find(q=>q.name===name)
  }));const $=id=>document.getElementById(id);const storage={
    get(key,fallback=null){
      try{
        return localStorage.getItem(key)??fallback
      }
      catch{
        return fallback
      }
    },set(key,value){
      try{
        localStorage.setItem(key,String(value))
      }
      catch{
        
      }
    },remove(key){
      try{
        localStorage.removeItem(key)
      }
      catch{
        
      }
    }
  };
  storage.remove('chord-garden-total');storage.remove('chord-garden-streak');storage.remove('chord-garden-last');
  const storedNumber=(key,fallback)=>{
    const stored=storage.get(key);
    if(stored===null||stored.trim()==='')return fallback;
    const value=Number(stored);
    return Number.isFinite(value)?value:fallback;
  };
  const isIOSBrowser=/iPad|iPhone|iPod/.test(navigator.userAgent)||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let current=null;
  let audioCtx=null;
  let analyser=null;
  let stream=null;
  let midiAccess=null;
  let midiInput=null;
  const midiNotes=new Map();
  const midiAttempt=new Set();
  const audioAttempt=new Set();
  let audioAttemptBlocked=false;
  let midiAwaitingRelease=false;
  let midiMatchTimer=0;
  let raf=0;
  let registeredNotes=new Set();
  let selectedLevel=(()=>{
    const value=Number(storage.get('chord-garden-level-v2')||0);
    return Number.isInteger(value)&&value>=0&&value<levels.length?value:0;
  })();
  let levelCustomization=(()=>{
    try{
      const saved=JSON.parse(storage.get('chord-garden-level-customization')||'null');
      return saved?.level===selectedLevel&&Array.isArray(saved.chords)?saved.chords:null;
    }catch{return null;}
  })();
  let solved=false;
  let deckPaused=false;
  let guided=storage.get('chord-garden-guided')!=='false';
  let goodSince=0;
  let toastTimer=0;
  let noiseFloor=Math.max(0,storedNumber('chord-garden-noise-floor',0));
  let noisePeak=Math.max(0,storedNumber('chord-garden-noise-peak',0));
  let playingLevel=Math.max(0,storedNumber('chord-garden-playing-level',0));
  let harmonicProfile=(()=>{
    try{
      const saved=JSON.parse(storage.get('chord-garden-harmonic-profile')||'null');
      return Array.isArray(saved)&&saved.length===4?saved.map((value,index)=>Number.isFinite(value)?Math.max(.001,Math.min(.9,value)):[.12,.05,.025,.015][index]):[.12,.05,.025,.015];
    }catch{return [.12,.05,.025,.015];}
  })();
  let noteTemplates=(()=>{
    try{
      const saved=JSON.parse(storage.get('chord-garden-note-templates')||'{}');
      return saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{}
    }catch{return {};}
  })();
  let tuningCents=Math.max(-50,Math.min(50,storedNumber('chord-garden-tuning-cents',0)));
  let calibration=null;
  const PIANO_INHARMONICITY=0.0004;
  const calibrationMinCaptureMs=500,calibrationMinCaptureFrames=12;
  const rmsHistory=new Float32Array(40);
  let rmsHistoryIdx=0,rmsHistoryCount=0;
  let deckMode=storage.get('chord-garden-deck-mode')==='random'?'random':'walk';
  let progressionGraphModel=null;
  let currentProgressionIndex=null;
  let progressionChordIndex=0;
  function noteName(midi){
    return notes[midi%12]+(Math.floor(midi/12)-1)
  }
  function inharmonicPartialHz(f0,h){
    return h*f0*Math.sqrt(1+PIANO_INHARMONICITY*h*h)
  }
  function noteFrequency(midi){
    return 440*Math.pow(2,(midi-69+tuningCents/100)/12)
  }
  function readMagnitudeSpectrum(analyser,decibels,magnitude){
    analyser.getFloatFrequencyData(decibels);
    for(let i=0;i<decibels.length;i++){
      const db=decibels[i];
      magnitude[i]=(!Number.isFinite(db)||db<-90)?0:Math.max(0,Math.min(1,(db+90)/80))
    }
  }
  function findPeakMagnitude(magnitude,targetHz,binHz,searchCents=35){
    const loHz=targetHz*Math.pow(2,-searchCents/1200),hiHz=targetHz*Math.pow(2,searchCents/1200);
    const loBin=Math.max(1,Math.floor(loHz/binHz)),hiBin=Math.min(magnitude.length-2,Math.ceil(hiHz/binHz));
    if(loBin>hiBin)return 0;
    let bestBin=loBin,maxVal=magnitude[loBin];
    for(let b=loBin+1;b<=hiBin;b++){
      if(magnitude[b]>maxVal){maxVal=magnitude[b];bestBin=b}
    }
    if(maxVal<=0)return 0;
    const left=magnitude[bestBin-1],center=magnitude[bestBin],right=magnitude[bestBin+1],denom=left-2*center+right;
    if(denom<0){
      const shift=0.5*(left-right)/denom;
      return Math.max(0,center-0.25*(left-right)*shift)
    }
    return center
  }
  function estimateTuningCents(magnitude,binHz,midi){
    const f0=440*Math.pow(2,(midi-69)/12),testPartials=midi<48?[2,3]:[1,2],shifts=[];
    for(const h of testPartials){
      const expected=inharmonicPartialHz(f0,h),lo=Math.max(1,Math.floor(expected*Math.pow(2,-45/1200)/binHz)),hi=Math.min(magnitude.length-2,Math.ceil(expected*Math.pow(2,45/1200)/binHz));
      if(lo>=hi)continue;
      let peakBin=lo;
      for(let b=lo+1;b<=hi;b++)if(magnitude[b]>magnitude[peakBin])peakBin=b;
      const left=magnitude[peakBin-1],center=magnitude[peakBin],right=magnitude[peakBin+1],denom=left-2*center+right;
      if(denom<0&&center>0.1){
        const shift=0.5*(left-right)/denom,freq=(peakBin+shift)*binHz,cents=1200*Math.log2(freq/expected);
        if(Math.abs(cents)<=45)shifts.push(cents)
      }
    }
    return shifts.length?shifts.reduce((a,b)=>a+b,0)/shifts.length:0
  }
  function noteSalience(magnitude,binHz,midi){
    const f0=noteFrequency(midi);
    if(f0<20||f0>16000)return 0;
    const weights=[1.0,0.65,0.45,0.30,0.20,0.15],fundMag=findPeakMagnitude(magnitude,inharmonicPartialHz(f0,1),binHz,32),secondMag=findPeakMagnitude(magnitude,inharmonicPartialHz(f0,2),binHz,32);
    if(midi>=48&&fundMag<0.10)return 0;
    if(midi<48&&fundMag<0.06&&secondMag<0.10)return 0;
    let weightedSum=0,weightTotal=0;
    for(let h=1;h<=6;h++){
      const partHz=inharmonicPartialHz(f0,h);
      if(partHz>(magnitude.length-2)*binHz)break;
      const peak=findPeakMagnitude(magnitude,partHz,binHz,32),w=weights[h-1];
      weightedSum+=w*peak;weightTotal+=w
    }
    return weightTotal>0?weightedSum/weightTotal:0
  }
  function noteTemplateFor(midi){
    const exact=noteTemplates[midi];if(Array.isArray(exact))return exact;
    const samePitch=Object.keys(noteTemplates).map(Number).filter(note=>note%12===midi%12&&Array.isArray(noteTemplates[note])).sort((a,b)=>Math.abs(a-midi)-Math.abs(b-midi));
    return samePitch.length?noteTemplates[samePitch[0]]:harmonicProfile
  }
  function pitchSaliences(magnitude,binHz){
    const salience=new Float32Array(85);
    for(let midi=36;midi<=84;midi++)salience[midi]=noteSalience(magnitude,binHz,midi);
    return salience
  }
  function computeChromaFromSaliences(saliences){
    const chroma=new Float32Array(12);
    for(let midi=36;midi<=84;midi++){
      const pc=midi%12,octave=Math.floor(midi/12)-1,octaveWeight=(octave===3||octave===4)?1.0:0.82;
      chroma[pc]+=saliences[midi]*octaveWeight
    }
    const maxVal=Math.max(...chroma);
    if(maxVal>0)for(let c=0;c<12;c++)chroma[c]/=maxVal;
    return chroma
  }
  function calibrationNoteDetected(saliences,midi){
    let peak=0;for(let n=36;n<=84;n++)peak=Math.max(peak,saliences[n]);
    if(peak<=1e-6)return false;
    const noteSal=saliences[midi]||0,octaveSal=(saliences[midi-12]||0)+(saliences[midi+12]||0);
    return(noteSal>=peak*0.40)||(noteSal+octaveSal*0.5>=peak*0.45)
  }
  function measureHarmonicProfile(magnitude,binHz,midi){
    const f0=noteFrequency(midi),fundMag=Math.max(0.01,findPeakMagnitude(magnitude,inharmonicPartialHz(f0,1),binHz,32));
    return[2,3,4,5,6,7,8].map(h=>{
      const partMag=findPeakMagnitude(magnitude,inharmonicPartialHz(f0,h),binHz,35);
      return Math.max(.001,Math.min(.9,partMag/fundMag))
    })
  }
  function updateDynamicNoise(rms){
    rmsHistory[rmsHistoryIdx]=rms;
    rmsHistoryIdx=(rmsHistoryIdx+1)%rmsHistory.length;
    if(rmsHistoryCount<rmsHistory.length)rmsHistoryCount++;
    const sorted=Array.from(rmsHistory.subarray(0,rmsHistoryCount)).sort((a,b)=>a-b);
    const p15=sorted[Math.floor(sorted.length*0.15)]||0.002,p85=sorted[Math.floor(sorted.length*0.85)]||p15;
    noiseFloor=Math.max(0.001,Math.min(0.03,p15));
    noisePeak=Math.max(noiseFloor,Math.min(0.05,p85))
  }
  function evaluateChordMatch(chroma,root,quality,targetPCs){
    const peak=Math.max(...chroma);
    if(peak<0.20)return{matched:false,activePCs:new Set(),cosineSim:0};
    const targetLevels=targetPCs.map(pc=>chroma[pc]/peak);
    const minTarget=Math.min(...targetLevels);
    const hasAllTargets=minTarget>=0.28;
    const activePCs=new Set();
    for(let pc=0;pc<12;pc++){
      if(chroma[pc]/peak>0.24)activePCs.add(pc)
    }
    const harmonicShadow=new Set();
    targetPCs.forEach(t=>{
      harmonicShadow.add((t+7)%12);harmonicShadow.add((t+4)%12);harmonicShadow.add((t+10)%12);harmonicShadow.add((t+2)%12)
    });
    let alienCount=0;
    for(let pc=0;pc<12;pc++){
      const isTarget=targetPCs.includes(pc),inShadow=harmonicShadow.has(pc),rel=chroma[pc]/peak;
      if(!isTarget&&!inShadow&&rel>0.40)alienCount++
    }
    let dot=0,normT=0,normC=0;
    for(let pc=0;pc<12;pc++){
      const isTarget=targetPCs.includes(pc),inShadow=harmonicShadow.has(pc),tVal=isTarget?1.0:(inShadow?0.20:0.0),cVal=chroma[pc]/peak;
      dot+=tVal*cVal;normT+=tVal*tVal;normC+=cVal*cVal
    }
    const cosineSim=(normT>0&&normC>0)?dot/(Math.sqrt(normT)*Math.sqrt(normC)):0;
    let qualityConflict=false;
    if(quality.name==='maj'||quality.name==='7'||quality.name==='maj7'){
      const m3=chroma[(root+3)%12],M3=chroma[(root+4)%12];
      if(m3>M3&&m3>peak*0.45)qualityConflict=true
    }
    else if(quality.name==='m'||quality.name==='m7'){
      const m3=chroma[(root+3)%12],M3=chroma[(root+4)%12];
      if(M3>m3&&M3>peak*0.45)qualityConflict=true
    }
    else if(quality.name==='dim'){
      const P5=chroma[(root+7)%12],d5=chroma[(root+6)%12];
      if(P5>d5&&P5>peak*0.55)qualityConflict=true
    }
    else if(quality.name==='aug'){
      const P5=chroma[(root+7)%12],A5=chroma[(root+8)%12];
      if(P5>A5&&P5>peak*0.55)qualityConflict=true
    }
    const matched=hasAllTargets&&alienCount===0&&!qualityConflict&&cosineSim>=0.70;
    return{matched,activePCs,cosineSim}
  }
  function renderKeyboard(){
    const board=$('keyboard');board.innerHTML='';if((!current||deckPaused)&&!calibration)return;const target=current?current.q.ints.map(i=>(current.root+i)%12):[],leftNotes=current?current.q.ints.map(i=>36+current.root+i):[],rightNotes=current?current.q.ints.map(i=>60+current.root+i):[],reveal=solved||guided,notePrompt=calibration?.phase==='notes'?calibration.notePrompts[calibration.noteIndex]:null,calibrationTargets=calibration&&!calibration.awaitingRelease?(notePrompt?[notePrompt.midi]:[]):[];let whiteIndex=-1;for(let midi=36;midi<84;midi++){
      const pc=midi%12,isCalibrationTarget=calibrationTargets.includes(midi),isTarget=calibration?isCalibrationTarget:target.includes(pc),isLeft=leftNotes.includes(midi),isRight=rightNotes.includes(midi),showGuide=!calibration&&guided&&(isLeft||isRight),hand=isLeft?'left':'right',targetClass=calibration?(isCalibrationTarget?' target calibration-target':''):reveal&&showGuide?' target hand-'+hand:'';if(whitePitchClasses.includes(pc)){
        whiteIndex++;const key=document.createElement('div');key.className='key'+targetClass+(registeredNotes.has(midi)?' registered':'');key.dataset.midi=midi;key.title=noteName(midi);key.setAttribute('aria-label',noteName(midi)+(isTarget?', chord note':''));const label=document.createElement('span');label.className='keylabel';label.textContent=pc===0?noteName(midi):notes[pc];key.appendChild(label);if(showGuide){
          const marker=document.createElement('span');marker.className='key-guide guide-'+hand;marker.textContent=noteName(midi);key.appendChild(marker)
        }board.appendChild(key)
      }
      else{
        const key=document.createElement('div');key.className='black'+targetClass+(registeredNotes.has(midi)?' registered':'');key.dataset.midi=midi;key.style.left=`${(whiteIndex+1)/28*100}%`;key.title=noteName(midi);key.setAttribute('aria-label',noteName(midi)+(isTarget?', chord note':''));if(showGuide){
          const marker=document.createElement('span');marker.className='black-guide guide-'+hand;marker.textContent=noteName(midi);key.appendChild(marker)
        }board.appendChild(key)
      }
    }
  }
  function updateRegistered(next){
    if(next.size===registeredNotes.size&&[...next].every(n=>registeredNotes.has(n)))return;registeredNotes=next;document.querySelectorAll('#keyboard [data-midi]').forEach(key=>key.classList.toggle('registered',registeredNotes.has(Number(key.dataset.midi))))
  }
  function render(){
    if(calibration){
      const phase=calibration.phase,index=calibration.noteIndex||0,release=calibration.awaitingRelease;
      $('cardLabel').textContent='Calibrate';
      if(phase==='noise'){
        $('round').textContent='QUIET';$('chordName').textContent='Stay quiet';$('quality').textContent='Measuring room acoustic levels.';setStatus('Room check','Keep quiet until the note prompts begin.','◉');
      }
      else if(phase==='notes'){
        const prompt=calibration.notePrompts[index],groupIndex=index%7,handLabel=prompt.hand==='left'?'Left hand':'Right hand',previous=calibration.notePrompts[index-1];$('round').textContent=`${prompt.hand==='left'?'LH':'RH'} ${groupIndex+1}/7`;$('chordName').textContent=release?'Release':prompt.name;$('quality').textContent=release?(previous?`Release ${previous.name}, then play ${prompt.name}.`:'Release the key.'):`${handLabel}: play and hold ${prompt.name} until the prompt advances.`;setStatus(release?'Release the note':`${handLabel} note`,release?'Wait for the sound to fade.':'Hold the key while it is sampled.','♪');
      }
    }
    else if(current&&!deckPaused){
      $('cardLabel').textContent='Chord';
      const root=notes[current.root],q=current.q,quality=document.createElement('span');quality.textContent=q.name;$('chordName').replaceChildren(document.createTextNode(root),quality);$('quality').textContent=`${root} ${q.label} · root position`;$('round').textContent=''
    }
    else{
      $('cardLabel').textContent='Chord';$('chordName').textContent='—';$('quality').textContent='Choose a learning level to begin';$('round').textContent=''
    }renderKeyboard()
  }
  function chordId(chord){
    return `${chord.root}:${chord.q.name}`
  }
  function progressionChordKey(chord){
    if(!chord)return'';const quality=chord.q||qualities.find(item=>item.name===chord.quality);return quality?quality.ints.map(interval=>(chord.root+interval)%12).sort((a,b)=>a-b).join(','):''
  }
  function levelDeck(index=selectedLevel){
    const chords=levels[index].chords;return index===selectedLevel&&Array.isArray(levelCustomization)?chordCatalog.filter(chord=>levelCustomization.includes(chordId(chord))):chords.slice()
  }
  function pick(){
    clearMidiMatchTimer();midiAttempt.clear();audioAttempt.clear();audioAttemptBlocked=false;goodSince=0;if(midiInput&&midiNotes.size)midiAwaitingRelease=true;
    let choice;if(deckMode==='walk'&&progressionGraphModel?.progressions.length){
      if(currentProgressionIndex===null){
        const progressions=progressionGraphModel.progressions,starts=progressions.map((progression,index)=>({index,chordIndex:0,chord:progression.chords[0]})).filter(item=>item.chord&&progressionChordKey(item.chord)!==progressionChordKey(current));
        if(current&&starts.length){const start=starts[Math.floor(Math.random()*starts.length)];currentProgressionIndex=start.index;progressionChordIndex=start.chordIndex}
        else{currentProgressionIndex=Math.floor(Math.random()*progressions.length);progressionChordIndex=0}
      }
      const chord=progressionGraphModel.progressions[currentProgressionIndex].chords[progressionChordIndex];choice=chord&&{
        root:chord.root,q:qualities.find(quality=>quality.name===chord.quality)
      }
    }
    else{
      let pool=levelDeck();if(pool.length>1&&current)pool=pool.filter(chord=>chord.root!==current.root||chord.q!==current.q);if(pool.length)choice=pool[Math.floor(Math.random()*pool.length)]
    }if(!choice){
      deckPaused=true;solved=true;goodSince=0;registeredNotes.clear();render();setStatus('No chords in this level','Add chords from the library below to start practicing.','♪');return
    }deckPaused=false;current=choice;solved=false;goodSince=0;registeredNotes.clear();render();$('response').classList.remove('good');setStatus('Ready when you are','Play the chord together or one note at a time, in any order.','♪');updateGraphWalkMarker()
  }
  function advanceProgressionWalk(){
    const progressions=progressionGraphModel?.progressions||[];if(!progressions.length){
      currentProgressionIndex=null;progressionChordIndex=0;pick();return
    }
    const previousKey=progressionChordKey(current),stepLimit=Math.max(1,progressions.reduce((sum,item)=>sum+item.chords.length,0)*2);
    const step=()=>{
      const sequence=progressions[currentProgressionIndex]?.chords||[];
      if(progressionChordIndex+1<sequence.length)progressionChordIndex++;
      else{
        const neighbors=progressionGraphModel?.outgoing[currentProgressionIndex]||[];
        currentProgressionIndex=neighbors.length?neighbors[Math.floor(Math.random()*neighbors.length)]:Math.floor(Math.random()*progressions.length);progressionChordIndex=0
      }
    };
    for(let i=0;i<stepLimit;i++){
      step();const candidate=progressions[currentProgressionIndex]?.chords[progressionChordIndex];if(progressionChordKey(candidate)!==previousKey)break
    }
    if(progressionChordKey(progressions[currentProgressionIndex]?.chords[progressionChordIndex])===previousKey){
      const alternatives=[];progressions.forEach((sequence,index)=>sequence.chords.forEach((chord,chordIndex)=>{if(progressionChordKey(chord)!==previousKey)alternatives.push({index,chordIndex})}));
      if(alternatives.length){const next=alternatives[Math.floor(Math.random()*alternatives.length)];currentProgressionIndex=next.index;progressionChordIndex=next.chordIndex}
    }
    pick()
  }
  function setStatus(title,detail,icon){
    $('statusTitle').textContent=title;$('statusDetail').textContent=detail;$('statusIcon').textContent=icon
  }
  function succeed(){
    if(solved)return;solved=true;if(midiInput&&midiNotes.size)midiAwaitingRelease=true;if(deckMode==='walk')advanceProgressionWalk();else pick()
  }
  function clearMidiMatchTimer(){
    if(midiMatchTimer)clearTimeout(midiMatchTimer);midiMatchTimer=0
  }
  function midiChordMatches(){
    if(!midiInput||midiAwaitingRelease||!current||deckPaused)return false;
    const targetPCs=current.q.ints.map(interval=>(current.root+interval)%12);
    return targetPCs.every(pc=>midiAttempt.has(pc))
  }
  function evaluateMidiInput(){
    const activeNotes=new Set(midiNotes.values());updateRegistered(activeNotes);
    if(midiAwaitingRelease){
      clearMidiMatchTimer();if(activeNotes.size)return;midiAwaitingRelease=false;midiAttempt.clear()
    }
    if(midiChordMatches()){
      if(!midiMatchTimer)midiMatchTimer=setTimeout(()=>{midiMatchTimer=0;if(midiChordMatches())succeed()},150)
    }
    else clearMidiMatchTimer()
  }
  function handleMidiMessage(event){
    const [status,pitch,velocity]=event.data,command=status&0xf0,channel=status&0x0f,key=`${channel}:${pitch}`;
    if(command===0x90&&velocity>0){
      midiNotes.set(key,pitch);
      if(current&&!deckPaused&&!midiAwaitingRelease){
        const targetPCs=current.q.ints.map(interval=>(current.root+interval)%12);
        if(targetPCs.includes(pitch%12))midiAttempt.add(pitch%12);else{midiAttempt.clear();clearMidiMatchTimer()}
      }
    }
    else if(command===0x80||(command===0x90&&velocity===0))midiNotes.delete(key);
    else if(command===0xb0&&(pitch===120||pitch===123)){
      for(const noteKey of midiNotes.keys())if(noteKey.startsWith(`${channel}:`))midiNotes.delete(noteKey);midiAttempt.clear();clearMidiMatchTimer()
    }
    else return;
    evaluateMidiInput()
  }
  function setMidiInput(input){
    if(midiInput===input)return;
    if(midiInput)midiInput.onmidimessage=null;
    if(input)stopMic();
    midiInput=input;midiNotes.clear();midiAwaitingRelease=false;clearMidiMatchTimer();updateRegistered(new Set());
    if(input){
      midiInput.onmidimessage=handleMidiMessage;$('midiDot').classList.add('live');$('midiStatus').textContent=`Connected · ${input.name||'MIDI keyboard'}`;$('midiConnectBtn').textContent='Disconnect MIDI';$('connectBtn').textContent='◉  Start microphone';$('calibrateBtn').disabled=true;$('connDot').classList.remove('live');$('connectionText').textContent='Microphone paused · MIDI input active'
    }
    else{
      $('midiDot').classList.remove('live');$('midiStatus').textContent='MIDI disconnected';$('midiConnectBtn').textContent='Connect MIDI';$('midiInputSelect').classList.add('hidden');$('connectBtn').textContent='◉  Start listening';$('calibrateBtn').disabled=true;$('connDot').classList.remove('live');$('connectionText').textContent='MIDI disconnected'
    }
  }
  function refreshMidiInputs(){
    if(!midiAccess)return;
    const inputs=[...midiAccess.inputs.values()].filter(input=>input.state==='connected'),select=$('midiInputSelect'),selectedId=midiInput?.id;
    select.replaceChildren(...inputs.map(input=>{const option=document.createElement('option');option.value=input.id;option.textContent=input.name||input.manufacturer||'MIDI keyboard';return option}));
    select.classList.toggle('hidden',inputs.length<2);
    if(selectedId&&inputs.some(input=>input.id===selectedId)){select.value=selectedId;return}
    if(midiInput)setMidiInput(null);
    if(inputs.length){select.value=inputs[0].id;setMidiInput(inputs[0])}
    else{$('midiDot').classList.remove('live');$('midiStatus').textContent='No MIDI input found · connect a keyboard and retry'}
  }
  async function connectMidi(silent=false){
    if(midiInput){
      setMidiInput(null);if(midiAccess)midiAccess.onstatechange=null;midiAccess=null;$('midiStatus').textContent='MIDI disconnected';return
    }
    if(typeof navigator.requestMIDIAccess!=='function'){
      $('midiStatus').textContent='Web MIDI is not supported in this browser';if(!silent)toast('Web MIDI is unavailable here. Use a MIDI-capable browser or microphone input.');return
    }
    $('midiStatus').textContent='Requesting MIDI access…';
    try{
      midiAccess=await navigator.requestMIDIAccess({sysex:false});midiAccess.onstatechange=refreshMidiInputs;refreshMidiInputs()
    }
    catch(error){
      midiAccess=null;$('midiStatus').textContent='MIDI access was not granted';if(!silent)toast(`Could not connect MIDI: ${error?.message||error}`)
    }
  }
  function toast(message){
    $('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200)
  }
  function stopMic(){
    if(raf)cancelAnimationFrame(raf);raf=0;calibration=null;goodSince=0;$('calibrateBtn').disabled=true;$('calibrateBtn').textContent='Calibrate';if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;analyser=null;if(audioCtx){
      audioCtx.close().catch(()=>{
        
      });audioCtx=null
    }
    $('volume').classList.add('hidden');if($('cardLabel'))render()
  }
  function beginCalibration(){
    if(!analyser||calibration)return;const scaleNotes=[['C',0],['D',2],['E',4],['F',5],['G',7],['A',9],['B',11]],notePrompts=['left','right'].flatMap(hand=>scaleNotes.map(([name,offset])=>({name:`${name}${hand==='left'?2:4}`,hand,midi:(hand==='left'?36:60)+offset})));calibration={
      phase:'noise',until:performance.now()+1500,noiseSamples:[],playSum:0,playFrames:0,notePrompts,noteIndex:0,noteProfiles:{},profileSamples:[],noteTuningSamples:[],tuningSamples:[],noteLevels:[],awaitingRelease:false,releaseFrames:0,releaseTimeoutAt:0
    };goodSince=0;registeredNotes.clear();$('calibrateBtn').disabled=false;$('calibrateBtn').textContent='Cancel calibration';$('connectionText').textContent='Calibration started · stay quiet';render()
  }
  async function startMic(){
    stopMic();$('connectBtn').textContent='Requesting microphone…';if(!navigator.mediaDevices?.getUserMedia){
      const detail=`secure context=${isSecureContext}, mediaDevices=${!!navigator.mediaDevices}`;$('connectionText').textContent='Microphone API unavailable';$('connectBtn').textContent='◉  Start listening';toast('Microphone API unavailable ('+detail+'). Open this page over HTTPS.');return
    }
    let stage='starting audio engine';try{
      audioCtx=new(window.AudioContext||window.webkitAudioContext)();await audioCtx.resume();
      if(audioCtx.state!=='running')throw new Error('Tap Start listening to let iOS start the audio engine.');
      stage='requesting microphone permission';stream=await navigator.mediaDevices.getUserMedia({
        audio:{
          echoCancellation:false,noiseSuppression:false,autoGainControl:false
        }
      });stage='connecting audio input';analyser=audioCtx.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=0;audioCtx.createMediaStreamSource(stream).connect(analyser);$('connDot').classList.add('live');$('connectionText').textContent='Listening · play chord shown';$('connectBtn').textContent='■  Stop listening';$('calibrateBtn').disabled=false;$('volume').classList.remove('hidden');listen()
    }
    catch(e){
      if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(audioCtx){
        audioCtx.close().catch(()=>{
          
        });audioCtx=null
      }analyser=null;$('connDot').classList.remove('live');$('volume').classList.add('hidden');$('connectBtn').textContent='◉  Start listening';const name=e?.name||'Error',message=e?.message||String(e);$('connectionText').textContent=`${stage} failed · ${name}`;toast(`${stage} failed: ${name} — ${message}`)
    }
  }
  function listen(){
    const samples=new Float32Array(analyser.fftSize),decibels=new Float32Array(analyser.frequencyBinCount),magnitude=new Float32Array(analyser.frequencyBinCount),smoothedScores=new Float32Array(12),binHz=audioCtx.sampleRate/analyser.fftSize;const loop=()=>{
      if(!analyser)return;analyser.getFloatTimeDomainData(samples);let energy=0;for(let i=0;i<samples.length;i++){
        const x=samples[i];energy+=x*x
      }
      const rms=Math.sqrt(energy/samples.length);$('volumeBar').style.width=Math.min(100,rms*500)+'%';if(calibration){
        if(calibration.phase==='noise'){
          calibration.noiseSamples.push(rms);if(performance.now()>=calibration.until){
            const levels=calibration.noiseSamples.sort((a,b)=>a-b);noiseFloor=Math.min(.03,Math.max(.001,levels[Math.floor((levels.length-1)*.2)]||.002));noisePeak=Math.min(.045,Math.max(noiseFloor,levels[Math.floor((levels.length-1)*.85)]||noiseFloor));storage.set('chord-garden-noise-floor',String(noiseFloor));storage.set('chord-garden-noise-peak',String(noisePeak));calibration.phase='notes';calibration.noteIndex=0;calibration.until=Infinity;calibration.noteLevels=[];calibration.playSum=0;calibration.playFrames=0;calibration.awaitingRelease=false;calibration.releaseTimeoutAt=0;$('calibrateBtn').textContent='Cancel calibration';$('connectionText').textContent='Play '+calibration.notePrompts[0].name;render()
          }
        }
        else if(calibration.phase==='notes'){
          const signalGate=Math.min(.025,Math.max(.003,noiseFloor*1.4,noisePeak*.85)),releaseGate=Math.max(.0025,noiseFloor*1.2),expectedMidi=calibration.notePrompts[calibration.noteIndex].midi;readMagnitudeSpectrum(analyser,decibels,magnitude);const saliences=pitchSaliences(magnitude,binHz);if(calibration.awaitingRelease){
            const adaptiveReleaseGate=Math.max(noiseFloor*1.3,(calibration.releaseReference||releaseGate)*.35);if(rms<adaptiveReleaseGate||performance.now()>=calibration.releaseTimeoutAt){
              calibration.releaseFrames=(calibration.releaseFrames||0)+1;if(calibration.releaseFrames>=4||performance.now()>=calibration.releaseTimeoutAt){
                calibration.awaitingRelease=false;calibration.releaseFrames=0;calibration.playSum=0;calibration.playFrames=0;calibration.releaseTimeoutAt=0;$('connectionText').textContent='Play '+calibration.notePrompts[calibration.noteIndex].name;render()
              }
            }
            else calibration.releaseFrames=0
          }
          else{
            if(rms>signalGate){
              if(!calibration.playFrames){calibration.captureStartedAt=performance.now();
                let strongest=36;for(let midi=37;midi<=84;midi++)if(saliences[midi]>saliences[strongest])strongest=midi;
                if(saliences[strongest]>0.1)$('connectionText').textContent=`Hearing ${noteName(strongest)} · capturing ${calibration.notePrompts[calibration.noteIndex].name}`;
                setStatus('Sound detected',`Capturing ${calibration.notePrompts[calibration.noteIndex].name} · release when prompted.`,'◉')
              }
              calibration.playSum+=rms;calibration.playFrames++;calibration.profileSamples.push(measureHarmonicProfile(magnitude,binHz,expectedMidi));calibration.noteTuningSamples.push(estimateTuningCents(magnitude,binHz,expectedMidi));if(calibration.playFrames>=calibrationMinCaptureFrames&&performance.now()-calibration.captureStartedAt>=calibrationMinCaptureMs){
                const recognized=calibrationNoteDetected(saliences,expectedMidi);calibration.noteLevels.push(calibration.playSum/calibration.playFrames);calibration.releaseReference=calibration.playSum/calibration.playFrames;
                if(recognized){
                  calibration.noteProfiles[expectedMidi]=[0,1,2,3,4,5,6].map(i=>calibration.profileSamples.reduce((sum,profile)=>sum+profile[i],0)/calibration.profileSamples.length);
                  const validTuning=calibration.noteTuningSamples.filter(c=>Math.abs(c)<=45);
                  if(validTuning.length){validTuning.sort((a,b)=>a-b);calibration.tuningSamples.push(validTuning[Math.floor(validTuning.length/2)])}
                }
                calibration.profileSamples=[];calibration.noteTuningSamples=[];calibration.playSum=0;calibration.playFrames=0;calibration.captureStartedAt=0;calibration.noteIndex++;
                if(calibration.noteIndex<calibration.notePrompts.length){
                  calibration.awaitingRelease=true;calibration.releaseFrames=0;calibration.releaseTimeoutAt=performance.now()+1200;$('connectionText').textContent=`Signal captured${recognized?' · pitch matched':' · continuing'}; release, then play ${calibration.notePrompts[calibration.noteIndex].name}`;render()
                }
                else{
                  const levels=calibration.noteLevels.sort((a,b)=>a-b),measured=levels[Math.floor(levels.length/2)]||.05;playingLevel=Math.min(.2,measured);storage.set('chord-garden-playing-level',String(playingLevel));
                  if(calibration.tuningSamples.length){calibration.tuningSamples.sort((a,b)=>a-b);tuningCents=Math.max(-45,Math.min(45,calibration.tuningSamples[Math.floor(calibration.tuningSamples.length/2)]));storage.set('chord-garden-tuning-cents',String(tuningCents))}
                  if(Object.keys(calibration.noteProfiles).length){
                    noteTemplates={...noteTemplates,...calibration.noteProfiles};storage.set('chord-garden-note-templates',JSON.stringify(noteTemplates));
                    const learned=Object.values(noteTemplates).filter(Array.isArray);if(learned.length)harmonicProfile=[0,1,2,3].map(i=>{
                      const values=learned.map(profile=>profile[i]||.01).sort((a,b)=>a-b);return Math.max(.001,Math.min(.9,values[Math.floor(values.length/2)]||[.12,.05,.025,.015][i]))
                    });storage.set('chord-garden-harmonic-profile',JSON.stringify(harmonicProfile))
                  }
                  storage.remove('chord-garden-chord-target-floor');storage.remove('chord-garden-chord-extra-floor');calibration=null;$('calibrateBtn').disabled=false;$('calibrateBtn').textContent='Calibrate';$('connectionText').textContent='Listening · calibration complete';render();setStatus('Calibration complete','Play the chord shown to continue.','✓')
                }
              }
            }
            else{calibration.playSum=0;calibration.playFrames=0;calibration.captureStartedAt=0;calibration.profileSamples=[];calibration.noteTuningSamples=[]}
          }
        }raf=requestAnimationFrame(loop);return
      }
      updateDynamicNoise(rms);
      const gate=Math.min(.035,Math.max(.003,noiseFloor*1.75));
      if(rms>gate&&!deckPaused&&current){
        readMagnitudeSpectrum(analyser,decibels,magnitude);const noteScore=pitchSaliences(magnitude,binHz),rawChroma=computeChromaFromSaliences(noteScore);for(let pc=0;pc<12;pc++){
          smoothedScores[pc]=.50*smoothedScores[pc]+.50*rawChroma[pc]
        }
        const targetPCs=current.q.ints.map(i=>(current.root+i)%12),chordResult=evaluateChordMatch(smoothedScores,current.root,current.q,targetPCs),live=new Set();
        let dominantPC=0;for(let pc=1;pc<12;pc++)if(rawChroma[pc]>rawChroma[dominantPC])dominantPC=pc;
        if(Math.max(...rawChroma)>=.25&&!audioAttemptBlocked){
          if(targetPCs.includes(dominantPC))audioAttempt.add(dominantPC);else{audioAttempt.clear();audioAttemptBlocked=true}
        }
        chordResult.activePCs.forEach(pc=>{
          let bestM=-1,bestS=0;
          for(let m=36+pc;m<84;m+=12){
            if(noteScore[m]>0.20)live.add(m);
            if(noteScore[m]>bestS){bestS=noteScore[m];bestM=m}
          }
          if(bestM>=0&&bestS>0.10)live.add(bestM)
        });
        updateRegistered(live);
        if(!audioAttemptBlocked&&(chordResult.matched||targetPCs.every(pc=>audioAttempt.has(pc)))){
          if(!goodSince)goodSince=performance.now();else if(performance.now()-goodSince>=130)succeed()
        }
        else goodSince=0
      }
      else{
        goodSince=0;if(audioAttemptBlocked){audioAttemptBlocked=false;audioAttempt.clear()}for(let i=0;i<12;i++)smoothedScores[i]*=.85;updateRegistered(new Set())
      }raf=requestAnimationFrame(loop)
    };loop()
  }
  const graphPalette=['#a9d3ff','#d7f27a','#e6a9ff','#ffb977','#8edcc3','#ff9e97','#b5b8ff'];
  function renderProgressionGraph(){
    const host=$('progressionGraph'),legend=$('progressionLegend'),status=$('graphStatus');progressionGraphModel=window.ChordProgressionGraph.buildGraph(levels[selectedLevel].progressions||[]);const items=progressionGraphModel.progressions,edges=progressionGraphModel.edges;host.innerHTML='';legend.innerHTML='';if(!items.length){
      host.innerHTML='<div class="graph-empty">No progression connections available for this level.</div>';status.textContent='';return
    }
    const width=Math.max(760,host.clientWidth,items.length*11+200),height=Math.max(430,items.length*11+200),cx=width/2,cy=height/2,rx=width*.42,ry=height*.42,nodeRadius=items.length>35?11:items.length>20?14:17,points=items.map((item,i)=>{
      const angle=-Math.PI/2+2*Math.PI*i/items.length;return{
        x:cx+rx*Math.cos(angle),y:cy+ry*Math.sin(angle)
      }
    }),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('class','progression-svg');svg.style.width=`${width}px`;svg.style.height=`${height}px`;svg.setAttribute('role','group');svg.setAttribute('aria-label',`${items.length} progression nodes and ${edges.length} directed connections for level ${selectedLevel+1}`);const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');marker.setAttribute('id','graphArrow');marker.setAttribute('viewBox','0 0 8 8');marker.setAttribute('refX','7');marker.setAttribute('refY','4');marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto-start-reverse');const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M 0 0 L 8 4 L 0 8 z');arrow.setAttribute('fill','#9aa88c');marker.appendChild(arrow);defs.appendChild(marker);svg.appendChild(defs);const edgeEls=[];edges.forEach(({
      from,to
    })=>{
      const a=points[from],b=points[to],path=document.createElementNS(ns,'path');if(from===to){
        path.setAttribute('d',`M ${a.x-10} ${a.y-12} C ${a.x-38} ${a.y-51}, ${a.x+38} ${a.y-51}, ${a.x+10} ${a.y-12}`)
      }
      else{
        const vx=b.x-a.x,vy=b.y-a.y,len=Math.hypot(vx,vy)||1,ux=vx/len,uy=vy/len,sx=a.x+ux*(nodeRadius+1),sy=a.y+uy*(nodeRadius+1),ex=b.x-ux*(nodeRadius+4),ey=b.y-uy*(nodeRadius+4),mx=(sx+ex)/2,my=(sy+ey)/2,dx=cx-mx,dy=cy-my,dl=Math.hypot(dx,dy)||1,bend=Math.min(38,len*.16);path.setAttribute('d',`M ${sx} ${sy} Q ${mx+dx/dl*bend} ${my+dy/dl*bend} ${ex} ${ey}`)
      }path.setAttribute('class','graph-edge');path.setAttribute('marker-end','url(#graphArrow)');svg.appendChild(path);edgeEls.push({
        path,from,to
      })
    });const categories=[...new Set(items.map(item=>item.category))],categoryColor=new Map(categories.map((category,i)=>[category,graphPalette[i%graphPalette.length]]));categories.forEach(category=>{
      const entry=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=categoryColor.get(category);entry.append(swatch,document.createTextNode(category));legend.appendChild(entry)
    });const nodes=[];items.forEach((item,i)=>{
      const group=document.createElementNS(ns,'g'),circle=document.createElementNS(ns,'circle'),textNode=document.createElementNS(ns,'text');group.setAttribute('class','graph-node'+(deckMode==='walk'&&i===currentProgressionIndex?' walk-current':''));group.setAttribute('tabindex','0');group.setAttribute('role','button');group.setAttribute('aria-label',`Progression P${String(i+1).padStart(2,'0')}, ${item.category}${deckMode==='walk'&&i===currentProgressionIndex?', current random-walk position':''}`);group.dataset.index=String(i);circle.setAttribute('cx',points[i].x);circle.setAttribute('cy',points[i].y);circle.setAttribute('r',nodeRadius);circle.setAttribute('fill',categoryColor.get(item.category));textNode.setAttribute('x',points[i].x);textNode.setAttribute('y',points[i].y);textNode.textContent=`P${String(i+1).padStart(2,'0')}`;group.append(circle,textNode);const activate=()=>{
        const selected=group.classList.contains('selected');nodes.forEach(node=>node.classList.remove('selected','dim'));edgeEls.forEach(edge=>edge.path.classList.remove('active'));if(selected){
          updateGraphWalkMarker();return
        }group.classList.add('selected');const linked=new Set([i]);edgeEls.forEach(edge=>{
          if(edge.from===i||edge.to===i){
            edge.path.classList.add('active');linked.add(edge.from);linked.add(edge.to)
          }
        });nodes.forEach(node=>{
          if(!linked.has(Number(node.dataset.index)))node.classList.add('dim')
        });status.textContent=`P${String(i+1).padStart(2,'0')} · ${edges.filter(edge=>edge.from===i).length} outgoing, ${edges.filter(edge=>edge.to===i).length} incoming`
      };group.addEventListener('click',activate);group.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){
          event.preventDefault();activate()
        }
      });svg.appendChild(group);nodes.push(group)
    });host.appendChild(svg);updateGraphWalkMarker()
  }
  function updateGraphWalkMarker(){
    document.querySelectorAll('#progressionGraph .graph-node').forEach(node=>node.classList.toggle('walk-current',deckMode==='walk'&&Number(node.dataset.index)===currentProgressionIndex));if(deckMode==='walk'&&currentProgressionIndex!==null)$('graphStatus').textContent=`${progressionGraphModel.progressions.length} progressions · random walk at P${String(currentProgressionIndex+1).padStart(2,'0')}`;else if(progressionGraphModel)$('graphStatus').textContent=`${progressionGraphModel.progressions.length} progressions · ${progressionGraphModel.edges.length} directed connections`
  }
  let graphResizeFrame=0;window.addEventListener('resize',()=>{
    if(graphResizeFrame)cancelAnimationFrame(graphResizeFrame);graphResizeFrame=requestAnimationFrame(()=>{graphResizeFrame=0;renderProgressionGraph()})
  });
  function renderLibrary(){
    const table=$('chordLibrary'),selected=new Set(levelDeck().map(chordId));table.innerHTML='';const head=document.createElement('thead'),headRow=document.createElement('tr'),rootHead=document.createElement('th');rootHead.scope='col';rootHead.textContent='ROOT';headRow.appendChild(rootHead);qualities.forEach(q=>{
      const th=document.createElement('th');th.scope='col';th.textContent=q.short;headRow.appendChild(th)
    });head.appendChild(headRow);table.appendChild(head);const body=document.createElement('tbody');notes.forEach((rootName,root)=>{
      const row=document.createElement('tr'),heading=document.createElement('th');heading.scope='row';heading.className='library-key';heading.textContent=rootName;row.appendChild(heading);qualities.forEach(q=>{
        const chord={
          root,q
        },id=chordId(chord),cell=document.createElement('td'),button=document.createElement('button'),active=selected.has(id);button.type='button';button.className='library-chord'+(active?' selected':'');button.textContent=rootName+q.name;button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',`${active?'Remove':'Add'} ${rootName} ${q.label} ${active?'from':'to'} level ${selectedLevel+1}`);button.onclick=()=>{
          const ids=new Set(levelDeck().map(chordId));if(ids.has(id))ids.delete(id);else ids.add(id);if(!ids.size){
            toast('Keep at least one chord in the level.');return
          }levelCustomization=[...ids];storage.set('chord-garden-level-customization',JSON.stringify({
            level:selectedLevel,chords:levelCustomization
          }));renderLevels();renderLibrary();pick()
        };cell.appendChild(button);row.appendChild(cell)
      });body.appendChild(row)
    });table.appendChild(body);$('libraryCount').textContent=`${selected.size} selected`
  }
  function renderLevels(){
    const grid=$('levelGrid');grid.innerHTML='';levels.forEach((level,index)=>{
      const button=document.createElement('button');button.type='button';button.className='level-chip'+(index===selectedLevel?' current':'');button.textContent=String(index+1).padStart(2,'0');button.setAttribute('aria-label',`Level ${index+1} of ${levels.length}: ${level.title}`);button.setAttribute('aria-pressed',String(index===selectedLevel));button.onclick=()=>{
        selectedLevel=index;storage.set('chord-garden-level-v2',String(selectedLevel));currentProgressionIndex=null;progressionChordIndex=0;levelCustomization=null;storage.remove('chord-garden-level-customization');renderLevels();renderLibrary();pick()
      };grid.appendChild(button)
    });const level=levels[selectedLevel];$('levelTitle').textContent=`Level ${selectedLevel+1}/${levels.length} · ${level.title}`;$('levelSummary').textContent=`${levelDeck().length} chords in this deck. ${level.summary}`;renderProgressionGraph()
  }
  renderLevels();
  renderLibrary();
  function updateDeckModeButton(){
    $('deckModeBtn').textContent=deckMode==='walk'?'Progression walk':'Random chords';$('deckModeBtn').setAttribute('aria-pressed',String(deckMode==='walk'));$('deckModeBtn').setAttribute('aria-label',deckMode==='walk'?'Progression walk is on; switch to random chords':'Random chords are on; switch to progression walk')
  }
  updateDeckModeButton();$('deckModeBtn').onclick=()=>{
    deckMode=deckMode==='walk'?'random':'walk';storage.set('chord-garden-deck-mode',deckMode);currentProgressionIndex=null;progressionChordIndex=0;updateDeckModeButton();pick()
  };$('guidedBtn').setAttribute('aria-pressed',String(guided));$('guidedBtn').textContent=`Guided mode: ${guided?'on':'off'}`;$('guidedBtn').onclick=()=>{
    guided=!guided;storage.set('chord-garden-guided',String(guided));$('guidedBtn').setAttribute('aria-pressed',String(guided));$('guidedBtn').textContent=`Guided mode: ${guided?'on':'off'}`;render()
  };$('midiConnectBtn').onclick=()=>connectMidi();$('midiInputSelect').onchange=()=>{
    const selected=midiAccess?.inputs.get($('midiInputSelect').value);if(selected)setMidiInput(selected)
  };$('connectBtn').onclick=()=>{
    if(midiInput){if(midiAccess)midiAccess.onstatechange=null;midiAccess=null;setMidiInput(null)}
    if(stream){
      stopMic();updateRegistered(new Set());$('connDot').classList.remove('live');$('connectionText').textContent='Microphone stopped';$('connectBtn').textContent='◉  Start listening'
    }
    else startMic()
  };$('calibrateBtn').onclick=()=>{
    if(!calibration)beginCalibration();else{calibration=null;$('calibrateBtn').disabled=false;$('calibrateBtn').textContent='Calibrate';$('connectionText').textContent='Calibration cancelled';render();setStatus('Calibration cancelled','The current chord is ready for practice.','♪')}
  };if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{
    
  }));pick();
  if(isIOSBrowser){
    $('connectBtn').textContent='◉  Tap to start listening';
    $('connectionText').textContent='On iOS, tap Start listening to allow microphone access.';
  }
  else startMic();
  connectMidi(true);
})();
