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
            responseType: 'blob'
        });

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        let filename = projectName ? `${projectName}.pdf` : `project_report_${projectId}.pdf`;

        // try to get from headers
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch.length === 2) {
                filename = filenameMatch[1];
            }
        }

        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
    }
};
