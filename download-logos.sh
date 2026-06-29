#!/bin/bash

ICONS_DIR="static/projects/images/skill-icons"
mkdir -p "$ICONS_DIR"

convert_svg_to_png() {
    local svg_url=$1
    local output_file=$2
    local temp_svg="/tmp/$output_file.svg"
    
    curl -s "$svg_url" -o "$temp_svg" 2>/dev/null
    if [ -f "$temp_svg" ]; then
        convert "$temp_svg" -background none -resize 512x512 "$output_file"
        rm "$temp_svg"
        echo "✓ $output_file"
    else
        echo "✗ Failed: $output_file (network or URL issue)"
    fi
}

echo "Downloading logos from Devicon (GitHub)..."

convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/html5/html5-original.svg" "$ICONS_DIR/html.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/css3/css3-original.svg" "$ICONS_DIR/css.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/javascript/javascript-original.svg" "$ICONS_DIR/javascript.png"
convert_svg_to_png "https://githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" "$ICONS_DIR/typescript.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg" "$ICONS_DIR/react.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/nextjs/nextjs-original.svg" "$ICONS_DIR/nextjs.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/tailwindcss/tailwindcss-original.svg" "$ICONS_DIR/tailwind.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/vitejs/vitejs-original.svg" "$ICONS_DIR/vite.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/webpack/webpack-original.svg" "$ICONS_DIR/webpack.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/nodejs/nodejs-original.svg" "$ICONS_DIR/nodejs.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/firebase/firebase-original.svg" "$ICONS_DIR/firebase.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/supabase/supabase-original.svg" "$ICONS_DIR/supabase.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/figma/figma-original.svg" "$ICONS_DIR/figma.png"
convert_svg_to_png "https://raw.githubusercontent.com/devicons/devicon/master/icons/stripe/stripe-original.svg" "$ICONS_DIR/stripe.png"

echo -e "\n⚠️  Manual downloads needed for:"
echo "  • react-native.png — https://reactnative.dev/img/tiny_logo.png"
echo "  • cursor.png — https://cursor.sh (screenshot the logo)"
echo "  • claude.png — https://www.anthropic.com/images/claude.png"
echo "  • imdb.png — https://www.imdb.com/favicon.ico"
