interface PageLoadingProps {
    message?: string;
}

const PageLoading = ({ message = "讀取中..." }: PageLoadingProps) => {
    return (
        <div className="page-state">
            <p>{message}</p>
        </div>
    );
};

export default PageLoading;
