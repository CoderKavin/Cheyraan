import { NextResponse } from "next/server";
import { geminiModel } from "@/lib/gemini";

export async function POST(request) {
  try {
    const { concept, userPerformance } = await request.json();

    if (!concept) {
      return NextResponse.json(
        { error: "Concept is required" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    let performanceContext = "";
    if (userPerformance && userPerformance.attempts > 0) {
      if (userPerformance.confidence < 40) {
        performanceContext = `The student is struggling with this concept (${userPerformance.confidence}% accuracy). Focus on foundational understanding and clear definitions.`;
      } else if (userPerformance.confidence < 70) {
        performanceContext = `The student has partial understanding (${userPerformance.confidence}% accuracy). Focus on clarifying common points of confusion.`;
      } else {
        performanceContext = `The student has good understanding (${userPerformance.confidence}% accuracy). Provide advanced insights and exam tips.`;
      }
    }

    const prompt = `You are an expert IB Economics HL teacher creating a focused mini-lesson for a student reviewing this concept.

CONCEPT: ${concept.name}
UNIT: ${concept.unit}
DESCRIPTION: ${concept.description}
DIFFICULTY LEVEL: ${concept.difficulty}/5
IB COMMAND TERMS: ${concept.ib_command_terms?.join(", ") || "Various"}
KEY DIAGRAMS: ${concept.key_diagrams?.join(", ") || "None specified"}
COMMON MISCONCEPTIONS: ${concept.common_misconceptions?.join("; ") || "None listed"}

${performanceContext}

Create a concise but comprehensive review that would help a student master this concept for the IB exam.

Return ONLY valid JSON in this exact format:
{
  "definition": "A clear, exam-ready definition of the concept in 1-2 sentences. Use precise economic terminology.",
  "keyPoints": [
    "First essential point the student must understand",
    "Second essential point with specific detail",
    "Third essential point connecting to broader economics"
  ],
  "diagramExplanation": "If diagrams are relevant, explain what the key diagram shows and how to draw/label it correctly. If no diagram is central to this concept, provide a brief note on how it connects to other concepts visually.",
  "commonMistakes": [
    "First common exam mistake and how to avoid it",
    "Second common mistake with correction"
  ],
  "examTips": [
    "Specific tip for answering IB exam questions on this topic",
    "Second tip focusing on command term usage or diagram requirements"
  ],
  "realWorldExample": "A brief, current real-world example that illustrates this concept clearly."
}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.slice(7);
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith("```")) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    const review = JSON.parse(cleanedText);
    return NextResponse.json(review);
  } catch (error) {
    console.error("Error generating review:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate review" },
      { status: 500 }
    );
  }
}
