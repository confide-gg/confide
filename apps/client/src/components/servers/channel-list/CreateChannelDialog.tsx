import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

interface Category {
  id: string;
  name: string;
}

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
  onChannelNameChange: (name: string) => void;
  categoryId: string | undefined;
  onCategoryIdChange: (id: string | undefined) => void;
  categories: Category[];
  isCreating: boolean;
  onSubmit: () => void;
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  channelName,
  onChannelNameChange,
  categoryId,
  onCategoryIdChange,
  categories,
  isCreating,
  onSubmit,
}: CreateChannelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
          <DialogDescription>
            Create a new text channel in{" "}
            {categoryId ? categories.find((c) => c.id === categoryId)?.name : "this server"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Channel Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                #
              </span>
              <input
                id="name"
                value={channelName}
                onChange={(e) =>
                  onChannelNameChange(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                }
                placeholder="new-channel"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-7 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Category (Optional)</label>
            <Select value={categoryId} onValueChange={onCategoryIdChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!channelName.trim() || isCreating}>
            {isCreating && <FontAwesomeIcon icon="spinner" className="w-4 h-4 mr-2" spin />}
            Create Channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
