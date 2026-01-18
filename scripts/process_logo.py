import os
from PIL import Image
import math

def distance(c1, c2):
    (r1, g1, b1) = c1[:3]
    (r2, g2, b2) = c2[:3]
    return math.sqrt((r1 - r2)**2 + (g1 - g2)**2 + (b1 - b2)**2)

def remove_background_simple(img, tolerance=30):
    img = img.convert("RGBA")
    datas = img.getdata()
    
    # Sample corners to find background color
    width, height = img.size
    corners = [
        img.getpixel((0, 0)),
        img.getpixel((width-1, 0)),
        img.getpixel((0, height-1)),
        img.getpixel((width-1, height-1))
    ]
    
    # Average corner color
    avg_bg = (
        sum(c[0] for c in corners) // 4,
        sum(c[1] for c in corners) // 4,
        sum(c[2] for c in corners) // 4
    )
    
    print(f"  Estimated background color: {avg_bg}")

    newData = []
    for item in datas:
        if distance(item, avg_bg) < tolerance:
            newData.append((255, 255, 255, 0)) # Transparent
        else:
            newData.append(item)

    img.putdata(newData)
    return img

def process_logo():
    input_path = 'vestalogo.png'
    output_dir = 'public/resources'
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    print(f"Opening {input_path}...")
    img = Image.open(input_path)
    width, height = img.size
    print(f"Original dimensions: {width}x{height}")

    # Split into two halves
    midpoint = width // 2
    left_half = img.crop((0, 0, midpoint, height))
    right_half = img.crop((midpoint, 0, width, height))

    # Function to process single image
    def process_variant(image, name):
        print(f"Processing {name}...")
        
        # Remove background using simple method
        out_img = remove_background_simple(image)
        
        # Trim whitespace
        bbox = out_img.getbbox()
        if bbox:
            out_img = out_img.crop(bbox)
            print(f"  Trimmed to {bbox}")
        
        # Square up and resize (add padding)
        target_size = (512, 512)
        new_img = Image.new("RGBA", target_size, (0, 0, 0, 0))
        
        # Calculate scaling to fit within target_size with padding
        padding = 48
        max_dim = target_size[0] - (padding * 2)
        
        w, h = out_img.size
        ratio = min(max_dim / w, max_dim / h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        
        out_img_resized = out_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Center
        x = (target_size[0] - new_w) // 2
        y = (target_size[1] - new_h) // 2
        
        new_img.paste(out_img_resized, (x, y))
        
        output_path = os.path.join(output_dir, f"{name}.png")
        new_img.save(output_path)
        print(f"  Saved to {output_path}")

    # Assume Left = Light Mode, Right = Dark Mode (or vice versa, we'll see)
    process_variant(left_half, "logo_light")
    process_variant(right_half, "logo_dark")

if __name__ == "__main__":
    process_logo()
