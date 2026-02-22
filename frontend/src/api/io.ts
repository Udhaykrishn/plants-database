import { client } from "./client";

export const ioApi = {
    importCsv: async (file: File): Promise<any> => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await client.post("/import/csv", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    },

    exportProjectPdf: async (projectId: string, projectName?: string): Promise<void> => {
        const response = await client.get(`/export/pdf/project/${projectId}`, {
            responseType: 'blob',
        });

        // Build a proper PDF blob with explicit MIME type
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);

        // Determine filename — prefer the passed project name, fall back to header
        let filename = projectName
            ? `${projectName.replace(/[\\/*?:"<>|]/g, '')}.pdf`
            : `project_report_${projectId}.pdf`;

        // Try reading Content-Disposition header as secondary fallback
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
            // Handle both filename="foo" and filename=foo (with or without quotes)
            const match = contentDisposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
            if (match?.[1]) {
                try {
                    // decode URI-encoded filenames (RFC 5987)
                    filename = decodeURIComponent(match[1].trim().replace(/"/g, ''));
                } catch {
                    filename = match[1].trim().replace(/"/g, '');
                }
            }
        }

        // Trigger download
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();

        // Cleanup
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
    },
};
