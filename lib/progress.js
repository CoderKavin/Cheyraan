// Progress tracking utility with localStorage persistence

const STORAGE_KEY = "ib_economics_progress";
const HISTORY_KEY = "ib_economics_question_history";

// Get all progress data from localStorage
export function getProgress() {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
}

// Save progress data to localStorage
export function saveProgress(progress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// Get progress for a specific concept
export function getConceptProgress(conceptId) {
  const progress = getProgress();
  return (
    progress[conceptId] || {
      attempts: 0,
      correct: 0,
      confidence: 0,
      lastAttempt: null,
      history: [],
    }
  );
}

// Update progress after answering a question
export function updateConceptProgress(conceptId, isCorrect) {
  const progress = getProgress();
  const conceptProgress = progress[conceptId] || {
    attempts: 0,
    correct: 0,
    confidence: 0,
    lastAttempt: null,
    history: [],
  };

  conceptProgress.attempts += 1;
  if (isCorrect) {
    conceptProgress.correct += 1;
  }

  // Calculate confidence score
  conceptProgress.confidence = Math.round(
    (conceptProgress.correct / conceptProgress.attempts) * 100,
  );

  conceptProgress.lastAttempt = new Date().toISOString();
  conceptProgress.history.push({
    timestamp: conceptProgress.lastAttempt,
    correct: isCorrect,
  });

  // Keep only last 20 attempts in history
  if (conceptProgress.history.length > 20) {
    conceptProgress.history = conceptProgress.history.slice(-20);
  }

  progress[conceptId] = conceptProgress;
  saveProgress(progress);

  return conceptProgress;
}

// Check if a concept is considered "learned"
// Requires >70% confidence with minimum 3 attempts
export function isConceptLearned(conceptId) {
  const progress = getConceptProgress(conceptId);
  return progress.attempts >= 3 && progress.confidence >= 70;
}

// Check if all prerequisites for a concept are met
export function arePrerequisitesMet(concept, concepts) {
  if (!concept.prerequisites || concept.prerequisites.length === 0) {
    return { met: true, missing: [] };
  }

  const missing = [];
  for (const prereqId of concept.prerequisites) {
    if (!isConceptLearned(prereqId)) {
      const prereqConcept = concepts.find((c) => c.id === prereqId);
      if (prereqConcept) {
        missing.push(prereqConcept);
      }
    }
  }

  return {
    met: missing.length === 0,
    missing,
  };
}

// Get the full prerequisite chain for a concept
export function getPrerequisiteChain(concept, concepts, visited = new Set()) {
  if (!concept || visited.has(concept.id)) return [];
  visited.add(concept.id);

  const chain = [];
  if (concept.prerequisites) {
    for (const prereqId of concept.prerequisites) {
      const prereqConcept = concepts.find((c) => c.id === prereqId);
      if (prereqConcept) {
        // Get prerequisites of this prerequisite first (depth-first)
        const subChain = getPrerequisiteChain(prereqConcept, concepts, visited);
        chain.push(...subChain);
        chain.push(prereqConcept);
      }
    }
  }

  return chain;
}

// Get mastery level for display
export function getMasteryLevel(conceptId) {
  const progress = getConceptProgress(conceptId);

  if (progress.attempts === 0) {
    return { level: "not_attempted", label: "Not Attempted", color: "#9ca3af" };
  }

  if (progress.confidence >= 70) {
    return { level: "mastered", label: "Mastered", color: "#22c55e" };
  }

  if (progress.confidence >= 40) {
    return { level: "learning", label: "Learning", color: "#eab308" };
  }

  return { level: "struggling", label: "Needs Practice", color: "#ef4444" };
}

// Find the weakest concept that can be practiced (prerequisites met)
export function findWeakestConcept(concepts) {
  const progress = getProgress();

  // First priority: concepts with attempts but low confidence
  const strugglingConcepts = concepts
    .filter((concept) => {
      const conceptProgress = progress[concept.id];
      if (!conceptProgress || conceptProgress.attempts === 0) return false;
      if (conceptProgress.confidence >= 70) return false;
      return arePrerequisitesMet(concept, concepts).met;
    })
    .sort((a, b) => {
      const aProgress = progress[a.id];
      const bProgress = progress[b.id];
      return aProgress.confidence - bProgress.confidence;
    });

  if (strugglingConcepts.length > 0) {
    return strugglingConcepts[0];
  }

  // Second priority: unattempted concepts with prerequisites met
  const unattempted = concepts
    .filter((concept) => {
      const conceptProgress = progress[concept.id];
      if (conceptProgress && conceptProgress.attempts > 0) return false;
      return arePrerequisitesMet(concept, concepts).met;
    })
    .sort((a, b) => a.difficulty - b.difficulty);

  if (unattempted.length > 0) {
    return unattempted[0];
  }

  // Third priority: any concept with prerequisites met, lowest confidence first
  const available = concepts
    .filter((concept) => arePrerequisitesMet(concept, concepts).met)
    .sort((a, b) => {
      const aProgress = progress[a.id] || { confidence: 0 };
      const bProgress = progress[b.id] || { confidence: 0 };
      return aProgress.confidence - bProgress.confidence;
    });

  return available[0] || null;
}

// Get next recommended concept based on learning path
export function getRecommendedConcept(concepts) {
  const progress = getProgress();

  // Find concepts that are ready to learn (prerequisites met but not mastered)
  const readyToLearn = concepts.filter((concept) => {
    const conceptProgress = progress[concept.id];
    const mastered =
      conceptProgress &&
      conceptProgress.attempts >= 3 &&
      conceptProgress.confidence >= 70;
    if (mastered) return false;
    return arePrerequisitesMet(concept, concepts).met;
  });

  // Sort by: 1) Started but not mastered, 2) Difficulty level
  return readyToLearn.sort((a, b) => {
    const aProgress = progress[a.id] || { attempts: 0, confidence: 0 };
    const bProgress = progress[b.id] || { attempts: 0, confidence: 0 };

    // Prioritize concepts user has started
    if (aProgress.attempts > 0 && bProgress.attempts === 0) return -1;
    if (bProgress.attempts > 0 && aProgress.attempts === 0) return 1;

    // Then by difficulty
    return a.difficulty - b.difficulty;
  })[0];
}

// Get overall progress statistics
export function getOverallStats(concepts) {
  const progress = getProgress();

  let totalAttempts = 0;
  let totalCorrect = 0;
  let conceptsAttempted = 0;
  let conceptsMastered = 0;

  for (const concept of concepts) {
    const conceptProgress = progress[concept.id];
    if (conceptProgress && conceptProgress.attempts > 0) {
      totalAttempts += conceptProgress.attempts;
      totalCorrect += conceptProgress.correct;
      conceptsAttempted += 1;

      if (conceptProgress.attempts >= 3 && conceptProgress.confidence >= 70) {
        conceptsMastered += 1;
      }
    }
  }

  return {
    totalAttempts,
    totalCorrect,
    overallAccuracy:
      totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    conceptsAttempted,
    conceptsMastered,
    totalConcepts: concepts.length,
    progressPercent: Math.round((conceptsMastered / concepts.length) * 100),
  };
}

// Clear all progress (for reset)
export function clearProgress() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_KEY);
}

