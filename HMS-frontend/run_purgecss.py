import os
import subprocess
import glob

css_files = glob.glob('src/**/*.css', recursive=True)

for css in css_files:
    # Run purgecss on a single file, outputting to a temp file
    cmd = [
        "npx", "purgecss",
        "--css", css,
        "--content", "src/**/*.jsx",
    ]
    try:
        print(f"Purging {css}...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        # purgecss outputs JSON by default if no output is specified: [{"file": "...", "css": "..."}]
        import json
        output = json.loads(result.stdout)
        if output and len(output) > 0:
            purged_css = output[0]['css']
            with open(css, 'w') as f:
                f.write(purged_css)
    except Exception as e:
        print(f"Error purging {css}: {e}")

