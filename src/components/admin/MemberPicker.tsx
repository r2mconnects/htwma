import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Member } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function MemberPicker({
  members,
  value,
  onChange,
  disabled,
  id,
}: {
  members: Member[];
  value: string;
  onChange: (m: Member) => void;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = members.find((m) => m.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="mt-1.5 w-full justify-between font-normal"
        >
          <span className="truncate">
            {chosen ? `#${chosen.member_number} · ${chosen.full_name}` : "Search members…"}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Name, member ID or mobile…" />
          <CommandList>
            <CommandEmpty>No member found.</CommandEmpty>
            <CommandGroup>
              {members
                .filter((m) => m.status !== "archived")
                .map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`${m.member_number} ${m.full_name} ${m.mobile}`}
                    onSelect={() => {
                      onChange(m);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === m.id ? "opacity-100" : "opacity-0")} />
                    #{m.member_number} · {m.full_name}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
