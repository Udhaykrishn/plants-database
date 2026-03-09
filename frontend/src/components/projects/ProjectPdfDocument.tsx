/**
 * ProjectPdfDocument.tsx
 *
 * Generates a real vector PDF using @react-pdf/renderer.
 * - Text is selectable / copyable
 * - File size is dramatically smaller than the html2canvas bitmap approach
 * - Layout matches the original design
 */

import { useEffect, useState } from 'react';
import {
    Document,
    Page,
    View,
    Text,
    Image,
    StyleSheet,
    pdf,
} from '@react-pdf/renderer';
import type { Project } from '../../types/project';
import type { TaxonTree } from '../../types/taxon';

// ─── Register fonts ───────────────────────────────────────────────────────────
// Using built-in Helvetica so no external font download is needed.
// If you have Inter woff2 hosted, you can register it here instead.

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
    bg: '#f4f0ea',
    dark: '#1c2a1a',
    primary: '#2d5a27',
    sage: '#8aa87f',
    mutedBg: '#e4ddd1',
    mutedFg: '#6b7a6a',
    border: '#d9d2c5',
    white: '#ffffff',
    rowAlt: '#faf8f5',
    redBg: '#fff1f2',
    redBorder: '#fecdd3',
    redTitle: '#b91c1c',
    redBody: '#881337',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cleanVal(val: string | null | undefined): string {
    if (!val) return '—';
    const v = String(val);
    return v.includes('.') ? v.split('.').pop()!.replace(/_/g, ' ') : v;
}

function cleaningPlace(val: unknown): boolean {
    if (!val) return false;
    const s = String(val);
    return s !== '' && s !== 'null' && s !== 'undefined';
}

function getTaxPath(nodes: TaxonTree[], id: string, path: TaxonTree[] = []): TaxonTree[] | null {
    for (const n of nodes) {
        const p = [...path, n];
        if (n.id === id) return p;
        if (n.children?.length) {
            const f = getTaxPath(n.children, id, p);
            if (f) return f;
        }
    }
    return null;
}

const API_BASE = 'http://localhost:8000/api/v1';

