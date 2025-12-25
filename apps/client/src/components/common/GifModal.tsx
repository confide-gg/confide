import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
            <FontAwesomeIcon icon="star" className="w-5 h-5" />
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/50 text-white border border-white/20 backdrop-blur-md hover:bg-black/70 transition-colors"
            onClick={onClose}
          >
            <FontAwesomeIcon icon="xmark" className="w-5 h-5" />
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
