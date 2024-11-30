export const getImageBinary = (bytes: ArrayBuffer): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        try {
            const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(blob);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Invalid image"));
            };

            img.src = url;
        } catch (e) {
            reject(e);
        }
    });
};


export default getImageBinary;