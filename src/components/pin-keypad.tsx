import { useEffect, useState } from "react";
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
  const [pressed, setPressed] = useState<string | null>(null);

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

  // Mirror physical keyboard presses onto the on-screen keypad.
  useEffect(() => {
    function keyToId(key: string): string | null {
      if (/^[0-9]$/.test(key)) return key;
      if (key === "Backspace") return "backspace";
      if (key === "Delete") return "clear";
      if (key === "Enter") return "submit";
      return null;
    }
    function onKeyDown(e: KeyboardEvent) {
      const id = keyToId(e.key);
      if (!id) return;
      setPressed(id);
    }
    function onKeyUp() {
      setPressed(null);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onKeyUp);
    };
  }, []);

  const keyClass = (id: string, base: string) =>
    pressed === id ? `${base} pin-key-pressed` : base;

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
                  className={keyClass("clear", "pin-key pin-key-secondary")}
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
                  className={keyClass("backspace", "pin-key pin-key-secondary")}
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
                className={keyClass(key, "pin-key")}
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
        className={keyClass("submit", "pin-key pin-key-submit mt-2")}
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
