from PIL import Image
import os

# === CONFIG ===
base_image_path = "custom0.png"         # Your source image
output_folder = "./"   # Where to save the copies
variant_count = 100                  # Number of copies you want

# === LOAD BASE IMAGE ===
base_image = Image.open(base_image_path)

# === CREATE OUTPUT FOLDER ===
os.makedirs(output_folder, exist_ok=True)

# === GENERATE COPIES ===
for i in range(variant_count):
    filename = f"custom{i}.png"
    output_path = os.path.join(output_folder, filename)
    base_image.save(output_path)

print(f"✅ Generated {variant_count} image copies in '{output_folder}'")