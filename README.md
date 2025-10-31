TO-DO:

01-Export selected:      
-Multi selection: It will now export all pads in the selection to the same json file. This is not what I want; I want that all pads are saved in a separate json. This will make it more easy to import one pad later on, when import pad will be integrated. 

-When "multi-samples" are used they should also be referenced in the output json-file.

-When we implement sample editing, the actual samples used in the pad should also be stored. I think by putting all relevant files in a zip-file. Then implementing zip-file import. (maybe change the .zip extension to .pad to make clear that this is a pad-file.)

-When no samples in pad, it does not save it's settings and says: "Selected pads are empty", but it should save settings even without a sample inside, as some people like to use pads with only settings, for them to use as templates. For this same reason I think that all pads should always be filled with a template Empty-preset, loaded as an imported file (as in an include file), so people can make their own template files, so all their personal preferences are always in the pads. All pads should just be named "empty", so that they are recognized as an empty pad for when user want to Merge a preset (see 02 below), or maybe other functions that need to know if the pad is empty. (if better more advanced options will do the same, that's okay as well.
		
02-**New feature** Merge presets: When user has an preset open, and clicks merge preset; the following should happen: See what and how many Pads are unused. See how many pads are inside the file just selected to be merged with the one already in memory. If in-memory-pads + to-be-merged-pads > 16pads then ask the user, what pads should be imported from to-be-merged-preset; and checked on a checklist in a message window.


03-Edit modal with all parameters, as not yet all parameters are implemented in the modal edit window. To accomplish this in a nice way, we need to add Tabs to our modal window; tabs should be called: Main, Env, Lfo, Pos, Gran, Config

04-Next to a slider, the parameter values should also be input by test, keyboard input. For fast and accurate exact values.

**If you make any code changes, please __only__ send the JavaScript-function or part of the code that was changed. __Do not__ send the whole code, as that is way too expensive (token wise).**



