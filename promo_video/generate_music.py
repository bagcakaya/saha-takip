import numpy as np
import wave
import struct
import math

SAMPLE_RATE = 44100
DURATION = 95.0  # seconds

def synthesize_bg_music(filename="promo_video/audio/bg_music.wav"):
    total_samples = int(SAMPLE_RATE * DURATION)
    t = np.linspace(0, DURATION, total_samples, endpoint=False)
    
    # 4-chord progression: Ebmaj7 (Eb, G, Bb, D), Bb (Bb, D, F), Cm7 (C, Eb, G, Bb), Abmaj7 (Ab, C, Eb, G)
    chord_freqs = [
        [155.56, 196.00, 233.08, 293.66],  # Ebmaj7
        [116.54, 146.83, 174.61, 233.08],  # Bb
        [130.81, 155.56, 196.00, 233.08],  # Cm7
        [103.83, 130.81, 155.56, 196.00],  # Abmaj7
    ]
    
    bass_freqs = [77.78, 58.27, 65.41, 51.91]  # Eb1, Bb0, C1, Ab0
    
    chord_duration = 4.0  # 4 seconds per chord (16s cycle)
    cycle_duration = chord_duration * len(chord_freqs)
    
    left_channel = np.zeros(total_samples)
    right_channel = np.zeros(total_samples)
    
    # Generate warm synth pads & bass
    for i in range(int(DURATION / chord_duration) + 1):
        start_idx = int(i * chord_duration * SAMPLE_RATE)
        end_idx = min(total_samples, int((i + 1) * chord_duration * SAMPLE_RATE))
        if start_idx >= total_samples:
            break
        
        chord_idx = i % len(chord_freqs)
        notes = chord_freqs[chord_idx]
        bass = bass_freqs[chord_idx]
        
        seg_len = end_idx - start_idx
        seg_t = np.linspace(0, (end_idx - start_idx) / SAMPLE_RATE, seg_len, endpoint=False)
        
        # Envelope: soft attack and release
        attack = int(0.6 * SAMPLE_RATE)
        release = int(0.8 * SAMPLE_RATE)
        env = np.ones(seg_len)
        if seg_len > attack + release:
            env[:attack] = np.sin(np.linspace(0, np.pi/2, attack))
            env[-release:] = np.cos(np.linspace(0, np.pi/2, release))
        
        # Pad notes
        pad = np.zeros(seg_len)
        for idx, f in enumerate(notes):
            # Rich harmonics with slight detune for stereo width
            detune = 0.5 * (idx + 1)
            pad_l = 0.15 * np.sin(2 * np.pi * (f - detune) * seg_t) + 0.05 * np.sin(2 * np.pi * 2 * f * seg_t)
            pad_r = 0.15 * np.sin(2 * np.pi * (f + detune) * seg_t) + 0.05 * np.sin(2 * np.pi * 2 * f * seg_t)
            left_channel[start_idx:end_idx] += pad_l * env
            right_channel[start_idx:end_idx] += pad_r * env
            
        # Bass note (warm, deep sine)
        bass_wave = 0.25 * np.sin(2 * np.pi * bass * seg_t) + 0.08 * np.sin(2 * np.pi * 2 * bass * seg_t)
        left_channel[start_idx:end_idx] += bass_wave * env
        right_channel[start_idx:end_idx] += bass_wave * env

    # Add gentle rhythmic tick/pulse (BPM = 120 -> 0.5s per beat)
    beat_interval = int(0.5 * SAMPLE_RATE)
    for b in range(0, total_samples, beat_interval):
        click_len = min(2000, total_samples - b)
        click_t = np.linspace(0, click_len / SAMPLE_RATE, click_len, endpoint=False)
        click = np.sin(2 * np.pi * 800 * click_t) * np.exp(-click_t * 60) * 0.04
        left_channel[b:b+click_len] += click
        right_channel[b:b+click_len] += click

    # Master Fade In (first 2s) & Fade Out (last 3s)
    fade_in_len = int(2.0 * SAMPLE_RATE)
    fade_out_len = int(3.5 * SAMPLE_RATE)
    left_channel[:fade_in_len] *= np.linspace(0, 1, fade_in_len)
    right_channel[:fade_in_len] *= np.linspace(0, 1, fade_in_len)
    left_channel[-fade_out_len:] *= np.linspace(1, 0, fade_out_len)
    right_channel[-fade_out_len:] *= np.linspace(1, 0, fade_out_len)
    
    # Normalize volume (keep low so voice is crisp and prominent: -18dB)
    max_val = max(np.max(np.abs(left_channel)), np.max(np.abs(right_channel)))
    if max_val > 0:
        left_channel = (left_channel / max_val) * 0.22
        right_channel = (right_channel / max_val) * 0.22

    # Save to 16-bit WAV
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        
        interleaved = np.empty((total_samples * 2,), dtype=np.int16)
        interleaved[0::2] = (np.clip(left_channel, -1.0, 1.0) * 32767).astype(np.int16)
        interleaved[1::2] = (np.clip(right_channel, -1.0, 1.0) * 32767).astype(np.int16)
        wf.writeframes(interleaved.tobytes())
        
    print(f"[OK] Arka plan müzigi olusturuldu -> {filename}")

if __name__ == "__main__":
    synthesize_bg_music()
