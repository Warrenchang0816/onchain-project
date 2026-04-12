interface PageLoadingProps {
    message?: string;
}

const PageLoading = ({ message = "Loading..." }: PageLoadingProps) => {
    return (
        <div className="page-state">
            <p>{message}</p>
        </div>
    );
};

export default PageLoading;