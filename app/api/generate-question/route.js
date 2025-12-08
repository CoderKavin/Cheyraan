import { NextResponse } from "next/server";
import { generateQuestion } from "@/lib/gemini";

export async function POST(request) {
  try {
    const { concept, userPerformance, learnedConcepts } = await request.json();

    if (!concept) {
      return NextResponse.json(
        { error: "Concept is required" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const question = await generateQuestion(
      concept,
      userPerformance || null,
      learnedConcepts || [],
    );

    return NextResponse.json(question);
  } catch (error) {
    console.error("Error generating question:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate question" },
      { status: 500 },
    );
  }
}
