import * as React from "react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { filterArabic, filterEnglish, hasNonArabic, hasNonEnglish } from "@/lib/textFilters";
import { AlertCircle } from "lucide-react";

type Script = "en" | "ar";

interface Props extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  script: Script;
  value: string;
  onChange: (v: string) => void;
  isAr?: boolean;
}

export function ScriptInput({ script, value, onChange, isAr = false, ...rest }: Props) {
  const [warn, setWarn] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const message =
    script === "en"
      ? isAr
        ? "الكتابة لازم تكون بالإنجليزى فقط"
        : "This field accepts English letters only"
      : isAr
        ? "الكتابة لازم تكون بالعربى فقط"
        : "This field accepts Arabic letters only";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const invalid = script === "en" ? hasNonEnglish(raw) : hasNonArabic(raw);
    if (invalid) {
      setWarn(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setWarn(false), 2200);
    }
    const cleaned = script === "en" ? filterEnglish(raw) : filterArabic(raw);
    onChange(cleaned);
  };

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={warn}>
        <TooltipTrigger asChild>
          <div className="relative">
            <Input
              dir={script === "en" ? "ltr" : "rtl"}
              {...rest}
              value={value}
              onChange={handleChange}
              aria-invalid={warn}
              className={`${rest.className ?? ""} ${warn ? "border-destructive ring-2 ring-destructive/30" : ""}`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-destructive text-destructive-foreground flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{message}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
