import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
  },
});

export async function generateQuestion(
  concept,
  userPerformance = null,
  learnedConcepts = [],
) {
  // Determine adaptive difficulty based on user performance
  let adaptiveDifficulty = concept.difficulty;
  let performanceContext = "";

  if (userPerformance) {
    const { confidence, attempts } = userPerformance;

    if (attempts >= 3) {
      if (confidence >= 80) {
        // User is doing well - increase difficulty slightly
        adaptiveDifficulty = Math.min(5, concept.difficulty + 1);
        performanceContext = `The student has shown strong understanding (${confidence}% accuracy over ${attempts} attempts). Generate a MORE CHALLENGING question that tests deeper application and analysis.`;
      } else if (confidence >= 60) {
        // User is progressing - maintain difficulty
        performanceContext = `The student is progressing (${confidence}% accuracy over ${attempts} attempts). Generate a question at the standard difficulty level.`;
      } else if (confidence >= 40) {
        // User is struggling - slightly easier
        adaptiveDifficulty = Math.max(1, concept.difficulty - 1);
        performanceContext = `The student is finding this challenging (${confidence}% accuracy over ${attempts} attempts). Generate a question that reinforces core concepts before testing application.`;
      } else {
        // User needs foundational help
        adaptiveDifficulty = Math.max(1, concept.difficulty - 2);
        performanceContext = `The student needs more foundational practice (${confidence}% accuracy over ${attempts} attempts). Generate a straightforward question focusing on basic understanding and definitions.`;
      }
    }
  }

  // Build context about what concepts the user has learned
  let learnedContext = "";
  if (learnedConcepts.length > 0) {
    learnedContext = `
The student has demonstrated mastery of these related concepts: ${learnedConcepts.join(", ")}.
You can reference these concepts in the question as the student understands them.
DO NOT require knowledge of concepts NOT in this list.`;
  }

  const prompt = `You are an IB Economics HL exam question writer. Generate a realistic IB-style multiple choice question for the following concept:

Concept: ${concept.name}
Unit: ${concept.unit}
Description: ${concept.description}
Base Difficulty Level: ${concept.difficulty}/5
Adapted Difficulty Level: ${adaptiveDifficulty}/5
Relevant IB Command Terms: ${concept.ib_command_terms.join(", ")}
Common Misconceptions to Test: ${concept.common_misconceptions.join("; ")}
${concept.key_diagrams && concept.key_diagrams.length > 0 ? `Key Diagrams: ${concept.key_diagrams.join(", ")}` : ""}

${performanceContext}
${learnedContext}

Requirements:
1. Create a scenario-based question typical of IB Economics HL Paper 1
2. Match the question difficulty to the Adapted Difficulty Level:
   - Level 1-2: Focus on definitions, basic concepts, and direct application
   - Level 3: Include analysis and comparison between concepts
   - Level 4-5: Require evaluation, synthesis, and complex scenario analysis
3. Use appropriate IB command terms naturally in the question
4. Include 4 distinct, plausible answer options (A, B, C, D)
5. One option should be clearly correct based on economic theory
6. Distractors should reflect common misconceptions or partial understanding
7. Provide a clear explanation referencing relevant economic theory and diagrams
8. If appropriate, reference real-world scenarios or current economic events

Return ONLY valid JSON in this exact format, no markdown or additional text:
{
  "question": "The full question text with scenario",
  "options": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option",
    "D": "Fourth option"
  },
  "correct": "A",
  "explanation": "Detailed explanation of why the correct answer is right and why others are wrong, referencing economic theory",
  "adaptedDifficulty": ${adaptiveDifficulty}
}`;

  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Clean up the response - remove markdown code blocks if present
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

  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Failed to parse Gemini response:", cleanedText);
    throw new Error("Failed to parse question from Gemini response");
  }
}
