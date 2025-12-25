import { useEffect, useState, useRef } from "react";
import confetti from "canvas-confetti";

interface WelcomeScreenProps {
  onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const myConfetti = confetti.create(canvas, {
      resize: true,
    });

    const colors = ["#c9ed7b", "#a3d155", "#8bc34a", "#cddc39"];

    myConfetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    setTimeout(() => {
      myConfetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      myConfetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
    }, 250);

    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 2500);

    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 3200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[200] backdrop-blur-xl bg-background/60 flex items-center justify-center transition-opacity duration-700 ${
          isFading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="text-center animate-in fade-in zoom-in-95 duration-500">
          <h1 className="text-5xl font-bold text-foreground mb-4">Welcome to Confide</h1>
          <p className="text-lg text-muted-foreground">Your secure messaging starts now</p>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-[201] pointer-events-none transition-opacity duration-700 w-full h-full ${
          isFading ? "opacity-0" : "opacity-100"
        }`}
      />
    </>
  );
}
