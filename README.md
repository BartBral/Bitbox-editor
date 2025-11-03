==> [TEST IT HERE](https://bartbral.github.io/Bitbox-editor) <==
   ^^^^^^^^^^^^^^



TO-DO:

01-Add "Modulation Tab": The Bitbox Micro can have 12 modulation sources per pad, that can control the settings of the sampler. The Reverb and Delay can also have Modulations. Read further down this page for details. I have also a preset.xml file with details on how the xml structure is done.
		
02-**New feature** Merge presets: When user has a preset open, and clicks merge preset; the following should happen: See what and how many Pads are unused. See how many pads are inside the file just selected to be merged with the one already in memory. If in-memory-pads + to-be-merged-pads > 16pads then ask the user, what pads should be imported from to-be-merged-preset; and checked on a checklist in a message window.


**If you make any code changes, please __only__ send the JavaScript-function or part of the code that was changed. __Do not__ send the whole code, as that is way too expensive (token wise).**

==========================================================

Just some findings:

```
MODULATION:

No Modulation = omit the <modsource/> on that slot

Modulation Sources:
src = "mod1"     
src = "mod2"     
src = "mod3"     
src = "mod4"     
src = "mod5"     
src = "mod6"     
src = "mod7"     
src = "mod8"     
src = "keytrig"  
src = "velocity" 
src = "lfo1"     
src = "pitchbend"
src = "modwheel"
src = "midivol" 
src = "midipan" 
src = "midicc"  
____________________________________
____________________________________

Modulation Destinations:

In Sample-mode:
Screen name:		xml name:				

Main-window:
	Level:   		dest="gaindb"       
	Pitch:			dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:			dest="envattack" 
	Decay:			dest="envdecay"  
	Release:		dest="envrel"    
Pos-window:
	Start:			dest="samstart" 	
	Length:			dest="samlen"   
	Loop Start:		dest="loopstart"
	Loop End:		dest="loopend"  
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:		dest="lfoamount"
____________________________________

In Multi-Sample-mode:
Screen name:		xml name:

Main-window:
	Level:   		dest="gaindb"       
	Pitch:			dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:			dest="envattack" 
	Decay:			dest="envdecay"  
	Release:		dest="envrel"    
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:		dest="lfoamount"
____________________________________

In Clip-mode:
Screen name:		xml name:

Main-window:
	Level:   		dest="gaindb"       
	Pitch:			dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:			dest="envattack" 
	Decay:			dest="envdecay"  
	Release:		dest="envrel"    
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:		dest="lfoamount"
____________________________________

In Slice-mode:
Screen name:		xml name:

Main-window:
	Level:   		dest="gaindb"       
	Pitch:			dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:			dest="envattack" 
	Decay:			dest="envdecay"  
	Release:		dest="envrel"    
Pos-window:		
	Slice:			dest="actslice"
	Slice Seq:		dest="slicestepmode"  
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:		dest="lfoamount"


____________________________________

In Granular-mode:
Screen name:		xml name:

Main-window:
	Level:   		dest="gaindb"       
	Pitch:			dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:			dest="envattack" 
	Decay:			dest="envdecay"  
	Release:		dest="envrel"    
Pos-window:
	Start:			dest="samstart" 	
	Length:			dest="samlen"   
	Loop Start:		dest="loopstart"
	Loop End:		dest="loopend"  
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:		dest="lfoamount"
Gran-window:
	Speed:			dest="grainreadspeed"
```


And Modulation for the two FX; 
Delay and Reverb:
```
Modulation Sources:
src = "mod1"     
src = "mod2"     
src = "mod3"     
src = "mod4"     
src = "mod5"     
src = "mod6"     
src = "mod7"     
src = "mod8"     
src = "keytrig"  
src = "velocity" 
src = "lfo1"     
src = "pitchbend"
src = "modwheel"
src = "midivol" 
src = "midipan" 
src = "midicc"  

____________________________________

In Delay window:
<!-- Max 9 Modulation sources for the Delay effect -->
Screen name:		xml name:

Delay:				dest="delaymustime"
Feedback			dest="feedback"     
Cutoff:				dest="cutoff"        
____________________________________

In Reverb window:
<!-- Max 9 Modulation sources for the Reverb effect -->
Screen name:		xml name:

Decay:				dest="decay"	
Predelay:			dest="predelay"	
Damping:			dest="damping"	

____________________________________
```
           	
