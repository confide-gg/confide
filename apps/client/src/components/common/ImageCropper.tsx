import { useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "../ui/button";

interface ImageCropperProps {
  image: string;
  aspect: number;
  cropShape?: "rect" | "round";
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
}

export function ImageCropper({
  image,
  aspect,
  cropShape = "rect",
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropAreaComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (err) {
      console.error("Failed to crop image:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-lg bg-card rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-lg">Crop Image</h3>
          <button className="text-muted-foreground hover:text-foreground p-1" onClick={onCancel}>
            <FontAwesomeIcon icon="xmark" className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full h-[400px] bg-black">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaComplete}
          />
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <FontAwesomeIcon
              icon="magnifying-glass-minus"
              className="w-4 h-4 text-muted-foreground"
            />
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <FontAwesomeIcon
              icon="magnifying-glass-plus"
              className="w-4 h-4 text-muted-foreground"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Apply"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas toBlob failed"));
        }
      },
      "image/jpeg",
      0.9
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.setAttribute("crossOrigin", "anonymous");
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}
