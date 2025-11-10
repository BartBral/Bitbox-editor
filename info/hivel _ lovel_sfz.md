# lovel / hivel

The SFZ opcodes `lovel` and `hivel` translate to Bitbox Multisample assets `velrangebottom` and `velrangetop`.

If a note with velocity value equal to or higher than lovel AND equal to or lower than hivel is played, the region will play.
This is obviously useful for instruments with dynamic layers controlled by velocity. Though dynamic layers can also be controlled by CC, especially for sustained instruments, lovel and hivel are the standard way of controlling dynamics for instruments such as drums and pianos. It is also possible to use lovel / hivel to control other things instead, such as articulations - for example, a guitar could have palm-muted samples on low velocities, and pinch harmonics on velocity 127.
These opcodes will often need to be used with [amp_velcurve_N](https://sfzformat.com/opcodes/amp_velcurve_N/), unless [amp_veltrack](https://sfzformat.com/opcodes/amp_veltrack/) is set to 0. The reason for this is that with default velocity tracking behavior and non-normalized samples (and there are many reasons why normalizing samples should be avoided), the quiet velocity layers will be too quiet.
Velocity 0 is a note-off message, so 1 is the lowest usable value with hivel/lovel.
Example
lovel=64 hivel=95

An instrument with four velocity-controlled dynamic layers might use lovel and hivel like this:
<region>hivel=31 amp_velcurve_31=1 sample=kick_vl1.wav
<region>lovel=32 hivel=63 amp_velcurve_63=1 sample=kick_vl2.wav
<region>lovel=64 hivel=95 amp_velcurve_95=1 sample=kick_vl3.wav
<region>lovel=96 sample=kick_vl4.wav

The way this would work is the kick_vl1.wav region will play at velocities up to 31, with volume going gradually from 0 at velocity 0 (so, no sound) to full volume at velocity 31. The kick_vl2.wav region will play at velocties 32 to 63, with volume being full at velocity 63 and lower volume (but not zero) at 32. The kick_vl3 wav region will play at velocites 64 to 95, with full volume at velocity 95. Finally, the kick_vl4 layer plays at velocities 96 to 127, with no [amp_velcurve_N](https://sfzformat.com/opcodes/amp_velcurve_N/) set meaning it will have full volume at velocity 127.

The SFZ opcodes `lovel` and `hivel` define the lower and upper velocity boundaries of a region, determining when that region is triggered based on how hard the note is played (MIDI velocity). They are essential for building velocity-based dynamics, especially in realistic instrument sample sets.

***

**Detailed explanation:**

- `lovel` sets the lowest MIDI velocity that can trigger the region.
- `hivel` sets the highest MIDI velocity that can trigger the region.
- If the played note’s velocity value is between `lovel` and `hivel` (inclusive), that region plays.

Velocity values range from 1 to 127, since 0 means “note off” in MIDI.
These opcodes are most commonly used to simulate dynamic response in acoustic instruments like drums, pianos, and guitars—where a harder hit triggers a louder or differently articulated sample.

For example, softer velocities might trigger muted or gentle sounds, while higher velocities trigger brighter or more forceful samples.

Both parameters enable “velocity layering”: mapping multiple samples across different dynamic ranges to produce a natural response to performance dynamics.

***

**Practical example:**

```
<region> hivel=31  amp_velcurve_31=1  sample=kick_vl1.wav
<region> lovel=32 hivel=63 amp_velcurve_63=1 sample=kick_vl2.wav
<region> lovel=64 hivel=95 amp_velcurve_95=1 sample=kick_vl3.wav
<region> lovel=96 sample=kick_vl4.wav
```

Here’s how it works:

- `kick_vl1.wav` plays for velocities 1–31 (very soft hits).
- `kick_vl2.wav` covers 32–63 (soft to medium).
- `kick_vl3.wav` covers 64–95 (medium-hard).
- `kick_vl4.wav` activates from 96–127 (very hard).

Each layer can use `amp_velcurve_N` to modify the velocity curve for smoother transitions between layers, unless `amp_veltrack=0` disables velocity sensitivity entirely.

This combination of `lovel` and `hivel` with velocity tracking produces expressive, nuanced performance responses across different instruments and articulations.

# The SFZ opcodes `lovel` and `hivel` translate to Bitbox Multisample assets `velrangebottom` and `velrangetop`.
The 1010music Bitbox Mk2 and Bitbox Micro both support multi-samples with velocity layers. 
**The features include:**
• Up to 16 velocity layers per sample pad in multi-sample mode.

• **Metadata Reading:** The Bitbox reads embedded metadata (WAV tags) within the audio files to determine the root note and velocity range for each layer, allowing it to correctly map the samples across the keyboard and velocity range. 

This functionality allows you to create expressive, velocity-sensitive instruments within the module.