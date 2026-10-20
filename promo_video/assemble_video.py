import os
import subprocess
import json
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

def assemble():
    os.makedirs("promo_video/temp", exist_ok=True)
    with open("promo_video/durations.json", "r") as f:
        durations = json.load(f)

    scene_clips = []
    
    print("Sahneler video kliplerine dönüstürülüyor (Ken Burns zoom + ses)...")
    
    for i in range(1, 7):
        scene_id = f"scene_{i}"
        audio_path = f"promo_video/audio/{scene_id}.mp3"
        image_path = f"promo_video/frames/{scene_id}.png"
        out_clip = f"promo_video/temp/{scene_id}.mp4"
        
        # Audio length + small safety padding
        audio_dur = durations[scene_id]
        clip_dur = audio_dur + 0.6  # 0.6s pause after speech
        
        total_frames = int(clip_dur * 30)
        
        # Alternate subtle zoom in and zoom out for dynamic movement
        if i % 2 == 1:
            # Zoom in: 1.0 -> 1.05
            vf = f"zoompan=z='min(zoom+0.0005,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1920x1080:fps=30"
        else:
            # Zoom out / pan: 1.05 -> 1.0
            vf = f"zoompan=z='max(1.05-0.0005*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1920x1080:fps=30"

        # Build scene clip
        cmd = [
            FFMPEG, "-y",
            "-loop", "1",
            "-i", image_path,
            "-i", audio_path,
            "-t", f"{clip_dur:.3f}",
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            out_clip
        ]
        
        subprocess.run(cmd, check=True)
        print(f"[OK] {scene_id}.mp4 olusturuldu (Süre: {clip_dur:.2f}s)")
        scene_clips.append(out_clip)

    # 2. Concat list
    concat_list_path = "promo_video/temp/concat_list.txt"
    with open(concat_list_path, "w") as f:
        for c in scene_clips:
            # Absolute path with forward slashes
            abs_p = os.path.abspath(c).replace("\\", "/")
            f.write(f"file '{abs_p}'\n")

    combined_video = "promo_video/temp/video_combined.mp4"
    print("Tüm sahneler birlestiriliyor...")
    concat_cmd = [
        FFMPEG, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list_path,
        "-c", "copy",
        combined_video
    ]
    subprocess.run(concat_cmd, check=True)
    print("[OK] Sahneler birlestirildi.")

    # 3. Mix in background music
    bg_music = "promo_video/audio/bg_music.wav"
    final_output = "promo_video/saha_takip_tanitim.mp4"
    print("Arka plan müzigi miksleniyor ve son video üretiliyor...")
    
    # Audio filter: voice (input 0) at 100%, music (input 1) at 18%, mixed and trimmed to video length
    mix_cmd = [
        FFMPEG, "-y",
        "-i", combined_video,
        "-i", bg_music,
        "-filter_complex", "[0:a]volume=1.0[v];[1:a]volume=0.18[m];[v][m]amix=inputs=2:duration=first:dropout_transition=3[a]",
        "-map", "0:v",
        "-map", "[a]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "256k",
        "-shortest",
        final_output
    ]
    subprocess.run(mix_cmd, check=True)
    
    file_size_mb = os.path.getsize(final_output) / (1024 * 1024)
    print(f"\n==========================================")
    print(f"🎉 REKLAM FİLMİ BASARIYLA OLUSTURULDU!")
    print(f"Dosya: {os.path.abspath(final_output)}")
    print(f"Boyut: {file_size_mb:.2f} MB")
    print(f"==========================================")

if __name__ == "__main__":
    assemble()
