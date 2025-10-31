TO-DO:

00-Bugfix Slice-mode preset gets broken by our app:
-Just opening and saving a working Slice-mode pad will get rendered broken, because the slice information just gets cut out of the file when saving. See here how Slices should be used in this preset.xml: https://raw.githubusercontent.com/BartBral/Bitbox-editor/refs/heads/main/Test_Presets/preset_MOD_comments.xml

01-Export selected:      
-Multi selection: It will now export all pads in the selection to the same json file. This is not what I want; I want that all pads are saved in a separate json. This will make it more easy to import one pad later on, when import pad will be integrated. 

-When "multi-samples" are used they should also be referenced in the output json-file.

-When we implement sample editing, the actual samples used in the pad should also be stored. I think by putting all relevant files in a zip-file. Then implementing zip-file import. (maybe change the .zip extension to .pad to make clear that this is a pad-file.)

-When no samples in pad, it does not save it's settings and says: "Selected pads are empty", but it should save settings even without a sample inside, as some people like to use pads with only settings, for them to use as templates. For this same reason I think that all pads should always be filled with a template Empty-preset, loaded as an imported file (as in an include file), so people can make their own template files, so all their personal preferences are always in the pads. All pads should just be named "empty", so that they are recognized as an empty pad for when user want to Merge a preset (see 02 below), or maybe other functions that need to know if the pad is empty. (if better more advanced options will do the same, that's okay as well.
		
02-**New feature** Merge presets: When user has an preset open, and clicks merge preset; the following should happen: See what and how many Pads are unused. See how many pads are inside the file just selected to be merged with the one already in memory. If in-memory-pads + to-be-merged-pads > 16pads then ask the user, what pads should be imported from to-be-merged-preset; and checked on a checklist in a message window.


03-Edit modal with all parameters, as not yet all parameters are implemented in the modal edit window. To accomplish this in a nice way, we need to add Tabs to our modal window; tabs should be called: Main, Env, Lfo, Pos, Gran, Config

04-Next to a slider, the parameter values should also be input by text, keyboard input. For fast and accurate exact values. Maybe also go for circular "Pots" instead of slider for most of the values, as the actual value can placed within the pot, that will look tidy and if you double-click on the value, you can edit by keyboard input. Also using mouse-wheel if over value will edit it.

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
           	
