#!/usr/bin/env python3
import urllib.request
import os
import subprocess

icons_dir = "static/projects/images/skill-icons"
os.makedirs(icons_dir, exist_ok=True)

logos = {
    "html": "html5/html5-original.svg",
    "css": "css3/css3-original.svg",
    "javascript": "javascript/javascript-original.svg",
    "typescript": "typescript/typescript-original.svg",
    "react": "react/react-original.svg",
    "nextjs": "nextjs/nextjs-original.svg",
    "tailwind": "tailwindcss/tailwindcss-original.svg",
    "vite": "vitejs/vitejs-original.svg",
    "webpack": "webpack/webpack-original.svg",
    "nodejs": "nodejs/nodejs-original.svg",
    "firebase": "firebase/firebase-original.svg",
    "supabase": "supabase/supabase-original.svg",
    "figma": "figma/figma-original.svg",
    "stripe": "stripe/stripe-original.svg",
}

base = "https://raw.githubusercontent.com/devicons/devicon/master/icons/"

print("Downloading and converting logos...")
for name, path in logos.items():
    url = base + path
    svg_file = f"/tmp/{name}.svg"
    png_file = f"{icons_dir}/{name}.png"
    
    try:
        print(f"  {name}...", end=" ", flush=True)
        urllib.request.urlretrieve(url, svg_file)
        subprocess.run(
            ["rsvg-convert", "-w", "512", "-h", "512", svg_file, "-o", png_file],
            capture_output=True,
            check=True
        )
        os.remove(svg_file)
        print("✓")
    except Exception as e:
        print(f"✗ ({str(e)[:40]})")

print("\n⚠️  Still need manual downloads:")
print("  curl -o static/projects/images/skill-icons/react-native.png https://reactnative.dev/img/tiny_logo.png")
print("  curl -o static/projects/images/skill-icons/cursor.png https://www.cursor.sh/favicon.ico")
print("  curl -o static/projects/images/skill-icons/claude.png https://www.anthropic.com/images/claude.png")
print("  curl -o static/projects/images/skill-icons/imdb.png https://www.imdb.com/favicon.ico")
