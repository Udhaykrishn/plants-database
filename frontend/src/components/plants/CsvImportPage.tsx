import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ioApi } from '../../api/io';
import { useAlert } from '../../contexts/AlertContext';
import { Button } from '@/components/ui/button';
import { cn } from '../../lib-frontend/utils';
import {
    ArrowLeft, Upload, FileUp, Loader2, Trash2, Plus,
    AlertCircle, ChevronRight, Info, X, ImageOff, ZoomIn,
} from 'lucide-react';

// ── Field config ─────────────────────────────────────────────────────────────
const ALL_FIELDS: { key: string; label: string; width: string; required?: boolean; isImage?: boolean }[] = [
    { key: 'common_name', label: 'Common Name', width: '160px', required: true },
    { key: 'scientific_name', label: 'Scientific Name', width: '160px' },
    { key: 'category', label: 'Category', width: '120px' },
    { key: 'planting_place', label: 'Planting Place', width: '130px' },
    { key: 'kingdom', label: 'Kingdom', width: '110px', required: true },
    { key: 'division', label: 'Division', width: '110px' },
    { key: 'class', label: 'Class', width: '110px' },
    { key: 'order', label: 'Order', width: '110px' },
    { key: 'family', label: 'Family', width: '110px' },
    { key: 'genus', label: 'Genus', width: '110px' },
    { key: 'species', label: 'Species', width: '110px', required: true },
    { key: 'description', label: 'Description', width: '200px' },
    { key: 'common_diseases', label: 'Diseases', width: '180px' },
    { key: 'care_water', label: 'Water', width: '140px' },
    { key: 'care_sunlight', label: 'Sunlight', width: '140px' },
    { key: 'care_soil', label: 'Soil', width: '140px' },
    { key: 'care_maintenance', label: 'Maintenance', width: '140px' },
    { key: 'icon_url', label: 'Icon URL', width: '200px', isImage: true },
    { key: 'image_url', label: 'Image URL', width: '200px', isImage: true },
];

const BLANK_ROW = (): Record<string, string> =>
    Object.fromEntries(ALL_FIELDS.map(f => [f.key, '']));

type Stage = 'upload' | 'edit';

// ── Inline image thumbnail cell ───────────────────────────────────────────────
const ImageCell = ({
    url,
    fieldKey,
    rowIdx,
    onChange,
    onZoom,
    fieldWidth,
}: {
    url: string;
    fieldKey: string;
    rowIdx: number;
    onChange: (rowIdx: number, key: string, val: string) => void;
    onZoom: (url: string, label: string) => void;
    fieldWidth: string;
}) => {
    const [imgError, setImgError] = useState(false);
    const hasUrl = url.trim().startsWith('http');

    // Reset error state when url changes
    const handleUrlChange = (val: string) => {
        setImgError(false);
        onChange(rowIdx, fieldKey, val);
    };

    return (
        <div className="flex flex-col h-full" style={{ minWidth: fieldWidth }}>
            {/* Thumbnail */}
            <div className="relative w-full border-b border-border/50 bg-muted/20" style={{ height: '60px' }}>
                {hasUrl && !imgError ? (
                    <>
                        <img
                            src={url}
                            alt=""
                            onError={() => setImgError(true)}
                            className="w-full h-full object-cover"
                        />
                        {/* Zoom overlay */}
                        <button
                            onClick={() => onZoom(url, fieldKey === 'icon_url' ? 'Icon' : 'Image')}
                            className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors group"
                            title="Enlarge preview"
                        >
                            <ZoomIn
                                size={18}
                                className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
                            />
                        </button>
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        {hasUrl && imgError
                            ? <ImageOff size={16} className="text-red-400" />
                            : <div className="w-5 h-5 rounded-full bg-muted-foreground/10 border border-border/40" />
                        }
                    </div>
                )}
            </div>
            {/* URL input */}
            <textarea
                value={url}
                onChange={e => handleUrlChange(e.target.value)}
                rows={1}
                className={cn(
                    'flex-1 w-full px-2 py-1.5 text-xs bg-transparent resize-none',
                    'focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-primary/3',
                    'placeholder:text-muted-foreground/30 transition-colors',
                    'min-h-[32px]'
                )}
                style={{ maxHeight: '60px' }}
                placeholder="https://…"
            />
        </div>
    );
};

