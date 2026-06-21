export function readFileAsDataUrl(file: File, errorMessage = "Could not read the uploaded file.") {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(errorMessage));
    reader.readAsDataURL(file);
  });
}

export function loadImageSize(src: string, errorMessage = "Could not read the uploaded image size.") {
  return new Promise<[number, number]>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve([
        Math.max(1, image.naturalWidth || image.width || 256),
        Math.max(1, image.naturalHeight || image.height || 256),
      ]);
    };
    image.onerror = () => reject(new Error(errorMessage));
    image.src = src;
  });
}
