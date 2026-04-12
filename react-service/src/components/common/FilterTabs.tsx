interface FilterOption<T extends string> {
    label: string;
    value: T;
}

interface FilterTabsProps<T extends string> {
    options: FilterOption<T>[];
    value: T;
    onChange: (value: T) => void;
}

const FilterTabs = <T extends string>({
    options,
    value,
    onChange,
}: FilterTabsProps<T>) => {
    return (
        <div className="filter-group">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className={
                        value === option.value
                            ? "filter-button active"
                            : "filter-button"
                    }
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};

export default FilterTabs;