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

Modulation Destinations:

In Sample-mode:
Screen name:		xml name:				

Main-window:
	Level:   		dest="gaindb"       
	Pitch:		dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:		dest="envattack" 
	Decay:		dest="envdecay"  
	Release:		dest="envrel"    
Pos-window:
	Start:		dest="samstart" 	
	Length:		dest="samlen"   
	Loop Start:	dest="loopstart"
	Loop End:		dest="loopend"  
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:	dest="lfoamount"

   
In Multi-Sample-mode:
Screen name:		xml name:

Main-window:
	Level:   		dest="gaindb"       
	Pitch:		dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:		dest="envattack" 
	Decay:		dest="envdecay"  
	Release:		dest="envrel"    
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:	dest="lfoamount"
____________________________________

In Clip-mode:
Screen name:		xml name:

Main-window:
	Level:   		dest="gaindb"       
	Pitch:		dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:		dest="envattack" 
	Decay:		dest="envdecay"  
	Release:		dest="envrel"    
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:	dest="lfoamount"
____________________________________

In Slice-mode:
Screen name:		xml name:

Main-window:
	Level:   		dest="gaindb"       
	Pitch:		dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:		dest="envattack" 
	Decay:		dest="envdecay"  
	Release:		dest="envrel"    
Pos-window:		
	Slice:		dest="actslice"
	Slice Seq:	dest="slicestepmode"  
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:	dest="lfoamount"


____________________________________

In Granular-mode:
Screen name:		xml name:

Main-window:
	Level:   		dest="gaindb"       
	Pitch:		dest="pitch"        
	Filter: 		dest="dualfilcutoff"
	Res:     		dest="res"             
	Pan:     		dest="panpos"
Env-window:
	Attack:		dest="envattack" 
	Decay:		dest="envdecay"  
	Release:		dest="envrel"    
Pos-window:
	Start:		dest="samstart" 	
	Length:		dest="samlen"   
	Loop Start:	dest="loopstart"
	Loop End:		dest="loopend"  
LFO-window:
	LFO Rate:		dest="lforate"  
	LFO Depth:	dest="lfoamount"
Gran-window:
	Speed:		dest="grainreadspeed"
