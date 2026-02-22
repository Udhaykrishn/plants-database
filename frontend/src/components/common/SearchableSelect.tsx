import React, { useState, useRef, useEffect, useMemo } from 'react';

interface Option {
    value: string;
    label: string;
    createdAt?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    sortOption?: 'alpha' | 'recent';
    onSortChange?: (sort: 'alpha' | 'recent') => void;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    sortOption = 'recent',
    onSortChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value);

    const filteredOptions = useMemo(() => {
        let filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
        if (sortOption === 'alpha') {
            filtered = [...filtered].sort((a, b) => a.label.localeCompare(b.label));
        } else if (sortOption === 'recent') {
            filtered = [...filtered].sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
            });
        }
        return filtered;
    }, [options, search, sortOption]);

    return (
        <div className="searchable-select" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div
                className="searchable-select-control"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '10px 14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <span style={{ color: selectedOption ? '#1a1a1a' : '#777' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span>▼</span>
            </div>

            {isOpen && (
                <div
                    className="searchable-select-menu"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        maxHeight: '300px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <div style={{ padding: '12px', borderBottom: '1px solid #eee', display: 'flex', gap: '8px', background: '#fafafa' }}>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '10px 14px',
                                width: '100%',
                                fontSize: '0.95rem',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                background: '#fff'
                            }}
                            autoFocus
                        />
                        {onSortChange && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSortChange(sortOption === 'alpha' ? 'recent' : 'alpha');
                                }}
                                title={sortOption === 'alpha' ? 'Sort Alphabetically (A-Z)' : 'Sort by Latest Added'}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    background: '#fff',
                                    cursor: 'pointer',
                                    color: '#555',
                                    flexShrink: 0
                                }}
                            >
                                {sortOption === 'alpha' ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 10v-5.5a2.5 2.5 0 0 0 -5 0v5.5m0 -4h5" />
                                        <path d="M19 21h-9l9 -7h-9" />
                                        <path d="M4 15l3 3l3 -3" />
                                        <path d="M7 6v12" />
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                )}
                            </button>
                        )}
                    </div>
                    <div style={{ overflowY: 'auto' }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '8px 12px', color: '#888' }}>No results found</div>
                        ) : (
                            filteredOptions.map(option => (
                                <div
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        background: option.value === value ? '#f0f8ff' : 'transparent',
                                        color: option.value === value ? '#0056b3' : '#1a1a1a'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (option.value !== value) e.currentTarget.style.background = '#f9f9f9';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (option.value !== value) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    {option.label}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
