import json
import os

# === CONFIG ===
input_file = "custom0.json"  # Your source file
output_folder = "./"  # Where to save the output
variant_count = 100  # Change this to your desired number

# === LOAD BASE GEOMETRY ===
with open(input_file, "r") as f:
    base_data = json.load(f)

# Find the key that starts with "geometry.custom"
base_key = next(k for k in base_data if k.startswith("geometry.custom"))
base_geometry = base_data[base_key]
format_version = base_data.get("format_version", "1.10.0")

# === CREATE OUTPUT FOLDER ===
os.makedirs(output_folder, exist_ok=True)

# === GENERATE FILES ===
for i in range(variant_count):
    filename = f"custom{i}.json"
    output_path = os.path.join(output_folder, filename)
    geometry_key = f"geometry.custom{i}_additional_1"

    output_data = {
        "format_version": format_version,
        geometry_key: base_geometry
    }

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)

print(f"✅ Generated {variant_count} files in '{output_folder}'")