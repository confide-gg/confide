import { useEffect, useState } from "react";
import { preferences } from "../../api/preferences";

interface Snowflake {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  meltProgress: number;
  isMelting: boolean;
}

// Simple event bus for snow effect preference changes
let preferenceUpdateCounter = 0;

export function notifySnowEffectChange() {
  preferenceUpdateCounter++;
}

export function getPreferenceUpdateCount() {
  return preferenceUpdateCounter;
}

export function SnowEffect() {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [userPrefEnabled, setUserPrefEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const now = new Date();
    const isHolidaySeason = now.getMonth() === 11;
    setIsEnabled(isHolidaySeason);
  }, []);

  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await preferences.getPreferences();
        const enabled = prefs.enable_snow_effect ?? true;
        setUserPrefEnabled(enabled);
        
        // If disabling, clear existing snowflakes immediately
        if (!enabled) {
          setSnowflakes([]);
        }
      } catch (error) {
        console.error('Failed to load snow effect preference:', error);
        setUserPrefEnabled(true);
      }
    };
    
    loadPreferences();
    
    // Check for preference updates
    const interval = setInterval(() => {
      const currentCount = getPreferenceUpdateCount();
      if (currentCount > updateTrigger) {
        loadPreferences();
        setUpdateTrigger(currentCount);
      }
    }, 200);
    
    return () => clearInterval(interval);
  }, [updateTrigger]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;
      setIsVisible(nowVisible);
      
      if (nowVisible) {
        setSnowflakes(prev => prev.filter(flake => !flake.isMelting || flake.meltProgress < 1));
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isEnabled || !isVisible || userPrefEnabled === false) return;

    const generateSnowflake = (): Snowflake => {
      return {
        id: Date.now() + Math.random(),
        x: Math.random() * 100,
        y: Math.random() * -100 - 20,
        size: Math.random() * 1.5 + 1,
        speed: Math.random() * 0.8 + 0.3,
        opacity: Math.random() * 0.2 + 0.1,
        meltProgress: 0,
        isMelting: false,
      };
    };

    const interval = setInterval(() => {
      setSnowflakes((prev) => {
        const activeSnowflakes = prev.filter((flake) => !flake.isMelting || flake.meltProgress < 1);
        
        if (activeSnowflakes.length < 20) {
          activeSnowflakes.push(generateSnowflake());
        }
        
        return activeSnowflakes;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isEnabled, isVisible]);

  useEffect(() => {
    if (!isEnabled || !isVisible || userPrefEnabled === false || snowflakes.length === 0) return;

    let animationFrameId: number;

    const animate = () => {
      setSnowflakes((prev) => 
        prev.map((flake) => {
          let newY = flake.y + flake.speed * 0.3;
          let newMeltProgress = flake.meltProgress;
          let newIsMelting = flake.isMelting;
          
          if (flake.y > 95 && !flake.isMelting) {
            newIsMelting = true;
          }
          
          if (flake.isMelting) {
            newMeltProgress = Math.min(flake.meltProgress + 0.003, 1);
            newY = flake.y + flake.speed * 0.1;
            newY = Math.min(newY, 98);
          }
          
          const newX = flake.isMelting ? flake.x : flake.x + (Math.sin(flake.y * 0.03) * 0.05);
          
          const boundedX = Math.max(2, Math.min(98, newX));
          
          return {
            ...flake,
            x: boundedX,
            y: newY,
            meltProgress: newMeltProgress,
            isMelting: newIsMelting,
          };
        })
      );
      
      if (isVisible) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isEnabled, isVisible, snowflakes]);

  if (!isEnabled || userPrefEnabled === false) return null;

  return (
    <div className="snow-effect fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake absolute text-white"
          style={{
            left: `${flake.x}%`,
            top: `${flake.y}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity * (1 - flake.meltProgress),
            transform: `translate(-50%, -50%) scale(${1 - flake.meltProgress * 0.5})`,
            transition: flake.isMelting ? 'opacity 0.1s ease-out, transform 0.1s ease-out' : 'none',
          }}
        >
          <div className="snowflake-shape w-full h-full">❄</div>
        </div>
      ))}
    </div>
  );
}
