import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";

/** Confirmation before destructive actions. Optionally requires typing a phrase. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  requireText,
  destructive = true,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  requireText?: string;
  destructive?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const blocked = !!requireText && typed.trim() !== requireText;
  return (
    <AlertDialog onOpenChange={() => setTyped("")}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requireText && (
          <div className="space-y-1.5">
            <p className="text-sm">
              Type <span className="font-mono font-semibold">{requireText}</span> to confirm.
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked}
            className={buttonVariants({ variant: destructive ? "destructive" : "default" })}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
