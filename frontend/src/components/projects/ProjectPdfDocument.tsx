/**
 * ProjectPdfDocument.tsx
 *
 * Hidden off-screen components rendered by html2canvas → jsPDF.
 * IMPORTANT: All styles are inline CSS (Tailwind is ignored by html2canvas).
 *
 * Layout:
 *   - pdf-cover-{projectId}  → inventory page (grouped by category, with icon)
 *   - pdf-plant-{plantId}    → one A4-sized page per plant (matches PlantDetails.tsx)
 */

import { useEffect, useState } from 'react';
import type { Project } from '../../types/project';
import type { TaxonTree } from '../../types/taxon';

// ─── Brand palette (exact from index.css) ────────────────────────────────────
const C = {
    bg: '#f4f0ea',   // warm cream
    dark: '#1c2a1a',   // near-black forest
    primary: '#2d5a27',   // dark forest green
    sage: '#8aa87f',   // sage green
    mutedBg: '#e4ddd1',   // warm beige
    mutedFg: '#6b7a6a',   // muted foreground
    border: '#d9d2c5',   // border
    white: '#ffffff',
    redBg: '#fff1f2',
    redBorder: '#fecdd3',
    redTitle: '#b91c1c',
    redBody: '#881337',
};

// A4 at 96 dpi: 794 × 1123 px
const A4_W = 794;
const A4_H = 1123;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip enum class prefix like "PlantingPlace.OUTDOOR" → "OUTDOOR" */
function cleanVal(val: string | null | undefined): string {
    if (!val) return '—';
    const v = String(val);
    return v.includes('.') ? v.split('.').pop()!.replace(/_/g, ' ') : v;
}

const CARE_ICONS: [string, string][] = [
    ['water', '💧'], ['sun', '☀️'], ['light', '☀️'], ['soil', '🌱'],
    ['maintenance', '⚙️'], ['fertiliz', '🌿'], ['humidity', '💦'],
    ['temp', '🌡️'], ['prun', '✂️'],
];
function careIcon(key: string) {
    const k = key.toLowerCase();
    return CARE_ICONS.find(([w]) => k.includes(w))?.[1] ?? '•';
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

/** Fetch an image URL and return a base64 data-URL (avoids CORS issues in html2canvas). */
async function imgToDataUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return null;
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

// ─── Pill / Badge component ───────────────────────────────────────────────────
function Pill({ label, emoji }: { label: string; emoji?: string }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: C.mutedBg, color: C.mutedFg,
            padding: '3px 11px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: '0.06em',
            whiteSpace: 'nowrap' as const,
        }}>
            {emoji && <span>{emoji}</span>}
            {label}
        </span>
    );
}

// ─── COVER PAGE ───────────────────────────────────────────────────────────────
interface CoverProps {
    project: Project;
    elementId: string;
    imgCache: Record<string, string>;   // plantId → icon base64
}