// ============ QUESTION HISTORY ============

// Get question history
export function getQuestionHistory() {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(HISTORY_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Save question history
function saveQuestionHistory(history) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// Add a question to history
export function addQuestionToHistory(entry) {
  const history = getQuestionHistory();

  const historyEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    conceptId: entry.conceptId,
    conceptName: entry.conceptName,
    question: entry.question,
    options: entry.options,
    studentAnswer: entry.studentAnswer,
    correctAnswer: entry.correctAnswer,
    isCorrect: entry.isCorrect,
    timeTaken: entry.timeTaken || null, // in seconds
    explanation: entry.explanation || null,
    personalizedExplanation: null, // Will be added if user requests it
  };

  history.unshift(historyEntry);

  // Keep only last 10 questions
  if (history.length > 10) {
    history.length = 10;
  }

  saveQuestionHistory(history);
  return historyEntry;
}

// Update a history entry with personalized explanation
export function updateHistoryWithExplanation(
  historyId,
  personalizedExplanation,
) {
  const history = getQuestionHistory();
  const entry = history.find((h) => h.id === historyId);
  if (entry) {
    entry.personalizedExplanation = personalizedExplanation;
    saveQuestionHistory(history);
  }
  return entry;
}

// Get a specific history entry
export function getHistoryEntry(historyId) {
  const history = getQuestionHistory();
  return history.find((h) => h.id === historyId) || null;
}

// ============ LEARNING VELOCITY & STUDY PATH ============

// Calculate learning velocity (concepts mastered per day)
export function getLearningVelocity(concepts) {
  const progress = getProgress();

  // Get all mastery dates
  const masteryDates = [];

  for (const concept of concepts) {
    const conceptProgress = progress[concept.id];
    if (
      conceptProgress &&
      conceptProgress.attempts >= 3 &&
      conceptProgress.confidence >= 70
    ) {
      // Use lastAttempt as approximate mastery date
      if (conceptProgress.lastAttempt) {
        masteryDates.push(new Date(conceptProgress.lastAttempt));
      }
    }
  }

  if (masteryDates.length === 0) {
    return { velocity: 0, daysActive: 0, conceptsPerDay: 0 };
  }

  // Sort dates
  masteryDates.sort((a, b) => a - b);

  const firstDate = masteryDates[0];
  const lastDate = masteryDates[masteryDates.length - 1];
  const daysDiff = Math.max(
    1,
    Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)),
  );

  // Calculate unique active days
  const uniqueDays = new Set(
    masteryDates.map((d) => d.toISOString().split("T")[0]),
  ).size;

  return {
    velocity: Math.round((masteryDates.length / daysDiff) * 100) / 100,
    daysActive: uniqueDays,
    conceptsPerDay: Math.round((masteryDates.length / uniqueDays) * 100) / 100,
    totalMastered: masteryDates.length,
  };
}

