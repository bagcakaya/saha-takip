import os
import subprocess
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

def finish_assemble():
    clips = [f"promo_video/temp/scene_{i}.mp4" for i in range(1, 7)]
    bg_music = "promo_video/audio/bg_music.wav"
    final_output = "promo_video/saha_takip_tanitim.mp4"
    
    inputs = []
    for c in clips:
        inputs.extend(["-i", c])
    inputs.extend(["-i", bg_music])
    
    filter_complex = (
        "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a][4:v][4:a][5:v][5:a]concat=n=6:v=1:a=1[vconcat][aconcat];"
        "[aconcat]volume=1.0[voice];"
        "[6:a]volume=0.18[music];"
        "[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]"
    )
    
    cmd = [
        FFMPEG, "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[vconcat]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "256k",
        final_output
    ]
    
    print("Sahneler birlestiriliyor ve müzik miksleniyor...")
    subprocess.run(cmd, check=True)
    
    size_mb = os.path.getsize(final_output) / (1024 * 1024)
    print(f"\n==========================================")
    print(f"🎉 REKLAM FILMI BASARIYLA TAMAMLANDI!")
    print(f"Konum: {os.path.abspath(final_output)}")
    print(f"Boyut: {size_mb:.2f} MB")
    print(f"==========================================")

if __name__ == "__main__":
    finish_assemble()
