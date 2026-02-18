export const Dashboard = () => {
    return (
        <div style={{ padding: '2rem' }}>
            <h1>Dashboard</h1>
            <p>Welcome to Landshaft Plants Database.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
                <div className="card" style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                    <h3>Taxonomy</h3>
                    <p>Manage the hierarchical classification of plants.</p>
                    <a href="/taxonomy">Go to Taxonomy</a>
                </div>
                <div className="card" style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                    <h3>Plants</h3>
                    <p>Manage species details and care information.</p>
                    <a href="/plants">Go to Plants</a>
                </div>
            </div>
        </div>
    );
};
