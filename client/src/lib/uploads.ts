export async function uploadFileToPresignedUrl(url: string, file: File) {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error("File upload failed.")
  }
}
