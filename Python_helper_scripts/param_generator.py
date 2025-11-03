#!/usr/bin/env python3
"""
Bitbox Parameter Generator
Generates HTML and JavaScript code snippets for adding new parameters to the Bitbox editor
"""

import json
from typing import List, Dict, Any

class ParameterGenerator:
    def __init__(self):
        self.param_types = {
            'slider': ['gaindb', 'pitch', 'panpos', 'dualfilcutoff', 'res', 'envattack', 'envdecay', 
                      'envsus', 'envrel', 'lforate', 'lfoamount', 'samstart', 'samlen', 'loopstart', 
                      'loopend', 'loopfadeamt', 'actslice', 'grainsizeperc', 'grainscat', 'grainpanrnd', 
                      'graindensity', 'grainreadspeed', 'gainssrcwin', 'rootnote', 'fx1send', 'fx2send'],
            'dropdown': ['cellmode', 'loopmodes', 'loopmode', 'samtrigtype', 'polymode', 'lfowave', 
                        'lfokeytrig', 'lfobeatsync', 'lforatebeatsync', 'midimode', 'reverse', 
                        'outputbus', 'chokegrp', 'slicestepmode']
        }
    
    def generate_slider_html(self, param_name: str, label: str, min_val: int, max_val: int, 
                            default_val: int) -> str:
        """Generate HTML for a slider parameter"""
        return f'''<div class="param">
    <label class="param-label">{label}</label>
    <div class="param-control">
        <input type="range" class="slider" id="{param_name}" min="{min_val}" max="{max_val}" value="{default_val}">
        <span class="param-value" id="{param_name}-val">0.0%</span>
    </div>
</div>'''
    
    def generate_dropdown_html(self, param_name: str, label: str, options: List[Dict[str, str]]) -> str:
        """Generate HTML for a dropdown parameter"""
        options_html = '\n'.join([
            f'                <option value="{opt["value"]}">{opt["label"]}</option>'
            for opt in options
        ])
        return f'''<div class="param">
    <label class="param-label">{label}</label>
    <select class="select" id="{param_name}">
{options_html}
    </select>
</div>'''
    
    def generate_display_formatter(self, param_name: str, format_type: str, **kwargs) -> str:
        """Generate JavaScript display formatter code"""
        formatters = {
            'percentage': f'''case '{param_name}':
    text = (val / 10).toFixed(1) + '%';
    break;''',
            'db': f'''case '{param_name}':
    text = (val >= 0 ? '+' : '') + (val / 1000).toFixed(1) + ' dB';
    break;''',
            'semitones': f'''case '{param_name}':
    text = (val >= 0 ? '+' : '') + (val / 1000).toFixed(2) + ' st';
    break;''',
            'ms': f'''case '{param_name}':
    text = (val / {kwargs.get("divisor", 1)}).toFixed(1) + ' ms';
    break;''',
            'hz': f'''case '{param_name}':
    const hz_{param_name} = {kwargs.get("min_hz", 0.1)} + ((val / 1000) * ({kwargs.get("max_hz", 20)} - {kwargs.get("min_hz", 0.1)}));
    text = hz_{param_name}.toFixed(2) + ' Hz';
    break;''',
            'custom': kwargs.get('custom_code', '// Add custom formatting here')
        }
        return formatters.get(format_type, formatters['percentage'])
    
    def generate_parser(self, param_name: str, format_type: str, **kwargs) -> str:
        """Generate JavaScript parser code for display value input"""
        parsers = {
            'percentage': f"return Math.round(val * 10);",
            'db': f"return Math.round(val * 1000);",
            'semitones': f"return Math.round(val * 1000);",
            'ms': f"return Math.round(val * {kwargs.get('divisor', 1)});",
            'hz': f"""const hz = parseFloat(text);
if (isNaN(hz) || hz < {kwargs.get('min_hz', 0.1)} || hz > {kwargs.get('max_hz', 20)}) return null;
return Math.round(((hz - {kwargs.get('min_hz', 0.1)}) / ({kwargs.get('max_hz', 20)} - {kwargs.get('min_hz', 0.1)})) * 1000);""",
            'custom': kwargs.get('custom_code', 'return Math.round(val);')
        }
        return parsers.get(format_type, parsers['percentage'])
    
    def add_to_lists(self, param_name: str, param_type: str) -> Dict[str, List[str]]:
        """Generate updated parameter lists for JavaScript"""
        if param_type == 'slider':
            self.param_types['slider'].append(param_name)
        else:
            self.param_types['dropdown'].append(param_name)
        
        return {
            'setupParameterListeners_sliders': self.param_types['slider'],
            'setupParameterListeners_dropdowns': self.param_types['dropdown'],
            'loadParamsToModal_sliders': self.param_types['slider'],
            'loadParamsToModal_dropdowns': self.param_types['dropdown']
        }
    
    def generate_default_param(self, param_name: str, default_value: str) -> str:
        """Generate default parameter for createEmptyPadData"""
        return f"{param_name}: '{default_value}'"
    
    def generate_full_parameter(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Generate all code snippets for a new parameter"""
        param_name = config['name']
        param_type = config['type']
        
        result = {
            'param_name': param_name,
            'default_param': self.generate_default_param(param_name, config.get('default', '0')),
        }
        
        if param_type == 'slider':
            result['html'] = self.generate_slider_html(
                param_name,
                config['label'],
                config['min'],
                config['max'],
                config.get('default', 0)
            )
            result['display_formatter'] = self.generate_display_formatter(
                param_name,
                config.get('format', 'percentage'),
                **config.get('format_options', {})
            )
            result['parser'] = self.generate_parser(
                param_name,
                config.get('format', 'percentage'),
                **config.get('format_options', {})
            )
        else:  # dropdown
            result['html'] = self.generate_dropdown_html(
                param_name,
                config['label'],
                config['options']
            )
        
        result['updated_lists'] = self.add_to_lists(param_name, param_type)
        
        return result


def main():
    """Example usage"""
    gen = ParameterGenerator()
    
    # Example 1: Adding a slider parameter (e.g., Distortion)
    distortion_config = {
        'name': 'distortion',
        'type': 'slider',
        'label': 'Distortion',
        'min': 0,
        'max': 1000,
        'default': 0,
        'format': 'percentage'
    }
    
    # Example 2: Adding a dropdown parameter (e.g., Filter Type)
    filter_type_config = {
        'name': 'filtertype',
        'type': 'dropdown',
        'label': 'Filter Type',
        'default': '0',
        'options': [
            {'value': '0', 'label': 'Low Pass'},
            {'value': '1', 'label': 'High Pass'},
            {'value': '2', 'label': 'Band Pass'},
            {'value': '3', 'label': 'Notch'}
        ]
    }
    
    # Example 3: Advanced slider with Hz formatting
    cutoff_config = {
        'name': 'filtercutoff',
        'type': 'slider',
        'label': 'Filter Cutoff',
        'min': 0,
        'max': 1000,
        'default': 500,
        'format': 'hz',
        'format_options': {
            'min_hz': 20,
            'max_hz': 20000
        }
    }
    
    print("=" * 70)
    print("BITBOX PARAMETER GENERATOR")
    print("=" * 70)
    
    # Generate code for distortion parameter
    print("\n\n### EXAMPLE 1: DISTORTION SLIDER ###\n")
    distortion_code = gen.generate_full_parameter(distortion_config)
    
    print("1. Add to HTML (in appropriate tab):")
    print(distortion_code['html'])
    
    print("\n2. Add to createEmptyPadData() params object:")
    print(distortion_code['default_param'] + ",")
    
    print("\n3. Add to updateParamDisplay() switch statement:")
    print(distortion_code['display_formatter'])
    
    print("\n4. Add to parseDisplayValue() switch statement:")
    print(f"case 'distortion':")
    print(f"    {distortion_code['parser']}")
    
    print("\n5. Add 'distortion' to these arrays:")
    print("   - setupParameterListeners: params array (line ~580)")
    print("   - loadParamsToModal: slider array (line ~830)")
    
    # Generate code for filter type parameter
    print("\n\n### EXAMPLE 2: FILTER TYPE DROPDOWN ###\n")
    filter_code = gen.generate_full_parameter(filter_type_config)
    
    print("1. Add to HTML (in appropriate tab):")
    print(filter_code['html'])
    
    print("\n2. Add to createEmptyPadData() params object:")
    print(filter_code['default_param'] + ",")
    
    print("\n3. Add 'filtertype' to these arrays:")
    print("   - setupParameterListeners: dropdown array (line ~650)")
    print("   - loadParamsToModal: dropdown array (line ~850)")
    
    print("\n\n" + "=" * 70)
    print("CURRENT PARAMETER LISTS (copy these to update your code)")
    print("=" * 70)
    print("\nSlider parameters:")
    print(json.dumps(distortion_code['updated_lists']['setupParameterListeners_sliders'], indent=2))
    print("\nDropdown parameters:")
    print(json.dumps(distortion_code['updated_lists']['setupParameterListeners_dropdowns'], indent=2))
    
    print("\n\n" + "=" * 70)
    print("CHECKLIST FOR ADDING A NEW PARAMETER")
    print("=" * 70)
    print("""
    For SLIDER parameters:
    [ ] 1. Add HTML to appropriate modal tab
    [ ] 2. Add default value to createEmptyPadData()
    [ ] 3. Add to params array in setupParameterListeners()
    [ ] 4. Add to slider array in loadParamsToModal()
    [ ] 5. Add case to updateParamDisplay() switch
    [ ] 6. Add case to parseDisplayValue() switch
    [ ] 7. Test: load preset, edit value, save preset
    
    For DROPDOWN parameters:
    [ ] 1. Add HTML to appropriate modal tab
    [ ] 2. Add default value to createEmptyPadData()
    [ ] 3. Add to dropdown array in setupParameterListeners()
    [ ] 4. Add to dropdown array in loadParamsToModal()
    [ ] 5. Add any conditional logic (like updateTabVisibility)
    [ ] 6. Test: load preset, change option, save preset
    """)


if __name__ == '__main__':
    main()