// ── Lightbox overlay ──────────────────────────────────────────────────────────
const Lightbox = ({ url, label, onClose }: { url: string; label: string; onClose: () => void }) => (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
    >
        <div
            className="relative max-w-3xl max-h-[85vh] m-4"
            onClick={e => e.stopPropagation()}
        >
            <button
                onClick={onClose}
                className="absolute -top-3 -right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white text-foreground shadow-lg hover:bg-muted transition-colors"
            >
                <X size={14} />
            </button>
            <div className="rounded-xl overflow-hidden shadow-2xl bg-muted border border-border/20">
                <div className="px-3 py-2 bg-muted/80 border-b border-border/40 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                </div>
                <img
                    src={url}
                    alt={label}
                    className="block max-w-full max-h-[75vh] object-contain"
                />
                <div className="px-3 py-1.5 border-t border-border/40">
                    <p className="text-[10px] text-muted-foreground truncate">{url}</p>
                </div>
            </div>
        </div>
    </div>
);

export const CsvImportPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showAlert } = useAlert();

    const [stage, setStage] = useState<Stage>('upload');
    const [isDragOver, setIsDragOver] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [fileName, setFileName] = useState('');
    const [parseErrors, setParseErrors] = useState<string[]>([]);

    // The editable rows
    const [rows, setRows] = useState<Record<string, string>[]>([BLANK_ROW()]);

    // Lightbox state
    const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

    // ── File handling ──────────────────────────────────────────────────────
    const processFile = useCallback(async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showAlert('Please upload a valid .csv file.', 'error');
            return;
        }
        setIsPreviewing(true);
        try {
            const result = await ioApi.previewCsv(file);
            setFileName(file.name);
            setParseErrors(result.errors);
            setRows(result.rows.length > 0 ? result.rows : [BLANK_ROW()]);
            setStage('edit');
        } catch (err: any) {
            showAlert('Could not parse CSV: ' + (err.response?.data?.detail || err.message), 'error');
        } finally {
            setIsPreviewing(false);
        }
    }, [showAlert]);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) await processFile(file);
    }, [processFile]);

    const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processFile(file);
    }, [processFile]);

    // ── Row editing ───────────────────────────────────────────────────────
    const updateCell = (rowIdx: number, key: string, value: string) => {
        setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [key]: value } : r));
    };

    const addRow = () => setRows(prev => [...prev, BLANK_ROW()]);

    const deleteRow = (idx: number) =>
        setRows(prev => prev.length === 1 ? [BLANK_ROW()] : prev.filter((_, i) => i !== idx));

    // ── Import ────────────────────────────────────────────────────────────
    const handleImport = async () => {
        const nonEmpty = rows.filter(r => r.common_name?.trim() || r.species?.trim());
        if (nonEmpty.length === 0) {
            showAlert('No plants to import. Fill in at least one row.', 'warning');
            return;
        }
        setIsImporting(true);
        try {
            const result = await ioApi.importRows(nonEmpty);
            showAlert(
                `Import complete! ✓ ${result.success} added${result.failed ? `, ✗ ${result.failed} failed` : ''}.`,
                'success'
            );
            queryClient.invalidateQueries({ queryKey: ['plants'] });
            queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
            navigate('/plants');
        } catch (err: any) {
            showAlert('Import failed: ' + (err.response?.data?.detail || err.message), 'error');
        } finally {
            setIsImporting(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <>
            {/* ── Lightbox ──────────────────────────────────────────────── */}
            {lightbox && (
                <Lightbox
                    url={lightbox.url}
                    label={lightbox.label}
                    onClose={() => setLightbox(null)}
                />
            )}

            <div className="flex flex-col h-full min-h-[calc(100vh-8rem)]">

                {/* ── Page header ─────────────────────────────────────────── */}
                <div className="flex items-center gap-3 mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/plants')}
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft size={15} />
                        Plants
                    </Button>
                    <ChevronRight size={14} className="text-muted-foreground/50" />
                    <span className="text-sm font-medium text-foreground">
                        {stage === 'upload' ? 'Import from CSV' : (
                            <span className="flex items-center gap-2">
                                Import Preview
                                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    {rows.filter(r => r.common_name?.trim()).length} plants
                                </span>
                            </span>
                        )}
                    </span>
                </div>

                {/* ══════════════════════════════════════════════════════════ */}
                {/* STAGE 1: Upload                                            */}
                {/* ══════════════════════════════════════════════════════════ */}
                {stage === 'upload' && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-2xl mx-auto w-full">
                        <div className="w-full space-y-2 text-center">
                            <h1 className="text-2xl font-bold text-foreground">Import Plants from CSV</h1>
                            <p className="text-sm text-muted-foreground">
                                Upload a CSV file — you can review and edit every field before importing.
                            </p>
                        </div>

                        {/* Drop zone */}
                        <label className="w-full">
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileInput}
                                disabled={isPreviewing}
                            />
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleDrop}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-200 cursor-pointer select-none',
                                    isPreviewing
                                        ? 'border-primary/40 bg-primary/5 cursor-wait'
                                        : isDragOver
                                            ? 'border-primary bg-primary/8 scale-[1.01] shadow-lg shadow-primary/10'
                                            : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
                                )}
                            >
                                <div className={cn(
                                    'flex items-center justify-center w-16 h-16 rounded-2xl transition-colors',
                                    isDragOver ? 'bg-primary/15' : 'bg-muted'
                                )}>
                                    {isPreviewing
                                        ? <Loader2 size={28} className="text-primary animate-spin" />
                                        : <FileUp size={28} className={isDragOver ? 'text-primary' : 'text-muted-foreground'} />
                                    }
                                </div>
                                <div className="space-y-1.5">
                                    <p className={cn('text-base font-semibold', isDragOver ? 'text-primary' : 'text-foreground')}>
                                        {isPreviewing ? 'Reading CSV…' : isDragOver ? 'Drop to preview' : 'Drag & drop your CSV file'}
                                    </p>
                                    {!isPreviewing && (
                                        <p className="text-sm text-muted-foreground">
                                            or click to <span className="text-primary font-medium">browse files</span>
                                        </p>
                                    )}
                                </div>
                                <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest bg-background/70 px-3 py-1 rounded-full border border-border/50">
                                    .csv only
                                </span>
                            </div>
                        </label>

                        <div className="w-full bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 flex gap-3">
                            <Info size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-emerald-800 leading-relaxed">
                                Don't have a CSV yet? Go back to Plants and click <strong>Import CSV</strong> to copy the AI prompt that generates correctly formatted CSVs.
                            </p>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* STAGE 2: Editable spreadsheet                              */}
                {/* ══════════════════════════════════════════════════════════ */}
                {stage === 'edit' && (
                    <div className="flex-1 flex flex-col gap-4 min-h-0">

                        {/* Parse errors */}
                        {parseErrors.length > 0 && (
                            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                <div className="text-xs text-red-700">
                                    {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
                                </div>
                            </div>
                        )}

                        {/* Info + actions bar */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <FileUp size={14} className="text-primary" />
                                    <span className="font-medium text-foreground truncate max-w-[200px]">{fileName || 'Manual entry'}</span>
                                    <span>·</span>
                                    <span>{rows.filter(r => r.common_name?.trim()).length} plants</span>
                                </div>
                                <button
                                    onClick={() => { setStage('upload'); setParseErrors([]); }}
                                    className="text-xs text-primary hover:underline"
                                >
                                    Re-upload
                                </button>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addRow}
                                    className="gap-1.5 h-8 text-xs"
                                >
                                    <Plus size={13} /> Add Row
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleImport}
                                    disabled={isImporting || parseErrors.length > 0}
                                    className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90"
                                >
                                    {isImporting ? (
                                        <><Loader2 size={13} className="animate-spin" /> Importing…</>
                                    ) : (
                                        <><Upload size={13} /> Confirm Import</>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Spreadsheet */}
                        <div className="flex-1 min-h-0 rounded-xl border border-border overflow-hidden shadow-sm">
                            <div className="overflow-auto h-full max-h-[calc(100vh-18rem)]">
                                <table className="border-collapse text-xs" style={{ width: 'max-content', minWidth: '100%' }}>
                                    <thead className="sticky top-0 z-20 bg-muted shadow-sm">
                                        <tr>
                                            {/* Row number */}
                                            <th className="w-9 min-w-[36px] text-center text-[10px] font-bold text-muted-foreground/60 border-b border-r border-border px-1 py-2 bg-muted sticky left-0 z-30">
                                                #
                                            </th>
                                            {ALL_FIELDS.map(f => (
                                                <th
                                                    key={f.key}
                                                    className="text-left px-2 py-2 border-b border-r border-border font-bold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                                                    style={{ minWidth: f.width }}
                                                >
                                                    {f.label}
                                                    {f.required && <span className="text-red-400 ml-0.5">*</span>}
                                                </th>
                                            ))}
                                            {/* Delete col */}
                                            <th className="w-9 border-b border-border bg-muted" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, rowIdx) => {
                                            const isEmpty = !row.common_name?.trim() && !row.species?.trim();
                                            return (
                                                <tr
                                                    key={rowIdx}
                                                    className={cn(
                                                        'group',
                                                        rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                                                        isEmpty ? 'opacity-50' : ''
                                                    )}
                                                >
                                                    {/* Row num */}
                                                    <td className="text-center text-[10px] text-muted-foreground/40 tabular-nums border-r border-b border-border px-1 sticky left-0 z-10 bg-inherit align-top pt-2">
                                                        {rowIdx + 1}
                                                    </td>
                                                    {ALL_FIELDS.map(f => (
                                                        <td key={f.key} className="border-r border-b border-border p-0 align-top">
                                                            {f.isImage ? (
                                                                <ImageCell
                                                                    url={row[f.key] ?? ''}
                                                                    fieldKey={f.key}
                                                                    rowIdx={rowIdx}
                                                                    onChange={updateCell}
                                                                    onZoom={(url, label) => setLightbox({ url, label })}
                                                                    fieldWidth={f.width}
                                                                />
                                                            ) : (
                                                                <textarea
                                                                    value={row[f.key] ?? ''}
                                                                    onChange={e => updateCell(rowIdx, f.key, e.target.value)}
                                                                    rows={1}
                                                                    className={cn(
                                                                        'w-full h-full min-h-[32px] px-2 py-1.5 text-xs bg-transparent resize-none',
                                                                        'focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-primary/3',
                                                                        'placeholder:text-muted-foreground/30 transition-colors',
                                                                        f.required && !row[f.key]?.trim()
                                                                            ? 'bg-red-50/40'
                                                                            : ''
                                                                    )}
                                                                    style={{ minWidth: f.width, maxHeight: '80px' }}
                                                                    placeholder={f.required ? '(required)' : ''}
                                                                />
                                                            )}
                                                        </td>
                                                    ))}
                                                    {/* Delete */}
                                                    <td className="border-b border-border p-0 text-center align-top pt-1">
                                                        <button
                                                            onClick={() => deleteRow(rowIdx)}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-muted-foreground hover:text-red-500"
                                                            title="Remove row"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer hint */}
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Info size={12} className="text-amber-500 shrink-0" />
                            Blank fields (description, care data, images) will be auto-filled by AI during import.
                            Required fields are marked <span className="text-red-400 font-bold">*</span>.
                        </p>
                    </div>
                )}
            </div>
        </>
    );
};
