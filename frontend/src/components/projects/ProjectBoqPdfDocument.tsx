/**
 * ProjectBoqPdfDocument.tsx
 *
 * Generates a clean vector PDF of the Bill of Quantities (BOQ) using @react-pdf/renderer.
 */

import {
    Document,
    Page,
    View,
    Text,
    Image,
    StyleSheet,
    pdf,
    Svg,
    Path,
} from '@react-pdf/renderer';
import type { Project } from '../../types/project';

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
    bg: '#fbfaf8',
    dark: '#1a1a1a',
    primary: '#2d5a27',
    sage: '#5a7a4f',
    mutedBg: '#f0ede8',
    mutedFg: '#666666',
    border: '#e5e1d8',
    white: '#ffffff',
    rowAlt: '#f6f4f1',
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    page: {
        backgroundColor: C.bg,
        paddingHorizontal: 30,
        paddingVertical: 35,
        fontFamily: 'Helvetica',
        color: C.dark,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1.5,
        borderBottomColor: C.primary,
    },
    headerLeft: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontFamily: 'Helvetica-Bold',
        color: C.primary,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    metaGrid: {
        flexDirection: 'column',
        gap: 4,
    },
    metaItem: {
        fontSize: 10,
        color: C.mutedFg,
        lineHeight: 1.3,
    },
    metaBold: {
        fontFamily: 'Helvetica-Bold',
        color: C.dark,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        color: C.primary,
        letterSpacing: 2,
        marginTop: 3,
    },
    // Table
    tableHead: {
        flexDirection: 'row',
        backgroundColor: C.mutedBg,
        borderBottomWidth: 1.5,
        borderBottomColor: C.primary,
        alignItems: 'center',
        minHeight: 24,
    },
    th: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: C.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: C.border,
        minHeight: 36,
    },
    td: {
        fontSize: 9.5,
        color: C.dark,
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    tdMuted: {
        fontSize: 9,
        color: C.mutedFg,
        fontFamily: 'Helvetica-Oblique',
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    plantImg: {
        width: 26,
        height: 26,
        borderRadius: 5,
        objectFit: 'cover',
        borderWidth: 0.5,
        borderColor: C.border,
        marginVertical: 4,
        marginHorizontal: 4,
    },
    fallbackImg: {
        width: 26,
        height: 26,
        borderRadius: 5,
        backgroundColor: '#e5e7eb',
        borderWidth: 0.5,
        borderColor: C.border,
        marginVertical: 4,
        marginHorizontal: 4,
    },
    qtyTd: {
        fontSize: 9.5,
        fontFamily: 'Helvetica-Bold',
        color: C.dark,
        paddingVertical: 4,
        paddingHorizontal: 4,
    }
});

// ─── Column widths percentages (total must be 100%) ──────────────────────────
const COL = {
    num: '6%',
    img: '8%',
    common: '26%',
    sci: '24%',
    height: '18%',
    qty: '9%',
    unit: '9%',
};

interface BoqPdfProps {
    project: Project;
    imgCache: Record<string, string>;
    dateStr: string;
}

