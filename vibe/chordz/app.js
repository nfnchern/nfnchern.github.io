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
  const storedNumber=(key,fallback)=>{
    const stored=storage.get(key);
    if(stored===null||stored.trim()==='')return fallback;
    const value=Number(stored);
    return Number.isFinite(value)?value:fallback;
  };
  const isIOSBrowser=/iPad|iPhone|iPod/.test(navigator.userAgent)||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let current=null;
  let done=Math.max(0,Math.floor(storedNumber('chord-garden-total',0)));
  let audioCtx=null;
  let analyser=null;
  let stream=null;
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
  let chordTargetFloor=Math.min(.12,Math.max(.04,storedNumber('chord-garden-chord-target-floor',.06)));
  let chordExtraFloor=Math.min(.4,Math.max(.24,storedNumber('chord-garden-chord-extra-floor',.3)));
  let calibration=null;
  let deckMode=storage.get('chord-garden-deck-mode')==='random'?'random':'walk';
  let progressionGraphModel=null;
  let currentProgressionIndex=null;
  let progressionChordIndex=0;
  function localDateKey(date){
    return[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')
  }
  function noteName(midi){
    return notes[midi%12]+(Math.floor(midi/12)-1)
  }
  function readPowerSpectrum(analyser,decibels,power){
    analyser.getFloatFrequencyData(decibels);for(let i=0;i<decibels.length;i++)power[i]=Number.isFinite(decibels[i])?Math.pow(10,decibels[i]/10):0
  }
  function powerAt(power,hz,binHz){
    const bin=hz/binHz,lo=Math.floor(bin),fraction=bin-lo;if(lo<0||lo+1>=power.length)return 0;return power[lo]*(1-fraction)+power[lo+1]*fraction
  }
  function nearbyPowerAt(power,hz,binHz){
    let peak=0;for(const cents of[-40,-20,0,20,40])peak=Math.max(peak,powerAt(power,hz*Math.pow(2,cents/1200),binHz));return peak
  }
  function noteFrequency(midi){
    return 440*Math.pow(2,(midi-69)/12)
  }
  function noteSalience(power,binHz,midi){
    const frequency=noteFrequency(midi),fundamental=nearbyPowerAt(power,frequency,binHz);let predicted=0;for(let h=2;h<=5;h++){
      const subharmonic=nearbyPowerAt(power,frequency/h,binHz),ratio=harmonicProfile[h-2]||0;predicted=Math.max(predicted,subharmonic*ratio)
    }return Math.max(fundamental*.25,fundamental-predicted*.25)
  }
  function pitchSaliences(power,binHz){
    const salience=new Float32Array(85);for(let midi=36;midi<=84;midi++)salience[midi]=noteSalience(power,binHz,midi);return salience
  }
  function calibrationNoteDetected(saliences,midi){
    let peak=0;for(let n=36;n<=84;n++)peak=Math.max(peak,saliences[n]);return saliences[midi]>=Math.max(peak*.18,1e-12)
  }
  function calibrationChordMetrics(saliences,pcs){
    const score=new Float32Array(12);for(let n=36;n<=84;n++)score[n%12]=Math.max(score[n%12],saliences[n]);const peak=Math.max(...score),weakest=Math.min(...pcs.map(pc=>score[pc])),extra=Math.max(0,...Array.from(score,(value,pc)=>pcs.includes(pc)?0:value));return{
      targetRatio:peak?weakest/peak:0,extraRatio:peak?extra/peak:0
    }
  }
  function measureHarmonicProfile(power,binHz,midi){
    const fundamental=nearbyPowerAt(power,noteFrequency(midi),binHz);return[2,3,4,5].map(h=>Math.max(.001,Math.min(.9,nearbyPowerAt(power,noteFrequency(midi)*h,binHz)/Math.max(fundamental,1e-12))))
  }
  function renderKeyboard(){
    const board=$('keyboard');board.innerHTML='';if((!current||deckPaused)&&!calibration)return;const target=current?current.q.ints.map(i=>(current.root+i)%12):[],leftNotes=current?current.q.ints.map(i=>36+current.root+i):[],rightNotes=current?current.q.ints.map(i=>60+current.root+i):[],reveal=solved||guided,notePrompt=calibration?.phase==='notes'?calibration.notePrompts[calibration.noteIndex]:null,calibrationTargets=calibration&&!calibration.awaitingRelease?(notePrompt?[notePrompt.midi]:calibration.phase==='chords'?(calibration.chordPrompts[calibration.chordIndex]?.midis||[]):[]):[];let whiteIndex=-1;for(let midi=36;midi<84;midi++){
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
      const phase=calibration.phase,index=phase==='chords'?calibration.chordIndex:calibration.noteIndex||0,release=calibration.awaitingRelease;
      $('cardLabel').textContent='Calibrate';
      if(phase==='noise'){
        $('round').textContent='QUIET';$('chordName').textContent='Stay quiet';$('quality').textContent='Measuring the room for two seconds.';setStatus('Room check','Keep quiet until the note prompts begin.','◉');
      }
      else if(phase==='notes'){
        const prompt=calibration.notePrompts[index],groupIndex=index%7,handLabel=prompt.hand==='left'?'Left hand':'Right hand',previous=calibration.notePrompts[index-1];$('round').textContent=`${prompt.hand==='left'?'LH':'RH'} ${groupIndex+1}/7`;$('chordName').textContent=release?'Release':prompt.name;$('quality').textContent=release?`Let ${previous.name} ring out, then play ${prompt.name}.`:`${handLabel}: play and hold ${prompt.name}. The prompt advances when sound is captured.`;setStatus(release?'Release the note':`${handLabel} note`,release?'Wait for the sound to fade.':'Hold the key briefly, then release it.','♪');
      }
      else{
        const chord=calibration.chordPrompts[index],groupIndex=index%6,handLabel=chord.hand==='left'?'Left hand':'Right hand';$('round').textContent=`${chord.hand==='left'?'LH':'RH'} ${groupIndex+1}/6`;$('chordName').textContent=release?'Release':chord.name;$('quality').textContent=release?'Let every key ring out before the next prompt.':`${handLabel}: play and hold the highlighted keys together.`;setStatus(release?'Release the chord':`${handLabel} chord`,release?'Wait for the sound to fade.':'The prompt advances when sound is captured.','♪');
      }
    }
    else if(current&&!deckPaused){
      $('cardLabel').textContent='Chord';
      const root=notes[current.root],q=current.q,quality=document.createElement('span');quality.textContent=q.name;$('chordName').replaceChildren(document.createTextNode(root),quality);$('quality').textContent=`${root} ${q.label} · root position`;$('round').textContent=String(done+1).padStart(2,'0')
    }
    else{
      $('cardLabel').textContent='Chord';$('chordName').textContent='—';$('quality').textContent='Choose a learning level to begin';$('round').textContent='--'
    }renderKeyboard()
  }
  function chordId(chord){
    return `${chord.root}:${chord.q.name}`
  }
  function levelDeck(index=selectedLevel){
    const chords=levels[index].chords;return index===selectedLevel&&Array.isArray(levelCustomization)?chordCatalog.filter(chord=>levelCustomization.includes(chordId(chord))):chords.slice()
  }
  function pick(){
    let choice;if(deckMode==='walk'&&progressionGraphModel?.progressions.length){
      if(currentProgressionIndex===null){
        currentProgressionIndex=Math.floor(Math.random()*progressionGraphModel.progressions.length);progressionChordIndex=0
      }
      const chord=progressionGraphModel.progressions[currentProgressionIndex].chords[progressionChordIndex];choice=chord&&{
        root:chord.root,q:qualities.find(quality=>quality.name===chord.quality)
      }
    }
    else{
      let pool=levelDeck();if(pool.length>1&&current)pool=pool.filter(chord=>chord.root!==current.root||chord.q!==current.q);if(pool.length)choice=pool[Math.floor(Math.random()*pool.length)]
    }if(!choice){
      deckPaused=true;solved=true;goodSince=0;registeredNotes.clear();render();setStatus('No chords in this level','Add chords from the library below to start practicing.','♪');return
    }deckPaused=false;current=choice;solved=false;goodSince=0;registeredNotes.clear();render();$('response').classList.remove('good');setStatus('Ready when you are','Play all the notes together to continue.','♪');updateGraphWalkMarker()
  }
  function advanceProgressionWalk(){
    const currentSequence=progressionGraphModel?.progressions[currentProgressionIndex]?.chords||[];if(progressionChordIndex+1<currentSequence.length){
      progressionChordIndex++
    }
    else{
      const neighbors=progressionGraphModel?.outgoing[currentProgressionIndex]||[];currentProgressionIndex=neighbors.length?neighbors[Math.floor(Math.random()*neighbors.length)]:Math.floor(Math.random()*progressionGraphModel.progressions.length);progressionChordIndex=0
    }pick()
  }
  function setStatus(title,detail,icon){
    $('statusTitle').textContent=title;$('statusDetail').textContent=detail;$('statusIcon').textContent=icon
  }
  function succeed(){
    if(solved)return;solved=true;done++;storage.set('chord-garden-total',done);$('doneCount').textContent=done;const today=localDateKey(new Date()),previous=storage.get('chord-garden-last');let streak=Number(storage.get('chord-garden-streak')||0);if(previous!==today){
      const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);streak=previous===localDateKey(yesterday)?streak+1:1;storage.set('chord-garden-last',today);storage.set('chord-garden-streak',streak)
    }if(deckMode==='walk')advanceProgressionWalk();else pick()
  }
  function toast(message){
    $('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200)
  }
  function stopMic(){
    if(raf)cancelAnimationFrame(raf);raf=0;calibration=null;$('calibrateBtn').disabled=true;$('calibrateBtn').textContent='Calibrate';if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;analyser=null;if(audioCtx){
      audioCtx.close().catch(()=>{
        
      });audioCtx=null
    }
    $('volume').classList.add('hidden');if($('cardLabel'))render()
  }
  function beginCalibration(){
    if(!analyser||calibration)return;const scaleNotes=[['C',0],['D',2],['E',4],['F',5],['G',7],['A',9],['B',11]],notePrompts=['left','right'].flatMap(hand=>scaleNotes.map(([name,offset])=>({name:`${name}${hand==='left'?2:4}`,hand,midi:(hand==='left'?36:60)+offset}))),chordPrompts=['left','right'].flatMap(hand=>levels[0].chords.map(chord=>{
      const base=hand==='left'?36:60,midis=chord.q.ints.map(interval=>base+chord.root+interval),quality=chord.q.name==='maj'?'major':'minor';return{
        name:`${notes[chord.root]} ${quality}`,hand,midis,pcs:chord.q.ints.map(interval=>(chord.root+interval)%12)
      }
    }));calibration={
      phase:'noise',until:performance.now()+2000,noiseSamples:[],playSum:0,playFrames:0,notePrompts,noteProfiles:[],profileSamples:[],chordPrompts,chordIndex:0,chordTargetRatios:[],chordExtraRatios:[]
    };goodSince=0;registeredNotes.clear();$('calibrateBtn').disabled=false;$('calibrateBtn').textContent='Cancel calibration';$('connectionText').textContent='Calibration started';render()
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
      });stage='connecting audio input';analyser=audioCtx.createAnalyser();analyser.fftSize=16384;analyser.smoothingTimeConstant=.25;audioCtx.createMediaStreamSource(stream).connect(analyser);$('connDot').classList.add('live');$('connectionText').textContent='Microphone ready · calibration is starting';$('connectBtn').textContent='■  Stop listening';$('calibrateBtn').disabled=false;$('volume').classList.remove('hidden');listen();beginCalibration()
    }
    catch(e){
      if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(audioCtx){
        audioCtx.close().catch(()=>{
          
        });audioCtx=null
      }analyser=null;$('connDot').classList.remove('live');$('volume').classList.add('hidden');$('connectBtn').textContent='◉  Start listening';const name=e?.name||'Error',message=e?.message||String(e);$('connectionText').textContent=`${stage} failed · ${name}`;toast(`${stage} failed: ${name} — ${message}`)
    }
  }
  function listen(){
    const samples=new Uint8Array(analyser.fftSize),decibels=new Float32Array(analyser.frequencyBinCount),power=new Float32Array(analyser.frequencyBinCount),smoothedScores=new Float32Array(12),binHz=audioCtx.sampleRate/analyser.fftSize;const loop=()=>{
      if(!analyser)return;analyser.getByteTimeDomainData(samples);let energy=0;for(let i=0;i<samples.length;i++){
        const x=(samples[i]-128)/128;energy+=x*x
      }
      const rms=Math.sqrt(energy/samples.length);$('volumeBar').style.width=Math.min(100,rms*500)+'%';if(calibration){
        if(calibration.phase==='noise'){
          calibration.noiseSamples.push(rms);if(performance.now()>=calibration.until){
            const levels=calibration.noiseSamples.sort((a,b)=>a-b);noiseFloor=Math.min(.04,Math.max(.0005,levels[Math.floor((levels.length-1)*.5)]||0));noisePeak=Math.min(.04,Math.max(noiseFloor,levels[Math.floor((levels.length-1)*.9)]||noiseFloor));storage.set('chord-garden-noise-floor',String(noiseFloor));storage.set('chord-garden-noise-peak',String(noisePeak));calibration.phase='notes';calibration.noteIndex=0;calibration.until=Infinity;calibration.noteLevels=[];calibration.playSum=0;calibration.playFrames=0;calibration.awaitingRelease=false;$('calibrateBtn').textContent='Cancel calibration';$('connectionText').textContent='Play C2';render();
          }
        }
        else{
          const signalGate=Math.min(.02,Math.max(.002,noiseFloor*1.25,noisePeak*.9,noiseFloor+.001)),releaseGate=Math.max(.002,noiseFloor*1.2,noisePeak*.95),expectedMidi=calibration.phase==='notes'?calibration.notePrompts[calibration.noteIndex].midi:0;readPowerSpectrum(analyser,decibels,power);const saliences=pitchSaliences(power,binHz);if(calibration.awaitingRelease){
            const adaptiveReleaseGate=Math.max(noiseFloor*1.25,noisePeak*1.1,(calibration.releaseReference||releaseGate)*.2);if(rms<adaptiveReleaseGate){
              calibration.releaseFrames=(calibration.releaseFrames||0)+1;if(calibration.releaseFrames>=6){
                calibration.awaitingRelease=false;calibration.releaseFrames=0;calibration.playSum=0;calibration.playFrames=0;$('connectionText').textContent=calibration.phase==='notes'?'Play '+calibration.notePrompts[calibration.noteIndex].name:'Play '+calibration.chordPrompts[calibration.chordIndex].name;render()
              }
            }
            else calibration.releaseFrames=0;
          }
          else if(calibration.phase==='notes'){
            if(rms>signalGate){
              if(!calibration.playFrames){
                let strongest=36;for(let midi=37;midi<=84;midi++)if(saliences[midi]>saliences[strongest])strongest=midi;
                if(saliences[strongest]>1e-12)$('connectionText').textContent=`Hearing ${noteName(strongest)} · capturing ${calibration.notePrompts[calibration.noteIndex].name}`;
                setStatus('Sound detected',`Capturing ${calibration.notePrompts[calibration.noteIndex].name} · release when prompted.`,'◉');
              }
              calibration.playSum+=rms;calibration.playFrames++;calibration.profileSamples.push(measureHarmonicProfile(power,binHz,expectedMidi));if(calibration.playFrames>=8){
                const recognized=calibrationNoteDetected(saliences,expectedMidi);calibration.noteLevels.push(calibration.playSum/calibration.playFrames);calibration.releaseReference=calibration.playSum/calibration.playFrames;
                if(recognized)calibration.noteProfiles.push([0,1,2,3].map(i=>calibration.profileSamples.reduce((sum,profile)=>sum+profile[i],0)/calibration.profileSamples.length));
                calibration.profileSamples=[];calibration.playSum=0;calibration.playFrames=0;calibration.noteIndex++;
                if(calibration.noteIndex<calibration.notePrompts.length){
                  calibration.awaitingRelease=true;calibration.releaseFrames=0;$('connectionText').textContent=`Signal captured${recognized?' · pitch matched':' · pitch unclear, continuing'}; release, then play ${calibration.notePrompts[calibration.noteIndex].name}`;render();
                }
                else{
                  const levels=calibration.noteLevels.sort((a,b)=>a-b),measured=levels[Math.floor(levels.length/2)];playingLevel=Math.min(.2,measured);storage.set('chord-garden-playing-level',String(playingLevel));
                  if(calibration.noteProfiles.length)harmonicProfile=[0,1,2,3].map(i=>{
                    const values=calibration.noteProfiles.map(profile=>profile[i]).sort((a,b)=>a-b);return Math.max(.001,Math.min(.9,values[Math.floor(values.length/2)]||[.12,.05,.025,.015][i]))
                  });
                  storage.set('chord-garden-harmonic-profile',JSON.stringify(harmonicProfile));calibration.phase='chords';calibration.chordIndex=0;calibration.awaitingRelease=true;calibration.releaseFrames=0;calibration.playFrames=0;calibration.playSum=0;$('connectionText').textContent='Signal captured; release B4, then play C major.';render()
                }
              }
            }
            else{calibration.playSum=0;calibration.playFrames=0;calibration.profileSamples=[]}
          }
          else if(calibration.phase==='chords'){
            const prompt=calibration.chordPrompts[calibration.chordIndex],metrics=calibrationChordMetrics(saliences,prompt.pcs);if(rms>signalGate){
              if(!calibration.playFrames)setStatus('Sound detected',`Capturing ${prompt.hand} hand · ${prompt.name}.`,'◉');
              calibration.playSum+=rms;if(metrics.targetRatio>.025){calibration.chordTargetRatios.push(metrics.targetRatio);calibration.chordExtraRatios.push(metrics.extraRatio)}if(++calibration.playFrames>=8){
                calibration.releaseReference=calibration.playSum/calibration.playFrames;calibration.playSum=0;calibration.chordIndex++;calibration.playFrames=0;if(calibration.chordIndex<calibration.chordPrompts.length){
                  calibration.awaitingRelease=true;calibration.releaseFrames=0;$('connectionText').textContent='Sound captured; release, then play '+calibration.chordPrompts[calibration.chordIndex].name;render()
                }
                else{
                  const sortedTarget=calibration.chordTargetRatios.slice().sort((a,b)=>a-b),sortedExtra=calibration.chordExtraRatios.slice().sort((a,b)=>a-b);if(sortedTarget.length){
                    chordTargetFloor=Math.max(.04,Math.min(.12,sortedTarget[Math.floor(sortedTarget.length*.2)]*.55));chordExtraFloor=Math.max(.24,Math.min(.4,(sortedExtra[Math.floor(sortedExtra.length*.8)]||.2)*1.25));storage.set('chord-garden-chord-target-floor',String(chordTargetFloor));storage.set('chord-garden-chord-extra-floor',String(chordExtraFloor))
                  }$('connectionText').textContent='Listening · calibration complete';calibration=null;$('calibrateBtn').disabled=false;$('calibrateBtn').textContent='Calibrate';render();setStatus('Calibration complete','Play the chord shown to continue.','✓');
                }
              }
            }
            else calibration.playFrames=0
          }
          else{
            calibration.playSum=0;calibration.playFrames=0;calibration.profileSamples=[]
          }
        }raf=requestAnimationFrame(loop);return;
      }
      const gate=Math.min(.045,Math.max(.004,noiseFloor*2.5,noisePeak*1.5,playingLevel*.12));if(rms>gate&&!deckPaused){
        readPowerSpectrum(analyser,decibels,power);const noteScore=pitchSaliences(power,binHz),score=new Float32Array(12);for(let n=36;n<=84;n++)score[n%12]=Math.max(score[n%12],noteScore[n]);for(let pc=0;pc<12;pc++){score[pc]=.55*smoothedScores[pc]+.45*score[pc];smoothedScores[pc]=score[pc]}const peak=Math.max(...score),target=current.q.ints.map(i=>(current.root+i)%12),hasTarget=peak>0&&target.every(pc=>score[pc]>peak*chordTargetFloor),liveClasses=new Set();let extraStrong=0;for(let pc=0;pc<12;pc++){
          const isTarget=target.includes(pc),relative=score[pc]/Math.max(peak,1e-20);if(isTarget?relative>.035:relative>chordExtraFloor*.9)liveClasses.add(pc);if(!isTarget&&score[pc]>peak*chordExtraFloor)extraStrong++
        }
        const live=new Set();for(let midi=36;midi<=83;midi++)if(liveClasses.has(midi%12))live.add(midi);updateRegistered(live);if(hasTarget&&extraStrong===0){
          if(!goodSince)goodSince=performance.now();else if(performance.now()-goodSince>=180)succeed()
        }
        else goodSince=0;
      }
      else{
        goodSince=0;smoothedScores.fill(0);updateRegistered(new Set())
      }raf=requestAnimationFrame(loop);
    };loop();
  }
  const graphPalette=['#a9d3ff','#d7f27a','#e6a9ff','#ffb977','#8edcc3','#ff9e97','#b5b8ff'];
  function renderProgressionGraph(){
    const host=$('progressionGraph'),legend=$('progressionLegend'),status=$('graphStatus');progressionGraphModel=window.ChordProgressionGraph.buildGraph(levels[selectedLevel].progressions||[]);const items=progressionGraphModel.progressions,edges=progressionGraphModel.edges;host.innerHTML='';legend.innerHTML='';if(!items.length){
      host.innerHTML='<div class="graph-empty">No progression connections available for this level.</div>';status.textContent='';return
    }
    const width=Math.max(760,items.length*11+200),height=Math.max(430,items.length*11+200),cx=width/2,cy=height/2,rx=width*.42,ry=height*.42,nodeRadius=items.length>35?11:items.length>20?14:17,points=items.map((item,i)=>{
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
  };$('connectBtn').onclick=()=>{
    if(stream){
      stopMic();updateRegistered(new Set());$('connDot').classList.remove('live');$('connectionText').textContent='Microphone stopped';$('connectBtn').textContent='◉  Start listening'
    }
    else startMic()
  };$('calibrateBtn').onclick=()=>{
    if(!calibration)beginCalibration();else{calibration=null;$('calibrateBtn').disabled=false;$('calibrateBtn').textContent='Calibrate';$('connectionText').textContent='Calibration cancelled';render();setStatus('Calibration cancelled','The current chord is ready for practice.','♪')}
  };$('doneCount').textContent=done;if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{
    
  }));pick();
  if(isIOSBrowser){
    $('connectBtn').textContent='◉  Tap to start listening';
    $('connectionText').textContent='On iOS, tap Start listening to allow microphone access and begin calibration.';
  }
  else startMic();
})();
