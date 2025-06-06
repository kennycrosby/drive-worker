import os
import subprocess
from PIL import Image, ImageOps

# Define paths
input_root = "./tmp/input"

# Max resolution limits
MAX_WIDTH = 8192
MAX_HEIGHT = 4320
image_extensions = (".jpg", ".jpeg", ".png", ".bmp", ".webp")

# Traverse subfolders (e.g., stop1, stop2)
for stop_folder in os.listdir(input_root):
    stop_path = os.path.join(input_root, stop_folder)
    if not os.path.isdir(stop_path):
        continue

    # Create per-stop output folders
    video_output_root = os.path.join("./tmp/output", stop_folder, "videos")
    thumb_output_root = os.path.join("./tmp/output", stop_folder, "thumbnails")
    os.makedirs(video_output_root, exist_ok=True)
    os.makedirs(thumb_output_root, exist_ok=True)

    for filename in os.listdir(stop_path):
        if not filename.lower().endswith(image_extensions):
            continue

        input_path = os.path.join(stop_path, filename)
        name, ext = os.path.splitext(filename)
        prefixed_name = f"{stop_folder}_{name}"

        # --- Video Export ---
        video_output_path = os.path.join(video_output_root, f"{prefixed_name}.mp4")
        if not os.path.exists(video_output_path):
            with Image.open(input_path) as img:
                width, height = img.size
                scale_width, scale_height = width, height
                if width > MAX_WIDTH or height > MAX_HEIGHT:
                    ratio = min(MAX_WIDTH / width, MAX_HEIGHT / height)
                    scale_width = int(width * ratio)
                    scale_height = int(height * ratio)
                scale_width -= scale_width % 2
                scale_height -= scale_height % 2
                if (scale_width, scale_height) != (width, height):
                    print(f"Downscaling {filename} from {width}x{height} to {scale_width}x{scale_height}")

            cmd = [
                "ffmpeg",
                "-loop", "1",
                "-i", input_path,
                "-t", "1",
                "-r", "30",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-vf", f"scale={scale_width}:{scale_height}",
                "-y",
                video_output_path
            ]
            print(f"Creating video: {video_output_path}")
            subprocess.run(cmd, check=True)
        else:
            print(f"Skipping existing video: {video_output_path}")

        # --- Thumbnail Export ---
        thumbnail_output_path = os.path.join(thumb_output_root, f"{prefixed_name}.jpg")
        try:
            with Image.open(input_path) as img:
                img = ImageOps.exif_transpose(img)
                thumb_width = 400
                thumb_ratio = thumb_width / img.width
                thumb_height = int(img.height * thumb_ratio)
                img = img.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
                img.convert("RGB").save(thumbnail_output_path, "JPEG", quality=85)
        except Exception as e:
            print(f"Failed to process thumbnail for {input_path}: {e}")

print("✅ Conversion complete: videos and thumbnails exported.")
