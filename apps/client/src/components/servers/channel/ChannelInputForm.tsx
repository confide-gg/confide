import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { GifPicker } from "../../chat/GifPicker";
import { EmojiPicker } from "../../chat/EmojiPicker";

interface ChannelInputFormProps {
  channelName: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onGifSelect: (url: string) => void;
  onEmojiSelect: (emoji: { native: string }) => void;
  disabled: boolean;
  isSending: boolean;
}

export function ChannelInputForm({
  channelName,
  value,
  onChange,
  onSubmit,
  onGifSelect,
  onEmojiSelect,
  disabled,
  isSending,
}: ChannelInputFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 h-10 rounded-xl bg-secondary px-4 ring-1 ring-transparent focus-within:ring-primary/50 transition-all"
    >
      <div className="flex items-center gap-1 shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1.5 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-white/10"
              title="Send GIF"
            >
              <span className="text-[10px] font-bold px-1">GIF</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="p-0 border-none bg-transparent shadow-none w-[320px]"
          >
            <GifPicker onSelect={onGifSelect} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1.5 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-white/10"
              title="Add emoji"
            >
              <FontAwesomeIcon icon="face-smile" className="w-5 h-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-auto p-0 border-none bg-transparent shadow-none"
          >
            <EmojiPicker onSelect={onEmojiSelect} />
          </PopoverContent>
        </Popover>
      </div>

      <input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e);
          }
        }}
        placeholder={`Message #${channelName}`}
        className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground h-full min-w-0"
        disabled={isSending || disabled}
      />
    </form>
  );
}