async function imgToDataUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    try {
        const proxyUrl = `${API_BASE}/proxy/image?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
            const blob = await res.blob();
            return await blobToDataUrl(blob);
        }
    } catch { /* fall through */ }
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) {
            const blob = await res.blob();
            return await blobToDataUrl(blob);
        }
    } catch { /* fall through */ }
    return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onloadend = () => res(r.result as string);
        r.onerror = () => rej(null);
        r.readAsDataURL(blob);
    });
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    page: {
        backgroundColor: C.bg,
        paddingHorizontal: 36,
        paddingVertical: 30,
        fontFamily: 'Helvetica',
        color: C.dark,
    },

    // ── Cover ──
    coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 5, letterSpacing: -0.5 },
    coverMeta: { flexDirection: 'row', gap: 20, marginBottom: 4 },
    coverMetaText: { fontSize: 11, color: C.mutedFg },
    coverMetaBold: { fontFamily: 'Helvetica-Bold', color: C.dark },
    coverDesc: { fontSize: 10.5, color: C.mutedFg, lineHeight: 1.6, marginTop: 2 },
    divider: { borderBottomWidth: 1.5, borderBottomColor: C.primary, marginVertical: 12 },
    sectionTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.primary, marginBottom: 10, letterSpacing: -0.3 },

    // ── Table ──
    tableHead: { flexDirection: 'row', backgroundColor: C.mutedBg, borderBottomWidth: 1.5, borderBottomColor: C.primary },
    th: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.5, paddingVertical: 6, paddingHorizontal: 6 },
    catRow: { paddingVertical: 8, paddingBottom: 3, borderLeftWidth: 3, borderLeftColor: C.primary, paddingLeft: 8, marginTop: 4 },
    catLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.primary, textTransform: 'uppercase', letterSpacing: 1 },
    tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: C.border },
    td: { fontSize: 10.5, color: C.dark, paddingVertical: 6, paddingHorizontal: 6 },
    tdMuted: { fontSize: 10.5, color: C.mutedFg, paddingVertical: 6, paddingHorizontal: 6 },
    pill: { backgroundColor: C.mutedBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5, borderWidth: 0.5, borderColor: C.border, alignSelf: 'flex-start' },
    pillText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.mutedFg, textTransform: 'uppercase', letterSpacing: 0.6 },

    // ── Plant page ──
    plantPage: {
        backgroundColor: C.bg,
        paddingHorizontal: 30,
        paddingVertical: 26,
        fontFamily: 'Helvetica',
        color: C.dark,
        flex: 1,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 },
    headerLeft: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    iconImg: { width: 52, height: 52, borderRadius: 8, objectFit: 'cover', borderWidth: 0.5, borderColor: C.border },
    plantName: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: C.dark, letterSpacing: -0.5, lineHeight: 1.1 },
    sciName: { fontSize: 11, color: C.mutedFg, marginTop: 2 },
    pillsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
    notesBox: { backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, borderRadius: 6, padding: 8, marginTop: 2 },
    notesLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
    notesText: { fontSize: 10.5, color: C.dark },
    heroImg: { width: 210, height: 148, borderRadius: 10, objectFit: 'cover' },
    dividerThin: { borderBottomWidth: 0.5, borderBottomColor: C.border, marginVertical: 10 },
    bodyGrid: { flex: 1, flexDirection: 'row', gap: 12 },
    mainCol: { flex: 7, flexDirection: 'column', gap: 10 },
    sideCol: { flex: 5, flexDirection: 'column', gap: 10 },
    card: { backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, borderRadius: 8, padding: 12 },
    cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8, paddingBottom: 7, borderBottomWidth: 0.5, borderBottomColor: C.border },
    cardTitleText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.dark },
    bodyText: { fontSize: 10.5, color: C.mutedFg, lineHeight: 1.7 },
    careGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    careItem: { backgroundColor: C.mutedBg, borderRadius: 6, padding: 8, width: '48%' },
    careKey: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, color: C.dark, marginBottom: 3 },
    careVal: { fontSize: 10, color: C.mutedFg, lineHeight: 1.5 },
    redCard: { backgroundColor: C.redBg, borderWidth: 0.5, borderColor: C.redBorder, borderRadius: 8, padding: 12 },
    redTitle: { color: C.redTitle },
    redBody: { fontSize: 10.5, color: C.redBody, lineHeight: 1.7 },
    taxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: C.border },
    taxRank: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, color: C.mutedFg },
    taxName: { fontSize: 10.5, fontFamily: 'Helvetica', color: C.dark },
});

// ─── COVER PAGE ───────────────────────────────────────────────────────────────
interface CoverProps {
    project: Project;
    imgCache: Record<string, string>;
}

function CoverPage({ project, imgCache }: CoverProps) {
    const groups = new Map<string, Project['plants']>();
    for (const pp of project.plants) {
        const cat = cleanVal(pp.plant?.category ?? 'Other');
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(pp);
    }
    let serial = 0;

    // Column widths (sum = 100%)
    const COL = { num: '6%', name: '28%', sci: '24%', place: '16%', notes: '26%' };

    return (
        <Page size="A4" style={s.page} wrap>
            {/* Header */}
            <Text style={s.coverTitle}>{project.name}</Text>
            <View style={s.coverMeta}>
                {project.client_name && (
                    <Text style={s.coverMetaText}>
                        <Text style={s.coverMetaBold}>Client: </Text>{project.client_name}
                    </Text>
                )}
                {project.location && (
                    <Text style={s.coverMetaText}>
                        <Text style={s.coverMetaBold}>Location: </Text>{project.location}
                    </Text>
                )}
            </View>
            {project.description && (
                <Text style={s.coverDesc}>{project.description}</Text>
            )}
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Project Inventory</Text>

            {/* Table header */}
            <View style={s.tableHead}>
                <Text style={[s.th, { width: COL.num, textAlign: 'center' }]}>#</Text>
                <Text style={[s.th, { width: COL.name }]}>Plant</Text>
                <Text style={[s.th, { width: COL.sci }]}>Scientific Name</Text>
                <Text style={[s.th, { width: COL.place }]}>Placement</Text>
                <Text style={[s.th, { width: COL.notes }]}>Notes</Text>
            </View>

            {/* Rows */}
            {Array.from(groups.entries()).map(([cat, pps]) => (
                <View key={cat}>
                    {/* Category heading */}
                    <View style={{ paddingVertical: 6, paddingBottom: 2 }}>
                        <View style={s.catRow}>
                            <Text style={s.catLabel}>{cat}</Text>
                        </View>
                    </View>

                    {pps.map((pp, rowIdx) => {
                        const p = pp.plant;
                        if (!p) return null;
                        serial += 1;
                        const rowBg = rowIdx % 2 === 0 ? C.bg : C.rowAlt;
                        const iconSrc = imgCache[p.id];
                        const placement = cleanVal(p.planting_place);

                        return (
                            <View key={pp.plant_id} style={[s.tableRow, { backgroundColor: rowBg }]}>
                                {/* # */}
                                <Text style={[s.tdMuted, { width: COL.num, textAlign: 'center', fontSize: 9 }]}>{serial}</Text>

                                {/* Plant name + icon */}
                                <View style={{ width: COL.name, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 6 }}>
                                    {iconSrc && (
                                        <Image src={iconSrc} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                                    )}
                                    <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.primary, flex: 1 }}>
                                        {p.common_name}
                                    </Text>
                                </View>

                                {/* Scientific */}
                                <Text style={[s.tdMuted, { width: COL.sci, fontSize: 9.5 }]}>
                                    {p.scientific_name || p.taxon?.name || '—'}
                                </Text>

                                {/* Placement */}
                                <View style={{ width: COL.place, paddingVertical: 5, paddingHorizontal: 6 }}>
                                    {cleaningPlace(p.planting_place) && (
                                        <View style={s.pill}>
                                            <Text style={s.pillText}>
                                                {placement === 'INDOOR & OUTDOOR' ? 'Both' : placement}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Notes */}
                                <Text style={[s.tdMuted, { width: COL.notes, fontSize: 9.5 }]}>{pp.notes || '—'}</Text>
                            </View>
                        );
                    })}
                </View>
            ))}
        </Page>
    );
}

// ─── PLANT DETAIL PAGE ────────────────────────────────────────────────────────
interface PlantPageProps {
    pp: Project['plants'][number];
    taxTree: TaxonTree[] | null | undefined;
    imgCache: Record<string, string>;
}

function PlantDetailPage({ pp, taxTree, imgCache }: PlantPageProps) {
    const p = pp.plant;
    if (!p) return null;

    const taxPath = taxTree && p.taxon?.id ? getTaxPath(taxTree, p.taxon.id) : null;
    const heroSrc = imgCache[`hero_${p.id}`];
    const iconSrc = imgCache[`icon_${p.id}`];
    const placement = cleanVal(p.planting_place);
    const careEntries = Object.entries(p.care_data || {}).filter(([, v]) => v);

    return (
        <Page size="A4" style={s.plantPage}>
            {/* Header */}
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <View style={s.nameRow}>
                        {iconSrc && <Image src={iconSrc} style={s.iconImg} />}
                        <View style={{ flex: 1 }}>
                            <Text style={s.plantName}>{p.common_name}</Text>
                            <Text style={s.sciName}>
                                {p.scientific_name || p.taxon?.name || 'Scientific Name Unknown'}
                            </Text>
                        </View>
                    </View>

                    {/* Pills */}
                    <View style={s.pillsRow}>
                        {p.category && (
                            <View style={s.pill}>
                                <Text style={s.pillText}>🏷 {cleanVal(p.category)}</Text>
                            </View>
                        )}
                        {cleaningPlace(p.planting_place) && (
                            <View style={s.pill}>
                                <Text style={s.pillText}>
                                    📍 {placement === 'INDOOR & OUTDOOR' ? 'Both' : placement}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Project notes */}
                    {pp.notes && (
                        <View style={s.notesBox}>
                            <Text style={s.notesLabel}>Project Notes</Text>
                            <Text style={s.notesText}>{pp.notes}</Text>
                        </View>
                    )}
                </View>

                {/* Hero image */}
                {heroSrc && <Image src={heroSrc} style={s.heroImg} />}
            </View>

            <View style={s.dividerThin} />

            {/* Body grid */}
            <View style={s.bodyGrid}>
                {/* Main column */}
                <View style={s.mainCol}>
                    {/* Description */}
                    <View style={[s.card, { flex: 1 }]}>
                        <View style={s.cardTitle}>
                            <Text style={s.cardTitleText}>📄 Description</Text>
                        </View>
                        <Text style={s.bodyText}>
                            {p.description || 'No description provided.'}
                        </Text>
                    </View>

                    {/* Care data */}
                    {careEntries.length > 0 && (
                        <View style={s.card}>
                            <View style={s.cardTitle}>
                                <Text style={s.cardTitleText}>🌱 Care Data</Text>
                            </View>
                            <View style={s.careGrid}>
                                {careEntries.map(([key, value]) => (
                                    <View key={key} style={s.careItem}>
                                        <Text style={s.careKey}>{key.replace(/_/g, ' ')}</Text>
                                        <Text style={s.careVal}>{String(value)}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Side column */}
                <View style={s.sideCol}>
                    {/* Diseases */}
                    {p.common_diseases && (
                        <View style={s.redCard}>
                            <View style={[s.cardTitle, { borderBottomColor: C.redBorder }]}>
                                <Text style={[s.cardTitleText, s.redTitle]}>🐛 Common Diseases & Pests</Text>
                            </View>
                            <Text style={s.redBody}>{p.common_diseases}</Text>
                        </View>
                    )}

                    {/* Taxonomy */}
                    {taxPath && taxPath.length > 0 && (
                        <View style={[s.card, { flex: 1 }]}>
                            <View style={s.cardTitle}>
                                <Text style={s.cardTitleText}>🌿 Taxonomy Lineage</Text>
                            </View>
                            {taxPath.map((t, i) => (
                                <View key={t.id} style={[s.taxRow, i === taxPath.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                                    <Text style={s.taxRank}>{t.rank}</Text>
                                    <Text style={s.taxName}>{t.name}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </Page>
    );
}

// ─── ROOT PDF DOCUMENT ────────────────────────────────────────────────────────
interface PdfDocProps {
    project: Project;
    taxTree: TaxonTree[] | null | undefined;
    imgCache: Record<string, string>;
}

function ProjectPdfDoc({ project, taxTree, imgCache }: PdfDocProps) {
    return (
        <Document title={project.name} author="Landschaft" creator="Landschaft Plants Database">
            <CoverPage project={project} imgCache={imgCache} />
            {project.plants.map((pp) =>
                pp.plant ? (
                    <PlantDetailPage key={pp.plant_id} pp={pp} taxTree={taxTree} imgCache={imgCache} />
                ) : null
            )}
        </Document>
    );
}

// ─── Export utility ───────────────────────────────────────────────────────────
export async function exportProjectPdfNew(
    project: Project,
    taxTree: TaxonTree[] | null | undefined,
    imgCache: Record<string, string>,
    filename: string,
): Promise<void> {
    const doc = <ProjectPdfDoc project={project} taxTree={taxTree} imgCache={imgCache} />;
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── CONTAINER (manages image caching + triggers export) ──────────────────────
interface ContainerProps {
    project: Project;
    taxTree: TaxonTree[] | null | undefined;
    projectId: string;
    onReady?: () => void;
}

/**
 * Kept as a passthrough component so ProjectDetails.tsx still renders it.
 * It pre-loads images into the cache and signals readiness.
 */
export function ProjectPdfContainer({ project, taxTree, projectId: _projectId, onReady }: ContainerProps) {
    const [imgCache, setImgCache] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!project?.plants?.length) { onReady?.(); return; }

        const urls: Array<{ key: string; url: string }> = [];
        for (const pp of project.plants) {
            const p = pp.plant;
            if (!p) continue;
            if (p.icon_url) urls.push({ key: p.id, url: p.icon_url });
            if (p.image_url) urls.push({ key: `hero_${p.id}`, url: p.image_url });
            if (p.icon_url) urls.push({ key: `icon_${p.id}`, url: p.icon_url });
        }

        Promise.all(
            urls.map(({ key, url }) => imgToDataUrl(url).then(data => ({ key, data })))
        ).then(results => {
            const cache: Record<string, string> = {};
            for (const { key, data } of results) {
                if (data) cache[key] = data;
            }
            setImgCache(cache);
            onReady?.();
        });
    }, [project]);

    // Store cache on a ref accessible by the export trigger
    // We expose the generate function through a custom event so ProjectDetails
    // doesn't need a major refactor.
    useEffect(() => {
        const handler = async (e: Event) => {
            const { filename } = (e as CustomEvent).detail;
            await exportProjectPdfNew(project, taxTree, imgCache, filename);
        };
        window.addEventListener('trigger-pdf-export', handler);
        return () => window.removeEventListener('trigger-pdf-export', handler);
    }, [project, taxTree, imgCache]);

    return null; // No DOM output needed
}