// Get study path recommendation based on exam timeline
export function getStudyPath(concepts, daysUntilExam = 30) {
  const progress = getProgress();

  // Get concepts that still need work
  const needsWork = concepts.filter((concept) => {
    const conceptProgress = progress[concept.id];
    const mastered =
      conceptProgress &&
      conceptProgress.attempts >= 3 &&
      conceptProgress.confidence >= 70;
    return !mastered && arePrerequisitesMet(concept, concepts).met;
  });

  // Sort by priority:
  // 1. Started but struggling (urgent)
  // 2. Not started but low difficulty (quick wins)
  // 3. Higher difficulty concepts
  const prioritized = needsWork.sort((a, b) => {
    const aProgress = progress[a.id] || { attempts: 0, confidence: 100 };
    const bProgress = progress[b.id] || { attempts: 0, confidence: 100 };

    // Struggling concepts first
    if (
      aProgress.attempts > 0 &&
      aProgress.confidence < 50 &&
      (bProgress.attempts === 0 || bProgress.confidence >= 50)
    ) {
      return -1;
    }
    if (
      bProgress.attempts > 0 &&
      bProgress.confidence < 50 &&
      (aProgress.attempts === 0 || aProgress.confidence >= 50)
    ) {
      return 1;
    }

    // Then by difficulty (easier first for quick wins)
    return a.difficulty - b.difficulty;
  });

  // Calculate concepts per day needed
  const conceptsPerDay = Math.ceil(
    prioritized.length / Math.max(1, daysUntilExam),
  );

  // Group into daily targets
  const dailyTargets = [];
  for (let i = 0; i < prioritized.length; i += conceptsPerDay) {
    dailyTargets.push(prioritized.slice(i, i + conceptsPerDay));
  }

  return {
    totalRemaining: prioritized.length,
    conceptsPerDay,
    daysNeeded: dailyTargets.length,
    dailyTargets,
    urgentConcepts: prioritized.filter((c) => {
      const p = progress[c.id];
      return p && p.attempts > 0 && p.confidence < 50;
    }),
  };
}

// Build dependency graph for visualization
export function buildDependencyGraph(concepts) {
  const nodes = concepts.map((concept) => {
    const progress = getConceptProgress(concept.id);
    const mastery = getMasteryLevel(concept.id);
    return {
      id: concept.id,
      name: concept.name,
      unit: concept.unit,
      difficulty: concept.difficulty,
      mastery: mastery.level,
      color: mastery.color,
      confidence: progress.confidence,
      attempts: progress.attempts,
    };
  });

  const edges = [];
  for (const concept of concepts) {
    if (concept.prerequisites) {
      for (const prereqId of concept.prerequisites) {
        edges.push({
          from: prereqId,
          to: concept.id,
        });
      }
    }
  }

  return { nodes, edges };
}

// Get concepts by mastery status grouped by unit
export function getConceptsByMasteryStatus(concepts) {
  const progress = getProgress();

  const result = {
    mastered: [],
    learning: [],
    struggling: [],
    notStarted: [],
  };

  for (const concept of concepts) {
    const conceptProgress = progress[concept.id];

    if (!conceptProgress || conceptProgress.attempts === 0) {
      result.notStarted.push(concept);
    } else if (
      conceptProgress.attempts >= 3 &&
      conceptProgress.confidence >= 70
    ) {
      result.mastered.push(concept);
    } else if (conceptProgress.confidence >= 40) {
      result.learning.push(concept);
    } else {
      result.struggling.push(concept);
    }
  }

  return result;
}
