import { NextResponse } from "next/server";
import { geminiModel } from "@/lib/gemini";

export async function POST(request) {
  try {
    const { concept, question, studentAnswer, correctAnswer, options } =
      await request.json();

    if (!concept || !question || !studentAnswer || !correctAnswer) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const studentAnswerText = options?.[studentAnswer] || studentAnswer;
    const correctAnswerText = options?.[correctAnswer] || correctAnswer;

    const prompt = `You are an experienced IB Economics HL teacher providing personalized feedback to a student who answered a question incorrectly.

CONCEPT: ${concept.name}
UNIT: ${concept.unit}
CONCEPT DESCRIPTION: ${concept.description}
COMMON MISCONCEPTIONS: ${concept.common_misconceptions?.join("; ") || "None listed"}

QUESTION: ${question}

STUDENT'S ANSWER: ${studentAnswer}. ${studentAnswerText}

CORRECT ANSWER: ${correctAnswer}. ${correctAnswerText}

Provide a personalized explanation that helps this specific student understand their error. Be empathetic but direct.

Return ONLY valid JSON in this exact format:
{
  "likelyReasoning": "A 2-3 sentence explanation of why the student probably chose their answer. Be specific about what logic or partial understanding led them there.",
  "misconception": "Identify the specific misconception or knowledge gap this error reveals. Reference common IB Economics mistakes if applicable.",
  "correctExplanation": "A clear, step-by-step explanation of the correct reasoning. Use the economic concept name and theory. Reference relevant diagrams if applicable.",
  "keyInsight": "One memorable sentence that captures the core distinction the student needs to remember.",
  "practiceAdvice": "One specific, actionable tip for practicing this concept. Be concrete - suggest a specific type of question or scenario to work through."
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

    let explanation;
    try {
      explanation = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Received text:", cleanedText);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 },
      );
    }

    // Validate required fields
    if (
      !explanation.likelyReasoning ||
      !explanation.misconception ||
      !explanation.correctExplanation
    ) {
      return NextResponse.json(
        { error: "Invalid response structure from AI. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json(explanation);
  } catch (error) {
    console.error("Error generating explanation:", error);

    // Handle rate limiting
    if (error.status === 429) {
      return NextResponse.json(
        {
          error: "API rate limit reached. Please wait a moment and try again.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to generate explanation" },
      { status: 500 },
    );
  }
}
