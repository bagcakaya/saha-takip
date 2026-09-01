import React, { useEffect, useRef } from 'react';
import { TimeOfDay, WeatherCondition } from '../../types/auth';

interface WeatherBackgroundProps {
  timeOfDay: TimeOfDay;
  condition: WeatherCondition;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  active: boolean;
  tailLength: number;
}

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  wind: number;
  angle: number;
  opacity: number;
}

interface Cloud {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
}

export const WeatherBackground: React.FC<WeatherBackgroundProps> = ({
  timeOfDay,
  condition,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // 1. Initialize Stars for Night
    const stars: Star[] = Array.from({ length: 180 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.9,
      radius: Math.random() * 1.6 + 0.4,
      baseAlpha: Math.random() * 0.7 + 0.3,
      twinkleSpeed: Math.random() * 0.04 + 0.01,
      phase: Math.random() * Math.PI * 2,
    }));

    // 2. Shooting Stars (Kayan Yıldızlar)
    const shootingStars: ShootingStar[] = [];
    let nextShootingStarTime = Date.now() + 1000;

    const spawnShootingStar = () => {
      const angle = (Math.PI / 4) + (Math.random() * 0.2 - 0.1); // ~45 degrees diagonal
      shootingStars.push({
        x: Math.random() * width * 0.8 + width * 0.1,
        y: Math.random() * (height * 0.4),
        length: Math.random() * 80 + 70,
        speed: Math.random() * 9 + 11,
        angle,
        opacity: 1,
        active: true,
        tailLength: Math.random() * 100 + 80,
      });
    };

    // 3. Rain Drops
    const rainDrops: RainDrop[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 20 + 15,
      speed: Math.random() * 12 + 14,
      opacity: Math.random() * 0.4 + 0.4,
    }));

    // 4. Snowflakes
    const snowflakes: Snowflake[] = Array.from({ length: 120 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.5 + 1.2,
      speed: Math.random() * 1.5 + 0.8,
      wind: Math.random() * 0.5 - 0.25,
      angle: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.6 + 0.4,
    }));

    // 5. Clouds for Daytime / Cloudy
    const clouds: Cloud[] = Array.from({ length: 12 }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.4),
      radius: Math.random() * 60 + 50,
      speed: Math.random() * 0.25 + 0.08,
      opacity: Math.random() * 0.18 + 0.1,
    }));

    // 6. Lightning state
    let lightningOpacity = 0;
    let nextLightningTime = Date.now() + 3000;

    // Animation Loop
    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // --- Background Sky Gradient ---
      let grad = ctx.createLinearGradient(0, 0, 0, height);

      if (timeOfDay === 'night') {
        grad.addColorStop(0, '#040714');
        grad.addColorStop(0.5, '#0b132b');
        grad.addColorStop(1, '#1c2541');
      } else if (timeOfDay === 'sunset') {
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(0.35, '#581c87');
        grad.addColorStop(0.7, '#c026d3');
        grad.addColorStop(0.9, '#f97316');
        grad.addColorStop(1, '#fbbf24');
      } else {
        // Daytime
        if (condition === 'cloudy' || condition === 'rain' || condition === 'thunderstorm') {
          grad.addColorStop(0, '#334155');
          grad.addColorStop(0.5, '#475569');
          grad.addColorStop(1, '#64748b');
        } else {
          grad.addColorStop(0, '#0284c7');
          grad.addColorStop(0.4, '#38bdf8');
          grad.addColorStop(1, '#bae6fd');
        }
      }

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // --- Draw Celestial Body: Sun or Moon ---
      if (timeOfDay === 'night') {
        // Glowing Crescent Moon
        const moonX = width * 0.82;
        const moonY = height * 0.18;
        const moonRadius = Math.min(width, height) * 0.05 + 18;

        // Moon Glow
        const moonGlow = ctx.createRadialGradient(
          moonX,
          moonY,
          moonRadius * 0.5,
          moonX,
          moonY,
          moonRadius * 2.8
        );
        moonGlow.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
        moonGlow.addColorStop(0.5, 'rgba(253, 224, 71, 0.08)');
        moonGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius * 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Moon Body
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
        ctx.fill();

        // Shadow to make it a crescent
        ctx.fillStyle = '#0b132b';
        ctx.beginPath();
        ctx.arc(moonX + moonRadius * 0.45, moonY - moonRadius * 0.1, moonRadius * 0.88, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Sun (Gündüz & Günbatımı)
        const sunX = width * 0.8;
        const sunY = timeOfDay === 'sunset' ? height * 0.55 : height * 0.18;
        const sunRadius = Math.min(width, height) * 0.06 + 20;

        // Sun Corona Rays / Glow
        const sunGlow = ctx.createRadialGradient(
          sunX,
          sunY,
          sunRadius * 0.4,
          sunX,
          sunY,
          sunRadius * 3.5
        );
        if (timeOfDay === 'sunset') {
          sunGlow.addColorStop(0, 'rgba(251, 146, 60, 0.8)');
          sunGlow.addColorStop(0.5, 'rgba(244, 63, 94, 0.3)');
          sunGlow.addColorStop(1, 'rgba(244, 63, 94, 0)');
        } else {
          sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.7)');
          sunGlow.addColorStop(0.4, 'rgba(250, 204, 21, 0.25)');
          sunGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
        }

        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius * 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Sun Orb
        ctx.fillStyle = timeOfDay === 'sunset' ? '#fb923c' : '#fef08a';
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Draw Stars (Gece & Günbatımı) ---
      if (timeOfDay === 'night' || timeOfDay === 'sunset') {
        stars.forEach((star) => {
          star.phase += star.twinkleSpeed;
          const alpha =
            star.baseAlpha *
            (0.6 + 0.4 * Math.sin(star.phase)) *
            (timeOfDay === 'sunset' ? 0.35 : 1);

          ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, alpha)})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx.fill();
        });

        // --- Draw Shooting Stars (Kayan Yıldızlar) ---
        const now = Date.now();
        if (timeOfDay === 'night' && now > nextShootingStarTime) {
          spawnShootingStar();
          nextShootingStarTime = now + Math.random() * 3500 + 2500; // spawn every 2.5-6 seconds
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const s = shootingStars[i];
          if (!s.active) continue;

          s.x += Math.cos(s.angle) * s.speed;
          s.y += Math.sin(s.angle) * s.speed;
          s.opacity -= 0.012;

          if (s.opacity <= 0 || s.x > width + 100 || s.y > height) {
            shootingStars.splice(i, 1);
            continue;
          }

          // Draw Glowing Meteor Head & Trail
          const tailX = s.x - Math.cos(s.angle) * s.tailLength;
          const tailY = s.y - Math.sin(s.angle) * s.tailLength;

          const meteorGrad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
          meteorGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          meteorGrad.addColorStop(0.7, `rgba(186, 230, 253, ${s.opacity * 0.6})`);
          meteorGrad.addColorStop(1, `rgba(255, 255, 255, ${s.opacity})`);

          ctx.strokeStyle = meteorGrad;
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();

          // Spark head
          ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- Draw Floating Clouds (Gündüz & Bulutlu) ---
      if (condition === 'partly_cloudy' || condition === 'cloudy' || condition === 'rain' || condition === 'thunderstorm') {
        clouds.forEach((cloud) => {
          cloud.x += cloud.speed;
          if (cloud.x - cloud.radius > width) {
            cloud.x = -cloud.radius;
            cloud.y = Math.random() * (height * 0.4);
          }

          ctx.fillStyle =
            timeOfDay === 'night'
              ? `rgba(30, 41, 59, ${cloud.opacity * 1.5})`
              : timeOfDay === 'sunset'
              ? `rgba(251, 146, 60, ${cloud.opacity * 1.8})`
              : `rgba(255, 255, 255, ${cloud.opacity * 2.2})`;

          ctx.beginPath();
          ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
          ctx.arc(cloud.x + cloud.radius * 0.7, cloud.y - cloud.radius * 0.2, cloud.radius * 0.8, 0, Math.PI * 2);
          ctx.arc(cloud.x + cloud.radius * 1.3, cloud.y + cloud.radius * 0.1, cloud.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // --- Draw Rain ---
      if (condition === 'rain' || condition === 'thunderstorm') {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';

        rainDrops.forEach((drop) => {
          drop.y += drop.speed;
          drop.x -= drop.speed * 0.15; // wind angle

          if (drop.y > height) {
            drop.y = -drop.length;
            drop.x = Math.random() * width + 100;
          }

          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - drop.length * 0.15, drop.y + drop.length);
          ctx.stroke();
        });
      }

      // --- Draw Snow ---
      if (condition === 'snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

        snowflakes.forEach((flake) => {
          flake.angle += 0.02;
          flake.y += flake.speed;
          flake.x += Math.sin(flake.angle) * 0.8 + flake.wind;

          if (flake.y > height) {
            flake.y = -flake.radius * 2;
            flake.x = Math.random() * width;
          }

          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // --- Draw Thunderstorm Lightning Flash ---
      if (condition === 'thunderstorm') {
        const now = Date.now();
        if (now > nextLightningTime) {
          lightningOpacity = 0.75;
          nextLightningTime = now + Math.random() * 5000 + 3000;
        }

        if (lightningOpacity > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${lightningOpacity})`;
          ctx.fillRect(0, 0, width, height);
          lightningOpacity -= 0.06;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [timeOfDay, condition]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 transition-opacity duration-1000"
    />
  );
};
