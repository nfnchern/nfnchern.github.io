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
  let current=null;
  let midiAccess=null;
  let midiInput=null;
  const midiNotes=new Map();
  const midiAttempt=new Set();
  let midiAwaitingRelease=false;
  let midiMatchTimer=0;
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
  let toastTimer=0;
  let deckMode=storage.get('chord-garden-deck-mode')==='random'?'random':'walk';
  let progressionGraphModel=null;
  let currentProgressionIndex=null;
  let progressionChordIndex=0;
  let progressionQueue=[];
  let randomQueue=[];
  const visibleChordQueueSize=5;
  let renderedQueueChord='';
  let queueAnimationTimer=0;
  function noteName(midi){
    return notes[midi%12]+(Math.floor(midi/12)-1)
  }
  function renderKeyboard(){
    const board=$('keyboard');board.innerHTML='';if(!current||deckPaused)return;const target=current.q.ints.map(i=>(current.root+i)%12),leftNotes=current.q.ints.map(i=>36+current.root+i),rightNotes=current.q.ints.map(i=>60+current.root+i),reveal=solved||guided;let whiteIndex=-1;for(let midi=36;midi<84;midi++){
      const pc=midi%12,isTarget=target.includes(pc),isLeft=leftNotes.includes(midi),isRight=rightNotes.includes(midi),showGuide=guided&&(isLeft||isRight),hand=isLeft?'left':'right',targetClass=reveal&&showGuide?' target hand-'+hand:'';if(whitePitchClasses.includes(pc)){
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
    if(current&&!deckPaused){
      $('cardLabel').textContent='Chord';
      $('chordSequence').classList.remove('hidden');renderChordSequence();const root=notes[current.root],q=current.q;$('quality').textContent=`${root} ${q.label} · root position`;$('round').textContent=''
    }
    else{
      $('chordSequence').classList.add('hidden');$('cardLabel').textContent='Chord';$('quality').textContent='Choose a learning level to begin';$('round').textContent=''
    }renderKeyboard()
  }
  function renderChordSequence(){
    const sequence=$('chordSequence'),walkAvailable=deckMode==='walk'&&progressionGraphModel?.progressions.length,chords=[current,...(walkAvailable?progressionQueue.map(item=>item.chord):randomQueue)].filter(Boolean),activeKey=chordId(current),advancing=renderedQueueChord&&renderedQueueChord!==activeKey,departing=advancing?sequence.querySelector('.sequence-chord.current')?.cloneNode(true):null;
    sequence.querySelectorAll('.sequence-exit').forEach(item=>item.remove());
    sequence.replaceChildren(...chords.slice(0,visibleChordQueueSize).map((chord,index)=>{
      const item=document.createElement('div'),name=document.createElement('div'),quality=document.createElement('span'),root=document.createElement('span');item.className=`sequence-chord${index===0?' current':''}`;item.setAttribute('aria-current',String(index===0));item.setAttribute('aria-label',`${notes[chord.root]} ${chord.q.label}${index===0?', current chord':`, next ${index}`}`);root.textContent=notes[chord.root];quality.textContent=chord.q.name;quality.className='sequence-quality';name.className='sequence-name';name.append(root,quality);item.appendChild(name);return item
    }));
    if(departing){departing.className='sequence-chord sequence-exit';departing.removeAttribute('aria-current');departing.setAttribute('aria-hidden','true');sequence.appendChild(departing);sequence.classList.add('queue-advance');clearTimeout(queueAnimationTimer);queueAnimationTimer=setTimeout(()=>{sequence.classList.remove('queue-advance');departing.remove()},360)}renderedQueueChord=activeKey
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
  function randomChord(previous){
    const deck=levelDeck(),pool=previous&&deck.length>1?deck.filter(chord=>chordId(chord)!==chordId(previous)):deck;return pool.length?pool[Math.floor(Math.random()*pool.length)]:deck[0]
  }
  function ensureRandomQueue(count,previous=current){
    while(randomQueue.length<count){const previousChord=randomQueue[randomQueue.length-1]||previous,next=randomChord(previousChord);if(!next)break;randomQueue.push(next)}
  }
  function nextProgressionEntry(entry){
    const progressions=progressionGraphModel?.progressions||[],sequence=progressions[entry.progressionIndex]?.chords||[];
    if(entry.chordIndex+1<sequence.length){const chord=sequence[entry.chordIndex+1];return{progressionIndex:entry.progressionIndex,chordIndex:entry.chordIndex+1,chord:{root:chord.root,q:qualities.find(item=>item.name===chord.quality)}}}
    const neighbors=progressionGraphModel?.outgoing[entry.progressionIndex]||[],progressionIndex=neighbors.length?neighbors[Math.floor(Math.random()*neighbors.length)]:Math.floor(Math.random()*progressions.length),chord=progressions[progressionIndex]?.chords[0];return chord?{progressionIndex,chordIndex:0,chord:{root:chord.root,q:qualities.find(item=>item.name===chord.quality)}}:null
  }
  function ensureProgressionQueue(count){
    const progressions=progressionGraphModel?.progressions||[];if(!progressions.length)return;
    if(!progressionQueue.length){
      const starts=progressions.map((progression,index)=>({progressionIndex:index,chordIndex:0,chord:progression.chords[0]&&{root:progression.chords[0].root,q:qualities.find(item=>item.name===progression.chords[0].quality)}})).filter(item=>item.chord&&(!current||progressionChordKey(item.chord)!==progressionChordKey(current)));
      const alternatives=[];progressions.forEach((progression,index)=>progression.chords.forEach((chord,chordIndex)=>{const converted={root:chord.root,q:qualities.find(item=>item.name===chord.quality)};if(converted.q&&(!current||progressionChordKey(converted)!==progressionChordKey(current)))alternatives.push({progressionIndex:index,chordIndex,chord:converted})}));
      const available=starts.length?starts:alternatives.length?alternatives:progressions.map((progression,index)=>({progressionIndex:index,chordIndex:0,chord:progression.chords[0]&&{root:progression.chords[0].root,q:qualities.find(item=>item.name===progression.chords[0].quality)}})).filter(item=>item.chord);
      if(available.length)progressionQueue.push(available[Math.floor(Math.random()*available.length)])
    }
    while(progressionQueue.length<count){
      const previous=progressionQueue[progressionQueue.length-1],previousKey=progressionChordKey(previous.chord),limit=Math.max(1,progressions.reduce((sum,item)=>sum+item.chords.length,0)*2);let candidate=null;
      for(let i=0;i<limit;i++){candidate=nextProgressionEntry(candidate||previous);if(!candidate||progressionChordKey(candidate.chord)!==previousKey)break}
      if(!candidate||progressionChordKey(candidate.chord)===previousKey){
        const alternatives=[];progressions.forEach((progression,index)=>progression.chords.forEach((chord,chordIndex)=>{const converted={root:chord.root,q:qualities.find(item=>item.name===chord.quality)};if(converted.q&&progressionChordKey(converted)!==previousKey)alternatives.push({progressionIndex:index,chordIndex,chord:converted})}));
        if(!alternatives.length)break;candidate=alternatives[Math.floor(Math.random()*alternatives.length)]
      }
      progressionQueue.push(candidate)
    }
  }
  function pick(){
    clearMidiMatchTimer();midiAttempt.clear();if(midiInput&&midiNotes.size)midiAwaitingRelease=true;
    let choice;if(deckMode==='walk'&&progressionGraphModel?.progressions.length){
      ensureProgressionQueue(1);const next=progressionQueue.shift();if(next){currentProgressionIndex=next.progressionIndex;progressionChordIndex=next.chordIndex;choice=next.chord}ensureProgressionQueue(visibleChordQueueSize-1)
    }
    else{
      if(!randomQueue.length){const first=randomChord(current);if(first)randomQueue.push(first)}choice=randomQueue.shift();ensureRandomQueue(visibleChordQueueSize-1,choice)
    }if(!choice){
      deckPaused=true;solved=true;registeredNotes.clear();render();setStatus('No chords in this level','Add chords from the library below to start practicing.','♪');return
    }deckPaused=false;current=choice;solved=false;registeredNotes.clear();render();$('response').classList.remove('good');setStatus('Ready when you are','Play the chord together or one note at a time, in any order.','♪');updateGraphWalkMarker()
  }
  function advanceProgressionWalk(){
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
    midiInput=input;midiNotes.clear();midiAwaitingRelease=false;clearMidiMatchTimer();updateRegistered(new Set());
    if(input){midiInput.onmidimessage=handleMidiMessage;$('midiDot').classList.add('live');$('midiStatus').textContent=`Connected · ${input.name||'MIDI keyboard'}`;$('midiConnectBtn').textContent='Disconnect MIDI'}
    else{$('midiDot').classList.remove('live');$('midiStatus').textContent='MIDI disconnected';$('midiInputSelect').classList.add('hidden');$('midiConnectBtn').textContent='Connect MIDI'}
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
      $('midiStatus').textContent='Web MIDI is not supported in this browser';if(!silent)toast('Web MIDI is unavailable in this browser.');return
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
          }levelCustomization=[...ids];randomQueue=[];progressionQueue=[];storage.set('chord-garden-level-customization',JSON.stringify({
            level:selectedLevel,chords:levelCustomization
          }));renderLevels();renderLibrary();pick()
        };cell.appendChild(button);row.appendChild(cell)
      });body.appendChild(row)
    });table.appendChild(body);$('libraryCount').textContent=`${selected.size} selected`
  }
  function renderLevels(){
    const grid=$('levelGrid');grid.innerHTML='';levels.forEach((level,index)=>{
      const button=document.createElement('button');button.type='button';button.className='level-chip'+(index===selectedLevel?' current':'');button.textContent=String(index+1).padStart(2,'0');button.setAttribute('aria-label',`Level ${index+1} of ${levels.length}: ${level.title}`);button.setAttribute('aria-pressed',String(index===selectedLevel));button.onclick=()=>{
        selectedLevel=index;storage.set('chord-garden-level-v2',String(selectedLevel));currentProgressionIndex=null;progressionChordIndex=0;progressionQueue=[];randomQueue=[];levelCustomization=null;storage.remove('chord-garden-level-customization');renderLevels();renderLibrary();pick()
      };grid.appendChild(button)
    });const level=levels[selectedLevel];$('levelTitle').textContent=`Level ${selectedLevel+1}/${levels.length} · ${level.title}`;$('levelSummary').textContent=`${levelDeck().length} chords in this deck. ${level.summary}`;renderProgressionGraph()
  }
  renderLevels();
  renderLibrary();
  function updateDeckModeButton(){
    $('deckModeBtn').textContent=deckMode==='walk'?'Progression walk':'Random chords';$('deckModeBtn').setAttribute('aria-pressed',String(deckMode==='walk'));$('deckModeBtn').setAttribute('aria-label',deckMode==='walk'?'Progression walk is on; switch to random chords':'Random chords are on; switch to progression walk')
  }
  updateDeckModeButton();$('deckModeBtn').onclick=()=>{
    deckMode=deckMode==='walk'?'random':'walk';storage.set('chord-garden-deck-mode',deckMode);currentProgressionIndex=null;progressionChordIndex=0;progressionQueue=[];randomQueue=[];updateDeckModeButton();pick()
  };$('guidedBtn').setAttribute('aria-pressed',String(guided));$('guidedBtn').textContent=`Guided mode: ${guided?'on':'off'}`;$('guidedBtn').onclick=()=>{
    guided=!guided;storage.set('chord-garden-guided',String(guided));$('guidedBtn').setAttribute('aria-pressed',String(guided));$('guidedBtn').textContent=`Guided mode: ${guided?'on':'off'}`;render()
  };$('midiConnectBtn').onclick=()=>connectMidi();$('midiInputSelect').onchange=()=>{
    const selected=midiAccess?.inputs.get($('midiInputSelect').value);if(selected)setMidiInput(selected)
  };if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{
    
  }));pick();connectMidi(true);
})();
