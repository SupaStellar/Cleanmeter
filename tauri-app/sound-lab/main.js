import * as current from 'cuelume';
import * as legacyAudio from 'cuelume-legacy';
import { createAudioSession } from '../src/lib/audio-session.ts';
const $ = id => document.getElementById(id);
const session = createAudioSession(() => new AudioContext({latencyHint:'interactive'}));
let muted=false;
const sync = () => session.setActive(!muted && $('ready').checked && document.visibilityState==='visible' && document.hasFocus());
function volume(){const value=Number($('volume').value)/100;current.setVolume(value);legacyAudio.setVolume(value);$('volume-label').textContent=`${Math.round(value*100)}%`;}
volume();current.setEnabled(true);legacyAudio.setEnabled(true);
$('volume').addEventListener('input',volume);
$('mute').onclick=()=>{muted=!muted;current.setEnabled(!muted);legacyAudio.setEnabled(!muted);$('mute').textContent=muted?'Unmute':'Mute';$('mute').setAttribute('aria-pressed',String(muted));sync();$('status').textContent=muted?'Muted.':'Ready to listen.';};
$('ready').onchange=sync;
window.addEventListener('blur',()=>session.stop());window.addEventListener('pagehide',()=>session.stop());window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);
function listen(engine,sound,options,label){if(muted){$('status').textContent='Unmute to preview sounds.';return;}sync();engine.play(sound,options);$('status').textContent=`Playing ${label} - ${$('volume-label').textContent} volume`;}
function button(parent,label,detail,action){const b=document.createElement('button');b.className='cue';const title=document.createElement('strong');title.textContent=label;const sub=document.createElement('small');sub.textContent=detail;b.append(title,sub);b.onclick=action;parent.append(b);}
const presets=[['Feedback - softer','open',{emphasis:'subtle',volume:.5},'Current - subtle, half gain'],['Feedback - previous','open',{},'Previous - normal, full gain'],['Toggle on','toggle',{},'Legacy original / current app'],['Toggle off','toggle',{},'Legacy original / current app'],['Checkbox','press',{},'Legacy original / current app'],['Selection','select',{},'Current app'],['Success','success',{},'Current app'],['Error','error',{},'Current app']];
for(const [label,sound,opts,detail] of presets)button($('presets'),label,detail,()=>listen(sound==='toggle'||sound==='press'?legacyAudio:current,sound,{...opts,theme:'default'},label));
for(const name of current.themes){const o=document.createElement('option');o.value=name;o.textContent=name;$('theme').append(o);}
function render(){const legacy=$('library').value==='legacy';for(const id of ['theme','emphasis','direction'])$(id).disabled=legacy;$('sounds').replaceChildren();$('library-note').textContent=legacy?'Original Cuelume 0.2.2 library. Use the volume slider to compare.':'Current library. Try "subtle" emphasis for softer variants. Direction affects supported cues such as toggle; themes change the sound character.';const engine=legacy?legacyAudio:current;for(const name of engine.sounds)button($('sounds'),name,legacy?'Legacy 0.2.2':'Cleanmeter 0.2.8',()=>listen(engine,name,legacy?{}:{theme:$('theme').value,emphasis:$('emphasis').value,direction:$('direction').value},`${name} (${legacy?'Legacy':$('theme').value+' / '+$('emphasis').value+' / '+$('direction').value})`));}
$('library').onchange=render;render();
if(import.meta.hot)import.meta.hot.dispose(()=>session.stop());
