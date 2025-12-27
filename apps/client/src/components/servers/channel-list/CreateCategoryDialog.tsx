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

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  onCategoryNameChange: (name: string) => void;
  isCreating: boolean;
  onSubmit: () => void;
}

export function CreateCategoryDialog({
  open,
  onOpenChange,
  categoryName,
  onCategoryNameChange,
  isCreating,
  onSubmit,
}: CreateCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Category</DialogTitle>
          <DialogDescription>Create a new folder to organize your channels.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="catName" className="text-sm font-medium">
              Category Name
            </label>
            <input
              id="catName"
              value={categoryName}
              onChange={(e) => onCategoryNameChange(e.target.value)}
              placeholder="Text Channels"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!categoryName.trim() || isCreating}>
            {isCreating && <FontAwesomeIcon icon="spinner" className="w-4 h-4 mr-2" spin />}
            Create Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
