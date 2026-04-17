type LoadingOverlayProps = {
    isVisible: boolean;
    message?: string;
};

/**
 * Full-screen loading overlay with spinner.
 * Use whenever an async operation (API call, blockchain tx, file upload)
 * blocks user interaction and needs visual feedback.
 *
 * Usage:
 *   <LoadingOverlay isVisible={isBusy} message="上傳中，請稍候..." />
 */
const LoadingOverlay = ({ isVisible, message }: LoadingOverlayProps) => {
    if (!isVisible) return null;

    return (
        <div className="loading-overlay">
            <div className="loading-overlay-spinner" />
            {message ? (
                <p className="loading-overlay-message">{message}</p>
            ) : null}
        </div>
    );
};

export default LoadingOverlay;
