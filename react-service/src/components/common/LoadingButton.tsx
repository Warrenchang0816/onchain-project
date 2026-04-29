import type { ButtonHTMLAttributes, ReactNode } from "react";

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading: boolean;
    loadingText?: string;
    children: ReactNode;
}

const LoadingButton = ({
    isLoading,
    loadingText = "讀取中...",
    children,
    disabled,
    ...props
}: LoadingButtonProps) => {
    return (
        <button {...props} disabled={disabled || isLoading}>
            {isLoading ? loadingText : children}
        </button>
    );
};

export default LoadingButton;
