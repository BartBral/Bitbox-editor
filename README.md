[>>>>> EDITOR HERE <<<<<](https://bartbral.github.io/Bitbox-editor/)


---

# BITBOXER - User Guide

**Preset editor for 1010music Bitbox Micro and mk2**

---

## 🚀 Getting Started

### 1. Set Your Working Folder (IMPORTANT!)

Overall; in the top-right corner is a switch to set type of Bitbox you have.
The greyed out pads are **only** visual, as a reminder "these pads or parameters are not available to you on your Bitbox". But all of these pads and parameters that are greyed out are still 100% editable and usable. Also the saved files are always the same and it doesn't matter if you have chosen the Mk2 or Micro option.

Also when editing parameters, all greyed out settings are still completely usable, as some users might find it usefull to have certain parameters set, so they can change between two options in a live situation. (for example: set up a manual LFO speed on a certain rate, then switching to synced LFO-speed on the Bitbox, both speeds can already be set to known states)


**Before importing any files:**

Be aware that this app will **never** be able to destroy your current preset.xml as it does not edit that file itself, but a copy that will get exported in a `zip`, including the samples used, in folderstructure needed. So you can copy/paste it to your SD-card in the presets folder, and unzip it there. All will be good.

1. Click the big red **"⚠️ Set Working Folder!"** monstrosity at the top
2. Select the folder where you keep your samples
3. Button turns less obnoxious

**Why?** BITBOXER automatically searches this folder for samples when importing SFZ files or presets. Because it is a web-app, it does not have full access to all of your precious files, thank god! I would recommend to just select a subfolder in your sample folder, or something broad like that, and then be sure that all the samples and sfz files and preset.xml files etc are located there. When you choose not to set a folder (or you have a browser that won't alowe you to) then it is best to always use the zip-files this app creates. Or just zip preset-folders + sample folders. As when all is in a zipfile it can be drag and dropped from any folder, as all sample-assets are inside that zip. By the way: no presets, samples, sfz-file (any files) will ever leave your computer, nothing goes online. So don't worry, all is done on your computer, you can even use it offline if you would like to.

---

## 📂 Importing Files

### Loading Presets

**Method 1: Drag & Drop**
- Drag `.xml` or `.zip` preset file anywhere on the page
- Choose "Replace All Pads" or "Merge Into Project"
   - "Replace All Pads" will get you the exact same pads configuration as you had on your Bitbox (often a good startingpoint).
   - "Merge Into Project" will import another preset.xml onto the still avaiable pads, and will ask you to what pads you would like to import.

**Method 2: Load Button**
- Click **"Load Preset"**
- Select `.xml` or `.zip` file
- If samples are missing, BITBOXER searches your working folder automatically (if set).

**Method 3: Load Folder**
⚠️ Experimental!
- Click **"Load Folder"** (Chrome/Edge only)
- Select folder containing preset + samples
- Everything **should** import automatically

---

### Importing to Specific Pads

**Single Sample (WAV)**
1. Select a pad (click it)
2. Click **[ Import Pad ]**
3. Choose `.wav` file
4. Sample loads with metadata (loop points, slices, tempo)
5. Or just drag and drop a `.wav` file from your harddrive to a pad.

**SFZ Multisample**
1. Select a pad
2. Click **[ Import Pad ]**
3. Choose `.sfz` file
4. BITBOXER analyzes the SFZ:
   - **Single layer** → Loads directly to pad
   - **Multiple layers** → Shows layer mapping modal
5. Or just drag and drop a `.sfz` file from your harddrive to a pad.

**Zipped (SFZ + Samples)**
1. Select a pad
2. Click **[ Import Pad ]**
3. Choose `.zip` file containing SFZ + WAV files
4. Everything imports automatically
5. Or just drag and drop a `.zip` file from your harddrive to a pad.

**Zipped (JSON + Samples)**
You can save just one pad with this app, for later reuse.
Here is how to again import one of those:
1. Select a pad
2. Click **[ Import Pad ]**
3. Choose `.zip` file containing JSON + WAV files
4. Or just drag and drop a `.zip` file from your harddrive to a pad.

## ⚠️ Experimental ⚠️ SFZ Layer Detection

BITBOXER **tries to** analyzes SFZ files, but is not yet very able:

### Single Layer (Key-Mapped Multisample)
- Regions have **non-overlapping key ranges**
- Example: C2-E2, F2-A2, A#2-D3, etc.
- **Result:** Loads to 1 pad as multisample

### ⚠️ Multiple Layers (Stacked)
- If regions have **overlapping key ranges**
- Example: Two groups both covering C2-C5
- **Result:** Shows modal to map each layer to different pads

### ⚠️ Velocity Layers
- Multiple regions with **same key range** but different velocity ranges
- Example: C2-C5 with lovel/hivel splits
- **Result:** Loads to 1 pad as velocity-switched multisample
- **Limit:** Maximum 16 velocity zones per pad
- **Auto-Merge:** If >16 zones, BITBOXER merges them evenly (shows ⚠️ warning)
- ⚠️ At the moment I have not yet tested this out very well.
---

## 🎛️ Layer Mapping Modal

When importing SFZ with multiple layers:

**Layer List:**
- Shows each layer with key range (e.g., "Layer 1: C2-C5")
- Shows velocity zone count
- ⚠️ icon if >16 zones (will be auto-merged)

**Pad Selection:**
- Choose destination pad for each layer (dropdown)
- Empty pads auto-selected
- Skip unwanted layers (select "-- Skip This Layer --")

**Shared MIDI Channel:**
- Set one MIDI channel for ALL layers
- They trigger together when playing via MIDI
- Default: Ch 1 (omni)

---

## 🎚️ Editing Pads

When editing parameters, all greyed out settings are still completely usable, as some users might find it usefull to have certain parameters set, so they can change between two options in a live situation. (for example: set up a manual LFO speed on a certain rate, then switching to synced LFO-speed on the Bitbox, both speeds can already be set to known states)

### Opening Pad Editor
- **Double-click** any pad
- Or **Right-click** → "Edit Pad"

### Tabs Explained

**Main** - Core sound parameters
- Level, Pitch, Pan, Filter, Reverb/Delay sends

**Env** - ADSR Envelope
- Attack, Decay, Sustain, Release
- Visual envelope display

**LFO** - Low Frequency Oscillator
- Wave shape, Rate, Depth
- Beat sync options

**Pos** - Position & Loop
- Sample start/length/loop points
- Clip mode settings (quantize, sync)
- Slicer mode settings

**Gran** - Granular Synthesis
- Grain size, scatter, density
- Only for Granular mode

**Multi** - Multisample Layers 
- View all velocity/key layers (editable)
- Shows root notes and ranges (editable)

**Config** - Advanced Settings
- Launch mode, polyphony, MIDI channel
- Output routing, interpolation quality

**Mod** - Modulation Matrix
- Up to 12 modulation slots per pad
- Sources: Velocity, LFO, MIDI CC, etc.
- Destinations: Filter, Pitch, Level, etc.

---

## 🎨 Global FX & EQ

Click **"FX & EQ Settings"** to edit global effects:

**Delay**
- Time (ms or synced), Feedback, Ping-pong
- Optional filter with cutoff/resonance

**Reverb**
- Decay, Pre-delay, Damping

**EQ** (mk2 only, greyed out on Micro)
- 4-band parametric EQ
- Each band: Type, Gain, Frequency, Q

**FX Modulation**
- Up to 9 modulation slots per FX
- Modulate delay time, reverb decay, etc.

---

## 📋 Pad Operations

### Copy/Paste
1. Select pad(s) - Ctrl+Click for multi-select
2. Click **"Copy"**
3. Select destination pad(s)
4. Click **"Paste"**

### Export Pads
1. Select pad(s)
2. Click **"Export Selected"**
3. Each pad saves as individual ZIP with:
   - Pad settings (JSON)
   - All WAV files
   - Ready to import elsewhere

### Drag & Drop Pads
- **Drag pad** onto another pad to **swap** them
- Asset cells (multisamples) update automatically

### Rename Pads
- **Right-click** pad → "Rename Pad"
- For multisamples: Renames folder
- For samples: Renames WAV file (in cache)

---

## 💾 Saving Projects

Click **"Save Preset"** to export:

**ZIP Structure:**
```
ProjectName/
├── preset.xml          (Bitbox preset file)
├── sample1.wav         (single samples at root)
├── sample2.wav
├── Multisample1/       (multisample folders)
│   ├── layer_01.wav
│   ├── layer_02.wav
│   └── README.txt      (lists expected files)
└── Multisample2/
    └── ...
```

**Missing Samples:** If BITBOXER can't find a sample, it creates:
- `filename.wav.missing.txt` placeholder
- `README.txt` with list of missing files

---

## ⚙️ Device Modes

**Bitbox Micro** (8 pads)
- Toggle: Click "Bitbox Micro" button
- Pads 9-16 greyed out
- EQ tab greyed out
  
**Bitbox mk2** (16 pads)
- Toggle: Click "Bitbox mk2" button
- All 16 pads active
- Full 4-band EQ available

---

## 💡 Tips & Tricks

### Workflow Best Practices
1. **Always set working folder first**
2. **Name your project** (click title to rename)
3. **Save often** - exports are non-destructive
4. **Use ZIP for portability** - includes all samples

### Keyboard Shortcuts
- **Click** on a pad - Selects a pad
- **Ctrl+Click** - Let's you select more then one pad at the time
- **Double-click** - Edit the pad. A window will open with parameters.
- **Right-click** - Context menu appears with some options.
- **Drag** - Swap pads

### Working with Multisamples
- **Velocity layers:** Up to 16 zones per pad
- **Key-mapped zones:** No limit (uses asset cells)
- **Mixed:** Can have both velocity AND key layers

### MIDI Channel Strategy
- **None** - Pad triggers only from Bitbox pads
- **Ch 1 (omni)** - Responds to all MIDI channels
- **Ch 2-16** - Responds to specific channel only
- **Stacked layers** - Are Set to the same channel so they trigger together

---

## 🐛 Troubleshooting

**"Samples not found" when loading preset**
- ✅ Set working folder first
- ✅ Ensure samples are in the working folder or subfolders thereof
- ✅ Check sample names match exactly (case-sensitive)

**SFZ import creates too many pads**
- ✅ Key ranges SHOULD **NOT** overlap for single-pad import
- ✅ Use modal to map layers to fewer pads

**EQ tab is greyed out**
- ✅ Switch to "Bitbox mk2" mode (EQ unavailable on Micro)

**Can't find my samples after import**
- ✅ Samples are cached in browser memory
- ✅ Save preset as ZIP to export everything together
- ✅ Reload page? Re-import or load from ZIP

**Pad shows "Empty" but has settings**
- ✅ This is a template pad (no sample loaded yet)
- ✅ Import a sample to activate it

---

## 📚 File Format Support

| Format | Import | Export | Notes |
|--------|--------|--------|-------|
| XML | ✅ | ✅ | Bitbox preset format |
| ZIP | ✅ | ✅ | Preset + samples bundled |
| WAV | ✅ | ✅ | Reads loop points, slices, tempo |
| SFZ | ✅ | ✅ | Layer detection |
| JSON | ✅ | ✅ | Individual pad export |

---

## 🎯 Common Workflows

### Workflow 1: Build Preset from Scratch
1. Click **"New Preset"**
2. Set working folder
3. Import samples to pads (drag or button)
4. Edit parameters, add modulation
5. Set up global FX
6. Save as ZIP

### Workflow 2: Import Existing SFZ Library
1. Set working folder (parent of SFZ files)
2. Select empty pad
3. Import SFZ file
4. If multiple layers, map to pads in modal
5. Set shared MIDI channel
6. Repeat for other instruments
7. Save project

### Workflow 3: Edit & Merge Presets
1. Load preset A (Replace All)
2. Load preset B (Merge Into Project)
3. Map incoming pads to empty slots
4. Edit and rearrange pads
5. Save combined preset

### Workflow 4: Layer Splitting
1. Import multi-layer SFZ
2. In modal, select different pads for each layer
3. Set shared MIDI channel (e.g., Ch 2)
4. Now all layers trigger together from MIDI Ch 2
5. Adjust individual layer volumes/FX in pad editor

---

## 🔗 Resources

- **Bitbox Manual:** [1010music.com](https://1010music.com)
- **SFZ Format:** [sfzformat.com](https://sfzformat.com)
- **Report Issues:** Check browser console (F12)

---

## ⚡ System Requirements

- **Browser:** Chrome, Edge, Opera or Firefox (latest)
- **Features:**
  - Folder import: Chrome/Edge/Opera only (chromium based)
  - Working folder: Chrome/Edge/Opera recommended
  - File drag & drop: All browsers, use zip if available for best UX.
- **Storage:** Uses browser memory (no server uploads)

---

**Made with ❤️ for the Bitbox community**

*Version: x.x? | Last updated: 2026*
