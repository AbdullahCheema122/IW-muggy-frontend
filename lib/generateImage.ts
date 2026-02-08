export async function generateLearningImage(prompt: string) {
  const res = await fetch("/api/images/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      aspect: "16:9",
    }),
  });

  if (!res.ok) {
    throw new Error("Image generation failed");
  }

  const data = await res.json();
  return data.imageUrl as string;
}
