import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Render a single DOM element to a canvas.
 */
async function elementToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
    const prev = {
        position: el.style.position,
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        visibility: el.style.visibility,
        zIndex: el.style.zIndex,
    };

    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '794px';   // A4 at 96 dpi
    el.style.visibility = 'visible';
    el.style.zIndex = '-9999';

    try {
        return await html2canvas(el, {
            scale: 2.5,
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
        el.style.visibility = prev.visibility;
        el.style.zIndex = prev.zIndex;
    }
}

/**
 * Add canvas image to current PDF page, splitting across multiple pages if the canvas is tall.
 * Returns the number of pages added (always ≥ 1).
 */
function addCanvasToPdf(
    pdf: jsPDF,
    canvas: HTMLCanvasElement,
    addNewPageFirst: boolean
): number {
    const PAGE_W_MM = 210;
    const PAGE_H_MM = 297;

    const imgW_px = canvas.width;
    const imgH_px = canvas.height;

    const imgW_mm = PAGE_W_MM;
    const imgH_mm = (imgH_px / imgW_px) * imgW_mm;

    const pagesNeeded = Math.ceil(imgH_mm / PAGE_H_MM);

    for (let i = 0; i < pagesNeeded; i++) {
        if (addNewPageFirst || i > 0) {
            pdf.addPage();
        }

        // Slice the canvas vertically for this page
        const sliceStart_px = Math.round((i * PAGE_H_MM) / imgH_mm * imgH_px);
        const sliceH_px = Math.round(Math.min(PAGE_H_MM / imgH_mm * imgH_px, imgH_px - sliceStart_px));

        const slice = document.createElement('canvas');
        slice.width = imgW_px;
        slice.height = sliceH_px;
        slice.getContext('2d')!.drawImage(
            canvas,
            0, sliceStart_px, imgW_px, sliceH_px,
            0, 0, imgW_px, sliceH_px
        );

        const sliceH_mm = (sliceH_px / imgW_px) * imgW_mm;
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W_MM, sliceH_mm);
    }

    return pagesNeeded;
}

/**
 * Export the project to a PDF.
 *
 * @param coverElementId   ID of the cover/inventory page element
 * @param plantElementIds  Array of {elementId, plantId} for each plant detail page (in order)
 * @param plantRowMeta     Array of {plantId, rowIndex, totalRows} for link placement on cover page
 * @param filename         Filename without .pdf
 */
export async function exportProjectPdf(
    coverElementId: string,
    plantElementIds: Array<{ elementId: string; plantId: string }>,
    filename: string
) {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ── Render cover page ────────────────────────────────────────────────────
    const coverEl = document.getElementById(coverElementId);
    if (!coverEl) throw new Error(`#${coverElementId} not found`);
    const coverCanvas = await elementToCanvas(coverEl);
    const coverPages = addCanvasToPdf(pdf, coverCanvas, false);

    // Page number where each plant detail starts (1-indexed)
    const plantPageNumbers: Record<string, number> = {};
    let currentPage = coverPages + 1;

    // ── Render each plant page ───────────────────────────────────────────────
    for (const { elementId, plantId } of plantElementIds) {
        const el = document.getElementById(elementId);
        if (!el) continue;

        plantPageNumbers[plantId] = currentPage;
        const canvas = await elementToCanvas(el);
        const pagesAdded = addCanvasToPdf(pdf, canvas, true);
        currentPage += pagesAdded;
    }

    // ── Add internal PDF links on the cover page ─────────────────────────────
    // Each plant row link is stored as a data attribute in the DOM
    // We read them and add jsPDF annotations.
    const linkEls = coverEl.querySelectorAll<HTMLElement>('[data-plant-id]');
    linkEls.forEach((linkEl) => {
        const plantId = linkEl.getAttribute('data-plant-id');
        const targetPage = plantId ? plantPageNumbers[plantId] : undefined;
        if (!targetPage) return;

        // Get approximate bounding box of the row relative to the cover element
        const coverRect = coverEl.getBoundingClientRect();
        const rowRect = linkEl.getBoundingClientRect();

        // Convert pixel offsets to mm (cover element is 794px wide = 210mm)
        const scale = 210 / coverEl.offsetWidth;

        const x_mm = (rowRect.left - coverRect.left) * scale;
        const y_mm = (rowRect.top - coverRect.top) * scale;
        const w_mm = rowRect.width * scale;
        const h_mm = rowRect.height * scale;

        // Add on cover page(s) — only page 1 typically
        pdf.setPage(1);
        pdf.link(x_mm, y_mm, w_mm, h_mm, { pageNumber: targetPage });
    });

    pdf.save(`${filename}.pdf`);
}
