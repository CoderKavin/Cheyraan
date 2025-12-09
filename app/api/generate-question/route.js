import { NextResponse } from "next/server";
import { generateQuestion } from "@/lib/grok";

export async function POST(request) {
  try {
    const { concept, userPerformance, learnedConcepts } = await request.json();

    if (!concept) {
      return NextResponse.json(
        { error: "Concept is required" },
        { status: 400 },
      );
    }

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: "GROK_API_KEY is not configured" },
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

    if (
      error.status === 429 ||
      error.message?.includes("429") ||
      error.message?.includes("rate")
    ) {
      return NextResponse.json(
        {
          error: "API rate limit reached. Please wait a moment and try again.",
        },
        { status: 429 },
      );
    }

    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      return NextResponse.json(
        { error: "Unable to connect to AI service. Please try again." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to generate question" },
      { status: 500 },
    );
  }
}