function ProjectBoqPdfDoc({ project, imgCache, dateStr }: BoqPdfProps) {
    return (
        <Document title={`${project.name} - Bill of Quantities`} author="Landschaft" creator="Landschaft Plants Database">
            <Page size="A4" style={s.page} wrap>
                {/* Header */}
                <View style={s.header}>
                    <View style={s.headerLeft}>
                        <Text style={s.title}>BILL OF QUANTITIES</Text>
                        <View style={s.metaGrid}>
                            <Text style={s.metaItem}>
                                <Text style={s.metaBold}>Project: </Text>{project.name}
                            </Text>
                            <Text style={s.metaItem}>
                                <Text style={s.metaBold}>Client: </Text>{project.client_name || '—'}
                            </Text>
                            <Text style={s.metaItem}>
                                <Text style={s.metaBold}>Location: </Text>{project.location || '—'}
                            </Text>
                            <Text style={s.metaItem}>
                                <Text style={s.metaBold}>Date: </Text>{dateStr}
                            </Text>
                        </View>
                    </View>
                    
                    {/* Landschaft Logo */}
                    <View style={s.logoContainer}>
                        <Svg width="42" height="42" viewBox="0 0 400 400">
                            <Path fill="#2d5a27" d="M125 70 Q125 40 155 40 H245 Q275 40 275 70 V190 H125 Z" />
                            <Path fill="#5a7a4f" d="M125 210 H275 V360 H155 Q125 360 125 330 V210 Z" />
                            <Path fill="#e5e1d8" d="M295 210 H415 Q445 210 445 240 V330 Q445 360 415 360 H295 V210 Z" />
                        </Svg>
                        <Text style={s.logoText}>LANDSCHAFT</Text>
                    </View>
                </View>

                {/* Table Headers */}
                <View style={s.tableHead} fixed>
                    <Text style={[s.th, { width: COL.num, textAlign: 'center' }]}>#</Text>
                    <Text style={[s.th, { width: COL.img, textAlign: 'center' }]}>Img</Text>
                    <Text style={[s.th, { width: COL.common }]}>Common Name</Text>
                    <Text style={[s.th, { width: COL.sci }]}>Scientific Name</Text>
                    <Text style={[s.th, { width: COL.height }]}>Optimum Height/Size</Text>
                    <Text style={[s.th, { width: COL.qty, textAlign: 'right' }]}>Qty</Text>
                    <Text style={[s.th, { width: COL.unit }]}>Unit</Text>
                </View>

                {/* Table Rows */}
                {project.plants.length === 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: C.mutedFg }}>No plants added to this project.</Text>
                    </View>
                ) : (
                    project.plants.map((pp, rowIdx) => {
                        const p = pp.plant;
                        if (!p) return null;
                        const rowBg = rowIdx % 2 === 0 ? C.white : C.rowAlt;
                        const imgUrl = imgCache[p.id] || imgCache[`icon_${p.id}`] || p.icon_url;

                        return (
                            <View key={pp.plant_id} style={[s.tableRow, { backgroundColor: rowBg }]} wrap={false}>
                                <Text style={[s.td, { width: COL.num, textAlign: 'center', fontSize: 9 }]}>
                                    {rowIdx + 1}
                                </Text>
                                <View style={{ width: COL.img, alignItems: 'center', justifyContent: 'center' }}>
                                    {imgUrl ? (
                                        <Image src={imgUrl} style={s.plantImg} />
                                    ) : (
                                        <View style={s.fallbackImg} />
                                    )}
                                </View>
                                <Text style={[s.td, { width: COL.common, fontFamily: 'Helvetica-Bold', color: C.primary }]}>
                                    {p.common_name}
                                </Text>
                                <Text style={[s.tdMuted, { width: COL.sci }]}>
                                    {p.scientific_name || p.taxon?.name || '—'}
                                </Text>
                                <Text style={[s.td, { width: COL.height }]}>
                                    {pp.optimum_height_size || '—'}
                                </Text>
                                <Text style={[s.qtyTd, { width: COL.qty, textAlign: 'right' }]}>
                                    {pp.quantity !== undefined && pp.quantity !== null ? pp.quantity : '—'}
                                </Text>
                                <Text style={[s.td, { width: COL.unit, color: C.mutedFg }]}>
                                    {pp.unit || '—'}
                                </Text>
                            </View>
                        );
                    })
                )}
            </Page>
        </Document>
    );
}

// ─── Export utility ───────────────────────────────────────────────────────────
export async function exportProjectBoqPdf(
    project: Project,
    imgCache: Record<string, string>,
    filename: string,
): Promise<void> {
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const doc = <ProjectBoqPdfDoc project={project} imgCache={imgCache} dateStr={dateStr} />;
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_BOQ.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
}
