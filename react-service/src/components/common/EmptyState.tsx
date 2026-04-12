interface EmptyStateProps {
    title: string;
    description: string;
}

const EmptyState = ({ title, description }: EmptyStateProps) => {
    return (
        <div className="page-state empty-state">
            <h2>{title}</h2>
            <p>{description}</p>
        </div>
    );
};

export default EmptyState;