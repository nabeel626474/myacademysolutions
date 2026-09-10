import { Delete, CornerDownLeft } from "lucide-react";

interface PinKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  maxLength?: number;
}

export function PinKeypad({
  value,
  onChange,
  onSubmit,
  disabled,
  maxLength = 8,
}: PinKeypadProps) {
  function append(digit: string) {
    if (disabled) return;
    const next = (value + digit).replace(/\D/g, "").slice(0, maxLength);
    onChange(next);
  }

  function backspace() {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }

  function clear() {
    if (disabled) return;
    onChange("");
  }

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["clear", "0", "backspace"],
  ];

  return (
    <div className="pin-keypad" role="group" aria-label="PIN keypad">
      {keys.map((row, rowIndex) => (
        <div key={rowIndex} className="pin-keypad-row">
          {row.map((key) => {
            if (key === "clear") {
              return (
                <button
                  key={key}
                  type="button"
                  className="pin-key pin-key-secondary"
                  onClick={clear}
                  disabled={disabled || value.length === 0}
                  aria-label="Clear PIN"
                  title="Clear"
                >
                  C
                </button>
              );
            }
            if (key === "backspace") {
              return (
                <button
                  key={key}
                  type="button"
                  className="pin-key pin-key-secondary"
                  onClick={backspace}
                  disabled={disabled || value.length === 0}
                  aria-label="Backspace"
                  title="Backspace"
                >
                  <Delete className="size-5" aria-hidden="true" />
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                className="pin-key"
                onClick={() => append(key)}
                disabled={disabled || value.length >= maxLength}
                aria-label={`${key}`}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
      <button
        type="button"
        className="pin-key pin-key-submit mt-2"
        onClick={onSubmit}
        disabled={disabled || value.length < 4}
        aria-label="Unlock"
      >
        <CornerDownLeft className="size-5" aria-hidden="true" />
        <span>Unlock</span>
      </button>
    </div>
  );
}
