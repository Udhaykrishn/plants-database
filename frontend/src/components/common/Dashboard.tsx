import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Leaf, ListTree, Tags, FolderKanban, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { plantsApi } from '../../api/plants';
import { taxonomyApi } from '../../api/taxonomy';
import { categoriesApi } from '../../api/categories';
import { projectsApi } from '../../api/projects';

const StatCard = ({
    title,
    value,
    icon: Icon,
    to,
    color,
}: {
    title: string;
    value?: number | string;
    icon: React.ElementType;
    to: string;
    color: string;
}) => (
    <Link to={to} className="group block">
        <Card className="border border-border hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${color}`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-semibold tracking-tight text-foreground mb-1">
                    {value ?? <span className="text-muted-foreground text-xl">—</span>}
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-primary flex items-center gap-1 transition-colors">
                    View all <ArrowRight className="w-3 h-3" />
                </span>
            </CardContent>
        </Card>
    </Link>
);

export const Dashboard = () => {
    const { data: plants } = useQuery({ queryKey: ['plants'], queryFn: () => plantsApi.getAll() });
    const { data: tree } = useQuery({ queryKey: ['taxonomy', 'tree'], queryFn: () => taxonomyApi.getTree() });
    const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.getAll() });
    const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: () => projectsApi.getAll() });

    const taxonCount = tree
        ? (() => {
            let count = 0;
            const walk = (nodes: typeof tree) => nodes.forEach(n => { count++; walk(n.children || []); });
            walk(tree);
            return count;
        })()
        : undefined;

    return (
        <div>
            {/* Page header */}
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Welcome to the Landschaft Plants Database.
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <StatCard
                    title="Total Plants"
                    value={plants?.length}
                    icon={Leaf}
                    to="/plants"
                    color="bg-primary"
                />
                <StatCard
                    title="Taxonomy Nodes"
                    value={taxonCount}
                    icon={ListTree}
                    to="/taxonomy"
                    color="bg-secondary"
                />
                <StatCard
                    title="Categories"
                    value={categories?.length}
                    icon={Tags}
                    to="/categories"
                    color="bg-accent"
                />
                <StatCard
                    title="Projects"
                    value={projects?.length}
                    icon={FolderKanban}
                    to="/projects"
                    color="bg-primary"
                />
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                    { title: 'Plant Catalog', desc: 'Browse and manage species details and care information.', to: '/plants', icon: Leaf },
                    { title: 'Taxonomy', desc: 'Manage the hierarchical classification of plants.', to: '/taxonomy', icon: ListTree },
                    { title: 'Categories', desc: 'Organise plants into custom categories.', to: '/categories', icon: Tags },
                    { title: 'Projects', desc: 'Track landscape planning and design projects.', to: '/projects', icon: FolderKanban },
                ].map(({ title, desc, to, icon: Icon }) => (
                    <Link to={to} key={to} className="group">
                        <Card className="border border-border hover:border-primary/40 hover:shadow-md transition-all duration-200 h-full">
                            <CardContent className="flex items-start gap-4 pt-5">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0 group-hover:bg-primary/10 transition-colors">
                                    <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                    <p className="font-medium text-foreground text-sm">{title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary ml-auto self-center transition-colors" />
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
};
