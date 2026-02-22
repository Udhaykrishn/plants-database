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

/** Build the proxy URL for an external image. Falls back to a direct CORS fetch. */
const API_BASE = 'http://localhost:8000/api/v1';

async function imgToDataUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;

    // Method 1: Via backend proxy (avoids all CORS / redirect issues)
    try {
        const proxyUrl = `${API_BASE}/proxy/image?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
            const blob = await res.blob();
            return await blobToDataUrl(blob);
        }
    } catch { /* fall through */ }

    // Method 2: Direct CORS fetch
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) {
            const blob = await res.blob();
            return await blobToDataUrl(blob);
        }
    } catch { /* fall through */ }

    // Method 3: Image element with crossOrigin (last resort)
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                c.getContext('2d')!.drawImage(img, 0, 0);
                resolve(c.toDataURL());
            } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onloadend = () => res(r.result as string);
        r.onerror = () => rej(null);
        r.readAsDataURL(blob);
    });
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
                            {/* Category sub-heading — tr gets same bg to avoid white flash */}
                            <tr key={`cat-${cat}`} style={{ backgroundColor: C.bg }}>
                                <td colSpan={5} style={{ padding: '12px 0 5px', backgroundColor: C.bg }}>
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
                            {pps.map((pp, rowIdx) => {
                                const p = pp.plant;
                                if (!p) return null;
                                serial += 1;
                                // Alternate per-category so first row of every group is always cream
                                const rowBg = rowIdx % 2 === 0 ? C.bg : C.white;
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
                                                {iconSrc
                                                    ? <img src={iconSrc} alt=""
                                                        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }} />
                                                    : null   /* no placeholder — avoids white rectangle */
                                                }
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

                                        {/* Placement pill — website's muted badge style */}
                                        <td style={TD}>
                                            {cleaning_place(p.planting_place) && (
                                                <span style={{
                                                    display: 'inline-block',
                                                    background: C.mutedBg,
                                                    color: C.mutedFg,
                                                    padding: '2px 9px', borderRadius: 999,
                                                    fontSize: 10.5, fontWeight: 700,
                                                    textTransform: 'uppercase' as const,
                                                    letterSpacing: '0.05em',
                                                    border: `1px solid ${C.border}`,
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
    const careEntries = Object.entries(p.care_data || {}).filter(([, v]) => v);

    // ── Outer div is EXACTLY A4 height with flex-column layout ──
    // The body section (flex:1) fills all remaining space after the header.
    // This means no whitespace at the bottom and no pixel distortion —
    // we distribute space via CSS, not by stretching the rendered bitmap.
    return (
        <div id={elementId} style={{
            position: 'absolute', left: '-9999px', top: 0,
            visibility: 'hidden', zIndex: -1,
            width: A4_W, height: A4_H,            // ← exact A4 pixels
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: C.bg,
            fontFamily: "'Inter', system-ui, sans-serif",
            WebkitFontSmoothing: 'antialiased',
            color: C.dark, lineHeight: '1.5',
            padding: '28px 36px',
            boxSizing: 'border-box',
            gap: 0,
        }}>

            {/* ── HEADER (fixed height, flexShrink:0) ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexShrink: 0 }}>

                {/* Left: icon + name + sci + pills */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        {iconSrc && (
                            <img src={iconSrc} alt="" style={{
                                width: 64, height: 64, objectFit: 'cover',
                                borderRadius: 10, border: `1px solid ${C.border}`,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.10)', flexShrink: 0,
                            }} />
                        )}
                        <div>
                            <h1 style={{ fontSize: 32, fontWeight: 700, color: C.dark, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                {p.common_name}
                            </h1>
                            <p style={{ fontSize: 13, fontStyle: 'italic', color: C.mutedFg, margin: '4px 0 0' }}>
                                {p.scientific_name || p.taxon?.name || 'Scientific Name Unknown'}
                            </p>
                        </div>
                    </div>

                    {/* Pills row */}
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                        {p.category && <Pill label={cleanVal(p.category)} emoji="🏷" />}
                        {cleaning_place(p.planting_place) && (
                            <Pill label={placement === 'INDOOR & OUTDOOR' ? 'Both' : placement} emoji="📍" />
                        )}
                    </div>

                    {/* Project notes */}
                    {pp.notes && (
                        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: C.primary, margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Project Notes</p>
                            <p style={{ fontSize: 12, color: C.dark, margin: 0 }}>{pp.notes}</p>
                        </div>
                    )}
                </div>

                {/* Hero image */}
                {heroSrc && (
                    <img src={heroSrc} alt={p.common_name} style={{
                        width: 270, height: 190, objectFit: 'cover',
                        borderRadius: 14, boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                        flexShrink: 0,
                    }} />
                )}
            </div>

            {/* ── DIVIDER ── */}
            <div style={{ borderTop: `1px solid ${C.border}`, margin: '14px 0', flexShrink: 0 }} />

            {/* ── BODY GRID — fills all remaining height (flex:1) ── */}
            <div style={{ flex: 1, display: 'flex', gap: 16, alignItems: 'stretch', minHeight: 0 }}>

                {/* MAIN column (7/12) — description grows, care grid fixed */}
                <div style={{ flex: 7, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Description — flex:1 so it expands to fill available height */}
                    <div style={{ ...CARD, flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <CardTitle emoji="📄" label="Description" />
                        <p style={{ fontSize: 12.5, lineHeight: '1.80', color: C.mutedFg, margin: 0, whiteSpace: 'pre-wrap', flex: 1 }}>
                            {p.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* Care 2×2 grid — fixed height */}
                    {careEntries.length > 0 && (
                        <div style={{ ...CARD, flexShrink: 0 }}>
                            <CardTitle emoji="🌱" label="Care Data" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {careEntries.map(([key, value]) => (
                                    <div key={key} style={{ background: C.mutedBg, borderRadius: 8, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: C.dark, marginBottom: 4 }}>
                                            {careIcon(key)} {key.replace(/_/g, ' ')}
                                        </div>
                                        <p style={{ fontSize: 12, lineHeight: '1.65', color: C.mutedFg, margin: 0 }}>
                                            {String(value)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* SIDE column (5/12) */}
                <div style={{ flex: 5, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Diseases (red) — fixed height */}
                    {p.common_diseases && (
                        <div style={{ ...CARD, flexShrink: 0, background: C.redBg, borderColor: C.redBorder }}>
                            <CardTitle emoji="🐛" label="Common Diseases & Pests" color={C.redTitle} borderColor={C.redBorder} />
                            <p style={{ fontSize: 12.5, lineHeight: '1.80', color: C.redBody, margin: 0, whiteSpace: 'pre-wrap' }}>
                                {p.common_diseases}
                            </p>
                        </div>
                    )}

                    {/* Taxonomy — flex:1 so it fills remaining side height */}
                    {taxPath && taxPath.length > 0 && (
                        <div style={{ ...CARD, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <CardTitle emoji="🌿" label="Taxonomy Lineage" />
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                {taxPath.map((t, i) => (
                                    <div key={t.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 0',
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