function ProjectPdfCover({ project, elementId, imgCache }: CoverProps) {
    // Group by category
    const groups = new Map<string, Project['plants']>();
    for (const pp of project.plants) {
        const cat = cleanVal(pp.plant?.category ?? 'Other');
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(pp);
    }

    let serial = 0;

    return (
        <div id={elementId} style={{
            position: 'absolute', left: '-9999px', top: 0,
            visibility: 'hidden', zIndex: -1,
            width: A4_W, minHeight: A4_H,
            backgroundColor: C.bg,
            fontFamily: "'Inter', system-ui, sans-serif",
            WebkitFontSmoothing: 'antialiased',
            color: C.dark, lineHeight: '1.6',
            padding: '36px 44px',
            boxSizing: 'border-box',
        }}>
            {/* Project header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 36, fontWeight: 700, color: C.dark, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                    {project.name}
                </h1>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' as const, marginBottom: 6 }}>
                    {project.client_name && (
                        <span style={{ fontSize: 13, color: C.mutedFg }}>
                            <b style={{ color: C.dark }}>Client:</b> {project.client_name}
                        </span>
                    )}
                    {project.location && (
                        <span style={{ fontSize: 13, color: C.mutedFg }}>
                            <b style={{ color: C.dark }}>Location:</b> {project.location}
                        </span>
                    )}
                </div>
                {project.description && (
                    <p style={{ fontSize: 12.5, color: C.mutedFg, margin: 0, lineHeight: '1.6' }}>
                        {project.description}
                    </p>
                )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: `2px solid ${C.primary}`, marginBottom: 18 }} />

            <h2 style={{ fontSize: 19, fontWeight: 700, color: C.primary, margin: '0 0 14px', letterSpacing: '-0.01em' }}>
                Project Inventory
            </h2>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                    <tr style={{ background: C.mutedBg }}>
                        <th style={TH}>#</th>
                        <th style={{ ...TH, textAlign: 'left' as const, paddingLeft: 8 }}>Plant</th>
                        <th style={{ ...TH, textAlign: 'left' as const }}>Scientific Name</th>
                        <th style={{ ...TH, textAlign: 'left' as const }}>Placement</th>
                        <th style={{ ...TH, textAlign: 'left' as const }}>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from(groups.entries()).map(([cat, pps]) => (
                        <>
                            {/* Category sub-heading */}
                            <tr key={`cat-${cat}`}>
                                <td colSpan={5} style={{ padding: '12px 0 5px', background: C.bg }}>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        borderLeft: `3px solid ${C.primary}`,
                                        paddingLeft: 10,
                                    }}>
                                        <span style={{
                                            fontSize: 11, fontWeight: 800,
                                            color: C.primary,
                                            textTransform: 'uppercase' as const,
                                            letterSpacing: '0.09em',
                                        }}>
                                            {cat}
                                        </span>
                                    </div>
                                </td>
                            </tr>

                            {/* Plant rows */}
                            {pps.map((pp) => {
                                const p = pp.plant;
                                if (!p) return null;
                                serial += 1;
                                const rowBg = serial % 2 === 0 ? C.white : C.bg;
                                const iconSrc = imgCache[p.id];
                                const placement = cleanVal(p.planting_place);

                                return (
                                    <tr key={pp.plant_id} style={{ background: rowBg }}>
                                        {/* # */}
                                        <td style={{ ...TD, width: 28, textAlign: 'center' as const, color: C.mutedFg, fontSize: 11 }}>
                                            {serial}
                                        </td>

                                        {/* Plant: icon + name */}
                                        <td style={{ ...TD, paddingLeft: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                {iconSrc ? (
                                                    <img src={iconSrc} alt=""
                                                        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }} />
                                                ) : (
                                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: C.mutedBg, border: `1px solid ${C.border}`, flexShrink: 0 }} />
                                                )}
                                                <span
                                                    data-plant-id={p.id}
                                                    style={{ fontWeight: 700, color: C.primary, textDecoration: 'underline', textUnderlineOffset: 2, fontSize: 13 }}
                                                >
                                                    {p.common_name}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Scientific */}
                                        <td style={{ ...TD, fontStyle: 'italic', color: C.mutedFg, fontSize: 12 }}>
                                            {p.scientific_name || p.taxon?.name || '—'}
                                        </td>

                                        {/* Placement pill */}
                                        <td style={TD}>
                                            {cleaning_place(p.planting_place) && (
                                                <span style={{
                                                    display: 'inline-block',
                                                    background: placement === 'INDOOR' ? '#e8f5e9' : '#e3f2fd',
                                                    color: placement === 'INDOOR' ? '#2e7d32' : '#1565c0',
                                                    padding: '2px 9px', borderRadius: 999,
                                                    fontSize: 10.5, fontWeight: 700,
                                                    textTransform: 'uppercase' as const,
                                                    letterSpacing: '0.05em',
                                                    border: `1px solid ${placement === 'INDOOR' ? '#c8e6c9' : '#bbdefb'}`,
                                                }}>
                                                    {placement === 'INDOOR & OUTDOOR' ? 'Both' : placement}
                                                </span>
                                            )}
                                        </td>

                                        {/* Notes */}
                                        <td style={{ ...TD, color: C.mutedFg, fontSize: 12 }}>
                                            {pp.notes || '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Helper: check if planting_place has a real value
function cleaning_place(val: unknown): boolean {
    if (!val) return false;
    const s = String(val);
    return s !== '' && s !== 'null' && s !== 'undefined';
}

const TH: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'center' as const,
    fontWeight: 700, fontSize: 10.5,
    color: C.primary, textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    borderBottom: `2px solid ${C.primary}`,
};
const TD: React.CSSProperties = {
    padding: '7px 10px', borderBottom: `1px solid ${C.border}`,
    verticalAlign: 'middle' as const,
};

// ─── PLANT DETAIL PAGE ────────────────────────────────────────────────────────
interface PlantPageProps {
    pp: Project['plants'][number];
    taxTree: TaxonTree[] | null | undefined;
    elementId: string;
    imgCache: Record<string, string>;   // cacheKey → base64 data-url
}

function ProjectPdfPlantPage({ pp, taxTree, elementId, imgCache }: PlantPageProps) {
    const p = pp.plant;
    if (!p) return null;

    const taxPath = taxTree && p.taxon?.id ? getTaxPath(taxTree, p.taxon.id) : null;
    const heroSrc = imgCache[`hero_${p.id}`];
    const iconSrc = imgCache[`icon_${p.id}`];
    const placement = cleanVal(p.planting_place);
    const hasRed = placement === 'INDOOR' ? 'green' : 'blue';

    // Care data entries
    const careEntries = Object.entries(p.care_data || {}).filter(([, v]) => v);

    return (
        <div id={elementId} style={{
            position: 'absolute', left: '-9999px', top: 0,
            visibility: 'hidden', zIndex: -1,
            width: A4_W, height: A4_H,       // ← fixed A4 height = single page
            overflow: 'hidden',
            backgroundColor: C.bg,
            fontFamily: "'Inter', system-ui, sans-serif",
            WebkitFontSmoothing: 'antialiased',
            color: C.dark, lineHeight: '1.5',
            padding: '28px 36px',
            boxSizing: 'border-box',
        }}>
            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 16 }}>

                {/* Left: icon + name + sci + pills */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        {iconSrc && (
                            <img src={iconSrc} alt="" style={{
                                width: 60, height: 60, objectFit: 'cover',
                                borderRadius: 10, border: `1px solid ${C.border}`,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)', flexShrink: 0,
                            }} />
                        )}
                        <div>
                            <h1 style={{ fontSize: 30, fontWeight: 700, color: C.dark, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                {p.common_name}
                            </h1>
                            <p style={{ fontSize: 13, fontStyle: 'italic', color: C.mutedFg, margin: '3px 0 0' }}>
                                {p.scientific_name || p.taxon?.name || 'Scientific Name Unknown'}
                            </p>
                        </div>
                    </div>

                    {/* Pills row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                        {p.category && <Pill label={cleanVal(p.category)} emoji="🏷" />}
                        {cleaning_place(p.planting_place) && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: placement === 'INDOOR' ? '#e8f5e9' : placement === 'OUTDOOR' ? '#e3f2fd' : C.mutedBg,
                                color: placement === 'INDOOR' ? '#2e7d32' : placement === 'OUTDOOR' ? '#1565c0' : C.mutedFg,
                                border: `1px solid ${placement === 'INDOOR' ? '#a5d6a7' : placement === 'OUTDOOR' ? '#90caf9' : C.border}`,
                                padding: '3px 11px', borderRadius: 999,
                                fontSize: 10.5, fontWeight: 700,
                                textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                            }}>
                                📍 {placement}
                            </span>
                        )}
                    </div>

                    {/* Project note */}
                    {pp.notes && (
                        <div style={{ marginTop: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: C.primary, margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Project Notes</p>
                            <p style={{ fontSize: 12, color: C.dark, margin: 0 }}>{pp.notes}</p>
                        </div>
                    )}
                </div>

                {/* Right: hero image */}
                {heroSrc && (
                    <img src={heroSrc} alt={p.common_name} style={{
                        width: 260, height: 180, objectFit: 'cover',
                        borderRadius: 14, boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                        flexShrink: 0,
                    }} />
                )}
            </div>

            {/* ── DIVIDER ── */}
            <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 14 }} />

            {/* ── BODY GRID (7:5) ── */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

                {/* MAIN col (7/12) */}
                <div style={{ flex: 7, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Description */}
                    <div style={CARD}>
                        <CardTitle emoji="📄" label="Description" />
                        <p style={{ fontSize: 12, lineHeight: '1.75', color: C.mutedFg, margin: 0, whiteSpace: 'pre-wrap' }}>
                            {p.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* Care 2×2 grid */}
                    {careEntries.length > 0 && (
                        <div style={CARD}>
                            <CardTitle emoji="🌱" label="Care Data" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {careEntries.map(([key, value]) => (
                                    <div key={key} style={{ background: C.mutedBg, borderRadius: 8, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: C.dark, marginBottom: 4 }}>
                                            {careIcon(key)} {key.replace(/_/g, ' ')}
                                        </div>
                                        <p style={{ fontSize: 11.5, lineHeight: '1.6', color: C.mutedFg, margin: 0 }}>
                                            {String(value)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* SIDE col (5/12) */}
                <div style={{ flex: 5, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Diseases (red) */}
                    {p.common_diseases && (
                        <div style={{ ...CARD, background: C.redBg, borderColor: C.redBorder }}>
                            <CardTitle emoji="🐛" label="Common Diseases & Pests" color={C.redTitle} borderColor={C.redBorder} />
                            <p style={{ fontSize: 12, lineHeight: '1.75', color: C.redBody, margin: 0, whiteSpace: 'pre-wrap' }}>
                                {p.common_diseases}
                            </p>
                        </div>
                    )}

                    {/* Taxonomy */}
                    {taxPath && taxPath.length > 0 && (
                        <div style={CARD}>
                            <CardTitle emoji="🌿" label="Taxonomy Lineage" />
                            {taxPath.map((t, i) => (
                                <div key={t.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '7px 0',
                                    borderBottom: i < taxPath.length - 1 ? `1px dashed ${C.border}` : 'none',
                                }}>
                                    <span style={{ fontSize: 9.5, textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontWeight: 700, color: C.mutedFg }}>
                                        {t.rank}
                                    </span>
                                    <span style={{ fontSize: 12.5, fontWeight: 500, color: C.dark }}>
                                        {t.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const CARD: React.CSSProperties = {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '14px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

function CardTitle({ emoji, label, color = C.dark, borderColor = C.border }: {
    emoji: string; label: string; color?: string; borderColor?: string;
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 13, fontWeight: 600, color,
            marginBottom: 10, paddingBottom: 9,
            borderBottom: `1px solid ${borderColor}`,
        }}>
            <span>{emoji}</span> {label}
        </div>
    );
}

// ─── CONTAINER (renders all hidden pages) ─────────────────────────────────────
interface ContainerProps {
    project: Project;
    taxTree: TaxonTree[] | null | undefined;
    projectId: string;
    onReady?: () => void;
}

export function ProjectPdfContainer({ project, taxTree, projectId, onReady }: ContainerProps) {
    // Preload all images as base64 to avoid CORS issues in html2canvas
    const [imgCache, setImgCache] = useState<Record<string, string>>({});
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!project?.plants?.length) { setReady(true); onReady?.(); return; }

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
            setReady(true);
            onReady?.();
        });
    }, [project]);

    if (!ready) return null;

    return (
        <>
            <ProjectPdfCover
                project={project}
                elementId={`pdf-cover-${projectId}`}
                imgCache={imgCache}
            />
            {project.plants.map((pp) =>
                pp.plant ? (
                    <ProjectPdfPlantPage
                        key={pp.plant_id}
                        pp={pp}
                        taxTree={taxTree}
                        elementId={`pdf-plant-${pp.plant_id}`}
                        imgCache={imgCache}
                    />
                ) : null
            )}
        </>
    );
}
