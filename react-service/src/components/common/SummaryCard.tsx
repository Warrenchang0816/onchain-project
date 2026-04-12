interface SummaryCardProps {
    title: string;
    value: number;
    variant?: "default" | "success" | "info";
}

const SummaryCard = ({ title, value, variant = "default" }: SummaryCardProps) => {
    return (
        <div className={`summary-card summary-card--${variant}`}>
            <h3>{title}</h3>
            <p>{value}</p>
        </div>
    );
};

export default SummaryCard;