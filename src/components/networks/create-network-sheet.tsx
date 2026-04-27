import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function CreateNetworkSheet({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [driver, setDriver] = useState("bridge");
  const nameRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () => api.networks.create(name.trim(), driver.trim() || "bridge"),
    onSuccess: () => {
      onCreated();
      setOpen(false);
      setName("");
      setDriver("bridge");
      toast.success("Network created");
    },
    onError: (e) =>
      toast.error(`Create failed: ${e instanceof Error ? e.message : String(e)}`),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || mutation.isPending) return;
    mutation.mutate();
  }

  function handleOpenChange(next: boolean) {
    if (!next) { setName(""); setDriver("bridge"); }
    setOpen(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Create
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-6 w-[360px] sm:w-[360px]">
        <SheetHeader>
          <SheetTitle>Create Network</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Name</p>
            <TextInput
              ref={nameRef}
              placeholder="my-network"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Driver</p>
            <TextInput
              placeholder="bridge"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!name.trim() || mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
