import {
  Button as FluentButton,
  type ButtonProps as FluentButtonProps,
} from "@fluentui/react-components";

interface ButtonProps extends Omit<FluentButtonProps, "size"> {
  variant?: "filled" | "outlined" | "ghost";
  size?: "sm" | "md";
}

export function Button({
  variant = "filled",
  size = "md",
  children,
  ...props
}: ButtonProps) {
  const appearance =
    variant === "filled"
      ? "primary"
      : variant === "outlined"
        ? "outline"
        : "subtle";

  return (
    <FluentButton
      appearance={appearance}
      size={size === "sm" ? "small" : "medium"}
      {...props}
    >
      {children}
    </FluentButton>
  );
}
