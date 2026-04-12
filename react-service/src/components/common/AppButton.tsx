import type { ButtonHTMLAttributes, ReactNode } from "react";

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: "primary" | "secondary";
}

const AppButton = ({
    children,
    variant = "primary",
    className = "",
    ...props
}: AppButtonProps) => {
    const classes = `app-button app-button-${variant} ${className}`.trim();

    return (
        <button className={classes} {...props}>
            {children}
        </button>
    );
};

export default AppButton;