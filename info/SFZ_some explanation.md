An .SFZ file is a plain-text, human-readable format that acts as an instruction manual for a sampler engine. It defines regions (<region>), which are rules mapping specific input conditions (MIDI notes and velocity) to an audio sample.

The sampler's job is to read these rules and, in real-time, determine which specific audio file to play based on the user's performance input.

**Here is how the core parameters function:**

# The Core Mechanism: Region Selection
A sampler processes incoming MIDI events using an algorithm that checks each defined region's criteria. For every single MIDI note played:
1. **Input Data:** The sampler receives two key pieces of data:
    • Note_Number (e.g., 60 for Middle C).
    • Velocity (a value from 1 to 127).
2. **Matching:** It iterates through the defined regions and plays the first region (or sometimes the best match, depending on the engine's implementation) where both the Note_Number and Velocity fall within the specified boundaries.

# Key Parameters Explained
The following parameters define the boundaries for when a specific sample should be triggered:

## 1. `lokey` and `hikey` (Key Range/Note Boundaries)
These parameters define the horizontal range (the keyboard span) where a specific sample is eligible to play.
    • lokey = Lowest MIDI note number that triggers this region.
    • hikey = Highest MIDI note number that triggers this region.

**Computational Logic:**
```python
if user_note_number >= lokey and user_note_number <= hikey:
    # This sample is eligible to play for this note
    pass
else:
    # This sample is ignored for this note
    pass
```

## 2. `lovel` and `hivel` (Velocity Layers/Dynamics Boundaries)
These parameters define the vertical range (the dynamics/how hard the key is hit) where a specific sample is eligible to play. This is how velocity layers are implemented.
    • lovel = Lowest MIDI velocity (1–127) that triggers this region.
    • hivel = Highest MIDI velocity (1–127) that triggers this region.

**Computational Logic: (Combined with Key Range):**
```python
if (user_note_number >= lokey and user_note_number <= hikey) and \
   (user_velocity >= lovel and user_velocity <= hivel):
    # This is the correct sample to use for this specific performance input
    trigger_sample()
```

# 3. pitch_keycenter (The "Home Base" Pitch)
This is perhaps the most crucial parameter for multi-sampling accuracy. It tells the sampler which actual pitch was recorded in the audio file.
When you play a MIDI note, the sampler engine automatically pitch-shifts the sample to match the played note.
    • If you hit a C4 key, but the pitch_keycenter of the assigned sample is G3, the engine automatically speeds up the sample playback slightly so it sounds like a C4.

**Computational Logic:**
The sample is loaded, its playback rate is dynamically adjusted (playback_rate_multiplier) based on the difference between the incoming user_note_number and the recorded pitch_keycenter.

```python
# The sampler adjusts the pitch based on this delta:
pitch_shift_semitones = user_note_number - pitch_keycenter 
adjust_sample_playback_speed(pitch_shift_semitones)
```


# lokey, hikey
The SFZ opcodes `lokey` and `hikey` define the lower and upper boundaries of a region’s playable key range. In essence, they determine which MIDI notes will trigger that region.

**Detailed explanation:**
- `lokey` sets the lowest MIDI note number (or note name) that can activate the region.  
- `hikey` sets the highest MIDI note number (or note name) that can activate the region.  
- Together, they establish a key range for that region.

When both are defined, any MIDI note value between `lokey` and `hikey`, inclusive, will trigger playback of the region’s sample.

If a region represents only one note, the simpler `key` opcode is preferred.  
In that case, `lokey`, `hikey`, and `pitch_keycenter` are all implicitly the same value.

For proper pitch mapping, `pitch_keycenter` specifies which key the sample was originally recorded or tuned at, ensuring correct transposition within the `lokey`–`hikey` range.

Both `lokey` and `hikey` accept:
- MIDI note numbers (0–127) — recommended for consistency.
- Note names (e.g., `c3`, `D#4`).

In **SFZ 2**, both opcodes can also be set to `-1` to deactivate key triggering entirely; the region can then be triggered via MIDI control change (CC) opcodes like `on_loccN` and `onhiccN`. This is often used for non-keyboard sounds such as pedal or mechanical noises.

**Practical example:**
```sfz
<region> sample=a4.wav  lokey=68 hikey=70 pitch_keycenter=69
<region> sample=c5.wav  lokey=71 hikey=73 pitch_keycenter=72
<region> sample=eb5.wav lokey=74 hikey=76 pitch_keycenter=75
```
Each region here covers a small range (typically a minor third), allowing smooth transitions between samples recorded at different pitches.

**in a bitbox preset.xml __Multisample__ this would translate to:
<cell row="0" filename=".\folder\a4.wav" type="asset">
<params rootnote="69" keyrangebottom="68" keyrangetop="70" velrangebottom="0" velrangetop="127" asssrcrow="0" asssrccol="0"/>
</cell>
<cell row="1" filename=".\folder\c5.wav" type="asset">
<params rootnote="72" keyrangebottom="71" keyrangetop="73" velrangebottom="0" velrangetop="127" asssrcrow="0" asssrccol="0"/>
</cell>
<cell row="2" filename=".\folder\eb5.wav" type="asset">
<params rootnote="75" keyrangebottom="74" keyrangetop="76" velrangebottom="0" velrangetop="127" asssrcrow="0" asssrccol="0"/>
</cell>

