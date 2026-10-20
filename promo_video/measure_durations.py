import subprocess
import imageio_ffmpeg
import json
import re

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

durations = {}
for i in range(1, 6):
    path = f"promo_video/audio/scene_{i}.mp3"
    proc = subprocess.run([ffmpeg, "-i", path], stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", proc.stderr)
    if m:
        h, mn, s = m.groups()
        dur = int(h)*3600 + int(mn)*60 + float(s)
        durations[f"scene_{i}"] = dur
        print(f"scene_{i}: {dur:.2f} saniye")

with open("promo_video/durations.json", "w") as f:
    json.dump(durations, f, indent=2)
print("Kaydedildi -> promo_video/durations.json")
