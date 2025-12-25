import { useChat } from "../../context/chat";

interface GifModalProps {
  gifUrl: string;
  onClose: () => void;
}

export function GifModal({ gifUrl, onClose }: GifModalProps) {
  const { favoriteGifUrls, toggleFavoriteGif } = useChat();
  const isFavorite = favoriteGifUrls.has(gifUrl);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavoriteGif(gifUrl);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex items-center justify-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 absolute top-4 right-4 z-10">
          <button
            className={`w-10 h-10 flex items-center justify-center rounded-lg backdrop-blur-md border transition-all ${
              isFavorite
                ? "bg-primary/90 text-primary-foreground border-primary hover:bg-primary"
                : "bg-black/50 text-white border-white/20 hover:bg-black/70"
            }`}
            onClick={handleFavorite}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={isFavorite ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/50 text-white border border-white/20 backdrop-blur-md hover:bg-black/70 transition-colors"
            onClick={onClose}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <img
          src={gifUrl}
          alt="GIF"
          className="max-w-[95vw] max-h-[95vh] rounded-xl shadow-2xl border border-white/10 object-contain"
        />
      </div>
    </div>
  );
}
