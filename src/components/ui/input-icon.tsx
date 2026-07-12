import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  containerClassName?: string;
};

/**
 * Input with leftIcon / rightIcon / clearable X.
 * Reserves proper padding on each side so text never sits under an icon.
 * RTL-safe via logical padding (ps-*/pe-*).
 */
export const InputIcon = React.forwardRef<HTMLInputElement, Props>(function InputIcon(
  { leftIcon, rightIcon, clearable, onClear, className, containerClassName, value, ...props },
  ref,
) {
  const hasLeft = !!leftIcon;
  const hasClear = !!clearable && value != null && String(value).length > 0;
  const hasRight = !!rightIcon || hasClear;
  const rightSlots = (rightIcon ? 1 : 0) + (hasClear ? 1 : 0);

  return (
    <div className={cn("relative w-full", containerClassName)}>
      {hasLeft && (
        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-2.5 text-muted-foreground">
          <span className="[&_svg]:h-4 [&_svg]:w-4">{leftIcon}</span>
        </span>
      )}
      <Input
        ref={ref}
        value={value as string | number | readonly string[] | undefined}
        {...props}
        className={cn(
          hasLeft && "ps-9",
          hasRight && (rightSlots > 1 ? "pe-16" : "pe-9"),
          className,
        )}
      />
      {hasRight && (
        <div className="absolute inset-y-0 end-0 flex items-center gap-0.5 pe-1.5">
          {hasClear && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onClear?.()}
              tabIndex={-1}
              aria-label="Clear"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {rightIcon && (
            <span className="inline-flex items-center text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
              {rightIcon}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
