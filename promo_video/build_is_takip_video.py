import os
import subprocess
import json
import shutil
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

def build_all():
    os.makedirs("promo_video/temp", exist_ok=True)
    with open("promo_video/durations.json", "r") as f:
        durations = json.load(f)

    scene_clips = []
    print("Sahneler video kliplerine donusturuluyor (Takilmasiz, kristal netlikte 1080p + ses)...")

    num_scenes = 5
    for i in range(1, num_scenes + 1):
        scene_id = f"scene_{i}"
        audio_path = f"promo_video/audio/{scene_id}.mp3"
        image_path = f"promo_video/frames/{scene_id}.png"
        out_clip = f"promo_video/temp/{scene_id}.mp4"

        audio_dur = durations[scene_id]
        clip_dur = audio_dur + 0.5  # brief breath after voiceover
        fade_time = 0.35

        # Rock-solid, crystal-clear 1080p with smooth fade-in and fade-out (NO zoompan, NO stutter)
        vf = f"fade=t=in:st=0:d={fade_time},fade=t=out:st={clip_dur - fade_time:.3f}:d={fade_time}"

        cmd = [
            FFMPEG, "-y",
            "-loop", "1",
            "-framerate", "30",
            "-i", image_path,
            "-i", audio_path,
            "-t", f"{clip_dur:.3f}",
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "17",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            out_clip
        ]

        subprocess.run(cmd, check=True)
        print(f"[OK] {scene_id}.mp4 olusturuldu ({clip_dur:.2f} saniye, sifir takilma)")
        scene_clips.append(out_clip)

    # Combine 5 scenes and mix background music
    bg_music = "promo_video/audio/bg_music.wav"
    final_output = "promo_video/is_takip_tanitim.mp4"

    inputs = []
    for c in scene_clips:
        inputs.extend(["-i", c])
    inputs.extend(["-i", bg_music])

    filter_complex = (
        "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a][4:v][4:a]concat=n=5:v=1:a=1[vconcat][aconcat];"
        "[aconcat]volume=1.0[voice];"
        "[5:a]volume=0.15[music];"
        "[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]"
    )

    mix_cmd = [
        FFMPEG, "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[vconcat]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "17",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "256k",
        final_output
    ]

    print("Tum sahneler birlestiriliyor ve arka plan muzigi miksleniyor...")
    subprocess.run(mix_cmd, check=True)

    # Copy to artifacts directory
    artifact_dir = r"C:\Users\Mert\.gemini\antigravity\brain\4a915668-2d0b-4529-a279-dd4a0a31f432"
    artifact_path = os.path.join(artifact_dir, "is_takip_tanitim.mp4")
    shutil.copy2(final_output, artifact_path)

    size_mb = os.path.getsize(final_output) / (1024 * 1024)
    print("\n==========================================")
    print(f"[BASARILI] TAKILMASIZ IS TAKIP SISTEMI REKLAM FILMI TAMAMLANDI!")
    print(f"Konum: {os.path.abspath(final_output)}")
    print(f"Artifact: {artifact_path}")
    print(f"Boyut: {size_mb:.2f} MB")
    print("==========================================")

if __name__ == "__main__":
    build_all()
