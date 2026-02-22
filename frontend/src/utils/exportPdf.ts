import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const SCALE = 2.5;

/** Make a hidden element visible temporarily, render to canvas at fixed A4 width. */
async function elementToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
    const prev = {
        position: el.style.position,
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        visibility: el.style.visibility,
        zIndex: el.style.zIndex,
    };

    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '794px';
    el.style.height = prev.height || '';   // keep explicit height if set
    el.style.visibility = 'visible';
    el.style.zIndex = '9999';

    try {
        return await html2canvas(el, {
            scale: SCALE,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#f4f0ea',
            logging: false,
            windowWidth: 794,
        });
    } finally {
        el.style.position = prev.position;
        el.style.left = prev.left;
        el.style.top = prev.top;
        el.style.width = prev.width;
        el.style.height = prev.height;
        el.style.visibility = prev.visibility;
        el.style.zIndex = prev.zIndex;
    }
}

/**
 * Add a canvas to the PDF as a SINGLE page.
 * - Canvas is placed at full A4 width.
 * - If canvas aspect ratio matches A4 exactly (plant pages with fixed height) → fills page perfectly.
 * - If canvas is shorter → placed at top; page background fills the rest.
 * - If canvas is taller → scaled DOWN proportionally to fit A4 height.
 * No stretching, no distortion.
 */
function addAsSinglePage(
    pdf: jsPDF,
    canvas: HTMLCanvasElement,
    addNewPage: boolean,
): void {
    if (addNewPage) pdf.addPage();

    const naturalH_mm = (canvas.height / canvas.width) * PAGE_W_MM;

    if (naturalH_mm <= PAGE_H_MM + 1) {
        // Fits in one page — place at top, proportional
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG',
            0, 0, PAGE_W_MM, naturalH_mm);
    } else {
        // Too tall — scale DOWN so height = PAGE_H_MM, maintain aspect
        const scaledW_mm = PAGE_W_MM * (PAGE_H_MM / naturalH_mm);
        const xOffset = (PAGE_W_MM - scaledW_mm) / 2;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG',
            xOffset, 0, scaledW_mm, PAGE_H_MM);
    }
}

/**
 * Add a (potentially tall) cover canvas, slicing into multiple A4 pages.
 */
function addAsMultiPage(
    pdf: jsPDF,
    canvas: HTMLCanvasElement,
    addNewPageFirst: boolean,
): number {
    const imgH_mm = (canvas.height / canvas.width) * PAGE_W_MM;
    const pages = Math.ceil(imgH_mm / PAGE_H_MM);

    for (let i = 0; i < pages; i++) {
        if (addNewPageFirst || i > 0) pdf.addPage();

        const sliceStart_px = Math.round((i * PAGE_H_MM / imgH_mm) * canvas.height);
        const sliceH_px = Math.round(
            Math.min((PAGE_H_MM / imgH_mm) * canvas.height, canvas.height - sliceStart_px)
        );

        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceH_px;
        slice.getContext('2d')!.drawImage(
            canvas, 0, sliceStart_px, canvas.width, sliceH_px,
            0, 0, canvas.width, sliceH_px
        );

        pdf.addImage(slice.toDataURL('image/jpeg', 0.93), 'JPEG',
            0, 0, PAGE_W_MM, (sliceH_px / canvas.width) * PAGE_W_MM);
    }
    return pages;
}

/**
 * Main export entry point.
 */
export async function exportProjectPdf(
    coverElementId: string,
    plantElementIds: Array<{ elementId: string; plantId: string }>,
    filename: string,
): Promise<void> {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ── Cover (multi-page) ───────────────────────────────────────────────────
    const coverEl = document.getElementById(coverElementId);
    if (!coverEl) throw new Error(`#${coverElementId} not found`);

    const coverCanvas = await elementToCanvas(coverEl);
    const coverPages = addAsMultiPage(pdf, coverCanvas, false);

    // ── Plant detail pages (each exactly one A4 page) ────────────────────────
    const plantPageMap: Record<string, number> = {};
    let currentPage = coverPages + 1;

    for (const { elementId, plantId } of plantElementIds) {
        const el = document.getElementById(elementId);
        if (!el) continue;

        plantPageMap[plantId] = currentPage;
        const canvas = await elementToCanvas(el);
        addAsSinglePage(pdf, canvas, true);
        currentPage += 1;
    }

    // ── Internal PDF links on cover page ─────────────────────────────────────
    const coverRect = coverEl.getBoundingClientRect();
    const mmPerPx = PAGE_W_MM / coverEl.offsetWidth;

    coverEl.querySelectorAll<HTMLElement>('[data-plant-id]').forEach((linkEl) => {
        const targetPage = plantPageMap[linkEl.getAttribute('data-plant-id') ?? ''];
        if (!targetPage) return;

        const r = linkEl.getBoundingClientRect();
        pdf.setPage(1);
        pdf.link(
            (r.left - coverRect.left) * mmPerPx,
            (r.top - coverRect.top) * mmPerPx,
            r.width * mmPerPx,
            r.height * mmPerPx,
            { pageNumber: targetPage },
        );
    });

    pdf.save(`${filename}.pdf`);
}
