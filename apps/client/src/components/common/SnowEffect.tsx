import { useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";

interface Snowflake {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  drift: number;
  rotation: number;
  rotationSpeed: number;
  meltProgress: number;
  isMelting: boolean;
}

export function SnowEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snowflakesRef = useRef<Snowflake[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastSpawnRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);

  const { preferences } = useAuth();

  useEffect(() => {
    const now = new Date();
    const isHolidaySeason = now.getMonth() === 11;
    const userPrefEnabled = preferences ? (preferences.enable_snow_effect ?? true) : true;

    if (!isHolidaySeason || !userPrefEnabled) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateCanvasSize();

    const handleResize = () => {
      updateCanvasSize();
    };

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      if (isVisibleRef.current) {
        snowflakesRef.current = snowflakesRef.current.filter(
          (flake) => !flake.isMelting || flake.meltProgress < 1
        );
        animate();
      }
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const createSnowflake = (): Snowflake => {
      const baseOpacity = Math.random();
      const opacity = baseOpacity < 0.5 ? Math.random() * 0.08 + 0.03 : Math.random() * 0.15 + 0.1;

      return {
        x: Math.random() * canvas.width,
        y: -20,
        size: Math.random() * 1.5 + 1.5,
        speed: Math.random() * 0.4 + 0.25,
        opacity,
        drift: (Math.random() - 0.5) * 0.15,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.008,
        meltProgress: 0,
        isMelting: false,
      };
    };

    const drawSnowflake = (flake: Snowflake) => {
      ctx.save();
      ctx.translate(flake.x, flake.y);
      ctx.rotate(flake.rotation);

      const actualOpacity = flake.opacity * (1 - flake.meltProgress);
      const scale = 1 - flake.meltProgress * 0.5;

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, flake.size * scale);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${actualOpacity})`);
      gradient.addColorStop(0.5, `rgba(245, 250, 255, ${actualOpacity * 0.85})`);
      gradient.addColorStop(1, `rgba(230, 240, 250, ${actualOpacity * 0.4})`);

      ctx.fillStyle = gradient;
      ctx.beginPath();

      const arms = 6;
      const innerRadius = flake.size * 0.3 * scale;
      const outerRadius = flake.size * scale;

      for (let i = 0; i < arms * 2; i++) {
        const angle = (Math.PI / arms) * i;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 255, 255, ${actualOpacity * 0.5})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.restore();
    };

    const animate = () => {
      if (!isVisibleRef.current) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentTime = Date.now();
      if (currentTime - lastSpawnRef.current > 1000 && snowflakesRef.current.length < 15) {
        snowflakesRef.current.push(createSnowflake());
        lastSpawnRef.current = currentTime;
      }

      snowflakesRef.current = snowflakesRef.current.filter((flake) => {
        flake.y += flake.speed;
        flake.x += Math.sin(flake.y * 0.008) * flake.drift * 2;
        flake.rotation += flake.rotationSpeed;

        if (flake.y > canvas.height - 50 && !flake.isMelting) {
          flake.isMelting = true;
        }

        if (flake.isMelting) {
          flake.meltProgress = Math.min(flake.meltProgress + 0.01, 1);
          flake.speed *= 0.95;
        }

        if (flake.x < -20 || flake.x > canvas.width + 20) {
          return false;
        }

        if (flake.meltProgress >= 1) {
          return false;
        }

        drawSnowflake(flake);
        return true;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      snowflakesRef.current = [];
    };
  }, [preferences]);

  const now = new Date();
  const isHolidaySeason = now.getMonth() === 11;
  const userPrefEnabled = preferences ? (preferences.enable_snow_effect ?? true) : true;

  if (!isHolidaySeason || !userPrefEnabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
