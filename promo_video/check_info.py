import subprocess
import imageio_ffmpeg

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
proc = subprocess.run([ffmpeg, '-i', 'promo_video/saha_takip_tanitim.mp4'], stderr=subprocess.PIPE, text=True)
for line in proc.stderr.splitlines():
    if any(k in line for k in ['Duration', 'Stream #0']):
        print(line.strip())
